/**
 * Shared types for the GEO/AO audit engine.
 *
 * Design rules that the rest of the engine depends on:
 *  - A factor is in exactly one of three states: `present`, `absent` (from the
 *    inspected pages) or `unverified` (we could not assess it). Partial presence
 *    is expressed through the score, never through a fourth state.
 *  - `status` is always DERIVED from the score ratio (see `deriveStatus`), so a
 *    full-marks factor can never be labelled "Needs work".
 *  - Every finding carries `evidence`: the URL inspected plus the supporting
 *    text or markup snippet.
 */

import type { AccessReport } from './access'

export type FactorState = 'present' | 'absent' | 'unverified'

/** Legacy-compatible status values. `unverified` is new; older UIs fall back. */
export type FactorStatus = 'good' | 'needs-work' | 'missing' | 'unverified'

export type EvidenceKind =
  | 'heading'
  | 'link'
  | 'text'
  | 'jsonld'
  | 'microdata'
  | 'meta'
  | 'list'
  | 'table'
  | 'date'
  | 'contact'
  | 'social'
  | 'image'

export interface Evidence {
  /** The URL actually inspected to produce this evidence. */
  url: string
  kind: EvidenceKind
  /** Supporting text or markup snippet, trimmed for display. */
  snippet: string
}

export interface Factor {
  id: string
  name: string
  state: FactorState
  /**
   * Points awarded. Always a number so legacy consumers never see NaN, but it
   * is only meaningful — and only counted toward the total — when `scored` is
   * true. An unverified factor reports 0 here and must be displayed as "—".
   */
  score: number
  maxScore: number
  /** False when state is `unverified`; such factors are excluded from totals. */
  scored: boolean
  /** Derived from the score ratio — never set by hand, never by the model. */
  status: FactorStatus
  /** Human label matching `status`, e.g. "Good" / "Needs work" / "Missing". */
  label: string
  detail: string
  evidence: Evidence[]
}

export interface Recommendation {
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  /** What the change addresses. Never a predicted traffic or ranking gain. */
  impact: string
}

export interface InspectedPage {
  url: string
  finalUrl: string
  status: number | null
  ok: boolean
  wordCount: number
  /** Why the page could not be used, when `ok` is false. */
  note?: string
  /** Set when a render fallback produced the HTML instead of a plain fetch. */
  renderedBy?: string
}

export type Confidence = 'high' | 'partial' | 'low'

/**
 * Provenance header shown on every report.
 *
 * The point is reproducibility: a reader should be able to tell exactly what we
 * fetched, as whom, when, and what we failed to get. `couldNotFetch` is the item
 * almost no tool builds, and it is what turns a mystifying "your schema is
 * missing" into "we were blocked from loading the script that injects it".
 */
export interface ChainOfCustody {
  fetchedAt: string
  /** The exact User-Agent string sent. */
  userAgent: string
  /** Raw HTML only on free runs; rendering is an entitled capability. */
  renderMode: 'raw' | 'rendered'
  renderedBy?: string
  requestedUrl: string
  finalUrl: string
  httpStatus: number | null
  elapsedMs: number
  /** Resources we could not load, itemised. */
  couldNotFetch: { url: string; reason: string }[]
  /** Every truncation applied, disclosed rather than silent. */
  truncations: {
    subject: string
    originalBytes: number
    keptBytes: number
    disclosure: string
  }[]
}

export interface AuditReport {
  // ── Legacy-compatible surface (stored in audit_results.result JSONB) ───────
  /**
   * Normalised 0-100 readiness score across the factors we could assess.
   * 0 when `scoreWithheld` is true — read `scoreWithheld` before displaying.
   */
  score: number
  grade: string
  breakdown: Factor[]
  recommendations: Recommendation[]
  quickWins: string[]

  // ── Accuracy surface ──────────────────────────────────────────────────────
  /**
   * Which analyzer produced this. Named `tool` rather than `type` so the report
   * can be spread into the NDJSON `{ type: 'result' }` event without clobbering
   * the event discriminator.
   */
  tool: 'geo' | 'ao'
  /** The URL the visitor asked for. */
  url: string
  /** Where we actually ended up after redirects. */
  finalUrl: string
  /** ISO timestamp of the run, from the injected clock. */
  analyzedAt: string
  /** Sum of `score` over scored factors. */
  rawScore: number
  /** Sum of `maxScore` over scored factors. */
  assessedMaxScore: number
  /** Sum of `maxScore` over every factor, assessed or not. */
  totalMaxScore: number
  /** True when too little could be assessed for a score to be meaningful. */
  scoreWithheld: boolean
  withheldReason?: string
  confidence: Confidence
  /** True when extraction or fetching was incomplete in any way. */
  incomplete: boolean
  pagesInspected: InspectedPage[]
  /** Operator-facing notes: render fallback used, pages that failed, etc. */
  notes: string[]

