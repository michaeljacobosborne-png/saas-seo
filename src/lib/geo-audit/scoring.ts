/**
 * Score bookkeeping. Everything that turns raw points into labels, grades and
 * totals lives here so the two analyzers cannot drift apart.
 */

import {
  BAND_RANK,
  GOOD_RATIO,
  GRADE_THRESHOLDS,
  MIN_ASSESSED_SHARE,
  NEEDS_WORK_RATIO,
  STATUS_LABELS,
  type Band,
  type CitabilitySignal,
  type Confidence,
  type Evidence,
  type Factor,
  type FactorState,
  type FactorStatus,
} from './types'

/** Builder used by the factor scorers to accumulate points with evidence. */
export class FactorBuilder {
  private points = 0
  private readonly evidence: Evidence[] = []
  private readonly details: string[] = []
  private unverifiedReason: string | null = null

  constructor(
    readonly id: string,
    readonly name: string,
    readonly maxScore: number,
  ) {}

  /** Award points and record why. */
  award(points: number, detail: string, evidence?: Evidence | Evidence[]): this {
    this.points += points
    if (detail) this.details.push(detail)
    if (evidence) this.evidence.push(...(Array.isArray(evidence) ? evidence : [evidence]))
    return this
  }

  /** Record something genuinely absent from the pages we inspected. */
  miss(detail: string): this {
    if (detail) this.details.push(detail)
    return this
  }

  /** Attach supporting evidence without changing the score. */
  note(evidence: Evidence | Evidence[]): this {
    this.evidence.push(...(Array.isArray(evidence) ? evidence : [evidence]))
    return this
  }

  /**
   * Mark the factor unassessable. It is then excluded from the totals entirely
   * rather than scored zero, which would read as a real absence.
   */
  unverified(reason: string): this {
    this.unverifiedReason = reason
    return this
  }

  build(): Factor {
    if (this.unverifiedReason) {
      return {
        id: this.id,
        name: this.name,
        state: 'unverified',
        score: 0,
        maxScore: this.maxScore,
        scored: false,
        status: 'unverified',
        label: STATUS_LABELS.unverified,
        detail: this.unverifiedReason,
        evidence: this.evidence,
      }
    }

    const score = clamp(this.points, 0, this.maxScore)
    const state: FactorState = score > 0 || this.evidence.length > 0 ? 'present' : 'absent'
    const status = deriveStatus(score, this.maxScore)

    return {
      id: this.id,
      name: this.name,
      state,
      score,
      maxScore: this.maxScore,
      scored: true,
      status,
      label: STATUS_LABELS[status],
      detail: this.details.join(' ').trim(),
      evidence: this.evidence,
    }
  }
}

/**
 * Builder for a banded citability signal.
 *
 * Deliberately has no `award(points)` — bands are assigned from what was found,
 * not accumulated arithmetically. That is the whole reason citability is banded:
 * there is no defensible sum that turns "has a named author" and "coined a term"
 * into a single number.
 */
export class SignalBuilder {
  private evidence: Evidence[] = []
  private details: string[] = []
  private assigned: Band | null = null
  private unverifiedReason: string | null = null

  constructor(
    readonly id: string,
    readonly name: string,
  ) {}

  found(band: Exclude<Band, 'unverified' | 'absent'>, detail: string, evidence?: Evidence | Evidence[]): this {
    // Keep the strongest band claimed, so ordering of checks cannot change it.
    if (!this.assigned || BAND_RANK[band] > BAND_RANK[this.assigned]) this.assigned = band
    if (detail) this.details.push(detail)
    if (evidence) this.evidence.push(...(Array.isArray(evidence) ? evidence : [evidence]))
    return this
  }

  missing(detail: string): this {
    if (detail) this.details.push(detail)
    return this
  }

  unverified(reason: string): this {
    this.unverifiedReason = reason
    return this
  }

  build(): CitabilitySignal {
    if (this.unverifiedReason) {
      return {
        id: this.id,
        name: this.name,
        band: 'unverified',
        state: 'unverified',
        detail: this.unverifiedReason,
        evidence: this.evidence,
      }
    }
    const band: Band = this.assigned ?? 'absent'
    return {
      id: this.id,
      name: this.name,
      band,
      state: band === 'absent' ? 'absent' : 'present',
      detail: this.details.join(' ').trim(),
      evidence: this.evidence,
    }
  }
}

