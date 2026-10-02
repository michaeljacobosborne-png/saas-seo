'use client'

/**
 * Shared presentation for the free GEO and AO analyzer reports.
 *
 * Both analyzers render the same score header and factor list, so the rules that
 * keep the display honest — showing "—" instead of 0 for an unassessed factor,
 * withholding the score when the engine withheld it, surfacing the evidence
 * behind every finding — live in one place and cannot drift apart.
 */

export interface Evidence {
  url: string
  kind: string
  snippet: string
}

export interface Factor {
  /** Stable check id. Absent on reports stored before Phase A. */
  id?: string
  name: string
  score: number
  maxScore: number
  status: 'good' | 'needs-work' | 'missing' | 'unverified'
  /** False when the factor could not be assessed; excluded from the total. */
  scored?: boolean
  label?: string
  detail: string
  evidence?: Evidence[]
}

export interface Recommendation {
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  impact: string
}

export type Band = 'strong' | 'adequate' | 'weak' | 'absent' | 'unverified'

export interface CitabilitySignal {
  id: string
  name: string
  band: Band
  detail: string
  evidence?: Evidence[]
}

export interface RetrievabilityGroup {
  id: string
  name: string
  score: number
  maxScore: number
  deduction: number
  scored: boolean
  status: Factor['status']
  label: string
  checks: Factor[]
}

export interface Retrievability {
  score: number
  grade: string
  rawScore: number
  assessedMaxScore: number
  scoreWithheld: boolean
  withheldReason?: string
  groups: RetrievabilityGroup[]
}

export interface Citability {
  band: Band
  label: string
  signals: CitabilitySignal[]
}

export interface Gap {
  quadrant: string
  headline: string
  diagnosis: string
  nextStep: string
}

export interface AnalysisResult {
  score: number
  grade: string
  breakdown: Factor[]
  recommendations: Recommendation[]
  quickWins: string[]
  scoreWithheld?: boolean
  withheldReason?: string
  rawScore?: number
  assessedMaxScore?: number
  confidence?: 'high' | 'partial' | 'low'
  pagesInspected?: { url: string; ok: boolean; wordCount: number }[]
  notes?: string[]
  /** Phase B. Absent on reports stored before the two-score model shipped. */
  retrievability?: Retrievability
  citability?: Citability
  gap?: Gap
}

// ── Band presentation ─────────────────────────────────────────────────────────

const BAND_ORDER: Band[] = ['absent', 'weak', 'adequate', 'strong']

const BAND_STYLE: Record<Band, { chip: string; bar: string; label: string }> = {
  strong: { chip: 'bg-green-100 text-green-700', bar: '#16a34a', label: 'Strong' },
  adequate: { chip: 'bg-[#B87333]/12 text-[#9A6228]', bar: '#B87333', label: 'Adequate' },
  weak: { chip: 'bg-amber-100 text-amber-700', bar: '#d97706', label: 'Weak' },
  absent: { chip: 'bg-red-100 text-red-700', bar: '#dc2626', label: 'Absent' },
  unverified: { chip: 'bg-[#F7F3EC] text-[#57534E] border border-[#E7E0D6]', bar: '#E7E0D6', label: 'Unable to assess' },
}

