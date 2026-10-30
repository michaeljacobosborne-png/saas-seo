import { describe, expect, it } from 'vitest'
import { promotedColumns } from './promoted-columns'

describe('promotedColumns', () => {
  it('promotes a normal Phase B report', () => {
    expect(
      promotedColumns({
        score: 87,
        retrievability: { score: 87, scoreWithheld: false },
        citability: { band: 'adequate' },
      }),
    ).toEqual({ retrievability_score: 87, citability_band: 'adequate' })
  })

  it('writes NULL, not 0, when the score was withheld', () => {
    // The rule that protects the benchmark. AuditReport.score is 0 when
    // withheld because the legacy numeric field cannot express "no score";
    // averaging that 0 would drag every median down with a number we never
    // measured.
    const out = promotedColumns({
      score: 0,
      scoreWithheld: true,
      retrievability: { score: 0, scoreWithheld: true },
      citability: { band: 'unverified' },
    })
    expect(out.retrievability_score).toBeNull()
    expect(out.citability_band).toBe('unverified')
  })

  it('falls back to the legacy top-level score for pre-Phase-B reports', () => {
    expect(promotedColumns({ score: 62, grade: 'C', breakdown: [] })).toEqual({
      retrievability_score: 62,
      citability_band: null,
    })
  })

  it('does not promote a legacy score that was withheld', () => {
    expect(promotedColumns({ score: 0, scoreWithheld: true, breakdown: [] }).retrievability_score).toBeNull()
  })

  it('returns nulls for a content-audit result', () => {
    expect(promotedColumns({ gaps: [], topicClusters: [], quickWins: [], pageCount: 12 })).toEqual({
      retrievability_score: null,
      citability_band: null,
    })
  })

  it('rejects a band it does not recognise rather than writing it', () => {
    // The column has a CHECK constraint; a bad value would fail the whole
    // insert and lose the lead, which matters more than the analytics.
    expect(promotedColumns({ citability: { band: 'excellent' } }).citability_band).toBeNull()
  })

  it('clamps and rounds an out-of-range score', () => {
    expect(promotedColumns({ retrievability: { score: 87.6, scoreWithheld: false } }).retrievability_score).toBe(88)
    expect(promotedColumns({ retrievability: { score: 140, scoreWithheld: false } }).retrievability_score).toBe(100)
    expect(promotedColumns({ retrievability: { score: -5, scoreWithheld: false } }).retrievability_score).toBe(0)
  })

  it('never throws on junk', () => {
    for (const junk of [null, undefined, 'a string', 42, [], {}, { retrievability: 'no' }, { citability: 7 }]) {
      expect(() => promotedColumns(junk)).not.toThrow()
      expect(promotedColumns(junk)).toEqual({ retrievability_score: null, citability_band: null })
    }
  })

  it('ignores NaN and Infinity', () => {
    expect(promotedColumns({ retrievability: { score: NaN, scoreWithheld: false } }).retrievability_score).toBeNull()
    expect(promotedColumns({ retrievability: { score: Infinity, scoreWithheld: false } }).retrievability_score).toBeNull()
  })
})
