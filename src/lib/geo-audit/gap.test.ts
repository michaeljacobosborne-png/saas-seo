import { describe, expect, it } from 'vitest'
import { diagnoseGap, findForbiddenClaims } from './gap'
import { overallBand, bandCounts, findBandInconsistencies, SignalBuilder } from './scoring'
import { BAND_LABELS, type Band, type Citability, type CitabilitySignal, type Retrievability } from './types'

function retr(score: number, withheld = false): Retrievability {
  return {
    score,
    grade: 'B',
    rawScore: score,
    assessedMaxScore: 100,
    totalMaxScore: 100,
    scoreWithheld: withheld,
    withheldReason: withheld ? 'not enough read' : undefined,
    confidence: 'high',
    groups: [],
  }
}

function cit(band: Band): Citability {
  const signals: CitabilitySignal[] = []
  return { band, label: BAND_LABELS[band], signals, counts: bandCounts(signals) }
}

describe('Gap — the wording rule', () => {
  // The single constraint Michael reviews personally: we describe what the page
  // CARRIES. We never assert what engines are doing with it.
  it('never claims the site is being retrieved without attribution', () => {
    const cases: [number, Band][] = [
      [90, 'absent'],
      [90, 'weak'],
      [30, 'strong'],
      [20, 'absent'],
      [85, 'strong'],
    ]
    for (const [score, band] of cases) {
      const g = diagnoseGap(retr(score), cit(band))
      const all = `${g.headline} ${g.diagnosis} ${g.nextStep}`
      expect(findForbiddenClaims(all)).toEqual([])
    }
  })

  it('uses the sanctioned phrasing for the flagship quadrant', () => {
    const g = diagnoseGap(retr(90), cit('absent'))
    expect(g.quadrant).toBe('high-retrievable-low-citable')
    // The approved formulation.
    expect(g.diagnosis).toMatch(/carry no attribution anchors/i)
    // The forbidden inference.
    expect(g.diagnosis).not.toMatch(/being retrieved/i)
  })

  it('catches forbidden phrasing if it is ever reintroduced', () => {
    expect(findForbiddenClaims('Your content is being retrieved without attribution.').length).toBeGreaterThan(0)
    expect(findForbiddenClaims('This guarantees citation.').length).toBeGreaterThan(0)
    expect(findForbiddenClaims('Passages carry no attribution anchors.')).toEqual([])
  })
})

describe('Gap — quadrants', () => {
  it('high retrievability with weak attribution is the flagship finding', () => {
    const g = diagnoseGap(retr(85), cit('weak'))
    expect(g.quadrant).toBe('high-retrievable-low-citable')
    expect(g.nextStep).toMatch(/attribution, not structure/i)
  })

  it('low retrievability with strong attribution points at access first', () => {
    const g = diagnoseGap(retr(35), cit('strong'))
    expect(g.quadrant).toBe('low-retrievable-high-citable')
    expect(g.nextStep).toMatch(/retrievability group|crawler access/i)
  })

  it('low on both starts with access and says why order matters', () => {
    const g = diagnoseGap(retr(25), cit('absent'))
    expect(g.quadrant).toBe('low-both')
    expect(g.diagnosis).toMatch(/has no effect/i)
  })

  it('high on both admits the limits of an on-page tool', () => {
    const g = diagnoseGap(retr(88), cit('strong'))
    expect(g.quadrant).toBe('high-both')
    expect(g.nextStep).toMatch(/repeated live sampling/i)
  })

  it('is indeterminate when the score was withheld', () => {
    const g = diagnoseGap(retr(0, true), cit('weak'))
    expect(g.quadrant).toBe('indeterminate')
  })

  it('is indeterminate when citability could not be assessed', () => {
    const g = diagnoseGap(retr(80), cit('unverified'))
    expect(g.quadrant).toBe('indeterminate')
  })
})

describe('band roll-up', () => {
  const sig = (band: Band): CitabilitySignal => {
    const b = new SignalBuilder('x', 'X')
    if (band === 'unverified') b.unverified('could not check')
    else if (band === 'absent') b.missing('nothing found')
    else b.found(band, 'found something', { url: 'https://x.test/', kind: 'text', snippet: 'evidence' })
    return b.build()
  }

  it('needs several strong signals to call the whole thing strong', () => {
    expect(overallBand([sig('strong'), sig('strong'), sig('strong'), sig('adequate')])).toBe('strong')
    expect(overallBand([sig('strong'), sig('absent'), sig('absent'), sig('absent')])).toBe('weak')
  })

  it('reports unverified only when nothing could be assessed', () => {
    expect(overallBand([sig('unverified'), sig('unverified')])).toBe('unverified')
    expect(overallBand([sig('unverified'), sig('adequate'), sig('adequate'), sig('adequate')])).toBe('adequate')
  })

  it('never outranks every individual signal', () => {
    const signals = [sig('weak'), sig('absent'), sig('absent')]
    const overall = overallBand(signals)
    expect(findBandInconsistencies(signals, overall)).toEqual([])
    // Forcing a stronger overall band must be caught.
    expect(findBandInconsistencies(signals, 'strong').join(' ')).toMatch(/stronger than any individual signal/)
  })
})

describe('band-vs-evidence consistency', () => {
  it('rejects a positive band with no evidence', () => {
    const bad: CitabilitySignal = {
      id: 'x',
      name: 'X',
      band: 'strong',
      state: 'present',
      detail: 'claims a lot',
      evidence: [],
    }
    expect(findBandInconsistencies([bad], 'weak').join(' ')).toMatch(/no supporting evidence/)
  })

  it('rejects an absent band that carries evidence', () => {
    const bad: CitabilitySignal = {
      id: 'x',
      name: 'X',
      band: 'absent',
      state: 'absent',
      detail: 'nothing found',
      evidence: [{ url: 'https://x.test/', kind: 'text', snippet: 'but here is something' }],
    }
    expect(findBandInconsistencies([bad], 'absent').join(' ')).toMatch(/evidence item\(s\) attached/)
  })

  it('rejects evidence not attributed to an inspected URL', () => {
    const bad: CitabilitySignal = {
      id: 'x',
      name: 'X',
      band: 'adequate',
      state: 'present',
      detail: 'found',
      evidence: [{ url: 'not-a-url', kind: 'text', snippet: 'x' }],
    }
    expect(findBandInconsistencies([bad], 'weak').join(' ')).toMatch(/not attributed to an inspected URL/)
  })

  it('rejects a signal with no detail', () => {
    const bad: CitabilitySignal = { id: 'x', name: 'X', band: 'absent', state: 'absent', detail: '  ', evidence: [] }
    expect(findBandInconsistencies([bad], 'absent').join(' ')).toMatch(/no detail recorded/)
  })
})