export function BandChip({ band }: { band: Band }) {
  const s = BAND_STYLE[band] ?? BAND_STYLE.unverified
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${s.chip}`}>{s.label}</span>
}

/**
 * Citability as a four-step scale rather than a number.
 *
 * A 0-100 integer here would be false precision — there is no defensible
 * arithmetic that turns "named author" into points. The steps show position
 * without implying a measurement.
 */
function BandScale({ band }: { band: Band }) {
  if (band === 'unverified') {
    return <div className="h-2 rounded-full bg-[#F7F3EC] border border-[#E7E0D6]" />
  }
  const filled = BAND_ORDER.indexOf(band) + 1
  return (
    <div className="flex gap-1" aria-label={`Citability: ${BAND_STYLE[band].label}`}>
      {BAND_ORDER.map((_, i) => (
        <div
          key={i}
          className="h-2 flex-1 rounded-full"
          style={{ backgroundColor: i < filled ? BAND_STYLE[band].bar : '#F7F3EC' }}
        />
      ))}
    </div>
  )
}

/**
 * Turns a `{ type: 'result', ... }` NDJSON event into an AnalysisResult.
 *
 * The engine's own discriminator is `tool`, so `type` here belongs to the event
 * envelope and must be dropped. Everything else is carried through, so new
 * report fields reach the UI without each client having to list them.
 */
export function toAnalysisResult(evt: Record<string, unknown>): AnalysisResult {
  const rest = { ...evt }
  Reflect.deleteProperty(rest, 'type')
  return {
    ...(rest as Omit<AnalysisResult, 'score' | 'grade' | 'breakdown' | 'recommendations' | 'quickWins'>),
    score: typeof rest.score === 'number' ? rest.score : 0,
    grade: typeof rest.grade === 'string' ? rest.grade : 'F',
    breakdown: Array.isArray(rest.breakdown) ? (rest.breakdown as Factor[]) : [],
    recommendations: Array.isArray(rest.recommendations) ? (rest.recommendations as Recommendation[]) : [],
    quickWins: Array.isArray(rest.quickWins) ? (rest.quickWins as string[]) : [],
  }
}

const STATUS_STYLES: Record<Factor['status'], string> = {
  good: 'bg-green-100 text-green-700',
  'needs-work': 'bg-amber-100 text-amber-700',
  missing: 'bg-red-100 text-red-700',
  unverified: 'bg-[#F7F3EC] text-[#57534E] border border-[#E7E0D6]',
}

const STATUS_LABELS: Record<Factor['status'], string> = {
  good: 'Good',
  'needs-work': 'Needs work',
  // Deliberately not "Missing": we only inspected some pages.
  missing: 'Not on this page',
  unverified: 'Unable to assess',
}

export function StatusBadge({ status, label }: { status: Factor['status']; label?: string }) {
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
        STATUS_STYLES[status] ?? STATUS_STYLES.unverified
      }`}
    >
      {label ?? STATUS_LABELS[status] ?? status}
    </span>
  )
}

export function ScoreHeader({ result, scoreLabel }: { result: AnalysisResult; scoreLabel: string }) {
  const { score, grade, scoreWithheld, withheldReason, rawScore, assessedMaxScore } = result

  if (scoreWithheld) {
    return (
      <div className="mb-6">
        <div className="flex items-center gap-6 mb-3">
          <div className="w-24 h-24 rounded-full flex items-center justify-center border-4 border-[#E7E0D6] shrink-0">
            <span className="text-3xl font-bold text-[#998876]">—</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#1C1917]">No score published</p>
            <p className="text-xs text-[#998876] max-w-xs mt-1">
              We only publish a score when we can read enough of the page to stand behind it.
            </p>
          </div>
        </div>
        {withheldReason && (
          <p className="text-sm text-[#57534E] bg-[#F7F3EC] border border-[#E7E0D6] rounded-xl px-4 py-3">
            {withheldReason}
          </p>
        )}
      </div>
    )
  }

  const color = score >= 70 ? '#16a34a' : score >= 40 ? '#d97706' : '#dc2626'
  const gradeColor =
    score >= 70
      ? 'bg-green-100 text-green-700'
      : score >= 40
      ? 'bg-amber-100 text-amber-700'
      : 'bg-red-100 text-red-700'

  return (
    <div className="flex items-center gap-6 mb-6">
      <div
        className="w-24 h-24 rounded-full flex items-center justify-center border-4 shrink-0"
        style={{ borderColor: color }}
      >
        <span className="text-3xl font-bold" style={{ color }}>
          {score}
        </span>
      </div>
      <div>
        <div
          className={`inline-flex items-center justify-center w-12 h-12 rounded-xl text-2xl font-bold mb-1 ${gradeColor}`}
        >
          {grade}
        </div>
        <p className="text-sm text-[#57534E]">{scoreLabel}</p>
        <p className="text-xs text-[#998876]">
          {typeof rawScore === 'number' && assessedMaxScore
            ? `${rawScore} of ${assessedMaxScore} points assessed`
            : 'out of 100'}
        </p>
      </div>
    </div>
  )
}

