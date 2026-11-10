/**
 * Four social posts from the 2026-11-02 audit run (engine 2026.14, all runs 05:51 to 06:01Z that day).
 * Written under the byline-outreach-and-social skill, scheduled run, 2 November 2026.
 *
 *   npx tsx --env-file=.env.local scripts/add-social-2026-11-02.ts [--dry]
 *
 * Skips any post whose text already exists in outreach_queue. Never posts anything.
 */
import { xLength } from '../src/lib/outreach-queue/parse'

const FOUNDER = 'Founder, Michael Jacobs'
const BRAND = 'Brand, Byline'
const TOOL = 'https://bylineseo.com/geo-analyzer'

const fX = [
  'An agency homepage scored 95/100 on retrievability this morning. Every crawler got a 200.',
  'The company name appears in 2 of its 10 substantive sections. No figure on the page links a source.',
  'An engine can lift a clean answer from it. The answer would not say whose it is.',
].join('\n\n')

const fL = [
  'I ran 30 sites through the Byline engine this morning. Mostly agencies, plus a few software companies. I picked them, so read this as a sample and nothing more.',
  'Seven came back Strong on citability. Four came back with no flags at all.',
  'The flag that showed up most was Original evidence: absent. 17 of 30. The pages carried figures, but no figure linked a source and no page named a method. An engine that quotes one of those numbers has nothing to point back to.',
  'That is the gap between a page that can be read and a page that can be credited. Closing it takes something only you hold: your own data, with a method someone can check.',
  'Two sites returned no score at all. I count those as failures. I do not know what their pages look like.',
].join('\n\n')

const bX = `A site scoring 90/100 on Byline returned 403 to CCBot at its Cloudflare edge while its robots.txt allowed it. CCBot is a training crawler. Byline lists the refusal and leaves it out of the score. Check your own: ${TOOL}`

// No link in the body (DECISIONS 40): the post teaches the check itself.
const bF = [
  'Can an AI search tool read your homepage? And if it quotes you, will anyone know the words came from you?',
  'We ran an agency homepage this morning. Readable: 95 out of 100. The company name showed up in 2 of its 10 sections, and no number on the page linked a source.',
  'You can check the second part on your own site in five minutes. Pick your three most important paragraphs and look for your company name inside them. The menu and footer do not count. If a tool lifted one of those paragraphs on its own, would it still say who wrote it?',
  'Then look at each figure you quote. If the page does not say where it came from, nobody repeating it can either.',
  'Byline gives you two separate scores for this, Retrievable and Citable, and never blends them. This is an assessment of content readiness, not a measurement of AI visibility.',
].join('\n\n')

const A = 'byline-audits 2026-11-02, engine 2026.14'
const posts = [
  { prefix: 'F-X', account: FOUNDER, platform: 'X', target: 'Founder, personal X', text: fX, chars: xLength(fX),
    warning: 'Scores are from this morning (2026-11-02, engine 2026.14) and are current. Site unnamed. Post by 5 November or re-run codebreak.co.uk before quoting 95/100.',
    note: 'Retrievable but not credited. Founder finding, no product mention.',
    rests: `${A}: codebreak.co.uk 2026-11-02_055548Z, Retrievability 95/100, Citable Adequate, Brand-claim proximity 2 of 10 sections, Original evidence absent, all six crawler rows HTTP 200`, priority: 3 },
  { prefix: 'F-L', account: FOUNDER, platform: 'LinkedIn', target: 'Founder, personal LinkedIn', text: fL, chars: fL.length,
    warning: 'A picked sample of 30, stated as a sample. Counts from INDEX.md rows dated 2026-11-02 (30 rows): Strong 7, clean 4, no-original-evidence 17, score withheld 2. Post by 5 November or re-run. Do not call it a study or generalise to agencies.',
    note: 'Original evidence is the most common gap in this morning\'s run. Founder argument, no product mention.',
    rests: `${A}: 30 runs 05:51Z to 06:01Z listed in INDEX.md; the two withheld are bluearray.co.uk and e2msolutions.com (unnamed in the post)`, priority: 3 },
  { prefix: 'B-X', account: BRAND, platform: 'X', target: 'Brand, business X', text: bX, chars: xLength(bX),
    warning: 'Cloudflare 403 to CCBot is from our network at 2026-11-02 05:59Z. Some crawlers verify by IP range, so the real crawler may be treated differently. Site unnamed. Link counted as 23 characters.',
    note: 'What the tool does with a training-crawler refusal: reports it, does not score it.',
    rests: `${A}: lusha.com 2026-11-02_055952Z, Retrievability 90/100, Citable Strong, CCBot HTTP 403 edge-block, robots allowed, DIVERGENCE robots-allows-origin-blocks`, priority: 3 },
  { prefix: 'B-F', account: BRAND, platform: 'Facebook', target: 'Brand, Facebook page', text: bF, chars: bF.length,
    warning: 'Scores are from this morning (engine 2026.14). Site unnamed. Post by 5 November or re-run codebreak.co.uk first. No link in the body (decision 40); none needed. If you want one, put it in the first comment: Free check: bylineseo.com/geo-analyzer',
    note: 'Plain-language version of the retrievable versus citable gap, with a check readers can do themselves. Rewritten 2 Nov to carry no link.',
    rests: `${A}: codebreak.co.uk 2026-11-02_055548Z, Retrievability 95/100, Brand-claim proximity 2 of 10 sections, Original evidence absent`, priority: 4 },
]

async function nextId(db: any, prefix: string, taken: number[]) {
  const { data, error } = await db.from('outreach_queue').select('id').like('id', `${prefix}-%`)
  if (error) throw new Error(error.message)
  return Math.max(0, ...taken, ...(data ?? []).map((x: { id: string }) => Number(x.id.slice(prefix.length + 1)) || 0)) + 1
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
    const n = await nextId(db, p.prefix, rows.filter((r) => r.id.startsWith(p.prefix + '-')).map((r) => Number(r.id.slice(p.prefix.length + 1))))
    rows.push({
      id: `${p.prefix}-${n}`, type: 'social post', account: p.account, platform: p.platform, target: p.target,
      parts: [{ label: 'text', text: p.text, part: null, alt: null, statedChars: p.platform === 'X' ? p.chars : null }],
      warning: p.warning, note: p.note, rests_on: p.rests, engine: '2026.14', status: 'pending', priority: p.priority,
      after_ids: [], due_date: null, needs_rerun: false, sort_order: 300 + i, created_at: now, updated_at: now,
    })
  }
  if (!rows.length) return
  const { data, error } = await db.from('outreach_queue').insert(rows).select('id')
  if (error) throw new Error(error.message)
  console.log(`inserted: ${(data ?? []).map((r: { id: string }) => r.id).join(', ')}`)
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
