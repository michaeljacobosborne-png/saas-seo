import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractPage } from './extract'
import { assessCitability } from './assess-citability'

/**
 * Original evidence counts only figures with a source linked from the same
 * section (engine 2026.13, DECISIONS 36). Both fixtures are verbatim excerpts of
 * real pages fetched 2026-10-26.
 */

const NOW = new Date('2026-10-26T12:00:00Z')
const fixture = (name: string) => readFileSync(join(__dirname, '__fixtures__', name), 'utf8')
const signal = (html: string, url: string) =>
  assessCitability({ home: extractPage(html, url), keyPages: [], now: NOW }).signals.find((s) => s.id === 'original-evidence')!

describe('original evidence: clickslice.co.uk', () => {
  // "AI search projected to hit 1 billion monthly visitors by the end of 2025",
  // with no source anywhere in the section. On engine 2026.12 this page's 12
  // unsourced figures earned "adequate: 12 specific figures appear in the copy".
  const html = fixture('clickslice-unsourced-figure.html')
  const url = 'https://www.clickslice.co.uk/'

  it('finds the figure but does not treat it as sourced', () => {
    const page = extractPage(html, url)
    expect(page.statistics.some((s) => s.includes('1 billion monthly visitors'))).toBe(true)
    expect(page.sourcedStatistics).toHaveLength(0)
  })

  it('gives the unsourced figure no credit, and says it is not counted either way', () => {
    const s = signal(html, url)
    expect(s.band).toBe('absent')
    expect(s.detail).toMatch(/none has a source linked from its section/)
    expect(s.detail).toMatch(/not counted either way/)
  })

  it('does not count the review badges as a source for the figure', () => {
    const page = extractPage(html, url)
    expect(page.blocks.flatMap((b) => b.sourceLinks ?? []).some((l) => l.includes('yell.com'))).toBe(false)
  })
})

describe('original evidence: app.bylineseo.com', () => {
  // The figures sit in one paragraph and the sources in a "Sources:" line under
  // it, inside the same section. That is a linked figure.
  const html = fixture('byline-sourced-figures.html')
  const url = 'https://app.bylineseo.com/'

  it('credits figures whose source is linked from the same section', () => {
    const page = extractPage(html, url)
    // One figure sentence by the engine's figure rules: "fell 94% ... rose 86%".
    // "cited 48 of them" is not matched as a figure, which is a separate question.
    expect(page.sourcedStatistics).toHaveLength(1)
    expect(page.sourcedStatistics[0].source).toBe('https://otterly.ai/blog/reddit-ban-geo-experiment/')
    expect(page.sourcedStatistics[0].figure).toMatch(/94%/)
  })

  it('reports the sourced figure, with the source in the evidence', () => {
    const s = signal(html, url)
    expect(s.band).toBe('weak')
    expect(s.detail).toMatch(/One figure appears with a source linked from the same section/)
    expect(s.evidence.some((e) => e.kind === 'link' && e.snippet.includes('otterly.ai'))).toBe(true)
  })
})
