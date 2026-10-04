'use client'

/**
 * Retrievable and Citable for a draft, in the article editor (paid engine thin
 * cut). Same two scores as the free tool (decision 13), named as the framework
 * names them (decision 14), with a draft-specific breakdown (decision 15):
 *
 *   "Judged now"             checks the draft itself carries, with scores
 *   "Judged at publication"  checks that belong to the published page, with the
 *                            reason, and never a zero, a failure or a deduction
 *
 * Every finding shows the text it rests on. From the engine: types, plus the
 * pure projection/scoring arithmetic, so no server code reaches the client bundle.
 */
import type { ReactNode } from 'react'
import { Clock } from 'lucide-react'
import type { DraftReport } from '@/lib/geo-audit/draft-report'
import type { Band } from '@/lib/geo-audit/types'
import { SCORE_DESCRIPTIONS, SCORE_LABELS } from '@/lib/score-labels'
import { draftFixes } from '@/lib/draft-fixes'
import { projectRetrievability } from '@/lib/geo-audit/projection'

const COPPER = '#B87333'

const BAND_COLOR: Record<Band, string> = {
  strong: '#22c55e',
  adequate: COPPER,
  weak: '#f59e0b',
  absent: '#f87171',
  unverified: '#a8a29e',
}
const BAND_ORDER: Band[] = ['absent', 'weak', 'adequate', 'strong']
const BAND_TEXT: Record<Band, string> = {
  strong: 'Strong',
  adequate: 'Adequate',
  weak: 'Weak',
  absent: 'Absent',
  unverified: 'Not assessed',
}

const card = 'bg-[var(--ink)] border border-[rgba(184,115,51,0.2)] rounded-xl'

function ratioColor(score: number, max: number) {
  const r = max > 0 ? score / max : 0
  return r >= 0.8 ? '#22c55e' : r >= 0.4 ? '#f59e0b' : '#f87171'
}

function groupByReason(items: DraftReport['afterPublication']) {
  const out: { reason: string; names: string[] }[] = []
  for (const a of items) {
    const hit = out.find((o) => o.reason === a.reason)
    if (hit) hit.names.push(a.name)
    else out.push({ reason: a.reason, names: [a.name] })
  }
  return out
}

/** Evidence snippets carry an `L12 · ` line prefix that means nothing in a rich-text editor. */
function cleanSnippet(s: string) {
  return s.replace(/^L\d+ · /, '')
}

