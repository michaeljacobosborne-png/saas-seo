/**
 * Two social posts for the Wikipedia Coffee teardown article, held until it is published.
 * Written under the byline-outreach-and-social skill, 3 November 2026.
 *
 *   npx tsx --env-file=.env.local scripts/add-article-posts-2026-11-03.ts [--dry]
 *
 * Ids are the next free F-L and B-X numbers in outreach_queue. Never posts anything.
 */
import { xLength } from '../src/lib/outreach-queue/parse'

const FOUNDER = 'Founder, Michael Jacobs'
const BRAND = 'Brand, Byline'
const SLUG = 'wikipedia-coffee-article-retrievable-citable-teardown'
const POST = `https://app.bylineseo.com/blog/${SLUG}`

const founderText = [
  "I ran my engine on Wikipedia's Coffee article on 2 November. Retrievability came back 87 out of 100. Three AI search crawlers were served the page, and it holds 41 sections that make sense when quoted alone.",
  'Citability came back Adequate. The report found no named author on the page. The word Wikipedia sits inside 2 of 42 substantive sections, so a passage lifted from the middle arrives with no name attached. Question headings scored zero out of six.',
  'One row surprised me. Six crawler user-agents requested the page and five got HTTP 200. ClaudeBot got a 403 from the application itself, with robots.txt allowing it. One request, one network, one day.',
  'A score describes the page. It does not tell you whether any engine cites it. Link in the first comment.',
].join('\n\n')

const brandText = `New teardown: Wikipedia's Coffee article scored 87/100 for retrievability and Adequate for citability on Byline's engine, 2 Nov 2026. Every check with its evidence, and the curl commands to reproduce the ClaudeBot 403: ${POST}`

async function nextId(db: any, prefix: string) {
  const { data, error } = await db.from('outreach_queue').select('id').like('id', `${prefix}-%`)
  if (error) throw new Error(error.message)
  const n = Math.max(0, ...(data ?? []).map((x: { id: string }) => Number(x.id.slice(prefix.length + 1)) || 0)) + 1
  return `${prefix}-${n}`
}

async function main() {
  const bx = xLength(brandText)
  console.log(`brand X ${bx}/280, founder LinkedIn ${founderText.length}`)
  if (bx > 280) throw new Error('brand X over 280')
  if (/—|–|!/.test(founderText + brandText)) throw new Error('banned character')
  if (process.argv.includes('--dry')) return

  const { createServiceClient } = await import('../src/lib/supabase/service')
  const db = createServiceClient()
  const now = new Date().toISOString()
  const fid = await nextId(db, 'F-L')
  const bid = await nextId(db, 'B-X')
  const rows = [
    {
      id: fid,
      type: 'social post',
      account: FOUNDER,
      platform: 'LinkedIn',
      target: 'Founder, personal LinkedIn',
      parts: [{ label: 'text', text: founderText, part: null, alt: null, statedChars: founderText.length }],
      warning: `Link in the first comment: ${POST}. Only after the post is published; the page holds this until it is. Re-verify against the 2026-11-02 audit (engine 2026.14) before posting if the article has been edited.`,
      note: 'Promotes the Wikipedia Coffee teardown. No product mention.',
      rests_on: `content/blog/${SLUG}.md; byline-audits/en.wikipedia.org/2026-11-02_152755Z_wiki-coffee_geo.md (engine 2026.14)`,
      engine: '2026.14',
      priority: 3,
    },
    {
      id: bid,
      type: 'social post',
      account: BRAND,
      platform: 'X',
      target: 'Brand, business X',
      parts: [{ label: 'text', text: brandText, part: null, alt: null, statedChars: bx }],
      warning: 'Only after the article is published; the page holds this until it is.',
      note: 'Brand half of the Wikipedia Coffee teardown. Link counted as 23 characters.',
      rests_on: `content/blog/${SLUG}.md; byline-audits/en.wikipedia.org/2026-11-02_152755Z_wiki-coffee_geo.md (engine 2026.14)`,
      engine: '2026.14',
      priority: 3,
    },
  ].map((r, i) => ({
    ...r,
    status: 'pending',
    after_ids: [`blog:${SLUG}`],
    due_date: null,
    needs_rerun: false,
    sort_order: 210 + i,
    created_at: now,
    updated_at: now,
  }))
  const { data, error } = await db.from('outreach_queue').insert(rows).select('id')
  if (error) throw new Error(error.message)
  console.log(`inserted: ${(data ?? []).map((r: { id: string }) => r.id).join(', ')}`)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
