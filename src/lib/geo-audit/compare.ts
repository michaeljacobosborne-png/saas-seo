/**
 * Compare two stored audits of the same page over time (MCP `compare_audits`,
 * docs/mcp-server-spec.md §2).
 *
 * Deterministic and evidence-preserving: it reports what changed between two
 * reports the engine already produced, and never re-scores anything. It refuses
 * to put a number on a change it cannot stand behind:
 *   - different engine versions → scores are not compared, only listed
 *   - a report written before versioning → treated as "legacy", same rule
 *   - a withheld score on either side → no delta
 *   - different final URLs → flagged; the diff still runs, so the user can see why
 *
 * Inputs are tolerant of the older stored shape (fields missing), because
 * `audit_results.result` holds rows from before the current engine.
 */

import { BAND_RANK, type Band, type FactorStatus } from './types'

/** The subset of a stored report this needs; every field may be missing on old rows. */
export interface ComparableReport {
  analyzedAt?: string
  engineVersion?: string
  url?: string
  finalUrl?: string
  retrievability?: {
    score?: number
    scoreWithheld?: boolean
    groups?: { id: string; name?: string; score?: number; maxScore?: number; scored?: boolean; checks?: { id: string; name?: string; score?: number; maxScore?: number; scored?: boolean; status?: FactorStatus }[] }[]
  }
  citability?: { band?: Band; signals?: { id: string; name?: string; band?: Band }[] }
}

export interface AuditComparison {
  /** Earlier and later run, ordered by analyzedAt regardless of argument order. */
  from: { analyzedAt: string | null; engineVersion: string; url: string | null }
  to: { analyzedAt: string | null; engineVersion: string; url: string | null }
  /** False when scores must not be diffed; `reasons` says why. */
  scoresComparable: boolean
  reasons: string[]
  retrievability: { from: number | null; to: number | null; delta: number | null }
  groups: { id: string; name: string; from: number | null; to: number | null; delta: number | null }[]
  /** Checks whose status changed, e.g. missing → good. */
  checkChanges: { id: string; name: string; from: FactorStatus | 'absent-from-report'; to: FactorStatus | 'absent-from-report' }[]
  citability: { from: Band | null; to: Band | null; direction: 'up' | 'down' | 'same' | 'unknown' }
  signalChanges: { id: string; name: string; from: Band | null; to: Band | null; direction: 'up' | 'down' }[]
  scope: string
}

const LEGACY = 'legacy'
export const COMPARE_SCOPE =
  'This compares two readiness assessments of the page. A change here is a change in what the page carries, not evidence that any AI system now retrieves or cites it.'

function scoreOf(r: ComparableReport): number | null {
  const x = r.retrievability
  if (!x || x.scoreWithheld || typeof x.score !== 'number') return null
  return x.score
}

function direction(a: Band | null | undefined, b: Band | null | undefined): 'up' | 'down' | 'same' | 'unknown' {
  if (!a || !b || a === 'unverified' || b === 'unverified') return 'unknown'
  const d = BAND_RANK[b] - BAND_RANK[a]
  return d > 0 ? 'up' : d < 0 ? 'down' : 'same'
}

export function compareAudits(x: ComparableReport, y: ComparableReport): AuditComparison {
  // Order by time so "from" is always the earlier run.
  const [a, b] = (x.analyzedAt ?? '') <= (y.analyzedAt ?? '') ? [x, y] : [y, x]
  const va = a.engineVersion ?? LEGACY
  const vb = b.engineVersion ?? LEGACY

  const reasons: string[] = []
  if (va !== vb) reasons.push(`Scoring engine changed between runs (${va} → ${vb}), so scores are listed but not diffed.`)
  if (va === LEGACY && vb === LEGACY) reasons.push('Both runs predate engine versioning, so the rubric they used cannot be confirmed as identical.')
  const sa = scoreOf(a)
  const sb = scoreOf(b)
  if (sa === null || sb === null) reasons.push('At least one run withheld its Retrievable score (too little could be assessed).')
  const ua = a.finalUrl ?? a.url ?? null
  const ub = b.finalUrl ?? b.url ?? null
  if (ua && ub && ua !== ub) reasons.push(`The runs inspected different URLs (${ua} vs ${ub}).`)

  const versionOk = va === vb && va !== LEGACY
  const scoresComparable = versionOk && sa !== null && sb !== null

  const groupsA = new Map((a.retrievability?.groups ?? []).map((g) => [g.id, g]))
  const groupsB = new Map((b.retrievability?.groups ?? []).map((g) => [g.id, g]))
  const groupIds = [...new Set([...groupsA.keys(), ...groupsB.keys()])]
  const groups = groupIds.map((id) => {
    const ga = groupsA.get(id)
    const gb = groupsB.get(id)
    const from = ga?.scored && typeof ga.score === 'number' ? ga.score : null
    const to = gb?.scored && typeof gb.score === 'number' ? gb.score : null
    return { id, name: gb?.name ?? ga?.name ?? id, from, to, delta: versionOk && from !== null && to !== null ? to - from : null }
  })

  const checksA = new Map((a.retrievability?.groups ?? []).flatMap((g) => g.checks ?? []).map((c) => [c.id, c]))
  const checksB = new Map((b.retrievability?.groups ?? []).flatMap((g) => g.checks ?? []).map((c) => [c.id, c]))
  const checkChanges: AuditComparison['checkChanges'] = []
  for (const id of new Set([...checksA.keys(), ...checksB.keys()])) {
    const ca = checksA.get(id)
    const cb = checksB.get(id)
    const from = ca?.status ?? 'absent-from-report'
    const to = cb?.status ?? 'absent-from-report'
    if (from !== to) checkChanges.push({ id, name: cb?.name ?? ca?.name ?? id, from, to })
  }

  const sigA = new Map((a.citability?.signals ?? []).map((s) => [s.id, s]))
  const sigB = new Map((b.citability?.signals ?? []).map((s) => [s.id, s]))
  const signalChanges: AuditComparison['signalChanges'] = []
  for (const id of new Set([...sigA.keys(), ...sigB.keys()])) {
    const fa = sigA.get(id)?.band ?? null
    const fb = sigB.get(id)?.band ?? null
    const d = direction(fa, fb)
    if (d === 'up' || d === 'down') signalChanges.push({ id, name: sigB.get(id)?.name ?? sigA.get(id)?.name ?? id, from: fa, to: fb, direction: d })
  }

  return {
    from: { analyzedAt: a.analyzedAt ?? null, engineVersion: va, url: ua },
    to: { analyzedAt: b.analyzedAt ?? null, engineVersion: vb, url: ub },
    scoresComparable,
    reasons,
    retrievability: { from: sa, to: sb, delta: scoresComparable ? sb! - sa! : null },
    groups,
    checkChanges,
    citability: { from: a.citability?.band ?? null, to: b.citability?.band ?? null, direction: direction(a.citability?.band, b.citability?.band) },
    signalChanges,
    scope: COMPARE_SCOPE,
  }
}
