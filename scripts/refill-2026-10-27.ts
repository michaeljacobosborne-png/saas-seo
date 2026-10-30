/**
 * Queue refill, 27 October 2026, written under the byline-outreach-and-social
 * skill. Inserts only ids not already present.
 *
 *   npx tsx --env-file=.env.local scripts/refill-2026-10-27.ts [--dry]
 *
 * Every outreach finding was re-run on engine 2026.13 on 27 Oct before writing.
 */
import { xLength } from '../src/lib/outreach-queue/parse'

const FOUNDER = 'Founder, Michael Jacobs'
const BRAND = 'Brand, Byline'
const SEMRUSH = 'https://www.semrush.com/blog/how-fast-do-ai-search-platforms-cite-new-content/'
const CRAWLER_POST = 'https://app.bylineseo.com/blog/which-ai-crawlers-your-site-actually-serves'
const VISIBILITY_POST = 'https://app.bylineseo.com/blog/one-ai-visibility-score-cannot-be-true'

type Part = { label: string; text: string; part: string | null; alt: string | null }
const one = (text: string): Part[] => [{ label: 'text', text, part: null, alt: null }]
const thread = (...texts: string[]): Part[] =>
  texts.map((text, i) => ({ label: `text ${i + 1}/${texts.length}`, text, part: `${i + 1}/${texts.length}`, alt: null }))
const noteThenDm = (note: string, dm: string): Part[] => [
  { label: 'text, connection note version', text: note, part: null, alt: 'connection note, send first' },
  { label: 'text, message after he accepts', text: dm, part: null, alt: 'message after he accepts' },
]

interface New {
  id: string
  type: 'social post' | 'outbound message'
  account: string
  platform: 'LinkedIn' | 'X' | 'Facebook'
  target: string
  parts: Part[]
  warning: string | null
  note: string
  rests_on: string
  engine: string
  priority: number
  after_ids?: string[]
  due_date?: string
}

