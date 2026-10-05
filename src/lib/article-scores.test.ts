import { describe, expect, it, vi } from 'vitest'
import { buildArticleScores } from './article-scores'
import { computeAEO, computeGEO, computeSEO, SEO_BASICS_KEYS } from './article-scoring'

const NOW = new Date('2026-09-30T12:00:00Z')
const CONTENT = `# Payroll for small teams

Payroll software is a tool that calculates wages and taxes. Acme runs payroll for 40 teams.

## What is payroll software?

${'Payroll software handles wages, deductions and filings so a founder does not have to. '.repeat(4)}

## How long does setup take?

${'Setup takes an afternoon for most small teams, according to Acme onboarding data. '.repeat(4)}
`

describe('SEO basics (decision 28)', () => {
  it('has no invented thresholds left', () => {
    const s = computeSEO(CONTENT, { meta_description: 'x'.repeat(130), url_slug: 'payroll-software', secondary_keywords: ['wages'] }, 'payroll software', { title: 'Payroll software for small teams', metaDescription: '' })
    expect(Object.keys(s.breakdown)).toEqual([...SEO_BASICS_KEYS])
    const labels = Object.values(s.breakdown).map((c) => (c as { label: string }).label).join(' ')
    expect(labels).not.toMatch(/H2 headings|target 2-4|Word count|1800|density|first 100 words|slug|Secondary|FAQ/i)
  })

  it('reads the meta description from the article field, not the brief (empty field scored 10/10 before)', () => {
    const s = computeSEO(CONTENT, { meta_description: 'A brief copy that the editor field does not have.' }, 'payroll software', { title: 'Payroll software', metaDescription: '' })
    expect(s.breakdown.meta_present.passed).toBe(false)
  })

  it('checks the keyword against the title the template renders, and only warns on meta length', () => {
    const s = computeSEO('No H1 in the body.', {}, 'payroll software', { title: 'Payroll Software for Small Teams', metaDescription: 'y'.repeat(200) })
    expect(s.breakdown.kw_in_title.passed).toBe(true)
    expect(s.breakdown.meta_length).toMatchObject({ passed: false, max: 0 })
    expect(s.score).toBe(100)
  })
})

describe('buildArticleScores', () => {
  const input = { content: CONTENT, brief: {}, targetKeyword: 'payroll software', articleId: 'a1', brandName: 'Acme', now: NOW }

  it('leaves the legacy scores byte-identical, so no current surface changes', () => {
    const s = buildArticleScores(input)
    expect(s.seo).toEqual(computeSEO(CONTENT, {}, 'payroll software'))
    expect(s.readability).toBeUndefined()
    expect(s.geo).toEqual(computeGEO(CONTENT))
    expect(s.aeo).toEqual(computeAEO(CONTENT))
  })

  it('stores the real engine draft report alongside', () => {
    const s = buildArticleScores(input)
    expect(s.draft?.tool).toBe('draft')
    expect(s.draft?.articleId).toBe('a1')
    expect(s.draft?.retrievability.draftMaxScore).toBe(45)
  })

  it('never lets a draft-report failure take the legacy scores down', async () => {
    vi.resetModules()
    vi.doMock('@/lib/geo-audit/draft-report', () => ({
      buildDraftReport: () => {
        throw new Error('boom')
      },
    }))
    const { buildArticleScores: isolated } = await import('./article-scores')
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = isolated(input)
    expect(s.geo).toEqual(computeGEO(CONTENT))
    expect(s.draft).toBeUndefined()
    expect(err).toHaveBeenCalled()
    vi.doUnmock('@/lib/geo-audit/draft-report')
  })
})
