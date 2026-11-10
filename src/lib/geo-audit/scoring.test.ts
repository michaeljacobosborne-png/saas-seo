import { describe, expect, it } from 'vitest'
import { computeTotals, deriveStatus, findScoreInconsistencies, gradeForScore, FactorBuilder } from './scoring'
import { STATUS_LABELS, type Factor } from './types'

function factor(overrides: Partial<Factor> = {}): Factor {
  const base: Factor = {
    id: 'test',
    name: 'Test factor',
    state: 'present',
    score: 10,
    maxScore: 10,
    scored: true,
    status: 'good',
    label: STATUS_LABELS.good,
    detail: '',
    evidence: [],
  }
  return { ...base, ...overrides }
}

describe('deriveStatus', () => {
  // The bug this prevents: the shipped report showed "Freshness signals 11/10 —
  // Needs work". A status is now a pure function of the score ratio.
  it('never labels a full-marks factor as needing work', () => {
    expect(deriveStatus(10, 10)).toBe('good')
    expect(STATUS_LABELS[deriveStatus(10, 10)]).toBe('Good')
    expect(deriveStatus(15, 15)).toBe('good')
  })

  it('maps ratios to statuses at the defined thresholds', () => {
    expect(deriveStatus(8, 10)).toBe('good')
    expect(deriveStatus(7, 10)).toBe('needs-work')
    expect(deriveStatus(4, 10)).toBe('needs-work')
    expect(deriveStatus(3, 10)).toBe('missing')
    expect(deriveStatus(0, 10)).toBe('missing')
  })
})

describe('gradeForScore', () => {
  it('derives the grade from the published thresholds', () => {
    expect(gradeForScore(100)).toBe('A')
    expect(gradeForScore(85)).toBe('A')
    expect(gradeForScore(84)).toBe('B')
    expect(gradeForScore(70)).toBe('B')
    expect(gradeForScore(55)).toBe('C')
    expect(gradeForScore(40)).toBe('D')
    expect(gradeForScore(39)).toBe('F')
    expect(gradeForScore(0)).toBe('F')
  })
})

describe('FactorBuilder', () => {
  it('clamps the score to maxScore so 11/10 is unrepresentable', () => {
    const f = new FactorBuilder('freshness', 'Freshness signals', 10)
      .award(6, 'dates present')
      .award(8, 'recently updated')
      .build()

    expect(f.score).toBe(10)
    expect(f.score).toBeLessThanOrEqual(f.maxScore)
    expect(f.status).toBe('good')
    expect(f.label).toBe('Good')
  })

  it('marks an unverified factor unscored rather than scoring it zero', () => {
    const f = new FactorBuilder('x', 'X', 15).unverified('Could not read the page.').build()

    expect(f.scored).toBe(false)
    expect(f.state).toBe('unverified')
    expect(f.status).toBe('unverified')
    expect(f.label).toBe('Unable to assess')
    expect(f.score).toBe(0)
  })

  it('records a genuine absence as absent, not unverified', () => {
    const f = new FactorBuilder('x', 'X', 15).miss('Nothing found on the page.').build()

    expect(f.scored).toBe(true)
    expect(f.state).toBe('absent')
    expect(f.status).toBe('missing')
  })
})