const items: New[] = [
  // ── Outbound: the Anthropic crawler finding ────────────────────────────────
  {
    id: 'OB-03',
    type: 'outbound message',
    account: FOUNDER,
    platform: 'LinkedIn',
    target: 'Owen Osztotis, Managing Director, Passion Digital (passion.digital)',
    parts: noteThenDm(
      'Owen, I run crawler access checks on agency sites. One result on passion.digital looks like a server rule nobody meant to leave on, and it touches LLM tracking. Happy to share. Michael',
      "Owen, Claude's search crawler gets a 403 from passion.digital while OpenAI's and Perplexity's get the page. robots.txt allows all three. It fires on claudebot@anthropic.com in the user agent.",
    ),
    warning:
      'Send the connection note first; the message only after he accepts. Not in the same week as ClickSlice (OB-02), so held until 2 Nov. Post F-L10 (the same pattern, sites unnamed) goes out first. Re-run the curl check on the day: it returned 403 to Claude-SearchBot and 200 to OAI-SearchBot on 27 Oct.',
    note:
      'Finding type 1. Passion advertises LLM Performance Tracking, which is why this lands. Suzannah Simpson (Head of Organic Search) is the second contact; not the same week. Do not quote the 77 score or the Citable band.',
    rests_on: 'byline-audits/passion.digital/2026-10-27_052030Z_home_geo.md (engine 2026.13, both request shapes agree); byline-prospect-findings-2026-10-14.md',
    engine: '2026.13',
    priority: 2,
    after_ids: ['F-L10'],
    due_date: '2026-11-02',
  },
  // ── Outbound: clean results ────────────────────────────────────────────────
  {
    id: 'OB-04',
    type: 'outbound message',
    account: FOUNDER,
    platform: 'LinkedIn',
    target: 'Tom Vaughton, Founder and CEO, Varn (varn.co.uk)',
    parts: one(
      'Tom, after my MeasureFest comment I ran varn.co.uk as the AI search crawlers from OpenAI, Anthropic and Perplexity. Each got the full page, and robots.txt agrees with the server. A clean read.',
    ),
    warning: 'Connection note with the finding and no ask. Only if he has not already connected after the comment (CM-02, 22 Oct).',
    note: 'Clean result as the message. CSV: if clean, VarnFest speaking is the later conversation; not in this note.',
    rests_on: 'byline-audits/varn.co.uk/2026-10-27_052111Z_home_geo.md (engine 2026.13): all six crawler rows HTTP 200, baseline 200, robots allows all',
    engine: '2026.13',
    priority: 2,
  },
  {
    id: 'OB-05',
    type: 'outbound message',
    account: FOUNDER,
    platform: 'LinkedIn',
    target: 'Joel Stone, Founder and MD, Codebreak (codebreak.co.uk)',
    parts: one(
      "Joel, I ran codebreak.co.uk as OpenAI's, Anthropic's and Perplexity's search crawlers today. All three got the full page and robots.txt agrees. Free check if useful: bylineseo.com/geo-analyzer",
    ),
    warning: null,
    note: 'Clean result as the message. CSV: Partner Baseline is the later pitch (no capacity to build it himself); not in this note.',
    rests_on: 'byline-audits/codebreak.co.uk/2026-10-27_052056Z_home_geo.md (engine 2026.13): all six crawler rows HTTP 200, baseline 200, robots allows all',
    engine: '2026.13',
    priority: 3,
  },
  {
    id: 'OB-06',
    type: 'outbound message',
    account: FOUNDER,
    platform: 'LinkedIn',
    target: 'Dan Sharp, Director and co-founder, Screaming Frog (screamingfrog.co.uk)',
    parts: one(
      'Dan, every AI crawler I probe gets screamingfrog.co.uk in full. One small thing: the homepage JSON-LD still says dateModified 2024-06-26. View source and search for it.',
    ),
    warning: 'Do not message Patrick Langridge the same day. The CSV line about "no named author" is false (dated bylines by Dan Sharp and Mark Porter); never use it.',
    note: 'Finding type 5 (stale provenance) on an otherwise clean site. They sell a crawler, so a crawler-identity finding is the most on-brand thing to send.',
    rests_on: 'byline-audits/screamingfrog.co.uk/2026-10-27_052131Z_home_geo.md (engine 2026.13): six crawler rows HTTP 200, newest markup date 2024-06-26',
    engine: '2026.13',
    priority: 3,
  },
  {
    id: 'OB-07',
    type: 'outbound message',
    account: FOUNDER,
    platform: 'LinkedIn',
    target: 'Tom Shurville, Managing Director, Distinctly (distinctly.co)',
    parts: one(
      "Tom, I checked distinctly.co as each AI search crawler today. OpenAI's, Anthropic's and Perplexity's all got the full homepage, and robots.txt says the same. Nothing to chase there.",
    ),
    warning: 'ClaudeBot (training) got a 429 in this run, which is unsettled and not mentioned. Re-run before any follow-up that touches crawlers.',
    note: 'Clean result on retrieval as the message.',
    rests_on: 'byline-audits/distinctly.co/2026-10-27_052244Z_home_geo.md (engine 2026.13): the three AI search crawlers HTTP 200, baseline 200',
    engine: '2026.13',
    priority: 3,
  },
  // ── Social: the Anthropic crawler pattern, sites unnamed (goes before OB-03) ─
  {
    id: 'F-X11',
    type: 'social post',
    account: FOUNDER,
    platform: 'X',
    target: 'Founder, personal X',
    parts: one(
      "Two UK agency homepages, checked 14 Oct and again 27 Oct: robots.txt allows every AI crawler, and the server returns 403 to any user agent containing claudebot@anthropic.com. OpenAI's and Perplexity's crawlers get the page. Claude's gets nothing.",
    ),
    warning: null,
    note: 'Pattern post for the ClickSlice and Passion finding. Never name either site.',
    rests_on: 'byline-audits clickslice.co.uk 2026-10-27_052155Z and passion.digital 2026-10-27_052030Z (engine 2026.13)',
    engine: '2026.13',
    priority: 2,
  },
  {
    id: 'F-L10',
    type: 'social post',
    account: FOUNDER,
    platform: 'LinkedIn',
    target: 'Founder, personal LinkedIn',
    parts: one(
      [
        'Two UK agency homepages, checked on 14 October and again today.',
        "Both have a robots.txt that allows every AI crawler. Both servers return a 403 to any request whose user agent contains claudebot@anthropic.com.",
        "That address sits in the user agent of Anthropic's search crawler, its training crawler and the fetch Claude makes when a person asks it to read a page. So all three are refused. OpenAI's and Perplexity's crawlers get the full page from the same server a second later.",
        'robots.txt says yes. The server says no. Nothing in a normal analytics report would show it.',
        'My guess is a rule written to keep one training crawler out that matched more than intended.',
        'To check your own site, request your homepage with that address in the user agent and compare it with an ordinary browser request. If the browser gets the page and the crawler gets a 403, the rule is on your server.',
        "One caveat. This tests the published user agent from our network. Anthropic's real crawler sends the same string, so a string rule refuses it too, but I cannot see how either server treats Anthropic's own IP ranges.",
      ].join('\n\n'),
    ),
    warning: null,
    note: 'Must go out before OB-03 (Passion). Sites unnamed.',
    rests_on: 'byline-audits clickslice.co.uk 2026-10-27_052155Z and passion.digital 2026-10-27_052030Z (engine 2026.13); byline-prospect-findings-2026-10-14.md for the user-agent trigger',
    engine: '2026.13',
    priority: 2,
  },
  // ── Social: the Semrush citation study (new pages, verified 26 Oct) ─────────
  {
    id: 'F-X12',
    type: 'social post',
    account: FOUNDER,
    platform: 'X',
    target: 'Founder, personal X',
    parts: thread(
      'Semrush published 81 new pages and tracked AI citations daily for 30 days. ChatGPT cited 8 on day one and 34 by day 30. Google AI Mode cited 29, peaked at 48 on day six and ended at 21. Same pages, same month, opposite directions.',
      `Average those two lines and you get a trend neither engine showed. Report citations per engine, and remember these were new pages, so it describes how fresh content gets picked up. Semrush's write-up: ${SEMRUSH}`,
    ),
    warning: 'New pages only. Never say unchanged pages or that nobody edited them (DECISIONS 35).',
    note: 'No product mention.',
    rests_on: `Semrush, Tushar Pol, 10 Dec 2025, ${SEMRUSH}. Figures verified 26 Oct.`,
    engine: 'n/a',
    priority: 3,
  },
  {
    id: 'F-L9',
    type: 'social post',
    account: FOUNDER,
    platform: 'LinkedIn',
    target: 'Founder, personal LinkedIn',
    parts: one(
      [
        'Semrush ran a clean experiment last December. They published 81 new FAQ-style pages on their own blog and checked every day for 30 days whether AI search cited them.',
        'ChatGPT started slow. 8 pages cited on day one, 34 by day thirty.',
        'Google AI Mode went the other way. 29 on day one, 48 by day six, then down to 21 by day thirty.',
        'Same pages, same month. One engine climbing while the other fell away.',
        'Two things follow.',
        'A single citation number for a site averages those curves into one that neither engine produced. If you report AI citations to a client, report them per engine.',
        'Timing matters more than people allow for. Check on day six and again on day thirty and AI Mode looks like it dropped more than half of what it cited.',
        'These were new pages, so this describes how fresh content gets picked up. Semrush do not say whether the pages were edited during the test, so it tells you nothing about pages that sit still.',
        'Their own summary: "What gets cited one week might not be cited the next."',
        'Source in the first comment.',
      ].join('\n\n'),
    ),
    warning: `Put the source in the first comment: ${SEMRUSH}. New pages only; never "unchanged" (DECISIONS 35).`,
    note: 'No product mention. 48 to 21 is a 56% fall, so "more than half" is accurate.',
    rests_on: `Semrush, Tushar Pol, 10 Dec 2025, ${SEMRUSH}. Figures verified 26 Oct.`,
    engine: 'n/a',
    priority: 3,
  },
  {
    id: 'B-X7',
    type: 'social post',
    account: BRAND,
    platform: 'X',
    target: 'Brand, business X',
    parts: one(
      "Semrush tracked 81 new pages for 30 days. ChatGPT citations rose from 8 to 34. Google AI Mode went from 29 up to 48, then down to 21. Byline scores the part you control: what a crawler can fetch and lift from your page. Free: bylineseo.com/geo-analyzer",
    ),
    warning: 'New pages only; never "unchanged". Credit Semrush in a reply if asked for the source.',
    note: 'Brand half of the Semrush finding: the founder says what it means, the brand says what the tool does.',
    rests_on: `Semrush, ${SEMRUSH}; the free tool at bylineseo.com/geo-analyzer`,
    engine: 'n/a',
    priority: 3,
  },
  {
    id: 'B-F5',
    type: 'social post',
    account: BRAND,
    platform: 'Facebook',
    target: 'Brand, Facebook page',
    parts: one(
      [
        'When you publish a new page, do AI tools like ChatGPT start pointing people to it? Semrush tested this with 81 new pages over a month.',
        'ChatGPT was slow to start. It cited 8 of the pages on day one and 34 by the end of the month.',
        "Google's AI Mode moved the other way. It cited 29 on day one, 48 by day six, then dropped back to 21.",
        'So if anyone hands you one number for how often AI mentions your business, ask which tool and which week. The answer depends on both.',
        "What you can check today is whether these tools can read your page at all. That is what our free checker does: bylineseo.com/geo-analyzer",
        `Source: Semrush, "How Fast Do AI Search Platforms Cite New Content?" ${SEMRUSH}`,
      ].join('\n\n'),
    ),
    warning: 'New pages only; never "unchanged".',
    note: 'Plain language for the least technical audience.',
    rests_on: `Semrush, ${SEMRUSH}`,
    engine: 'n/a',
    priority: 4,
  },
  // ── Social: the two blog articles, held until each is published ────────────
  {
    id: 'F-L11',
    type: 'social post',
    account: FOUNDER,
    platform: 'LinkedIn',
    target: 'Founder, personal LinkedIn',
    parts: one(
      [
        "When I probed reddit.com, OpenAI's, Anthropic's and Perplexity's search crawlers all got HTTP 200. Every one of those responses was a JavaScript challenge with none of Reddit's content in it. A plain browser request got the same challenge.",
        'Status codes on their own told the opposite story.',
        "I wrote up the whole method, including the baseline request that stops a site refusing datacentre traffic from being reported as a crawler block, and what changed in Cloudflare's AI controls this year.",
        'Link in the first comment.',
      ].join('\n\n'),
    ),
    warning: `Link in the first comment: ${CRAWLER_POST}. Only after the post is published; the page holds this until it is.`,
    note: 'Promotes the crawler article. No product mention.',
    rests_on: 'content/blog/which-ai-crawlers-your-site-actually-serves.md; reddit.com re-checked 26 Oct (engine 2026.13: the three search crawlers and the baseline all got the JavaScript challenge)',
    engine: '2026.13',
    priority: 3,
    after_ids: ['blog:which-ai-crawlers-your-site-actually-serves'],
  },
  {
    id: 'B-X8',
    type: 'social post',
    account: BRAND,
    platform: 'X',
    target: 'Brand, business X',
    parts: one(
      `New on the blog: robots.txt tells you what a site asks for. The edge decides what each AI crawler actually gets. How to check yours, with the baseline request that rules out false blocks: ${CRAWLER_POST}`,
    ),
    warning: 'Only after the crawler article is published; the page holds this until it is.',
    note: 'Brand half of the crawler article.',
    rests_on: 'content/blog/which-ai-crawlers-your-site-actually-serves.md',
    engine: 'n/a',
    priority: 3,
    after_ids: ['blog:which-ai-crawlers-your-site-actually-serves'],
  },
  {
    id: 'F-X13',
    type: 'social post',
    account: FOUNDER,
    platform: 'X',
    target: 'Founder, personal X',
    parts: thread(
      "Between July and September, Reddit's share of ChatGPT citations fell 94%. Its share of Perplexity citations rose 86%. Same site, same quarter (Otterly.AI). Any single AI visibility score averages those into something that happened to nobody.",
      `The longer version, with what to measure instead: ${VISIBILITY_POST}`,
    ),
    warning: 'Only after the visibility article is published; the page holds this until it is. Only the 94% and 86% figures; no other Otterly numbers.',
    note: 'Promotes the visibility article. No product mention.',
    rests_on: 'content/blog/one-ai-visibility-score-cannot-be-true.md; Otterly.AI 94% and 86% (evidence library)',
    engine: 'n/a',
    priority: 3,
    after_ids: ['blog:one-ai-visibility-score-cannot-be-true'],
  },
  {
    id: 'B-F6',
    type: 'social post',
    account: BRAND,
    platform: 'Facebook',
    target: 'Brand, Facebook page',
    parts: one(
      [
        'If a tool gives your business one score for how often AI mentions you, here is a reason to be careful with it.',
        "Between July and September, Reddit's share of the sources ChatGPT cited fell 94%. Over the same months its share on Perplexity rose 86%. Same website, same period, opposite directions (figures from Otterly.AI).",
        `An average of those two tells you nothing about either. We wrote up what to look at instead: ${VISIBILITY_POST}`,
      ].join('\n\n'),
    ),
    warning: 'Only after the visibility article is published; the page holds this until it is.',
    note: 'Plain language version of the visibility article.',
    rests_on: 'content/blog/one-ai-visibility-score-cannot-be-true.md; Otterly.AI 94% and 86%',
    engine: 'n/a',
    priority: 4,
    after_ids: ['blog:one-ai-visibility-score-cannot-be-true'],
  },
]

