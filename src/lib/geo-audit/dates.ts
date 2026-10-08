/**
 * Date extraction and comparison.
 *
 * Every comparison is made against a clock passed in at call time — never
 * against a hard-coded year or a model's idea of "now". A date is only "future"
 * if it falls on a later calendar day than the run date, so a page published in
 * January and updated in April is correctly past when audited in September of
 * the same year.
 */

export type DateRelation = 'past' | 'today' | 'future'

export interface ExtractedDate {
  /** Normalised ISO-8601 date (yyyy-mm-dd) in UTC. */
  iso: string
  /** Milliseconds since epoch, for comparison. */
  time: number
  /** Where it came from: `jsonld:datePublished`, `meta:article:modified_time`… */
  source: string
  /** The raw string as it appeared on the page. */
  raw: string
}

const MS_PER_DAY = 86_400_000

/** Parse a date string into a normalised entry, or null if it isn't a date. */
export function parseDate(raw: string, source: string): ExtractedDate | null {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return null

  // Reject bare numbers that `Date` would happily reinterpret (e.g. "2024" as a
  // year is fine, but "01." from a numbered list heading is not a date).
  if (/^\d{1,3}$/.test(trimmed)) return null

  // A date with no time is a calendar date, not midnight in whatever timezone
  // the server happens to run in — parsing it locally shifts it by a day.
  const dateOnly = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (dateOnly) {
    const d = utcDate(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    return d ? { iso: toIsoDay(d), time: d.getTime(), source, raw: trimmed } : null
  }

  // Human-written forms are read explicitly, for the same reason.
  const human = parseHumanDate(trimmed)
  if (human) return { iso: toIsoDay(human), time: human.getTime(), source, raw: trimmed }

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return null

  // Guard against absurd values from malformed markup.
  const year = parsed.getUTCFullYear()
  if (year < 1990 || year > 2100) return null

  return { iso: toIsoDay(parsed), time: parsed.getTime(), source, raw: trimmed }
}

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8,
  september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
}

/** Handles "12 April 2026", "April 12, 2026", "Updated: Apr 12 2026". */
export function parseHumanDate(text: string): Date | null {
  const cleaned = text.replace(/(\d+)(st|nd|rd|th)\b/gi, '$1')

  const dmy = cleaned.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})\b/)
  if (dmy) {
    const month = MONTHS[dmy[2].toLowerCase()]
    if (month !== undefined) return utcDate(Number(dmy[3]), month, Number(dmy[1]))
  }

  const mdy = cleaned.match(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/)
  if (mdy) {
    const month = MONTHS[mdy[1].toLowerCase()]
    if (month !== undefined) return utcDate(Number(mdy[3]), month, Number(mdy[2]))
  }

  return null
}

function utcDate(year: number, month: number, day: number): Date | null {
  if (year < 1990 || year > 2100 || day < 1 || day > 31) return null
  const d = new Date(Date.UTC(year, month, day))
  return Number.isNaN(d.getTime()) ? null : d
}

function toIsoDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function startOfUtcDay(time: number): number {
  return Math.floor(time / MS_PER_DAY) * MS_PER_DAY
}

/**
 * Compare a date to the run clock at day granularity. Only a strictly later
 * calendar day counts as future — a timestamp earlier today is `today`, not
 * `future`, and a date months earlier in the same year is `past`.
 */
export function relationToNow(date: ExtractedDate, now: Date): DateRelation {
  const dateDay = startOfUtcDay(date.time)
  const nowDay = startOfUtcDay(now.getTime())
  if (dateDay > nowDay) return 'future'
  if (dateDay === nowDay) return 'today'
  return 'past'
}

/** Whole days between a date and the run clock. Negative for future dates. */
export function daysSince(date: ExtractedDate, now: Date): number {
  return Math.round((startOfUtcDay(now.getTime()) - startOfUtcDay(date.time)) / MS_PER_DAY)
}

export interface FreshnessAssessment {
  /** The most recent date that is not in the future. */
  mostRecent: ExtractedDate | null
  daysOld: number | null
  /** Dates that postdate the run — genuinely suspect, e.g. templating bugs. */
  futureDates: ExtractedDate[]
  bucket: 'current' | 'recent' | 'aging' | 'stale' | 'none'
}

/**
 * Pick the freshness signal from a set of extracted dates. Future-dated entries
 * are set aside rather than treated as the newest, but they are reported so a
 * genuine templating bug is still surfaced.
 */
export function assessFreshness(dates: ExtractedDate[], now: Date): FreshnessAssessment {
  const futureDates = dates.filter((d) => relationToNow(d, now) === 'future')
  const usable = dates.filter((d) => relationToNow(d, now) !== 'future')

  if (usable.length === 0) {
    return { mostRecent: null, daysOld: null, futureDates, bucket: 'none' }
  }

  const mostRecent = usable.reduce((a, b) => (b.time > a.time ? b : a))
  const daysOld = daysSince(mostRecent, now)

  const bucket =
    daysOld <= 90 ? 'current' : daysOld <= 240 ? 'recent' : daysOld <= 540 ? 'aging' : 'stale'

  return { mostRecent, daysOld, futureDates, bucket }
}
