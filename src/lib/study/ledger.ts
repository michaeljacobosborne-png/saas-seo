/**
 * The run ledger: an append-only log of everything the harness did, from which
 * every site's state is derived.
 *
 * Why a log and not a table of results: progress survives a crash at any
 * point (a line is only written once an attempt has finished), a re-run reads
 * the log and skips what is done, and nothing is ever counted twice because a
 * site's final state is computed from the log, once, not accumulated.
 *
 * The pure half (`resolveSite`, `nextEligible`, `domainBudgetOk`) takes events
 * and a clock and returns a decision, so the resume, retry and drop rules are
 * testable without a network or a disk.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DISQUALIFYING, type Failure, type FailureKind } from './audit-site'
import type { StudyRow } from './derive'
import type { Vantage } from './vantage'

export interface Pacing {
  /** Pause between one site and the next. Third-party sites did not ask to be measured. */
  siteGapSeconds: number
  /** +/- fraction applied to the gap, so the run does not tick like a metronome. */
  jitter: number
  /** The existing per-domain cap: at most this many calls to one domain per window (mcp/limits DOMAIN_BUDGET). */
  perDomainMax: number
  perDomainWindowMs: number
  /** A failed site is tried again no sooner than this. */
  retryMinGapHours: number
  /** Attempts before a failing site can be dropped or marked unresolved. */
  maxAttempts: number
  /** ...and those attempts must span at least this long ("across the run window"). */
  minSpanHours: number
  /** Give up on one site after this long and record it as a harness timeout. */
  siteTimeoutMs: number
}

export type AttemptEvent = {
  type: 'attempt'
  key: string
  population: string
  rank: number
  name: string
  domain: string
  url: string
  attempt: number
  at: string
  durationMs: number
  engineVersion: string
  vantage: Vantage
  outcome: 'audited' | 'failed'
  failure?: Failure
  row?: StudyRow
  /** Full engine report, stored beside the ledger. */
  reportFile?: string
}

export type DuplicateEvent = {
  type: 'duplicate'
  key: string
  population: string
  rank: number
  name: string
  domain: string
  url: string
  duplicateOf: string
  at: string
}

export type RunEvent =
  | { type: 'run-start'; at: string; mode: 'smoke' | 'study'; runId: string; config: unknown; vantage: Vantage }
  | { type: 'halt'; at: string; reason: string }
  | AttemptEvent
  | DuplicateEvent

export type SiteStatus =
  | { status: 'pending' }
  | { status: 'audited'; attempt: AttemptEvent }
  /** Failed, and not yet allowed another attempt. */
  | { status: 'retry-wait'; failures: AttemptEvent[]; nextEligibleAt: string }
  /** Failed, and may be tried now. */
  | { status: 'retry-due'; failures: AttemptEvent[] }
  /** Failed on every attempt for a reason the selection rule names. Counted and published. */
  | { status: 'dropped'; reason: string; failures: AttemptEvent[] }
  /** Failed on every attempt for a reason the rule does NOT name. Needs a ruling; never silently dropped. */
  | { status: 'unresolved'; reason: string; failures: AttemptEvent[] }

const HOUR = 3_600_000

/**
 * One site's state, from its attempts. The rules:
 *  - the first audited attempt is the result; later ones are ignored, so a
 *    re-run can never double-count a site
 *  - failures drop a site only after `maxAttempts` attempts spanning at least
 *    `minSpanHours`, and only if every failure is a kind the rule names
 */