// OB-02 (ClickSlice) held a full message far over LinkedIn's 200-character cap
// for outreach; the connection note was already sent, so only the message is cut.
const OB02_DM =
  "Joshua, Claude's search crawler gets a 403 from clickslice.co.uk while OpenAI's and Perplexity's get the page. robots.txt allows all three. The trigger is claudebot@anthropic.com in the user agent."

function check() {
  let bad = 0
  const report = (id: string, label: string, n: number, max: number) => {
    const over = n > max
    if (over) bad++
    console.log(`${id} | ${label} | ${n}/${max}${over ? '  OVER' : ''}`)
  }
  for (const it of items) {
    for (const p of it.parts) {
      if (/—|–/.test(p.text)) { bad++; console.log(`${it.id} | ${p.label} | EM OR EN DASH`) }
      if (/!/.test(p.text)) { bad++; console.log(`${it.id} | ${p.label} | EXCLAMATION`) }
      if (it.platform === 'X') report(it.id, p.label, xLength(p.text), 280)
      else if (it.type === 'outbound message') report(it.id, p.label, p.text.length, 200)
      else console.log(`${it.id} | ${p.label} | ${p.text.length} chars`)
    }
  }
  report('OB-02', 'message after he accepts', OB02_DM.length, 200)
  return bad
}

