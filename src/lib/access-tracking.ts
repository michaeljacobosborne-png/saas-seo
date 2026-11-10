/**
 * The daily access check for tracked pages: the monitor half of score over time.
 *
 * Each check probes the page as the AI search crawlers and reads robots.txt (a
 * few seconds, against about 25 for a full audit), compares the result with the
 * page's last confirmed state, and holds any change as pending. Only a change
 * the next check also sees is confirmed, recorded in access_alerts and emailed.
 * The rules for what counts as a change are in geo-audit/access-monitor.ts.
 *
 * Needs migration 20261101_access_alerts.sql.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  accessChanges,
  accessState,
  confirmChanges,
  type AccessChange,
  type AccessState,
} from '@/lib/geo-audit/access-monitor'
import { crossReferenceRobots, probeCrawlerAccess } from '@/lib/geo-audit/crawler-access'
import { fetchRobotsTxt } from '@/lib/geo-audit/robots'
import { sendEmail } from '@/lib/email'

const HOUR = 3_600_000
/** A page is checked again once this long has passed: daily, with slack for the cron's timing. */
export const CHECK_EVERY_MS = 20 * HOUR

export interface MonitoredPage {
  id: string
  user_id: string
  url: string
  access_state: AccessState | null
  access_pending: AccessChange[] | null
}

export interface CheckOutcome {
  /** The confirmed state to store. */
  state: AccessState
  /** Changes seen once, waiting for the next check. Null when none. */
  pending: AccessChange[] | null
  /** Changes seen twice: record and tell the owner. */
  confirmed: AccessChange[]
}

/**
 * Pure. Where a change is still unconfirmed, the stored state keeps the earlier
 * observation for it, so the next check compares against the same baseline and
 * can confirm it. A check where the site is down for everyone changes nothing.
 */
export function processCheck(prev: AccessState | null, pending: AccessChange[] | null, curr: AccessState): CheckOutcome {
  if (!prev) return { state: curr, pending: null, confirmed: [] }
  const changes = accessChanges(prev, curr)
  if (!curr.baseline.served && !changes.length) {
    return { state: prev, pending, confirmed: [] }
  }
  const confirmed = pending ? confirmChanges(pending, changes) : []
  const confirmedKeys = new Set(confirmed.map((c) => c.key))
  const unconfirmed = changes.filter((c) => !confirmedKeys.has(c.key))
  return { state: advance(prev, curr, unconfirmed), pending: unconfirmed.length ? unconfirmed : null, confirmed }
}

function advance(prev: AccessState, curr: AccessState, unconfirmed: AccessChange[]): AccessState {
  const held = new Set(unconfirmed.map((c) => c.token).filter(Boolean))
  const before = new Map(prev.crawlers.map((c) => [c.token, c]))
  const kinds = new Set(unconfirmed.map((c) => c.kind))
  return {
    ...curr,
    baseline: kinds.has('page-gone') ? prev.baseline : curr.baseline,
    robots: kinds.has('robots-unreadable') ? prev.robots : curr.robots,
    crawlers: kinds.has('page-gone') ? prev.crawlers : curr.crawlers.map((c) => (held.has(c.token) ? (before.get(c.token) ?? c) : c)),
    // A probe-only check does not read the page, so noindex carries forward.
    ...(curr.noindex === undefined ? (prev.noindex === undefined ? {} : { noindex: prev.noindex }) : { noindex: curr.noindex }),
  }
}

/** Probe one page as the AI search crawlers and read its robots.txt. */
export async function observeAccess(url: string, now = new Date()): Promise<AccessState> {
  const [robots, probe] = await Promise.all([fetchRobotsTxt(url), probeCrawlerAccess(url, { robots: null, now })])
  return accessState(crossReferenceRobots(probe, robots.parsed ?? null), { state: robots.state, status: robots.status })
}

export interface AccessStore {
  due(now: Date, limit: number): Promise<MonitoredPage[]>
  save(page: MonitoredPage, outcome: CheckOutcome, checkedAt: Date): Promise<void>
}

export interface AccessRunSummary {
  checked: number
  pending: number
  alerts: number
  failed: { id: string; error: string }[]
  deferred: number
}