export function resolveSite(attempts: AttemptEvent[], pacing: Pacing, now: Date): SiteStatus {
  const sorted = [...attempts].sort((a, b) => a.at.localeCompare(b.at))
  const audited = sorted.find((a) => a.outcome === 'audited')
  if (audited) return { status: 'audited', attempt: audited }
  const failures = sorted.filter((a) => a.outcome === 'failed')
  if (failures.length === 0) return { status: 'pending' }

  const first = new Date(failures[0].at).getTime()
  const last = new Date(failures[failures.length - 1].at).getTime()
  const exhausted = failures.length >= pacing.maxAttempts && last - first >= pacing.minSpanHours * HOUR
  if (exhausted) {
    const kinds = [...new Set(failures.map((f) => f.failure!.kind))] as FailureKind[]
    const reason = kinds.join('+')
    return kinds.every((k) => DISQUALIFYING.has(k)) ? { status: 'dropped', reason, failures } : { status: 'unresolved', reason, failures }
  }
  const nextMs = Math.max(last + pacing.retryMinGapHours * HOUR, failures.length >= pacing.maxAttempts ? first + pacing.minSpanHours * HOUR : 0)
  return nextMs <= now.getTime()
    ? { status: 'retry-due', failures }
    : { status: 'retry-wait', failures, nextEligibleAt: new Date(nextMs).toISOString() }
}

/** The per-domain cap: calls to one domain inside the window, counting every attempt that touched it. */
export function domainBudgetOk(attempts: AttemptEvent[], domain: string, pacing: Pacing, now: Date): boolean {
  const since = now.getTime() - pacing.perDomainWindowMs
  const recent = attempts.filter((a) => a.domain === domain && new Date(a.at).getTime() > since)
  return recent.length < pacing.perDomainMax
}

// ── the file half ─────────────────────────────────────────────────────────────

export class Ledger {
  readonly eventsFile: string
  readonly reportsDir: string
  private readonly lockFile: string

  constructor(readonly dir: string) {
    this.eventsFile = join(dir, 'events.jsonl')
    this.reportsDir = join(dir, 'reports')
    this.lockFile = join(dir, 'run.lock')
    mkdirSync(this.reportsDir, { recursive: true })
  }

  /** One run at a time per directory, so two processes cannot both append and double-count. */
  lock(): void {
    if (existsSync(this.lockFile)) {
      const holder = readFileSync(this.lockFile, 'utf8').trim()
      const pid = Number(holder.split(' ')[0])
      let alive = false
      try {
        process.kill(pid, 0)
        alive = true
      } catch {
        alive = false
      }
      if (alive) throw new Error(`Another run holds ${this.lockFile} (${holder}). Stop it first.`)
    }
    writeFileSync(this.lockFile, `${process.pid} ${new Date().toISOString()}`)
  }

  unlock(): void {
    try {
      unlinkSync(this.lockFile)
    } catch {
      /* already gone */
    }
  }

  read(): RunEvent[] {
    if (!existsSync(this.eventsFile)) return []
    const out: RunEvent[] = []
    for (const line of readFileSync(this.eventsFile, 'utf8').split('\n')) {
      if (!line.trim()) continue
      try {
        out.push(JSON.parse(line) as RunEvent)
      } catch {
        // A torn last line from a crash mid-write. The attempt it described was
        // never recorded, so it is simply done again: nothing is double-counted.
      }
    }
    return out
  }

  append(event: RunEvent): void {
    appendFileSync(this.eventsFile, JSON.stringify(event) + '\n')
  }

  attempts(events: RunEvent[] = this.read()): AttemptEvent[] {
    return events.filter((e): e is AttemptEvent => e.type === 'attempt')
  }

  duplicates(events: RunEvent[] = this.read()): DuplicateEvent[] {
    // The same duplicate is only ever counted once, however many times the run restarts.
    const seen = new Map<string, DuplicateEvent>()
    for (const e of events) if (e.type === 'duplicate' && !seen.has(e.key)) seen.set(e.key, e)
    return [...seen.values()]
  }

  writeReport(key: string, attempt: number, payload: unknown): string {
    const file = `${key.replace(/[^A-Za-z0-9._-]+/g, '_')}.attempt${attempt}.json`
    writeFileSync(join(this.reportsDir, file), JSON.stringify(payload))
    return join('reports', file)
  }
}