/** Roll individual signals up into one overall band. */
export function overallBand(signals: CitabilitySignal[]): Band {
  const scored = signals.filter((s) => s.band !== 'unverified')
  if (scored.length === 0) return 'unverified'

  const strong = scored.filter((s) => s.band === 'strong').length
  const adequatePlus = scored.filter((s) => s.band === 'strong' || s.band === 'adequate').length
  const absent = scored.filter((s) => s.band === 'absent').length

  if (strong >= 3 && absent <= 1) return 'strong'
  if (adequatePlus >= 3) return 'adequate'
  if (adequatePlus >= 1) return 'weak'
  return 'absent'
}

export function bandCounts(signals: CitabilitySignal[]): Record<Band, number> {
  const counts: Record<Band, number> = { strong: 0, adequate: 0, weak: 0, absent: 0, unverified: 0 }
  for (const s of signals) counts[s.band]++
  return counts
}

export function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  return Math.max(min, Math.min(max, n))
}

/**
 * The only place a factor status is decided. Derived purely from the score
 * ratio, so "10/10 — Needs work" is unrepresentable.
 */
export function deriveStatus(score: number, maxScore: number): FactorStatus {
  if (maxScore <= 0) return 'unverified'
  const ratio = clamp(score, 0, maxScore) / maxScore
  if (ratio >= GOOD_RATIO) return 'good'
  if (ratio >= NEEDS_WORK_RATIO) return 'needs-work'
  return 'missing'
}

export function gradeForScore(score: number): string {
  const band = GRADE_THRESHOLDS.find((t) => score >= t.min)
  return band ? band.grade : 'F'
}

export interface Totals {
  rawScore: number
  assessedMaxScore: number
  totalMaxScore: number
  score: number
  grade: string
  scoreWithheld: boolean
  withheldReason?: string
  confidence: Confidence
}

/**
 * Roll factors up into a total. Only scored factors contribute; the 0-100 score
 * is the assessed points normalised over the assessed maximum, so it never
 * silently penalises a site for something we could not read.
 */
export function computeTotals(factors: Factor[]): Totals {
  const scored = factors.filter((f) => f.scored)
  const rawScore = scored.reduce((sum, f) => sum + f.score, 0)
  const assessedMaxScore = scored.reduce((sum, f) => sum + f.maxScore, 0)
  const totalMaxScore = factors.reduce((sum, f) => sum + f.maxScore, 0)

  const assessedShare = totalMaxScore > 0 ? assessedMaxScore / totalMaxScore : 0
  const confidence: Confidence =
    assessedShare >= 0.95 ? 'high' : assessedShare >= MIN_ASSESSED_SHARE ? 'partial' : 'low'

  if (assessedMaxScore === 0 || assessedShare < MIN_ASSESSED_SHARE) {
    const unverifiedNames = factors.filter((f) => !f.scored).map((f) => f.name)
    return {
      rawScore,
      assessedMaxScore,
      totalMaxScore,
      score: 0,
      grade: 'N/A',
      scoreWithheld: true,
      withheldReason:
        unverifiedNames.length > 0
          ? `Not enough of the page could be read to score it fairly. Unassessed: ${unverifiedNames.join(', ')}.`
          : 'Not enough of the page could be read to score it fairly.',
      confidence,
    }
  }

  const score = Math.round((rawScore / assessedMaxScore) * 100)
  return {
    rawScore,
    assessedMaxScore,
    totalMaxScore,
    score,
    grade: gradeForScore(score),
    scoreWithheld: false,
    confidence,
  }
}

/**
 * Internal consistency check. Returns a list of violations; an empty list means
 * the report is self-consistent. Used by the engine (to fail loudly in dev) and
 * by the regression tests.
 */
