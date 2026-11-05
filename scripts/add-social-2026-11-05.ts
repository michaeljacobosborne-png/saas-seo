/**
 * Four social posts from the 2026-11-04 audit run (engine 2026.15, runs 07:04 to 07:14Z).
 * Written under the byline-outreach-and-social skill, scheduled run, 5 November 2026.
 *
 *   npx tsx --env-file=.env.local scripts/add-social-2026-11-05.ts [--dry]
 *
 * Skips any post whose text already exists in outreach_queue. Never posts anything.
 */
import { xLength } from '../src/lib/outreach-queue/parse'

const FOUNDER = 'Founder, Michael Jacobs'
const BRAND = 'Brand, Byline'
const TOOL = 'https://bylineseo.com/geo-analyzer'

const fX = [
  'A homepage loaded fine for a browser request. Its robots.txt returned 403 to ours, same network, same run.',
  'Rules a crawler cannot fetch are rules it cannot follow. Run curl -I on your own /robots.txt. A 403 or a 5xx deserves a look.',
].join('\n\n')

const fL = [
  'I re-ran the same 30 sites two days after the first pass. The engine had moved up a version in between, and four scores moved.',
  'Every run keeps what it fetched, so I could split that. Re-scoring the first pass\'s own responses on the new version moved one score, by 5 points, and changed one citability band. The band change fixed a wrong finding: the old version missed a brand name written in capitals. The other three moves were the sites changing in those two days.',
  'The crawler refusals did not move. Three sites I had looked at closely refused a crawler on the first pass, and the same three refused the same crawlers on the second.',
  'That is why I lead with an HTTP status when I write to anyone. A status code is something you can check with one curl command in thirty seconds. A score depends on the version that produced it, so it needs a date and a version attached.',
].join('\n\n')

const bX = `When a site's robots.txt returns 403, Byline cannot read its crawler rules. The report marks permission as unable to assess and excludes it from the total instead of scoring it zero. Check yours: ${TOOL}`

// No link in the body (DECISIONS 40): the post teaches the check itself.
const bF = [
  'Here is a quick check anyone can do. No tools needed. Type your website address into a browser and add /robots.txt on the end.',
  'You should see a plain page of text with a few lines about what automated visitors may do. If you see an error page instead, ask whoever hosts your site why. Software that wants to read those rules cannot read them if the page will not load.',
  'A page that says not found is common and usually fine. A 403 or a server error is the one to ask about.',
  'Byline reports on this as part of content readiness. This is an assessment of content readiness, not a measurement of AI visibility.',
].join('\n\n')

