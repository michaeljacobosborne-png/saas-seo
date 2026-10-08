/**
 * MCP rate limits and quota checks (docs/mcp-server-spec.md §4), as pure
 * functions over call records. Entitlement and allowances come from
 * `entitlements.ts`, the single place plan decisions live (decision 27).
 *
 * Checked in this order:
 *   1. entitlement: is the tool included at all
 *   2. per-key rate: 10 calls/minute, 2 concurrent run_audit
 *   3. per-target-domain: at most 6 probe/audit calls per domain per 10 minutes,
 *      because check_crawler_access sends one request per AI crawler user-agent
 *      and must not become a way to hammer third-party sites
 *   4. monthly allowance per capability
 *
 * The owner (decision 11) skips 1, 2 and 4. Nobody skips 3: it protects other
 * people's sites, not our bill.
 */
import type { PlanTier } from './auth'
import { PLAN_MODEL, TOOL_CAPABILITY, entitlementFor, quotaExhaustedMessage, type PlanModel } from './entitlements'
import type { ToolName } from './schemas'

export const RATE = { perMinute: 10, concurrentAudits: 2 } as const
export const DOMAIN_BUDGET = { max: 6, windowMs: 10 * 60_000 } as const

/** Capabilities that fetch a third-party site and so count against the domain cap. */
const FETCHES_TARGET = new Set(['crawler_check', 'audit'])

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
  | { ok: false; reason: 'not_entitled' | 'rate' | 'concurrency' | 'domain' | 'quota'; retryAfterMs: number | null; message: string; upgradeUrl?: string }

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
  /** This account's calls, at least the current month's. */
  history: CallRecord[]
  now: number
  model?: PlanModel
}): LimitResult {
  const { tool, targetDomain, plan, isOwner, history, now, model = PLAN_MODEL } = args
  const ent = entitlementFor(plan, isOwner, tool, model)
  if (!ent.allowed) return { ok: false, reason: 'not_entitled', retryAfterMs: null, message: ent.message, upgradeUrl: ent.upgradeUrl }
  const cap = ent.capability

  if (!isOwner) {
    const lastMinute = history.filter((c) => c.at > now - 60_000)
    if (lastMinute.length >= RATE.perMinute) {
      const oldest = Math.min(...lastMinute.map((c) => c.at))
      return { ok: false, reason: 'rate', retryAfterMs: oldest + 60_000 - now, message: `Too many requests: at most ${RATE.perMinute} per minute.` }
    }
    if (tool === 'run_audit' && history.filter((c) => c.tool === 'run_audit' && c.inFlight).length >= RATE.concurrentAudits) {
      return { ok: false, reason: 'concurrency', retryAfterMs: null, message: `At most ${RATE.concurrentAudits} audits can run at once.` }
    }
  }

  if (FETCHES_TARGET.has(cap) && targetDomain) {
    const recent = history.filter(
      (c) => FETCHES_TARGET.has(TOOL_CAPABILITY[c.tool]) && c.targetDomain === targetDomain && c.at > now - DOMAIN_BUDGET.windowMs,
    )
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

  if (ent.monthlyAllowance === null) return { ok: true, remaining: null }
  const monthStart = startOfMonthUtc(now)
  const used = history.filter((c) => TOOL_CAPABILITY[c.tool] === cap && c.at >= monthStart).length
  if (used >= ent.monthlyAllowance) {
    const d = new Date(now)
    const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)
    return { ok: false, reason: 'quota', retryAfterMs: next - now, message: quotaExhaustedMessage(cap, used, ent.monthlyAllowance) }
  }
  return { ok: true, remaining: ent.monthlyAllowance - used - 1 }
}
