/**
 * LinkedIn's free account has run out of custom connection notes for the month
 * (2026-10-28). Outbound becomes three steps: a comment on something the person
 * wrote, a plain connection request with no note, then the finding as a message
 * once they accept. OB-02 already has this shape.
 *
 *   npx tsx --env-file=.env.local scripts/restructure-outbound-2026-10-28.ts [--dry]
 *
 * For each open prospect:
 *   RQ-xx  the plain request. Waiting on a comment first: none is drafted yet,
 *          and a noteless request from a stranger who never engaged is the
 *          weakest approach there is.
 *   OB-xx  the finding as a message, waiting until they accept RQ-xx.
 */

const MAX = 200

interface Prospect {
  ob: string
  rq: string
  name: string
  target: string
  message: string
}

const prospects: Prospect[] = [
  {
    ob: 'OB-03',
    rq: 'RQ-03',
    name: 'Owen Osztotis',
    target: 'Owen Osztotis, Managing Director, Passion Digital (passion.digital)',
    message: "Owen, Claude's search crawler gets a 403 from passion.digital while OpenAI's and Perplexity's get the page. robots.txt allows all three. It fires on claudebot@anthropic.com in the user agent.",
  },
  {
    ob: 'OB-05',
    rq: 'RQ-05',
    name: 'Joel Stone',
    target: 'Joel Stone, Founder and MD, Codebreak (codebreak.co.uk)',
    message: "Joel, I ran codebreak.co.uk as OpenAI's, Anthropic's and Perplexity's search crawlers on 27 Oct. All three got the full page and robots.txt agrees. Free check if useful: bylineseo.com/geo-analyzer",
  },
  {
    ob: 'OB-06',
    rq: 'RQ-06',
    name: 'Dan Sharp',
    target: 'Dan Sharp, Director and co-founder, Screaming Frog (screamingfrog.co.uk)',
    message: 'Dan, every AI crawler I probe gets screamingfrog.co.uk in full. One small thing: the homepage JSON-LD still says dateModified 2024-06-26. View source and search for it.',
  },
  {
    ob: 'OB-07',
    rq: 'RQ-07',
    name: 'Tom Shurville',
    target: 'Tom Shurville, Managing Director, Distinctly (distinctly.co)',
    message: "Tom, I checked distinctly.co as each AI search crawler on 27 Oct. OpenAI's, Anthropic's and Perplexity's all got the full homepage, and robots.txt says the same. Nothing to chase there.",
  },
]

async function main() {
  let bad = 0
  for (const p of prospects) {
    const n = p.message.length
    console.log(`${p.ob} message ${n}/${MAX}${n > MAX ? '  OVER' : ''}`)
    if (n > MAX || /—|–|!/.test(p.message)) bad++
  }
  if (bad) throw new Error('length or punctuation problem; nothing written')
  if (process.argv.includes('--dry')) return

  const { createServiceClient } = await import('../src/lib/supabase/service')
  const db = createServiceClient()
  const now = new Date().toISOString()

  for (const p of prospects) {
    const { data: ob, error: e0 } = await db.from('outreach_queue').select('*').eq('id', p.ob).single()
    if (e0) throw new Error(`${p.ob}: ${e0.message}`)
    if (!['pending', 'blocked'].includes(ob.status)) {
      console.log(`${p.ob} is ${ob.status}; left alone`)
      continue
    }

    // Step 2: the plain request.
    const { error: e1 } = await db.from('outreach_queue').upsert(
      {
        id: p.rq,
        type: 'outbound message',
        account: ob.account,
        platform: 'LinkedIn',
        target: p.target,
        parts: [{ label: 'text', text: `Connection request to ${p.name}. No note: send it plain.`, part: null, alt: null, statedChars: null }],
        warning: 'No note. The free account has used its custom notes for the month, and the finding goes in the message after he accepts.',
        note: `Step 2 of 3. Step 1 is a comment on something ${p.name} has written; none is drafted yet. Step 3 is ${p.ob}.`,
        rests_on: ob.rests_on,
        engine: ob.engine,
        status: 'blocked',
        blocked_reason: `Comment on something ${p.name} has written first, then send this request with no note. No comment drafted yet.`,
        blocked_at: now,
        priority: ob.priority,
        after_ids: ob.after_ids ?? [],
        due_date: ob.due_date,
        needs_rerun: false,
        sort_order: ob.sort_order,
        created_at: now,
        updated_at: now,
      },
      { onConflict: 'id', ignoreDuplicates: true },
    )
    if (e1) throw new Error(`${p.rq}: ${e1.message}`)

    // Step 3: the finding, held until he accepts.
    const warning = [
      `Send only after ${p.name} accepts ${p.rq}.`,
      ob.warning?.replace(/Send the connection note first; the message only after he accepts\.\s*/i, '') ?? '',
    ].join(' ').trim()
    const { error: e2 } = await db
      .from('outreach_queue')
      .update({
        parts: [{ label: 'text, message after he accepts', text: p.message, part: null, alt: 'message after he accepts', statedChars: p.message.length }],
        warning,
        note: `Step 3 of 3 (comment, then ${p.rq}, then this). ${ob.note ?? ''}`.trim(),
        status: 'blocked',
        blocked_reason: `Waiting for ${p.name} to accept the connection request (${p.rq}).`,
        blocked_at: now,
        after_ids: [...new Set([...(ob.after_ids ?? []), p.rq])],
        updated_at: now,
      })
      .eq('id', p.ob)
    if (e2) throw new Error(`${p.ob}: ${e2.message}`)
    console.log(`${p.ob} -> ${p.rq} (request) + ${p.ob} (message), both waiting`)
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
