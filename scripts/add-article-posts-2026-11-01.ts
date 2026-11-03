/**
 * Two social posts for the Fudan-study article, held until it is published.
 * Written under the byline-outreach-and-social skill, 1 November 2026.
 * Checked against the paper and corrected 3 November 2026: the paper measures
 * planted markers appearing in answers, so the posts say that.
 *
 *   npx tsx --env-file=.env.local scripts/add-article-posts-2026-11-01.ts [--dry]
 *
 * Ids are the next free F-L and B-X numbers in outreach_queue. Never posts anything.
 */
import { xLength } from '../src/lib/outreach-queue/parse'

const FOUNDER = 'Founder, Michael Jacobs'
const BRAND = 'Brand, Byline'
const SLUG = 'ai-search-cited-invented-concept-page-scores'
const POST = `https://app.bylineseo.com/blog/${SLUG}`

const founderText = [
  'Researchers at Fudan University published posts about a concept they had invented, then asked ten AI search platforms about it daily for a week. Eight cited it. Grok carried the planted markers, invented terms and figures, in 53% of its answers after its first citation. Perplexity cited the posts and carried none of them.',
  'The result I keep returning to is placement. One article on a platform the engines favour had a larger citation effect than more than 20 matched posts elsewhere. Forty posts on a self-hosted WordPress site drew no citations that week.',
  'Every topic was fictional, so the paper cannot speak to real brands. The placement result still matters for scoring: a score computed from the page alone cannot forecast a citation. I wrote up what a page score can say.',
  'Link in the first comment.',
].join('\n\n')

const brandText = `New on the blog: Fudan researchers planted an invented concept and eight of ten AI search platforms cited it within a week. What that leaves a page score able to say, and what needs sampling instead: ${POST}`

/** Queue ids are F-L12, B-X9: no dash before the number. */
async function nextId(db: any, prefix: string) {
  const { data, error } = await db.from('outreach_queue').select('id').like('id', `${prefix}%`)
  if (error) throw new Error(error.message)
  const pattern = new RegExp(`^${prefix}\\d+$`)
  const nums = (data ?? []).map((x: { id: string }) => x.id).filter((id: string) => pattern.test(id)).map((id: string) => Number(id.slice(prefix.length)))
  return `${prefix}${Math.max(0, ...nums) + 1}`
}

async function main() {
  const bx = xLength(brandText)
  console.log(`brand X ${bx}/280, founder LinkedIn ${founderText.length}`)
  if (bx > 280) throw new Error('brand X over 280')
  if (/—|–|!/.test(founderText + brandText)) throw new Error('banned character')
  if (process.argv.includes('--dry')) return

  const { createServiceClient } = await import('../src/lib/supabase/service')
  const db = createServiceClient()
  const { data: existing } = await db.from('outreach_queue').select('id').eq('type', 'social post').contains('after_ids', [`blog:${SLUG}`])
  if (existing?.length) {
    console.log(`already queued: ${existing.map((r: { id: string }) => r.id).join(', ')}`)
    return
  }
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
      warning: `Link in the first comment: ${POST}. Only after the post is published; the page holds this until it is. Percentages are from Table III of arXiv 2610.11932 (answers from each platform's first citation onward).`,
      note: 'Promotes the Fudan-study article. No product mention.',
      rests_on: `content/blog/${SLUG}.md; Liu et al., arXiv 2610.11932, 8 Oct 2026; Search Engine Journal, 19 Oct 2026`,
      engine: 'n/a',
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
      note: 'Brand half of the Fudan-study article. Link counted as 23 characters.',
      rests_on: `content/blog/${SLUG}.md; Liu et al., arXiv 2610.11932`,
      engine: 'n/a',
      priority: 3,
    },
  ].map((r, i) => ({
    ...r,
    status: 'pending',
    after_ids: [`blog:${SLUG}`],
    due_date: null,
    needs_rerun: false,
    sort_order: 200 + i,
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
