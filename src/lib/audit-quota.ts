import { createServiceClient } from '@/lib/supabase/service'
import { monthWindowUtc } from '@/lib/plans'
import { resolveLimits } from '@/lib/usage'

export interface MonthlyAuditBudget {
  allowed: boolean
  /** Audits left after this one, floored at zero. */
  remaining: number
  limit: number
  used: number
  /** UTC start of next month, when the count resets. */
  resetsAt: string
  /** Set when the count could not be read; the audit is allowed (fail open, as the daily limiter does). */
  degraded?: string
}

/**
 * One-off audits a signed-in account has run this calendar month (UTC), against
 * its plan's allowance (src/lib/plans.ts). Counted from `audit_snapshots`:
 * every audit run from the analyzers is stored with the user's id and no
 * tracked page, while scheduled re-scores of tracked pages are not counted
 * (they belong to monitoring). Anonymous visitors keep the daily limit.
 */
export async function monthlyAuditBudget(userId: string, now: Date = new Date()): Promise<MonthlyAuditBudget> {
  const { start, next } = monthWindowUtc(now)
  try {
    const svc = createServiceClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (svc as any).from('profiles').select('account_type').eq('user_id', userId).maybeSingle()
    const { limits } = await resolveLimits(userId, svc, profile?.account_type)
    const limit = limits.auditsPerMonth

    const { count, error } = await svc
      .from('audit_snapshots')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('tracked_page_id', null)
      .gte('recorded_at', start.toISOString())
    if (error) return { allowed: true, remaining: limit, limit, used: 0, resetsAt: next.toISOString(), degraded: error.message }

    const used = count ?? 0
    // `used` is the count before this run, so this run is allowed while used < limit.
    return { allowed: used < limit, remaining: Math.max(0, limit - used - 1), limit, used, resetsAt: next.toISOString() }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { allowed: true, remaining: 0, limit: 0, used: 0, resetsAt: next.toISOString(), degraded: message }
  }
}