async function main() {
  const bad = check()
  if (bad) throw new Error(`${bad} problem(s); nothing written`)
  if (process.argv.includes('--dry')) return

  const { createServiceClient } = await import('../src/lib/supabase/service')
  const db = createServiceClient()
  const now = new Date().toISOString()
  const rows = items.map((it, i) => ({
    id: it.id,
    type: it.type,
    account: it.account,
    platform: it.platform,
    target: it.target,
    parts: it.parts.map((p) => ({ ...p, statedChars: it.platform === 'X' ? xLength(p.text) : p.text.length })),
    warning: it.warning,
    note: it.note,
    rests_on: it.rests_on,
    engine: it.engine,
    status: 'pending',
    priority: it.priority,
    after_ids: it.after_ids ?? [],
    due_date: it.due_date ?? null,
    needs_rerun: false,
    sort_order: 100 + i,
    created_at: now,
    updated_at: now,
  }))
  const { data, error } = await db.from('outreach_queue').upsert(rows, { onConflict: 'id', ignoreDuplicates: true }).select('id')
  if (error) throw new Error(error.message)
  console.log(`inserted ${data?.length ?? 0}: ${(data ?? []).map((r) => r.id).join(', ')}`)

  // OB-02: replace the over-length message part; keep the note part as sent.
  const { data: ob, error: e1 } = await db.from('outreach_queue').select('parts').eq('id', 'OB-02').single()
  if (e1) throw new Error(e1.message)
  const parts = (ob.parts as Part[]).map((p) =>
    p.alt === null ? { ...p, label: 'text, message after he accepts', alt: 'message after he accepts', text: OB02_DM, statedChars: OB02_DM.length } : p,
  )
  const { error: e2 } = await db.from('outreach_queue').update({ parts, updated_at: now }).eq('id', 'OB-02')
  if (e2) throw new Error(e2.message)
  console.log('OB-02 message cut to', OB02_DM.length, 'characters')
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