  /** Provenance for this run. Always present. */
  chainOfCustody: ChainOfCustody
  /** Crawler access, robots.txt, llms.txt and indexing directives. */
  access: AccessReport

  // ── Phase B ────────────────────────────────────────────────────────────────
  /**
   * Deterministic, rule-derived. `score` above mirrors `retrievability.score`
   * so stored reports keep rendering in the legacy /report/[token] view.
   */
  retrievability: Retrievability
  /** Heuristic, banded. Never blended with retrievability into one number. */
  citability: Citability
  /** The distance between the two, and what it means. */
  gap: Gap
}

// ── Score thresholds — the single source of truth for labels ────────────────

export const GRADE_THRESHOLDS: ReadonlyArray<{ min: number; grade: string }> = [
  { min: 85, grade: 'A' },
  { min: 70, grade: 'B' },
  { min: 55, grade: 'C' },
  { min: 40, grade: 'D' },
  { min: 0, grade: 'F' },
]

/** A factor scoring at or above this ratio is "Good". */
export const GOOD_RATIO = 0.8
/** At or above this ratio (and below GOOD_RATIO) it is "Needs work". */
export const NEEDS_WORK_RATIO = 0.4

/**
 * Below this share of assessable points we refuse to publish an overall score
 * rather than present a misleading one.
 */
export const MIN_ASSESSED_SHARE = 0.6

// ── Phase B: the two-score model ───────────────────────────────────────────────

/**
 * Citability is judgement, not rule, so it is banded rather than scored.
 *
 * A 0-100 integer would be false precision: there is no defensible arithmetic
 * that makes "named author" worth 7 points and "coined term" worth 4. Bands say
 * what we can actually defend.
 */
export type Band = 'strong' | 'adequate' | 'weak' | 'absent' | 'unverified'

export const BAND_LABELS: Record<Band, string> = {
  strong: 'Strong',
  adequate: 'Adequate',
  weak: 'Weak',
  absent: 'Absent',
  unverified: 'Unable to assess',
}

/** Ordering used to roll individual signals up into an overall band. */
export const BAND_RANK: Record<Band, number> = {
  strong: 3,
  adequate: 2,
  weak: 1,
  absent: 0,
  unverified: -1,
}

export interface CitabilitySignal {
  id: string
  name: string
  band: Band
  state: FactorState
  /** What was looked for, and what was or was not found. */
  detail: string
  evidence: Evidence[]
}

export interface Citability {
  /** Roll-up of the six signals. */
  band: Band
  label: string
  signals: CitabilitySignal[]
  counts: Record<Band, number>
}

export type RetrievabilityGroupId = 'access' | 'parseability' | 'chunkability' | 'extractability'

export interface RetrievabilityGroup {
  id: RetrievabilityGroupId
  name: string
  /** Points awarded across this group's checks. */
  score: number
  maxScore: number
  /** Points lost — what the UI shows inline, per the deduction presentation. */
  deduction: number
  scored: boolean
  status: FactorStatus
  label: string
  /** The individual checks, each carrying its own evidence. */
  checks: Factor[]
}

export interface Retrievability {
  /** 0-100, normalised over the groups we could assess. */
  score: number
  grade: string
  rawScore: number
  assessedMaxScore: number
  totalMaxScore: number
  scoreWithheld: boolean
  withheldReason?: string
  confidence: Confidence
  groups: RetrievabilityGroup[]
}

export type GapQuadrant =
  | 'high-retrievable-low-citable'
  | 'low-retrievable-high-citable'
  | 'low-both'
  | 'high-both'
  | 'indeterminate'

/**
 * The headline artefact: two scores and the distance between them.
 *
 * Wording rule, enforced by test: this may state that content **carries no
 * attribution anchors**. It may NOT state that the site *is being* retrieved
 * without attribution — that is an inference about engine behaviour we cannot
 * observe from a page fetch.
 */
export interface Gap {
  quadrant: GapQuadrant
  headline: string
  diagnosis: string
  /** What to do first, given the quadrant. */
  nextStep: string
}

/** Retrievability at or above this is "high" for quadrant purposes. */
export const HIGH_RETRIEVABILITY = 70

export const STATUS_LABELS: Record<FactorStatus, string> = {
  good: 'Good',
  'needs-work': 'Needs work',
  missing: 'Missing',
  unverified: 'Unable to assess',
}
