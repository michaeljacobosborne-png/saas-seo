import { describe, expect, it, vi } from 'vitest'
import { buildArticleScores } from './article-scores'
import { computeAEO, computeGEO, computeReadability, computeSEO } from './article-scoring'

const NOW = new Date('2026-09-30T12:00:00Z')
const CONTENT = `# Payroll for small teams

Payroll software is a tool that calculates wages and taxes. Acme runs payroll for 40 teams.

## What is payroll software?

${'Payroll software handles wages, deductions and filings so a founder does not have to. '.repeat(4)}

## How long does setup take?

${'Setup takes an afternoon for most small teams, according to Acme onboarding data. '.repeat(4)}
`

describe('buildArticleScores', () => {
  const input = { content: CONTENT, brief: {}, targetKeyword: 'payroll software', articleId: 'a1', brandName: 'Acme', now: NOW }

  it('leaves the legacy scores byte-identical, so no current surface changes', () => {
    const s = buildArticleScores(input)
    expect(s.seo).toEqual(computeSEO(CONTENT, {}, 'payroll software'))
    expect(s.readability).toEqual(computeReadability(CONTENT))
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
