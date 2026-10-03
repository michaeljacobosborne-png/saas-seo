import { describe, expect, it } from 'vitest'
import { compareAudits, type ComparableReport } from './compare'
import { findForbiddenClaims } from './gap'

const run = (over: Partial<ComparableReport> & { score?: number; withheld?: boolean; chunk?: number; status?: 'good' | 'missing' | 'needs-work'; authorship?: 'weak' | 'strong' }): ComparableReport => ({
  analyzedAt: over.analyzedAt ?? '2026-10-01T00:00:00Z',
  engineVersion: 'engineVersion' in over ? over.engineVersion : '2026.10',
  finalUrl: over.finalUrl ?? 'https://acme.io/post',
  retrievability: {
    score: over.score ?? 60,
    scoreWithheld: over.withheld ?? false,
    groups: [
      {
        id: 'chunkability',
        name: 'Chunkability',
        score: over.chunk ?? 10,
        maxScore: 25,
        scored: true,
        checks: [{ id: 'chunk-hierarchy', name: 'Heading hierarchy', score: 5, maxScore: 12, scored: true, status: over.status ?? 'missing' }],
      },
    ],
  },
  citability: { band: 'weak', signals: [{ id: 'named-authorship', name: 'Named authorship', band: over.authorship ?? 'weak' }] },
})

describe('compareAudits', () => {
  it('diffs scores, groups, check statuses and signal bands for same-version runs, earliest first', () => {
    const later = run({ analyzedAt: '2026-10-02T00:00:00Z', score: 72, chunk: 18, status: 'good', authorship: 'strong' })
    const earlier = run({ score: 60 })
    const c = compareAudits(later, earlier) // argument order must not matter
    expect(c.scoresComparable).toBe(true)
    expect(c.retrievability).toEqual({ from: 60, to: 72, delta: 12 })
    expect(c.groups[0]).toMatchObject({ id: 'chunkability', from: 10, to: 18, delta: 8 })
    expect(c.checkChanges).toEqual([{ id: 'chunk-hierarchy', name: 'Heading hierarchy', from: 'missing', to: 'good' }])
    expect(c.signalChanges).toEqual([{ id: 'named-authorship', name: 'Named authorship', from: 'weak', to: 'strong', direction: 'up' }])
  })

  it('refuses a score delta across engine versions', () => {
    const c = compareAudits(run({ engineVersion: '2026.10' }), run({ analyzedAt: '2026-11-01T00:00:00Z', engineVersion: '2026.11', score: 90 }))
    expect(c.scoresComparable).toBe(false)
    expect(c.retrievability.delta).toBeNull()
    expect(c.groups[0].delta).toBeNull()
    expect(c.reasons.join(' ')).toMatch(/engine changed/)
  })

  it('treats pre-versioning rows as legacy and does not diff them', () => {
    const c = compareAudits(run({ engineVersion: undefined }), run({ analyzedAt: '2026-10-02T00:00:00Z', engineVersion: undefined }))
    expect(c.from.engineVersion).toBe('legacy')
    expect(c.scoresComparable).toBe(false)
  })

  it('never turns a withheld score into a number', () => {
    const c = compareAudits(run({ withheld: true }), run({ analyzedAt: '2026-10-02T00:00:00Z', score: 70 }))
    expect(c.retrievability.from).toBeNull()
    expect(c.retrievability.delta).toBeNull()
    expect(c.scoresComparable).toBe(false)
  })

  it('flags different URLs but still shows the diff', () => {
    const c = compareAudits(run({}), run({ analyzedAt: '2026-10-02T00:00:00Z', finalUrl: 'https://acme.io/other' }))
    expect(c.reasons.join(' ')).toMatch(/different URLs/)
  })

  it('tolerates old stored rows with no Phase B fields', () => {
    const c = compareAudits({ analyzedAt: '2026-06-01T00:00:00Z' }, run({}))
    expect(c.retrievability.from).toBeNull()
    expect(c.scoresComparable).toBe(false)
  })

  it('claims nothing about AI visibility', () => {
    const c = compareAudits(run({}), run({ analyzedAt: '2026-10-02T00:00:00Z' }))
    expect(findForbiddenClaims(JSON.stringify(c))).toEqual([])
    expect(c.scope).toMatch(/not evidence that any AI system/)
  })
})