/**
 * The headline artefact: two scores and the distance between them.
 *
 * They are shown side by side and never averaged. The diagnosis underneath is
 * derived from the quadrant, and describes what the page CARRIES — it does not
 * claim anything about what engines are doing with it.
 */
export function TwoScorePanel({ result }: { result: AnalysisResult }) {
  const { retrievability: r, citability: c, gap } = result
  if (!r || !c || !gap) return null

  const rColor = r.score >= 70 ? '#16a34a' : r.score >= 40 ? '#d97706' : '#dc2626'
  const withheld = r.scoreWithheld

  return (
    <div className="mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        {/* Retrievability — rule-derived, numeric */}
        <div className="bg-white border border-[#E7E0D6] rounded-xl p-4">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#998876]">Retrievable</span>
            <span className="text-[10px] uppercase tracking-wide text-[#998876]">Measured</span>
          </div>
          {withheld ? (
            <>
              <p className="text-3xl font-bold text-[#998876] leading-none mb-2">—</p>
              <p className="text-xs text-[#57534E]">Not enough could be read to score it.</p>
            </>
          ) : (
            <>
              <p className="text-3xl font-bold leading-none mb-1" style={{ color: rColor }}>
                {r.score}
                <span className="text-base font-normal text-[#998876]">/100</span>
              </p>
              <div className="h-2 rounded-full bg-[#F7F3EC] overflow-hidden mb-2">
                <div className="h-full rounded-full" style={{ width: `${r.score}%`, backgroundColor: rColor }} />
              </div>
              <p className="text-xs text-[#57534E]">Can an engine reach, parse and lift an answer from this page.</p>
            </>
          )}
        </div>

        {/* Citability — heuristic, banded */}
        <div className="bg-white border border-[#E7E0D6] rounded-xl p-4">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#998876]">Citable</span>
            <span className="text-[10px] uppercase tracking-wide text-[#998876]">Assessed</span>
          </div>
          <p className="text-3xl font-bold leading-none mb-2" style={{ color: BAND_STYLE[c.band].bar }}>
            {c.label}
          </p>
          <div className="mb-2">
            <BandScale band={c.band} />
          </div>
          <p className="text-xs text-[#57534E]">
            If an engine lifts this content, does anything in it force attribution back to you.
          </p>
        </div>
      </div>

      {/* The Gap — the diagnosis */}
      <div className="bg-[#1C1917] rounded-xl p-5 text-[#F7F3EC]">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#A89070] mb-2">The gap</p>
        <h3 className="text-lg font-bold mb-2 leading-snug">{gap.headline}</h3>
        <p className="text-sm text-[#D8CFC2] leading-relaxed mb-3">{gap.diagnosis}</p>
        <p className="text-sm text-[#F7F3EC]">
          <span className="font-semibold">Where to start: </span>
          {gap.nextStep}
        </p>
      </div>
    </div>
  )
}

