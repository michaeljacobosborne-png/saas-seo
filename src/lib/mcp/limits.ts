/**
 * MCP metering and rate limits (docs/mcp-server-spec.md §4), as pure functions
 * over call records. The `api_calls` table supplies the records later; the
 * decisions here are testable now.
 *
 * Three guards, checked in this order:
 *   1. per-key rate: 10 calls/minute, 2 concurrent run_audit
 *   2. per-target-domain: at most 6 probe/audit calls per domain per 10 minutes
 *      per user, because check_crawler_access sends one request per AI crawler
 *      user-agent and must not become a way to hammer third-party sites
 *   3. monthly quota per plan and tool class
 *
 * The owner (decision 11) skips 1 and 3. Nobody skips 2: it protects other
 * people's sites, not our bill.
 */
import type { PlanTier } from './auth'
import type { ToolName } from './schemas'

export type ToolClass = 'audit' | 'probe' | 'read'

export const TOOL_CLASS: Record<ToolName, ToolClass> = {
  run_audit: 'audit',
  check_crawler_access: 'probe',
  get_audit: 'read',
  list_audits: 'read',
  compare_audits: 'read',
  score_draft: 'read',
}

/**
 * PROPOSED quotas, pending decision M3. `null` = unmetered (rate limit only);
 * 0 = not available on that plan (pending decision M2).
 */
export const MONTHLY_QUOTA: Record<PlanTier, Record<ToolClass, number | null>> = {
  free: { audit: 0, probe: 10, read: 20 },
  starter: { audit: 100, probe: 300, read: null },
  growth: { audit: 400, probe: 1200, read: null },
  multi_brand: { audit: 1200, probe: 3600, read: null },
}

export const RATE = { perMinute: 10, concurrentAudits: 2 } as const
export const DOMAIN_BUDGET = { max: 6, windowMs: 10 * 60_000 } as const

export interface CallRecord {
  tool: ToolName
  /** Registrable host of the URL acted on; null for reads. */
  targetDomain: string | null
  at: number
  /** True while a run_audit is still executing. */
  inFlight?: boolean
}

export type LimitResult =
  | { ok: true; remaining: number | null }
  | { ok: false; reason: 'rate' | 'concurrency' | 'domain' | 'quota' | 'not_in_plan'; retryAfterMs: number | null; message: string }

/** The domain used for the per-target cap: lower-case host without www. */
export function targetDomainOf(url: string): string {
  return new URL(url).hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '')
}

function startOfMonthUtc(now: number): number {
  const d = new Date(now)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)
}

export function checkLimits(args: {
  tool: ToolName
  targetDomain: string | null
  plan: PlanTier
  isOwner: boolean
  /** This key's or user's calls, at least the last month's. */
  history: CallRecord[]
  now: number
}): LimitResult {
  const { tool, targetDomain, plan, isOwner, history, now } = args
  const cls = TOOL_CLASS[tool]

  if (!isOwner) {
    const lastMinute = history.filter((c) => c.at > now - 60_000)
    if (lastMinute.length >= RATE.perMinute) {
      const oldest = Math.min(...lastMinute.map((c) => c.at))
      return { ok: false, reason: 'rate', retryAfterMs: oldest + 60_000 - now, message: `Rate limit: ${RATE.perMinute} calls per minute.` }
    }
    if (tool === 'run_audit' && history.filter((c) => c.tool === 'run_audit' && c.inFlight).length >= RATE.concurrentAudits) {
      return { ok: false, reason: 'concurrency', retryAfterMs: null, message: `At most ${RATE.concurrentAudits} audits can run at once.` }
    }
  }

  if (cls !== 'read' && targetDomain) {
    const recent = history.filter((c) => TOOL_CLASS[c.tool] !== 'read' && c.targetDomain === targetDomain && c.at > now - DOMAIN_BUDGET.windowMs)
    if (recent.length >= DOMAIN_BUDGET.max) {
      const oldest = Math.min(...recent.map((c) => c.at))
      return {
        ok: false,
        reason: 'domain',
        retryAfterMs: oldest + DOMAIN_BUDGET.windowMs - now,
        message: `${targetDomain} was checked ${recent.length} times in the last 10 minutes. To avoid loading other people's sites, wait before checking it again.`,
      }
    }
  }

  if (isOwner) return { ok: true, remaining: null }

  const quota = MONTHLY_QUOTA[plan][cls]
  if (quota === null) return { ok: true, remaining: null }
  if (quota === 0) {
    return { ok: false, reason: 'not_in_plan', retryAfterMs: null, message: `${tool} is not included in your plan.` }
  }
  const monthStart = startOfMonthUtc(now)
  const used = history.filter((c) => TOOL_CLASS[c.tool] === cls && c.at >= monthStart).length
  if (used >= quota) {
    const d = new Date(now)
    const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)
    return { ok: false, reason: 'quota', retryAfterMs: next - now, message: `Monthly ${cls} quota used (${used}/${quota}). It resets on the 1st (UTC).` }
  }
  return { ok: true, remaining: quota - used - 1 }
}
