import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractPage, type ExtractedPage } from './extract'
import { scoreRetrievability } from './score-retrievability'
import { ENGINE_VERSION } from './types'

/**
 * Two rubric faults found by auditing our own homepage (DECISIONS 33).
 */

const NOW = new Date('2026-10-11T00:00:00Z')
const factor = (r: ReturnType<typeof scoreRetrievability>, id: string) =>
  r.groups.flatMap((g) => g.checks).find((c) => c.id === id)!

describe('Heading hierarchy can reach its maximum', () => {
  it('awards 12/12 to one H1, six H2s, six H3s and no skipped levels', () => {
    const headings = [
      { level: 1, text: 'Title' },
      ...Array.from({ length: 6 }, (_, i) => [
        { level: 2, text: `Section ${i}` },
        { level: 3, text: `Sub ${i}` },
      ]).flat(),
    ]
    const home = { ...extractPage('<html><body><main><p>x</p></main></body></html>', 'https://example.com/'), headings } as ExtractedPage
    const f = factor(scoreRetrievability({ home, access: null, now: NOW }), 'chunk-hierarchy')
    expect(f.maxScore).toBe(12)
    expect(f.score).toBe(12)
  })

  it('is versioned, so scores before the fix are not compared silently', () => {
    expect(ENGINE_VERSION).not.toBe('2026.10')
  })
})

describe('the rubric published on the GEO Analyzer page matches the engine', () => {
  // The page said "7 weighted factors: schema markup (15 pts)..." for months
  // after the engine moved to four groups. This keeps the published table true.
  it('lists every check with the points the engine awards', async () => {
    const { RUBRIC } = await import('../../app/(marketing)/geo-analyzer/geo-content')
    const home = extractPage('<html><body><main><p>x</p></main></body></html>', 'https://example.com/')
    const r = scoreRetrievability({ home, access: null, now: NOW })
    const engine = r.groups.map((g) => ({ group: g.name, points: g.maxScore, checks: g.checks.map((c) => [c.name, c.maxScore]) }))
    expect(RUBRIC.map((g) => ({ group: g.group, points: g.points, checks: g.checks.map(([n, p]) => [n, p]) }))).toEqual(engine)
  })
})

describe('SoftwareApplication counts as a content-level type (app.bylineseo.com)', () => {
  // Our own homepage as served on 2026-10-11: Organization, WebSite, Person and
  // SoftwareApplication. It was told it had no content-level type and advised
  // to "add a SoftwareApplication schema" it already had.
  const html = readFileSync(join(__dirname, '__fixtures__', 'bylineseo-home.html'), 'utf8')
  const home = extractPage(html, 'https://app.bylineseo.com/')

  it('reads SoftwareApplication from the page', () => {
    expect(home.structuredDataTypes).toContain('SoftwareApplication')
  })

  it('awards the content-level points', () => {
    const f = factor(scoreRetrievability({ home, access: null, now: NOW }), 'parse-structured-data')
    expect(f.detail).toMatch(/A content-level type describes what is on the page/)
    expect(f.detail).not.toMatch(/No content-level type/)
    expect(f.score).toBe(f.maxScore)
  })

  it('counts WebApplication too (the analyzer pages declare it)', () => {
    const page = extractPage(
      '<html><head><script type="application/ld+json">{"@context":"https://schema.org","@type":["WebApplication"],"name":"GEO Analyzer"}</script><script type="application/ld+json">{"@type":"Organization","name":"Byline"}</script></head><body><main><p>x</p></main></body></html>',
      'https://app.bylineseo.com/geo-analyzer',
    )
    const f = factor(scoreRetrievability({ home: page, access: null, now: NOW }), 'parse-structured-data')
    expect(f.detail).toMatch(/A content-level type describes/)
  })
})