export function DraftScores({
  draft,
  keyword,
  renderFix,
}: {
  draft: DraftReport
  keyword: string
  /** The host's Fix control for a patch-mode instruction (it owns the sending/sent feedback). */
  renderFix?: (instruction: string) => ReactNode
}) {
  const r = draft.retrievability
  const c = draft.citability
  const projection = projectRetrievability(draft)
  const fixById = new Map(draftFixes(draft, keyword, draft.brandName).map((f) => [f.id, f.instruction]))
  const filled = BAND_ORDER.indexOf(c.band) + 1
  const rColor = r.scoreWithheld ? '#a8a29e' : ratioColor(r.score, 100)

  const judgedNow = r.groups.filter((g) => g.scored)
  const signalsNow = c.signals.filter((s) => s.band !== 'unverified')
  // Unverified signals that are not publication-layer (e.g. no brand name or
  // author fields yet): shown with their reason, never as missing.
  const atPublicationIds = new Set(draft.afterPublication.map((a) => a.id))
  const notAssessed = c.signals.filter((s) => s.band === 'unverified' && !atPublicationIds.has(s.id))

  const fix = (id: string) => {
    const instruction = fixById.get(id)
    return instruction && renderFix ? renderFix(instruction) : null
  }

  return (
    <section className="space-y-4" aria-label={`${SCORE_LABELS.retrievable} and ${SCORE_LABELS.citable}`}>
      {/* The two scores, never blended. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className={`${card} p-5`}>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--cream-faint)]">{SCORE_LABELS.retrievable}</p>
          <p className="mt-1 text-3xl font-bold leading-none" style={{ color: rColor }}>
            {r.scoreWithheld ? '—' : r.score}
            {!r.scoreWithheld && <span className="text-sm font-normal text-[var(--cream-faint)]">/100</span>}
          </p>
          {!r.scoreWithheld && (
            <div className="mt-3 h-1.5 w-full rounded-full bg-[var(--ink-deep)]">
              <div className="h-1.5 rounded-full" style={{ width: `${r.score}%`, background: rColor }} />
            </div>
          )}
          <p className="mt-3 text-xs leading-relaxed text-[var(--cream-dim)]">
            {r.scoreWithheld ? r.withheldReason : SCORE_DESCRIPTIONS.draft.retrievable}
          </p>
        </div>

        <div className={`${card} p-5`}>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--cream-faint)]">{SCORE_LABELS.citable}</p>
          <p className="mt-1 text-3xl font-bold leading-none" style={{ color: BAND_COLOR[c.band] }}>
            {BAND_TEXT[c.band]}
          </p>
          <div className="mt-3 flex gap-1">
            {BAND_ORDER.map((_, i) => (
              <div
                key={i}
                className="h-1.5 flex-1 rounded-full"
                style={{ background: c.band !== 'unverified' && i < filled ? BAND_COLOR[c.band] : 'var(--ink-deep)' }}
              />
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-[var(--cream-dim)]">{SCORE_DESCRIPTIONS.draft.citable}</p>
        </div>
      </div>

      {/* Decision 15: the scope, inline. */}
      <p className="text-xs leading-relaxed text-[var(--cream-dim)]">{draft.scope}</p>

      {/* The gap. */}
      <div className="rounded-xl bg-[#1C1917] border border-[rgba(184,115,51,0.25)] p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#A89070]">The gap</p>
        <h3 className="mt-1 text-base font-bold text-[#F7F3EC]">{draft.gap.headline}</h3>
        <p className="mt-2 text-sm leading-relaxed text-[#D8CFC2]">{draft.gap.diagnosis}</p>
        <p className="mt-2 text-sm leading-relaxed text-[#F7F3EC]">
          <strong>Where to start: </strong>
          {draft.gap.nextStep}
        </p>
      </div>

      {/* Decision 29: a projected score on our own rubric, never time, traffic or position. */}
      {projection && (
        <div className={`${card} p-5`}>
          <h3 className="text-sm font-semibold text-[var(--cream)]">
            Fix these and {SCORE_LABELS.retrievable} goes from {projection.from} to {projection.to}
          </h3>
          <p className="mt-0.5 mb-3 text-xs text-[var(--cream-faint)]">
            Points each check adds on the 0–100 scale when it reaches full marks.
          </p>
          <ul className="space-y-2">
            {projection.findings.map((f) => (
              <li key={f.id} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-[var(--cream)]">{f.name}</span>
                <span className="flex shrink-0 items-center gap-3">
                  {fix(f.id)}
                  <span className="text-xs font-semibold tabular-nums text-[#22c55e]">+{f.points}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-[var(--cream-faint)]">
            This is arithmetic on Byline&apos;s own rubric for the draft. It is not a forecast of rankings, traffic or citations.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Judged now: Retrievable checks the draft carries. */}
        <div className={`${card} p-5`}>
          <h3 className="text-sm font-semibold text-[var(--cream)]">{SCORE_LABELS.retrievable}: judged now</h3>
          <p className="mt-0.5 mb-3 text-xs text-[var(--cream-faint)]">
            {r.scoreWithheld ? 'Not enough of the draft to score yet.' : `${r.rawScore} of ${r.assessedMaxScore} points`}
          </p>
          <div className="space-y-3">
            {judgedNow.flatMap((g) =>
              g.checks.map((check) => (
                <div key={check.id} className="border-t border-[rgba(184,115,51,0.1)] pt-3 first:border-t-0 first:pt-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-[var(--cream)]">
                      {check.name} <span className="text-xs text-[var(--cream-faint)]">· {g.name}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      {fix(check.id)}
                      <span className="text-xs font-semibold tabular-nums" style={{ color: check.scored ? ratioColor(check.score, check.maxScore) : '#a8a29e' }}>
                        {check.scored ? `${check.score}/${check.maxScore}` : '—'}
                      </span>
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--cream-dim)]">{check.detail}</p>
                  {check.evidence[0] && (
                    <p className="mt-1 truncate text-xs italic text-[var(--cream-faint)]" title={cleanSnippet(check.evidence[0].snippet)}>
                      &ldquo;{cleanSnippet(check.evidence[0].snippet)}&rdquo;
                    </p>
                  )}
                </div>
              )),
            )}
          </div>
        </div>

        {/* Judged now: Citable signals. */}
        <div className={`${card} p-5`}>
          <h3 className="text-sm font-semibold text-[var(--cream)]">{SCORE_LABELS.citable}: judged now</h3>
          <p className="mt-0.5 mb-3 text-xs text-[var(--cream-faint)]">Bands, not points: whether a quoted passage carries attribution back to you.</p>
          <div className="space-y-3">
            {signalsNow.map((s) => (
              <div key={s.id} className="border-t border-[rgba(184,115,51,0.1)] pt-3 first:border-t-0 first:pt-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-[var(--cream)]">{s.name}</span>
                  <span className="flex shrink-0 items-center gap-3">
                    {fix(s.id)}
                    <span className="text-xs font-semibold" style={{ color: BAND_COLOR[s.band] }}>{BAND_TEXT[s.band]}</span>
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-[var(--cream-dim)]">{s.detail}</p>
                {s.evidence[0] && (
                  <p className="mt-1 truncate text-xs italic text-[var(--cream-faint)]" title={cleanSnippet(s.evidence[0].snippet)}>
                    &ldquo;{cleanSnippet(s.evidence[0].snippet)}&rdquo;
                  </p>
                )}
              </div>
            ))}
            {notAssessed.map((s) => (
              <div key={s.id} className="border-t border-[rgba(184,115,51,0.1)] pt-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-[var(--cream-dim)]">{s.name}</span>
                  <span className="text-xs text-[var(--cream-faint)]">Not assessed</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-[var(--cream-faint)]">{s.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Judged at publication: reasons only. No score, no zero, no deduction. */}
      <div className={`${card} p-5`}>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--cream)]">
          <Clock className="h-4 w-4 text-[var(--cream-faint)]" />
          Judged at publication
        </h3>
        <p className="mt-0.5 mb-3 text-xs text-[var(--cream-faint)]">
          These depend on the published page, not the draft, so they are not part of the draft score. They are checked once the article is live.
        </p>
        <ul className="space-y-2">
          {groupByReason(draft.afterPublication).map(({ reason, names }) => (
            <li key={reason} className="text-xs leading-relaxed">
              <span className="text-[var(--cream-dim)]">{names.join(', ')}</span>
              <span className="text-[var(--cream-faint)]"> — {reason}</span>
            </li>
          ))}
        </ul>
      </div>

      {draft.notes.length > 0 && (
        <ul className="space-y-1">
          {draft.notes.map((n) => (
            <li key={n} className="text-xs text-[var(--cream-faint)]">
              {n}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
