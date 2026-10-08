/**
 * Values promoted out of `audit_results.result` (JSONB) into real columns.
 *
 * Every run that lands before this is wired up is a run we cannot backfill —
 * the peer benchmark ("median of the last N URLs we scanned") and the monthly
 * re-run delta both need these values to exist from the first run onward.
 *
 * The rule that matters: a WITHHELD score is NULL, never 0.
 *
 * `AuditReport.score` is 0 when the score was withheld, because the legacy
 * numeric field cannot express "no score". Writing that 0 into a column that
 * gets averaged would drag every benchmark down with scores that were never
 * measured. NULL is the only honest value, and SQL aggregates skip it.
 */

import type { AuditReport, Band } from './types'

export interface PromotedColumns {
  retrievability_score: number | null
  citability_band: Band | null
}

const BANDS: readonly string[] = ['strong', 'adequate', 'weak', 'absent', 'unverified']

/**
 * Extract the promoted values from whatever was stored.
 *
 * Deliberately tolerant: this also receives content-audit results (which have
 * `gaps[]` and no scores at all) and reports written before Phase B. Anything
 * unrecognised yields nulls rather than throwing — a failed promotion must never
 * block the lead capture that pays for the tool.
 */
export function promotedColumns(result: unknown): PromotedColumns {
  const empty: PromotedColumns = { retrievability_score: null, citability_band: null }
  if (!result || typeof result !== 'object') return empty

  const r = result as Partial<AuditReport> & Record<string, unknown>

  let score: number | null = null
  const retr = r.retrievability
  if (retr && typeof retr === 'object') {
    const withheld = (retr as { scoreWithheld?: unknown }).scoreWithheld === true
    const raw = (retr as { score?: unknown }).score
    // Withheld means "we declined to publish a number" — that is NULL, not zero.
    if (!withheld && typeof raw === 'number' && Number.isFinite(raw)) {
      score = Math.max(0, Math.min(100, Math.round(raw)))
    }
  } else if (r.scoreWithheld !== true && typeof r.score === 'number' && Number.isFinite(r.score)) {
    // Pre-Phase-B report: the legacy top-level score is the retrievability score.
    score = Math.max(0, Math.min(100, Math.round(r.score)))
  }

  let band: Band | null = null
  const cit = r.citability
  if (cit && typeof cit === 'object') {
    const raw = (cit as { band?: unknown }).band
    if (typeof raw === 'string' && BANDS.includes(raw)) band = raw as Band
  }

  return { retrievability_score: score, citability_band: band }
}