export function findScoreInconsistencies(factors: Factor[], totals: Totals): string[] {
  const problems: string[] = []

  for (const f of factors) {
    if (f.score > f.maxScore) {
      problems.push(`${f.name}: score ${f.score} exceeds maxScore ${f.maxScore}`)
    }
    if (f.score < 0) {
      problems.push(`${f.name}: negative score ${f.score}`)
    }
    if (f.scored) {
      const expected = deriveStatus(f.score, f.maxScore)
      if (f.status !== expected) {
        problems.push(
          `${f.name}: status "${f.status}" contradicts score ${f.score}/${f.maxScore} (expected "${expected}")`,
        )
      }
      if (f.state === 'unverified') {
        problems.push(`${f.name}: scored but state is "unverified"`)
      }
    } else {
      if (f.status !== 'unverified') {
        problems.push(`${f.name}: unscored factor must have status "unverified", got "${f.status}"`)
      }
      if (f.score !== 0) {
        problems.push(`${f.name}: unscored factor must report score 0, got ${f.score}`)
      }
    }
    if (f.label !== STATUS_LABELS[f.status]) {
      problems.push(`${f.name}: label "${f.label}" does not match status "${f.status}"`)
    }
  }

  const sum = factors.filter((f) => f.scored).reduce((s, f) => s + f.score, 0)
  if (sum !== totals.rawScore) {
    problems.push(`factor scores sum to ${sum} but rawScore is ${totals.rawScore}`)
  }

  const assessedMax = factors.filter((f) => f.scored).reduce((s, f) => s + f.maxScore, 0)
  if (assessedMax !== totals.assessedMaxScore) {
    problems.push(
      `assessed maxScores sum to ${assessedMax} but assessedMaxScore is ${totals.assessedMaxScore}`,
    )
  }

  if (!totals.scoreWithheld) {
    const expectedScore = Math.round((totals.rawScore / totals.assessedMaxScore) * 100)
    if (totals.score !== expectedScore) {
      problems.push(
        `total score ${totals.score} does not match ${totals.rawScore}/${totals.assessedMaxScore} normalised (${expectedScore})`,
      )
    }
    const expectedGrade = gradeForScore(totals.score)
    if (totals.grade !== expectedGrade) {
      problems.push(`grade "${totals.grade}" contradicts score ${totals.score} (expected "${expectedGrade}")`)
    }
  }

  return problems
}

/**
 * Band-vs-evidence consistency.
 *
 * The failure this prevents is a signal claiming `strong` with nothing to show
 * for it — which is how a heuristic quietly turns into an assertion. Every
 * positive band must be able to point at something; every `absent` must not.
 */
export function findBandInconsistencies(signals: CitabilitySignal[], overall: Band): string[] {
  const problems: string[] = []

  for (const s of signals) {
    if (s.band === 'strong' || s.band === 'adequate') {
      if (s.evidence.length === 0) {
        problems.push(`${s.name}: band "${s.band}" with no supporting evidence`)
      }
      if (s.state !== 'present') {
        problems.push(`${s.name}: band "${s.band}" but state is "${s.state}"`)
      }
    }

    if (s.band === 'absent') {
      if (s.evidence.length > 0) {
        problems.push(`${s.name}: band "absent" but ${s.evidence.length} evidence item(s) attached`)
      }
      if (s.state !== 'absent') {
        problems.push(`${s.name}: band "absent" but state is "${s.state}"`)
      }
    }

    if (s.band === 'unverified' && s.state !== 'unverified') {
      problems.push(`${s.name}: band "unverified" but state is "${s.state}"`)
    }

    if (!s.detail.trim()) {
      problems.push(`${s.name}: no detail recorded — every signal must say what it looked for`)
    }

    for (const e of s.evidence) {
      if (!/^https?:\/\//.test(e.url)) {
        problems.push(`${s.name}: evidence is not attributed to an inspected URL ("${e.url}")`)
      }
    }
  }

  const expected = overallBand(signals)
  if (overall !== expected) {
    problems.push(`overall band "${overall}" does not match the signal distribution (expected "${expected}")`)
  }

  // An overall band must never outrank every individual signal.
  const best = signals.reduce((acc, s) => Math.max(acc, BAND_RANK[s.band]), -1)
  if (BAND_RANK[overall] > best) {
    problems.push(`overall band "${overall}" is stronger than any individual signal`)
  }

  return problems
}