const A = 'byline-audits 2026-11-04, engine 2026.15'
const posts = [
  { prefix: 'F-X', account: FOUNDER, platform: 'X', target: 'Founder, personal X', text: fX, chars: xLength(fX),
    warning: 'Audit is from 2026-11-04 07:11Z (about a day old); the HTTP 403 on robots.txt is a durable fact but re-run e2msolutions.com before posting if it goes after 8 November. Site unnamed. Our network may be treated differently from a real crawler.',
    note: 'Founder finding, no product. Unreadable robots.txt as a thing to check with one curl.',
    rests: `${A}: e2msolutions.com 2026-11-04_071153Z, robots.txt HTTP 403, baseline browser request HTTP 200, score withheld`, priority: 3 },
  { prefix: 'F-L', account: FOUNDER, platform: 'LinkedIn', target: 'Founder, personal LinkedIn', text: fL, chars: fL.length,
    warning: 'Rewritten 5 Nov by the host session with the engine-only split. Live moves 2 Nov (2026.14) to 4 Nov (2026.15): cedarwood.digital 84 to 72, bigfinseo.com 93 to 87, inter-dev.co.il 80 to 75, kanopysecurity.com 70 to 67. Re-scoring the 2 Nov recordings on 2026.15 moved only inter-dev.co.il (80 to 75, a footer sentence no longer credited) and changed only aimclear.com\'s band (Weak to Adequate; the old engine missed "AIMCLEAR"). Cedarwood, Kanopy and Big Fin changed their pages. Crawler rows checked for passion.digital, clickslice.co.uk, lusha.com. A picked sample, not a study. Sites unnamed.',
    note: 'Why findings lead with an HTTP status. Founder argument, no product mention.',
    rests: `${A} against byline-audits 2026-11-02, engine 2026.14; INDEX.md rows for both dates`, priority: 3 },
  { prefix: 'B-X', account: BRAND, platform: 'X', target: 'Brand, business X', text: bX, chars: xLength(bX),
    warning: 'Link counted as 23 characters. Behaviour shown in the 2026-11-04 e2msolutions.com report (robots.txt 403, AI crawler access marked unable to assess). Site unnamed.',
    note: 'What the tool does when robots.txt cannot be read. Pairs with F-X, which carries the finding.',
    rests: `${A}: e2msolutions.com 2026-11-04_071153Z, AI crawler access shown as unassessed, not zero`, priority: 3 },
  { prefix: 'B-F', account: BRAND, platform: 'Facebook', target: 'Brand, Facebook page', text: bF, chars: bF.length,
    warning: 'No link in the body (decision 40); none needed. If you want one, put it in the first comment: Free check: bylineseo.com/geo-analyzer',
    note: 'Plain-language robots.txt check a non-technical owner can do in a browser.',
    rests: `${A}: e2msolutions.com 2026-11-04_071153Z, robots.txt HTTP 403`, priority: 4 },
]

async function nextId(db: any, prefix: string, taken: number[]) {
  // Queue ids are F-X15, B-F8: no dash before the number.
  const { data, error } = await db.from('outreach_queue').select('id').like('id', `${prefix}%`)
  if (error) throw new Error(error.message)
  const pattern = new RegExp(`^${prefix}\\d+$`)
  const nums = (data ?? []).map((x: { id: string }) => x.id).filter((id: string) => pattern.test(id)).map((id: string) => Number(id.slice(prefix.length)))
  return Math.max(0, ...taken, ...nums) + 1
}

async function main() {
  for (const p of posts) {
    if (/—|–|!/.test(p.text)) throw new Error(`banned character in ${p.prefix}`)
    if (p.platform === 'X' && p.chars > 280) throw new Error(`${p.prefix} is ${p.chars} on X`)
    console.log(`${p.prefix} ${p.platform} ${p.chars}${p.platform === 'X' ? '/280' : ''}`)
  }
  if (process.argv.includes('--dry')) return

  const { createServiceClient } = await import('../src/lib/supabase/service')
  const db = createServiceClient()
  const { data: existing, error: e0 } = await db.from('outreach_queue').select('parts').eq('type', 'social post')
  if (e0) throw new Error(e0.message)
  const have = new Set((existing ?? []).map((r: any) => String(r.parts?.[0]?.text ?? '')))
  const now = new Date().toISOString()
  const rows: any[] = []
  for (const [i, p] of posts.entries()) {
    if (have.has(p.text)) { console.log(`skip ${p.prefix}: already queued`); continue }
    const n = await nextId(db, p.prefix, rows.filter((r) => new RegExp(`^${p.prefix}\\d+$`).test(r.id)).map((r) => Number(r.id.slice(p.prefix.length))))
    rows.push({
      id: `${p.prefix}${n}`, type: 'social post', account: p.account, platform: p.platform, target: p.target,
      parts: [{ label: 'text', text: p.text, part: null, alt: null, statedChars: p.platform === 'X' ? p.chars : null }],
      warning: p.warning, note: p.note, rests_on: p.rests, engine: '2026.15', status: 'pending', priority: p.priority,
      after_ids: [], due_date: null, needs_rerun: false, sort_order: 400 + i, created_at: now, updated_at: now,
    })
  }
  if (!rows.length) return
  const { data, error } = await db.from('outreach_queue').insert(rows).select('id')
  if (error) throw new Error(error.message)
  console.log(`inserted: ${(data ?? []).map((r: { id: string }) => r.id).join(', ')}`)
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
