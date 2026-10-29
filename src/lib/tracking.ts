/**
 * Tracked pages: re-checked on a schedule, every run recorded with what it
 * fetched (DECISIONS 39). The scheduling logic is separate from the database
 * so it is testable; `supabaseTracking` wires it to the real tables.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { recordAudit, type RecordedAudit } from '@/lib/geo-audit/history'
import { encodeSnapshot } from '@/lib/geo-audit/snapshot'

const DAY = 86_400_000
/** A failed run is retried the next day rather than waiting a whole interval. */
const RETRY_AFTER_MS = DAY

export interface TrackedPage {
  id: string
  user_id: string
  url: string
  tool: 'geo' | 'ao'
  interval_days: number
}

export interface TrackingStore {
  due(now: Date, limit: number): Promise<TrackedPage[]>
  saveRun(page: TrackedPage, run: RecordedAudit): Promise<void>
  markRan(page: TrackedPage, next: Date, ranAt: Date): Promise<void>
  markFailed(page: TrackedPage, error: string, next: Date): Promise<void>
}

export interface RunSummary {
  ran: string[]
  failed: { id: string; error: string }[]
  /** Due pages left for the next invocation because the time budget ran out. */
  deferred: number
}

/**
 * Runs due pages one at a time until the time budget is spent. A page is only
 * started if there is room to finish it, so a serverless timeout never leaves a
 * run half-written.
 */
export async function runDuePages(
  store: TrackingStore,
  record: (page: TrackedPage, now: Date) => Promise<RecordedAudit>,
  opts: { now?: Date; budgetMs?: number; perRunMs?: number; limit?: number; clock?: () => number } = {},
): Promise<RunSummary> {
  const clock = opts.clock ?? Date.now
  const start = clock()
  const budget = opts.budgetMs ?? 45_000
  const perRun = opts.perRunMs ?? 20_000
  const now = opts.now ?? new Date()
  const due = await store.due(now, opts.limit ?? 10)
  const summary: RunSummary = { ran: [], failed: [], deferred: 0 }

  for (const [i, page] of due.entries()) {
    if (clock() - start + perRun > budget) {
      summary.deferred = due.length - i
      break
    }
    const ranAt = new Date(now.getTime() + (clock() - start))
    try {
      const run = await record(page, ranAt)
      await store.saveRun(page, run)
      await store.markRan(page, new Date(ranAt.getTime() + page.interval_days * DAY), ranAt)
      summary.ran.push(page.id)
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      await store.markFailed(page, error, new Date(ranAt.getTime() + RETRY_AFTER_MS))
      summary.failed.push({ id: page.id, error })
    }
  }
  return summary
}

/** The row stored for one recorded run. */
export function snapshotRow(page: Pick<TrackedPage, 'id' | 'user_id' | 'tool'>, run: RecordedAudit) {
  const r = run.report
  return {
    tracked_page_id: page.id,
    user_id: page.user_id,
    url: r.url,
    final_url: r.finalUrl,
    tool: page.tool,
    recorded_at: run.snapshot.recordedAt,
    engine_version: run.snapshot.engineVersion,
    content_hash: run.contentHash,
    retrievable_score: r.scoreWithheld ? null : (r.retrievability?.score ?? null),
    score_withheld: Boolean(r.scoreWithheld),
    citable_band: r.citability?.band ?? null,
    report: r,
    snapshot: encodeSnapshot(run.snapshot),
  }
}

export function supabaseTracking(db: SupabaseClient): TrackingStore {
  return {
    async due(now, limit) {
      const { data, error } = await db
        .from('tracked_pages')
        .select('id, user_id, url, tool, interval_days')
        .eq('active', true)
        .lte('next_run_at', now.toISOString())
        .order('next_run_at', { ascending: true })
        .limit(limit)
      if (error) throw new Error(error.message)
      return (data ?? []) as TrackedPage[]
    },
    async saveRun(page, run) {
      const { error } = await db.from('audit_snapshots').insert(snapshotRow(page, run))
      if (error) throw new Error(error.message)
    },
    async markRan(page, next, ranAt) {
      const { error } = await db
        .from('tracked_pages')
        .update({ last_run_at: ranAt.toISOString(), next_run_at: next.toISOString(), last_error: null })
        .eq('id', page.id)
      if (error) throw new Error(error.message)
    },
    async markFailed(page, message, next) {
      await db.from('tracked_pages').update({ last_error: message.slice(0, 500), next_run_at: next.toISOString() }).eq('id', page.id)
    },
  }
}

/** One recorded run of a tracked page. Deterministic wording: no model call on scheduled runs. */
export function recordTrackedPage(page: TrackedPage, now: Date): Promise<RecordedAudit> {
  return recordAudit(page.url, page.tool, { now, useModel: false })
}
