import { describe, expect, it } from 'vitest'
import { extractPage } from './extract'
import { assessCitability } from './assess-citability'

/**
 * Three reading errors found on app.bylineseo.com after its 2026-10-11 rewrite
 * (DECISIONS 34). The markup below uses the page's own sentences.
 */

const NOW = new Date('2026-10-11T00:00:00Z')
const page = (body: string, head = '') =>
  extractPage(`<!doctype html><html><head>${head}</head><body><main>${body}</main></body></html>`, 'https://app.bylineseo.com/')
const terms = (p: ReturnType<typeof page>) =>
  assessCitability({ home: p, keyPages: [], now: NOW }).signals.find((s) => s.id === 'proprietary-terms')!

describe('block boundaries in minified HTML', () => {
  it('keeps a space between a paragraph and the next heading', () => {
    // Next.js output has no whitespace between tags.
    const p = page('<p>The same rubric scores drafts before you publish them.</p><h3>Retrievable vs citable</h3><p>The two halves fail for different reasons.</p>')
    expect(p.mainText).toContain('publish them. Retrievable vs citable The two halves')
    expect(p.mainText).not.toMatch(/them\.Retrievable|citableThe/)
  })

  it('counts words that used to be merged across blocks', () => {
    const p = page('<h2>One</h2><p>two three</p><ul><li>four</li><li>five</li></ul>')
    expect(p.wordCount).toBe(5)
  })
})

describe('"N of M" counts are figures', () => {
  it('reads "48 of 81" and "seven of the eight" as figures', () => {
    const p = page(
      "<p>In Semrush's 30-day test, Google AI Mode cited 48 of 81 unchanged pages on day six and 21 on day thirty.</p>" +
        '<p>Seven of the eight had fewer than eight sections that stand alone when quoted.</p>',
    )
    expect(p.statistics.some((s) => s.includes('48 of 81'))).toBe(true)
    expect(p.statistics.some((s) => s.startsWith('Seven of the eight'))).toBe(true)
  })

  it('does not count a year or a plain number as a figure', () => {
    const p = page('<p>We started this agency in 2016 and we have a team of people who care about search.</p>')
    expect(p.statistics).toEqual([])
  })
})

describe('defined terms', () => {
  const HOMEPAGE =
    '<h2>What does Byline do?</h2><p>Byline reads a page the way a crawler does and scores two things. Retrievable is a score out of 100 for whether an engine can reach the page. Citable is a band for whether a lifted passage carries anything that points back to you.</p>' +
    '<h3>Retrievable vs citable</h3><p>The two halves fail for different reasons and need different fixes.</p>' +
    '<table><thead><tr><th></th><th>Retrievable</th><th>Citable</th></tr></thead></table>'

  it('recognises "Retrievable vs citable" as a defined, paired framework', () => {
    const s = terms(page(HOMEPAGE))
    expect(s.band).toBe('strong')
    expect(s.detail).toContain('Retrievable vs citable')
  })

  it('does not treat a product description as a coined term', () => {
    const s = terms(page('<p>Shopify is an ecommerce platform. Shopify hosts the store. We build on Shopify for clients.</p>'))
    expect(s.band).toBe('absent')
  })

  it('needs the term to be used again, not only defined once', () => {
    const s = terms(page('<p>Our report gives one number. Clarity is a score we compute from the page.</p>'))
    expect(s.band).toBe('absent')
  })
})
