/**
 * Two social posts for the Google AI features guide teardown, held until it is published.
 * Written under the byline-outreach-and-social skill, 10 November 2026.
 *
 *   npx tsx --env-file=.env.local scripts/add-article-posts-2026-11-10.ts [--dry]
 *
 * Ids are the next free F-L and B-X numbers in outreach_queue. Never posts anything.
 */
import { xLength } from '../src/lib/outreach-queue/parse'

const FOUNDER = 'Founder, Michael Jacobs'
const BRAND = 'Brand, Byline'
const SLUG = 'google-ai-features-guide-retrievable-citable-teardown'
const POST = `https://app.bylineseo.com/blog/${SLUG}`

const founderText = [
  "I ran my engine on Google's own guide to AI features on 10 November. Retrievability came back 81 out of 100. All six crawler user-agents I tested were served the page.",
  'Citability came back Weak. No named author and no Organization in the markup. The update date sits in the footer text only: the page has no time element and its structured data holds no date.',
  'One check I do not accept. Direct answers credited a footer line, "Java is a registered trademark of Oracle", as a definition. Take that credit away and the score is 76.',
  'A score describes the page. It does not tell you whether any engine cites it. Link in the first comment.',
].join('\n\n')

const brandText = `New teardown: Google's AI features guide scored 81/100 for retrievability and Weak for citability on Byline's engine, 10 Nov 2026. One check credited a footer trademark line as a definition, and the post says so: ${POST}`

async function nextId(db: any, prefix: string) {
  const { data, error } = await db.from('outreach_queue').select('id').like('id', `${prefix}%`)
  if (error) throw new Error(error.message)
  const n = Math.max(0, ...(data ?? []).map((x: { id: string }) => Number(x.id.slice(prefix.length)) || 0)) + 1
  return `${prefix}${n}`
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
  const REST = `content/blog/${SLUG}.md; byline-audits/developers.google.com/2026-11-10_040631Z_search-docs-appearance-ai-features_geo.md (engine 2026.15)`
  const { data: maxRow } = await db.from('outreach_queue').select('sort_order').order('sort_order', { ascending: false }).limit(1)
  const base = ((maxRow?.[0]?.sort_order as number | undefined) ?? 210) + 1
  const rows = [
    {
      id: fid,
      type: 'social post',
      account: FOUNDER,
      platform: 'LinkedIn',
      target: 'Founder, personal LinkedIn',
      parts: [{ label: 'text', text: founderText, part: null, alt: null, statedChars: founderText.length }],
      warning: `Link in the first comment: ${POST}. Only after the post is published; the page holds this until it is. Re-verify against the 2026-11-10 audit (engine 2026.15) before posting if the article has been edited.`,
      note: 'Promotes the Google AI features guide teardown. No product mention.',
      rests_on: REST,
      engine: '2026.15',
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
      note: 'Brand half of the Google AI features guide teardown. Link counted as 23 characters.',
      rests_on: REST,
      engine: '2026.15',
      priority: 3,
    },
  ].map((r, i) => ({
    ...r,
    status: 'pending',
    after_ids: [`blog:${SLUG}`],
    due_date: null,
    needs_rerun: false,
    sort_order: base + i,
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
