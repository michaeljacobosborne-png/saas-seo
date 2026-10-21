import { describe, expect, it } from 'vitest'
import { assessFreshness, daysSince, parseDate, relationToNow } from './dates'

const NOW = new Date('2026-09-14T12:00:00Z')

function d(raw: string) {
  const parsed = parseDate(raw, 'test')
  if (!parsed) throw new Error(`expected "${raw}" to parse as a date`)
  return parsed
}

describe('parseDate', () => {
  it('parses ISO timestamps', () => {
    expect(parseDate('2026-01-26T14:59:18+00:00', 'jsonld')?.iso).toBe('2026-01-26')
  })

  it('parses human-written dates in both orders', () => {
    expect(parseDate('12 April 2026', 'text')?.iso).toBe('2026-04-12')
    expect(parseDate('April 12, 2026', 'text')?.iso).toBe('2026-04-12')
    expect(parseDate('1st March 2025', 'text')?.iso).toBe('2025-03-01')
  })

  it('rejects things that are not dates', () => {
    expect(parseDate('', 'test')).toBeNull()
    expect(parseDate('01', 'test')).toBeNull() // numbered list marker
    expect(parseDate('not a date', 'test')).toBeNull()
    expect(parseDate('1776-07-04', 'test')).toBeNull() // outside plausible range
  })
})

describe('relationToNow', () => {
  // The regression this suite exists for: dates earlier in the same calendar
  // year were being reported as "in the future".
  it('treats earlier months of the same year as past', () => {
    expect(relationToNow(d('2026-01-26T14:59:18+00:00'), NOW)).toBe('past')
    expect(relationToNow(d('2026-04-12T13:20:07+00:00'), NOW)).toBe('past')
  })

  it('treats the run date as today regardless of time of day', () => {
    expect(relationToNow(d('2026-09-14T00:00:01Z'), NOW)).toBe('today')
    expect(relationToNow(d('2026-09-14T23:59:59Z'), NOW)).toBe('today')
  })

  it('treats only strictly later calendar days as future', () => {
    expect(relationToNow(d('2026-09-15T00:00:00Z'), NOW)).toBe('future')
    expect(relationToNow(d('2027-01-01T00:00:00Z'), NOW)).toBe('future')
  })

  it('compares against the clock it is given, not a hard-coded year', () => {
    const earlier = new Date('2026-02-01T00:00:00Z')
    expect(relationToNow(d('2026-04-12T00:00:00Z'), earlier)).toBe('future')
    expect(relationToNow(d('2026-04-12T00:00:00Z'), NOW)).toBe('past')
  })
})

describe('daysSince', () => {
  it('counts whole days back from the run clock', () => {
    expect(daysSince(d('2026-09-04T00:00:00Z'), NOW)).toBe(10)
    expect(daysSince(d('2026-09-14T08:00:00Z'), NOW)).toBe(0)
  })
})

describe('assessFreshness', () => {
  it('picks the most recent non-future date', () => {
    const result = assessFreshness([d('2026-01-26T00:00:00Z'), d('2026-04-12T00:00:00Z')], NOW)
    expect(result.mostRecent?.iso).toBe('2026-04-12')
    expect(result.futureDates).toHaveLength(0)
    expect(result.bucket).toBe('recent')
    expect(result.daysOld).toBe(155)
  })

  it('sets future dates aside instead of treating them as newest', () => {
    const result = assessFreshness([d('2026-04-12T00:00:00Z'), d('2027-06-01T00:00:00Z')], NOW)
    expect(result.mostRecent?.iso).toBe('2026-04-12')
    expect(result.futureDates.map((f) => f.iso)).toEqual(['2027-06-01'])
  })

  it('reports no usable signal when every date is in the future', () => {
    const result = assessFreshness([d('2027-06-01T00:00:00Z')], NOW)
    expect(result.mostRecent).toBeNull()
    expect(result.daysOld).toBeNull()
    expect(result.bucket).toBe('none')
  })

  it('reports no dates at all as "none" rather than stale', () => {
    expect(assessFreshness([], NOW).bucket).toBe('none')
  })

  it('buckets by age', () => {
    expect(assessFreshness([d('2026-08-01T00:00:00Z')], NOW).bucket).toBe('current')
    expect(assessFreshness([d('2026-03-01T00:00:00Z')], NOW).bucket).toBe('recent')
    expect(assessFreshness([d('2025-06-01T00:00:00Z')], NOW).bucket).toBe('aging')
    expect(assessFreshness([d('2023-01-01T00:00:00Z')], NOW).bucket).toBe('stale')
  })
})
