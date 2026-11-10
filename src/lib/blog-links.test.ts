import { describe, expect, it } from 'vitest'
import { checkInternalLinks, extractLinkTargets, internalLinks, type LinkLookups } from './blog-links'

const lookups = (published: string[], live: Record<string, number | null> = {}): LinkLookups => ({
  publishedSlugs: async (slugs) => new Set(slugs.filter((s) => published.includes(s))),
  liveStatus: async (path) => (path in live ? live[path] : 200),
})

describe('blog internal links', () => {
  it('refuses a link to a post that is not published: the parked Wikipedia teardown', async () => {
    const md = 'Same limit as in the [Wikipedia teardown](/blog/wikipedia-coffee-article-retrievable-citable-teardown).'
    const r = await checkInternalLinks(md, lookups(['one-ai-visibility-score-cannot-be-true']))
    expect(r.problems).toHaveLength(1)
    expect(r.problems[0].reason).toContain('No published post has the slug "wikipedia-coffee-article-retrievable-citable-teardown"')
  })

  it('accepts a published post, written relative or on our own hosts', async () => {
    const md = 'See [a](/blog/one-ai-visibility-score-cannot-be-true) and [b](https://app.bylineseo.com/blog/one-ai-visibility-score-cannot-be-true/) and https://www.bylineseo.com/blog/one-ai-visibility-score-cannot-be-true.'
    const r = await checkInternalLinks(md, lookups(['one-ai-visibility-score-cannot-be-true']))
    expect(r.problems).toEqual([])
    expect(r.checked).toBe(3)
  })

  it('checks other site pages against the live site and fails on 404 or an unreachable site', async () => {
    const md = '[tool](https://bylineseo.com/geo-analyzer) [gone](/no-such-page) [down](/pricing)'
    const r = await checkInternalLinks(md, lookups([], { '/no-such-page': 404, '/pricing': null }))
    expect(r.problems.map((p) => p.raw)).toEqual(['/no-such-page', '/pricing'])
    expect(r.problems[0].reason).toContain('HTTP 404')
    expect(r.problems[1].reason).toContain('Could not reach')
  })

  it('leaves external links, anchors and mailto alone', async () => {
    const md = '[g](https://developers.google.com/x) [a](#section) [m](mailto:hi@bylineseo.com)'
    expect(internalLinks(md)).toEqual({ links: [], problems: [] })
  })

  it('refuses a relative link with no leading slash, and a /blog path that is not a post', async () => {
    const r = await checkInternalLinks('[x](blog/some-post) [y](/blog/a/b)', lookups([]))
    expect(r.problems).toHaveLength(2)
  })

  it('finds links inside FAQ answers and bare URLs', () => {
    expect(extractLinkTargets(':::faq\n### Q\nSee https://app.bylineseo.com/blog/x for more.\n:::')).toEqual(['https://app.bylineseo.com/blog/x'])
  })
})
