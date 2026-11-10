import { describe, expect, it } from 'vitest'
import { fitMetaDescription, metaProblem } from './meta-description'
import { findGapHeadings } from './structure'
import { runDraftPipeline, type Chat } from './pipeline'

// Real output, article 7f231a4c (2026-10-05, keyword "writing for AI search").
const REAL_META = 'Learn effective strategies for writing for AI search. Optimize your content with AI SEO techniques.'
const REAL_GAP = 'Highlight the importance of natural language processing'

describe('meta description length', () => {
  it('flags the real 99-character description', () => {
    expect(REAL_META.length).toBe(99)
    expect(metaProblem(REAL_META, 'writing for AI search')).toMatch(/99 characters/)
  })

  it('asks for a rewrite and keeps one that lands in range with the keyword', async () => {
    const fixed = 'Learn how writing for AI search differs from classic SEO: answer-first openings, self-contained sections and headings that match the questions readers type.'
    const r = await fitMetaDescription(REAL_META, 'writing for AI search', async () => fixed)
    expect(r.meta).toBe(fixed)
    expect(r.meta!.length).toBeGreaterThanOrEqual(150)
    expect(r.meta!.length).toBeLessThanOrEqual(160)
  })

  it('rejects a rewrite that drops the keyword, and never pads a short one itself', async () => {
    const r = await fitMetaDescription(REAL_META, 'writing for AI search', async () => 'x'.repeat(155))
    expect(r.meta).toBe(REAL_META)
    expect(r.attempts).toBe(2)
  })

  it('trims an over-long description at a word boundary', async () => {
    const long = `${REAL_META} ${REAL_META}`
    const r = await fitMetaDescription(long, 'writing for AI search', async () => '')
    expect(r.meta!.length).toBeLessThanOrEqual(160)
    expect(r.meta).toMatch(/\.$/)
  })
})

describe('competitor-gap notes published as headings', () => {
  it('finds the real case, and leaves an ordinary heading alone', () => {
    const md = `Opening.\n\n## ${REAL_GAP}\n\nText.\n\n## How do AI engines read a page?\n\nText.`
    expect(findGapHeadings(md, [REAL_GAP, 'Discuss future trends'])).toEqual([{ heading: REAL_GAP, gap: REAL_GAP }])
  })

  it('has the pipeline rewrite only that heading, and reports it', async () => {
    const article = `Writing for AI search means writing so an engine can lift a clean answer.\n\n## ${REAL_GAP}\n\nNatural language processing decides how a page is read.\n\n## How do AI engines read a page?\n\nThey parse the raw HTML.`
    const chat: Chat = async (req) => {
      if (req.user.startsWith('Write the article')) return article
      if (req.user.includes('planning note')) return JSON.stringify({ rewrites: [{ original: REAL_GAP, rewritten: 'Why natural language processing shapes what gets quoted' }] })
      return '{}'
    }
    const out = await runDraftPipeline(chat, {
      articleId: 'a', brand: { name: 'Acme' }, author: null, sources: [], keyword: 'writing for AI search', secondaryKeywords: [],
      title: 'Writing for AI Search', serpIntent: 'informational', toneNotes: '', competitorGaps: [REAL_GAP], outlineText: '', targetWordCount: 40, polish: false,
    })
    expect(out.content).toContain('## Why natural language processing shapes what gets quoted')
    expect(out.content).not.toContain(`## ${REAL_GAP}`)
    expect(out.content).toContain('Natural language processing decides how a page is read.')
    expect(out.report.gapHeadingsFound).toBe(1)
    expect(out.report.gapHeadingsRemaining).toBe(0)
  })
})
