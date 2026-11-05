/**
 * Put the scheduled engagement brief's drafted comments into the action queue.
 *
 *   npx tsx --env-file=.env.local scripts/add-comments.ts <comments.json> [--dry]
 *
 * Input: a JSON array of
 *   { name, company, platform: "LinkedIn" | "X", postUrl, postDate (YYYY-MM-DD),
 *     postSummary, comment, restsOn, warning?, rq? }
 *
 * Each becomes a pending comment item (CM-nn, next free number). A comment is
 * only worth posting while the post is fresh, so it closes three days after the
 * post went up, and anything older than five days is refused. When the person
 * has a plain connection request waiting on a comment (rq), that request is
 * released: back to pending, to surface once the comment is marked done.
 * Never posts anything anywhere.
 */
import { readFileSync } from 'node:fs'

interface Draft {
  name: string
  company: string
  platform: 'LinkedIn' | 'X'
  postUrl: string
  postDate: string
  postSummary: string
  comment: string
  restsOn: string
  warning?: string | null
  rq?: string | null
}

const DAY = 86_400_000
const MAX_POST_AGE_DAYS = 5
const OPEN_DAYS = 3

function problems(d: Draft, today: Date): string[] {
  const out: string[] = []
  if (!d.name || !d.comment || !d.postUrl || !/^\d{4}-\d{2}-\d{2}$/.test(d.postDate ?? '')) out.push('missing name, comment, postUrl or postDate')
  if (/—|–/.test(d.comment)) out.push('em or en dash')
  if (/!/.test(d.comment)) out.push('exclamation mark')
  if (d.platform === 'X' && d.comment.length > 280) out.push(`X reply is ${d.comment.length} characters`)
  const age = Math.floor((today.getTime() - Date.parse(`${d.postDate}T00:00:00Z`)) / DAY)
  if (age > MAX_POST_AGE_DAYS) out.push(`post is ${age} days old`)
  return out
}

async function main() {
  const [file] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  if (!file) throw new Error('Usage: add-comments.ts <comments.json> [--dry]')
  const drafts = JSON.parse(readFileSync(file, 'utf8')) as Draft[]
  const today = new Date()

  const ok: Draft[] = []
  for (const d of drafts) {
    const p = problems(d, today)
    if (p.length) console.log(`SKIPPED ${d.name}: ${p.join('; ')}`)
    else ok.push(d)
  }
  if (process.argv.includes('--dry') || !ok.length) {
    console.log(`${ok.length} of ${drafts.length} would be added`)
    return
  }

  const { createServiceClient } = await import('../src/lib/supabase/service')
  const db = createServiceClient()
  const { data: ids, error: e0 } = await db.from('outreach_queue').select('id').like('id', 'CM-%')
  if (e0) throw new Error(e0.message)
  let next = Math.max(0, ...(ids ?? []).map((r) => Number(r.id.slice(3)) || 0)) + 1
  const now = today.toISOString()

  for (const d of ok) {
    const id = `CM-${String(next++).padStart(2, '0')}`
    const closes = new Date(Date.parse(`${d.postDate}T00:00:00Z`) + OPEN_DAYS * DAY).toISOString().slice(0, 10)
    const { error } = await db.from('outreach_queue').insert({
      id,
      type: 'comment',
      account: 'Founder, Michael Jacobs',
      platform: d.platform,
      target: `${d.name}, ${d.company}, on ${d.postSummary}, published ${d.postDate}`,
      parts: [{ label: 'text', text: d.comment, part: null, alt: null, statedChars: d.comment.length }],
      warning: [d.warning, `Open the post first and check it is still up: ${d.postUrl}`].filter(Boolean).join(' '),
      note: d.rq ? `Step 1 of 3 for ${d.name}: once this is done, ${d.rq} (the plain connection request) comes up.` : null,
      rests_on: d.restsOn,
      engine: 'n/a',
      status: 'pending',
      closes_on: closes,
      priority: d.rq ? 1 : 2,
      after_ids: [],
      needs_rerun: false,
      created_at: now,
      updated_at: now,
    })
    if (error) throw new Error(`${id}: ${error.message}`)
    console.log(`${id} ${d.name} (${d.platform}), closes ${closes}`)

    if (d.rq) {
      const { data: rq } = await db.from('outreach_queue').select('status, after_ids').eq('id', d.rq).single()
      if (rq?.status === 'blocked') {
        const { error: e2 } = await db
          .from('outreach_queue')
          .update({ status: 'pending', blocked_reason: null, blocked_at: null, after_ids: [...new Set([...(rq.after_ids ?? []), id])], updated_at: now })
          .eq('id', d.rq)
        if (e2) throw new Error(`${d.rq}: ${e2.message}`)
        console.log(`  ${d.rq} released: comes up once ${id} is done`)
      }
    }
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
