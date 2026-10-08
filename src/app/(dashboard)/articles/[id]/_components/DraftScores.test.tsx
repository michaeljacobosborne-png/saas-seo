import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DraftScores } from './DraftScores'
import { buildDraftReport, AT_PUBLICATION_LABEL } from '@/lib/geo-audit/draft-report'
import { draftFixes } from '@/lib/draft-fixes'
import { findForbiddenClaims } from '@/lib/geo-audit/gap'

const NOW = new Date('2026-10-01T09:00:00Z')
const para = (t: string) =>
  `${t} is a practical discipline. Acme measured it across 40 sites in 2026 and 62% lacked a direct answer. The fix is structural, not editorial, and it takes an afternoon to apply properly.`
const MD = [
  '# How to structure an article for AI answers',
  'Answer engines lift self-contained passages. This guide shows how to write sections that stand alone.',
  ...['What is answer-first writing?', 'Why do headings matter?', 'How long should a section be?', 'How do you add attribution?'].flatMap(
    (h) => [`## ${h}`, para(h.replace('?', ''))],
  ),
].join('\n\n')

const draft = buildDraftReport({ markdown: MD, articleId: 'a1', brandName: 'Acme', author: null, now: NOW })
const html = renderToStaticMarkup(<DraftScores draft={draft} keyword="answer-first writing" renderFix={() => <button>Fix</button>} />)

describe('DraftScores — two scores, named as the framework names them (decisions 13, 14)', () => {
  it('shows Retrievable and Citable, and no GEO/AEO score labels', () => {
    expect(html).toContain('Retrievable')
    expect(html).toContain('Citable')
    expect(html).not.toMatch(/>\s*(GEO|AEO)\s*</)
    expect(html).not.toMatch(/Overall/i)
  })

  it('states the 45-of-100 scope inline (decision 15)', () => {
    expect(html).toContain('45 of the 100 points')
  })
})

describe('DraftScores — publication-layer checks are never missing marks (decision 15)', () => {
  const section = html.slice(html.indexOf(AT_PUBLICATION_LABEL))

  it('lists them under "Checked at publication" with a reason', () => {
    expect(html).toContain(AT_PUBLICATION_LABEL)
    expect(section).toContain('AI crawler access')
    expect(section).toContain('Scored once this is live')
  })

  it('shows no score, zero or deduction for them', () => {
    expect(section).not.toMatch(/\d+\/\d+/)
    expect(section).not.toMatch(/−\d/)
    expect(section).not.toMatch(/Missing|Fail/i)
  })

  it('keeps them out of the draft score', () => {
    expect(draft.retrievability.draftMaxScore).toBe(45)
    for (const g of draft.retrievability.groups.filter((x) => x.id === 'access' || x.id === 'parseability')) {
      expect(g.label).toBe(AT_PUBLICATION_LABEL)
      expect(g.scored).toBe(false)
    }
  })
})

describe('DraftScores — evidence and claims', () => {
  it('shows the text findings rest on, without editor-meaningless line prefixes', () => {
    expect(html).toContain('“')
    expect(html).not.toMatch(/L\d+ · /)
  })

  it('claims nothing about AI visibility or citation', () => {
    expect(findForbiddenClaims(html)).toEqual([])
  })

  it('reports a missing author as absent with the fix, from the brand profile (decision 17)', () => {
    expect(html).toContain('No author is set on the brand profile')
  })
})

describe('draftFixes', () => {
  const fixes = draftFixes(draft, 'answer-first writing', 'Acme')

  it('never offers a fix for something judged at publication', () => {
    const atPublication = new Set(draft.afterPublication.map((a) => a.id))
    expect(fixes.some((f) => atPublication.has(f.id))).toBe(false)
  })

  it('never offers a fix for a check already in good shape', () => {
    const good = draft.retrievability.groups.flatMap((g) => g.checks).filter((c) => c.status === 'good').map((c) => c.id)
    expect(fixes.some((f) => good.includes(f.id))).toBe(false)
  })

  it('never asks the agent to invent figures or sources (decision 9)', () => {
    for (const f of fixes) {
      expect(f.instruction).not.toMatch(/add (a )?(data point|statistic)s? to each/i)
    }
    const evidence = draftFixes(
      { ...draft, citability: { ...draft.citability, signals: draft.citability.signals.map((s) => (s.id === 'original-evidence' ? { ...s, band: 'absent' as const } : s)) } },
      'x',
      'Acme',
    ).find((f) => f.id === 'original-evidence')!
    expect(evidence.instruction).toMatch(/Do not invent numbers or sources/)
  })

  it('skips brand proximity when there is no brand name to place', () => {
    const noBrand = { ...draft, citability: { ...draft.citability, signals: draft.citability.signals.map((s) => (s.id === 'brand-proximity' ? { ...s, band: 'absent' as const } : s)) } }
    expect(draftFixes(noBrand, 'x', null).some((f) => f.id === 'brand-proximity')).toBe(false)
  })
})