/** Retrievability groups with the points lost shown inline. */
export function RetrievabilityGroups({ result }: { result: AnalysisResult }) {
  const r = result.retrievability
  if (!r) return null

  return (
    <div className="space-y-4">
      {r.groups.map((g) => (
        <div key={g.id}>
          <div className="flex items-center justify-between mb-1 gap-3">
            <span className="text-sm font-medium text-[#1C1917]">{g.name}</span>
            <div className="flex items-center gap-2">
              {g.scored ? (
                <>
                  {g.deduction > 0 && (
                    <span className="text-xs font-medium text-[#9A6228]">−{g.deduction}</span>
                  )}
                  <span className="text-xs text-[#998876]">
                    {g.score}/{g.maxScore}
                  </span>
                </>
              ) : (
                <span className="text-xs text-[#998876]">—</span>
              )}
              <StatusBadge status={g.status} label={g.label} />
            </div>
          </div>
          <div className="h-1.5 bg-[#F7F3EC] rounded-full overflow-hidden mb-2">
            {g.scored && (
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.round((g.score / g.maxScore) * 100)}%`,
                  backgroundColor:
                    g.status === 'good' ? '#16a34a' : g.status === 'needs-work' ? '#d97706' : '#dc2626',
                }}
              />
            )}
          </div>
          <ul className="space-y-1.5 border-l-2 border-[#E7E0D6] pl-3">
            {g.checks.map((c) => (
              <li key={c.id ?? c.name} className="text-xs text-[#57534E]">
                <span className="font-medium text-[#1C1917]">{c.name}</span>
                <span className="text-[#998876]">
                  {' '}
                  {c.scored === false ? '—' : `${c.score}/${c.maxScore}`}
                </span>
                {c.detail && <span className="block leading-relaxed">{c.detail}</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

/** The six attribution signals, banded rather than scored. */
export function CitabilitySignals({ result }: { result: AnalysisResult }) {
  const c = result.citability
  if (!c) return null

  return (
    <div className="space-y-3">
      {c.signals.map((s) => (
        <div key={s.id} className="border-b border-[#F7F3EC] last:border-0 pb-3 last:pb-0">
          <div className="flex items-center justify-between mb-1 gap-3">
            <span className="text-sm font-medium text-[#1C1917]">{s.name}</span>
            <BandChip band={s.band} />
          </div>
          {s.detail && <p className="text-xs text-[#57534E] leading-relaxed">{s.detail}</p>}
          {s.evidence && s.evidence.length > 0 && (
            <details className="mt-1.5">
              <summary className="text-xs text-[#B87333] cursor-pointer hover:text-[#9A6228] transition-colors">
                What we found ({s.evidence.length})
              </summary>
              <ul className="mt-1.5 space-y-1.5 border-l-2 border-[#E7E0D6] pl-3">
                {s.evidence.map((e, i) => (
                  <li key={i} className="text-xs text-[#57534E]">
                    <span className="text-[#998876] uppercase tracking-wide text-[10px]">{e.kind}</span>
                    <span className="block break-words">{e.snippet}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      ))}
    </div>
  )
}

export function FactorBreakdown({ result, note }: { result: AnalysisResult; note: string }) {
  return (
    <>
      <div className="space-y-4">
        {result.breakdown.map((factor, i) => {
          const unscored = factor.scored === false || factor.status === 'unverified'
          return (
            <div key={i}>
              <div className="flex items-center justify-between mb-1 gap-3">
                <span className="text-sm font-medium text-[#1C1917]">{factor.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#998876]">
                    {unscored ? '—' : `${factor.score}/${factor.maxScore}`}
                  </span>
                  <StatusBadge status={factor.status} label={factor.label} />
                </div>
              </div>
              <div className="h-1.5 bg-[#F7F3EC] rounded-full overflow-hidden">
                {!unscored && (
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.round((factor.score / factor.maxScore) * 100)}%`,
                      backgroundColor:
                        factor.status === 'good'
                          ? '#16a34a'
                          : factor.status === 'needs-work'
                          ? '#d97706'
                          : '#dc2626',
                    }}
                  />
                )}
              </div>
              {factor.detail && (
                <p className="text-xs text-[#57534E] mt-1.5 leading-relaxed">{factor.detail}</p>
              )}
              {factor.evidence && factor.evidence.length > 0 && (
                <details className="mt-1.5">
                  <summary className="text-xs text-[#B87333] cursor-pointer hover:text-[#9A6228] transition-colors">
                    What we found ({factor.evidence.length})
                  </summary>
                  <ul className="mt-1.5 space-y-1.5 border-l-2 border-[#E7E0D6] pl-3">
                    {factor.evidence.map((e, j) => (
                      <li key={j} className="text-xs text-[#57534E]">
                        <span className="text-[#998876] uppercase tracking-wide text-[10px]">{e.kind}</span>
                        <span className="block break-words">{e.snippet}</span>
                        <span className="block text-[10px] text-[#998876] break-all">{e.url}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )
        })}
      </div>

      {result.pagesInspected && result.pagesInspected.length > 0 && (
        <p className="text-xs text-[#998876] mt-5 pt-4 border-t border-[#F7F3EC]">
          Pages inspected:{' '}
          {result.pagesInspected
            .filter((p) => p.ok)
            .map((p) => p.url)
            .join(', ') || 'none'}
          . {note}
        </p>
      )}
    </>
  )
}
