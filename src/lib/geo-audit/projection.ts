/**
 * Projected Retrievable score (decision 29): "fix these findings and Retrievable
 * goes from X to Y".
 *
 * Arithmetic on our own rubric, by the same `computeTotals` that produced X.
 * Every judged-now check that is short of full marks is listed with the points
 * it would add on the card's 0–100 scale. Never expressed as time, traffic,
 * position or likelihood of being cited; it says nothing about the world, only
 * about our rubric.
 *
 * Client-safe: no I/O, works on a stored report.
 */
import type { DraftReport } from './draft-report'
import { computeTotals } from './scoring'

/** Same list as draft-report's DRAFT_ASSESSABLE_GROUPS, kept here so this file stays client-safe. */
const DRAFT_ASSESSABLE_GROUPS: readonly string[] = ['chunkability', 'extractability']
import type { Factor } from './types'

export interface ProjectedFinding {
  id: string
  name: string
  /** Rubric points still available on this check. */
  rubricPoints: number
  /** The same points on the card's 0–100 scale; these sum exactly to `to - from`. */
  points: number
}

export interface Projection {
  from: number
  to: number
  findings: ProjectedFinding[]
}

/** Null when there is nothing to project: score withheld, or every check at full marks. */
export function projectRetrievability(draft: DraftReport): Projection | null {
  const r = draft.retrievability
  if (r.scoreWithheld) return null
  const checks: Factor[] = r.groups.filter((g) => DRAFT_ASSESSABLE_GROUPS.includes(g.id)).flatMap((g) => g.checks)
  const open = checks.filter((c) => c.scored && c.score < c.maxScore)
  if (!open.length) return null

  const from = computeTotals(checks).score
  const all = computeTotals(checks.map((c) => (c.scored ? { ...c, score: c.maxScore } : c)))
  if (all.scoreWithheld) return null
  const to = all.score

  // Apportion the card-scale gain across findings by largest remainder, so the
  // listed points add up to exactly to - from rather than drifting by rounding.
  const assessed = all.assessedMaxScore
  const exact = open.map((c) => ((c.maxScore - c.score) / assessed) * 100)
  const floors = exact.map(Math.floor)
  let left = to - from - floors.reduce((s, n) => s + n, 0)
  const order = exact.map((e, i) => ({ i, rem: e - floors[i] })).sort((a, b) => b.rem - a.rem)
  for (const { i } of order) {
    if (left <= 0) break
    floors[i]++
    left--
  }

  const findings = open
    .map((c, i) => ({ id: c.id, name: c.name, rubricPoints: c.maxScore - c.score, points: floors[i] }))
    .sort((a, b) => b.points - a.points || b.rubricPoints - a.rubricPoints)
  return { from, to, findings }
}