/** Checks due pages a few at a time until the time budget is spent. */
export async function runAccessChecks(
  store: AccessStore,
  observe: (url: string) => Promise<AccessState>,
  opts: { now?: Date; budgetMs?: number; perBatchMs?: number; batch?: number; limit?: number; clock?: () => number; notify?: (page: MonitoredPage, changes: AccessChange[]) => Promise<void> } = {},
): Promise<AccessRunSummary> {
  const clock = opts.clock ?? Date.now
  const start = clock()
  const now = opts.now ?? new Date()
  const batch = opts.batch ?? 5
  const due = await store.due(now, opts.limit ?? 50)
  const summary: AccessRunSummary = { checked: 0, pending: 0, alerts: 0, failed: [], deferred: 0 }

  for (let i = 0; i < due.length; i += batch) {
    if (clock() - start + (opts.perBatchMs ?? 15_000) > (opts.budgetMs ?? 45_000)) {
      summary.deferred = due.length - i
      break
    }
    await Promise.all(
      due.slice(i, i + batch).map(async (page) => {
        try {
          const outcome = processCheck(page.access_state, page.access_pending, await observe(page.url))
          await store.save(page, outcome, now)
          summary.checked++
          if (outcome.pending) summary.pending++
          if (outcome.confirmed.length) {
            summary.alerts += outcome.confirmed.length
            if (opts.notify) await opts.notify(page, outcome.confirmed).catch(() => undefined)
          }
        } catch (err) {
          summary.failed.push({ id: page.id, error: err instanceof Error ? err.message : String(err) })
        }
      }),
    )
  }
  return summary
}

export function supabaseAccess(db: SupabaseClient): AccessStore {
  return {
    async due(now, limit) {
      const cutoff = new Date(now.getTime() - CHECK_EVERY_MS).toISOString()
      const { data, error } = await db
        .from('tracked_pages')
        .select('id, user_id, url, access_state, access_pending')
        .eq('active', true)
        .or(`access_checked_at.is.null,access_checked_at.lt.${cutoff}`)
        .order('access_checked_at', { ascending: true, nullsFirst: true })
        .limit(limit)
      if (error) throw new Error(error.message)
      return (data ?? []) as MonitoredPage[]
    },
    async save(page, outcome, checkedAt) {
      if (outcome.confirmed.length) {
        const { error: e1 } = await db.from('access_alerts').insert(
          outcome.confirmed.map((c) => ({
            tracked_page_id: page.id,
            user_id: page.user_id,
            detected_at: checkedAt.toISOString(),
            kind: c.kind,
            change_key: c.key,
            good: c.good,
            headline: c.headline,
            detail: c.detail,
            reproduce: c.reproduce ?? null,
          })),
        )
        if (e1) throw new Error(e1.message)
      }
      const { error } = await db
        .from('tracked_pages')
        .update({ access_state: outcome.state, access_pending: outcome.pending, access_checked_at: checkedAt.toISOString() })
        .eq('id', page.id)
      if (error) throw new Error(error.message)
    },
  }
}

const APP_URL = 'https://app.bylineseo.com'

/** The alert email: plain text, evidence first, nothing about AI visibility. */
export function buildAccessEmail(pageId: string, url: string, changes: AccessChange[]): { subject: string; text: string } {
  const host = (() => { try { return new URL(url).hostname } catch { return url } })()
  const bad = changes.filter((c) => !c.good)
  const subject = bad.length
    ? `Byline: crawler access changed on ${host}`
    : `Byline: crawler access restored on ${host}`
  const blocks = changes.map((c) =>
    [c.headline, c.detail, c.reproduce ? `To see it yourself:\n${c.reproduce}` : null].filter(Boolean).join('\n\n'),
  )
  const text = [
    `Byline's daily check of ${url} found a change, and a second check the next day saw the same thing.`,
    ...blocks,
    'What this covers: what your server sent to a request presenting each crawler\'s published user-agent, from our network. We do not send from the crawler companies\' own addresses, so this is a change in how your server answers, not proof of what any AI system can or cannot read.',
    `History for this page: ${APP_URL}/tracking/${pageId}`,
  ].join('\n\n')
  return { subject, text }
}

export function emailAccessChange(db: SupabaseClient) {
  return async (page: MonitoredPage, changes: AccessChange[]): Promise<void> => {
    const { data } = await db.auth.admin.getUserById(page.user_id)
    const to = data.user?.email
    if (!to) return
    const { subject, text } = buildAccessEmail(page.id, page.url, changes)
    await sendEmail({ to, subject, text })
    await db
      .from('access_alerts')
      .update({ emailed_at: new Date().toISOString() })
      .eq('tracked_page_id', page.id)
      .is('emailed_at', null)
  }
}
