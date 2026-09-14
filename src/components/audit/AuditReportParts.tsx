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