describe('computeTotals', () => {
  it('sums factor scores into the total', () => {
    const factors = [
      factor({ id: 'a', score: 12, maxScore: 15, status: 'good', label: 'Good' }),
      factor({ id: 'b', score: 10, maxScore: 20, status: 'needs-work', label: 'Needs work' }),
      factor({ id: 'c', score: 5, maxScore: 15, status: 'missing', label: 'Missing' }),
    ]
    const totals = computeTotals(factors)

    expect(totals.rawScore).toBe(27)
    expect(totals.assessedMaxScore).toBe(50)
    expect(factors.reduce((s, f) => s + f.score, 0)).toBe(totals.rawScore)
  })

  it('normalises to 0-100 and derives the grade consistently', () => {
    const totals = computeTotals([factor({ score: 7, maxScore: 10, status: 'needs-work', label: 'Needs work' })])
    expect(totals.score).toBe(70)
    expect(totals.grade).toBe('B')
    expect(totals.scoreWithheld).toBe(false)
  })

  it('excludes unverified factors from the total instead of scoring them zero', () => {
    const scoredOnly = computeTotals([
      factor({ id: 'a', score: 8, maxScore: 10, status: 'good', label: 'Good' }),
      factor({ id: 'b', score: 8, maxScore: 10, status: 'good', label: 'Good' }),
      factor({ id: 'c', score: 8, maxScore: 10, status: 'good', label: 'Good' }),
    ])
    const withUnverified = computeTotals([
      factor({ id: 'a', score: 8, maxScore: 10, status: 'good', label: 'Good' }),
      factor({ id: 'b', score: 8, maxScore: 10, status: 'good', label: 'Good' }),
      factor({ id: 'c', score: 8, maxScore: 10, status: 'good', label: 'Good' }),
      factor({ id: 'd', score: 0, maxScore: 5, scored: false, state: 'unverified', status: 'unverified', label: 'Unable to assess' }),
    ])

    // The unassessed factor must not drag the score down.
    expect(withUnverified.score).toBe(scoredOnly.score)
    expect(withUnverified.assessedMaxScore).toBe(30)
    expect(withUnverified.totalMaxScore).toBe(35)
    expect(withUnverified.confidence).toBe('partial')
  })

  it('withholds the score when too little could be assessed', () => {
    const totals = computeTotals([
      factor({ id: 'a', score: 10, maxScore: 10, status: 'good', label: 'Good' }),
      factor({ id: 'b', score: 0, maxScore: 20, scored: false, state: 'unverified', status: 'unverified', label: 'Unable to assess' }),
      factor({ id: 'c', score: 0, maxScore: 20, scored: false, state: 'unverified', status: 'unverified', label: 'Unable to assess' }),
    ])

    expect(totals.scoreWithheld).toBe(true)
    expect(totals.grade).toBe('N/A')
    expect(totals.withheldReason).toContain('Test factor')
    expect(totals.confidence).toBe('low')
  })

  it('withholds rather than dividing by zero when nothing was assessed', () => {
    const totals = computeTotals([
      factor({ score: 0, maxScore: 10, scored: false, state: 'unverified', status: 'unverified', label: 'Unable to assess' }),
    ])
    expect(totals.scoreWithheld).toBe(true)
    expect(Number.isNaN(totals.score)).toBe(false)
  })
})

describe('findScoreInconsistencies', () => {
  it('accepts a self-consistent report', () => {
    const factors = [
      factor({ id: 'a', score: 12, maxScore: 15, status: 'good', label: 'Good' }),
      factor({ id: 'b', score: 8, maxScore: 20, status: 'needs-work', label: 'Needs work' }),
    ]
    expect(findScoreInconsistencies(factors, computeTotals(factors))).toEqual([])
  })

  it('catches a score above its maximum', () => {
    const factors = [factor({ score: 11, maxScore: 10 })]
    expect(findScoreInconsistencies(factors, computeTotals(factors)).join(' ')).toContain('exceeds maxScore')
  })

  it('catches a status that contradicts the score', () => {
    const factors = [factor({ score: 10, maxScore: 10, status: 'needs-work', label: 'Needs work' })]
    const problems = findScoreInconsistencies(factors, computeTotals(factors))
    expect(problems.join(' ')).toContain('contradicts score 10/10')
  })

  it('catches a label that does not match its status', () => {
    const factors = [factor({ score: 10, maxScore: 10, status: 'good', label: 'Needs work' })]
    expect(findScoreInconsistencies(factors, computeTotals(factors)).join(' ')).toContain('does not match status')
  })

  it('catches factor scores that do not sum to the total', () => {
    const factors = [factor({ score: 5, maxScore: 10, status: 'needs-work', label: 'Needs work' })]
    const totals = { ...computeTotals(factors), rawScore: 9 }
    expect(findScoreInconsistencies(factors, totals).join(' ')).toContain('sum to 5 but rawScore is 9')
  })

  it('catches a grade that contradicts the score', () => {
    const factors = [factor({ score: 5, maxScore: 10, status: 'needs-work', label: 'Needs work' })]
    const totals = { ...computeTotals(factors), grade: 'A' }
    expect(findScoreInconsistencies(factors, totals).join(' ')).toContain('contradicts score')
  })

  it('catches an unscored factor carrying a real status', () => {
    const factors = [factor({ scored: false, state: 'unverified', score: 0, status: 'needs-work', label: 'Needs work' })]
    expect(findScoreInconsistencies(factors, computeTotals(factors)).join(' ')).toContain('must have status "unverified"')
  })
})
