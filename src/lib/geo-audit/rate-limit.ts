/**
 * Rate limiting for the free analyzer.
 *
 * The threat is not a big page, it is a scripted loop. Every run costs at least
 * one model call plus several fetches, and the endpoint is unauthenticated, so
 * without a limit the cost of being targeted is unbounded.
 *
 * Backed by Postgres rather than memory because the route runs on serverless and
 * instances do not share state — an in-memory counter would reset constantly and
 * limit nothing.
 *
 * Presented to the user as a budget, not a wall: the remaining count is returned
 * on every response so the UI can show "2 of 3 runs left today" rather than only
 * telling them once they have run out.
 */

import { createServiceClient } from '@/lib/supabase/service'

/** Free runs per identity per UTC day. */
export const FREE_RUNS_PER_DAY = 3

export interface RateLimitResult {
  allowed: boolean
  /** Runs left after this one, floored at zero. */
  remaining: number
  limit: number
  /** UTC timestamp when the window resets. */
  resetsAt: string
  /** Populated when the limiter could not reach the database. */
  degraded?: string
}

/**
 * Derive a stable identity for an anonymous request.
 *
 * IP alone is wrong behind shared NAT and trivially rotated; we combine it with
 * the user agent to reduce collisions without pretending this is identity. This
 * is a speed bump against scripting, not an authentication system.
 */
export function identityFor(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = forwarded || headers.get('x-real-ip') || 'unknown'
  const ua = headers.get('user-agent') ?? ''
  return `${ip}|${hash(ua)}`
}

function hash(s: string): string {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}

function startOfUtcDay(now: Date): string {
  return now.toISOString().slice(0, 10)
}

function nextUtcMidnight(now: Date): string {
  const d = new Date(now)
  d.setUTCHours(24, 0, 0, 0)
  return d.toISOString()
}

/**
 * Consume one run for this identity.
 *
 * Fails OPEN: if the database is unreachable we allow the run and flag it as
 * degraded. A rate limiter that takes the whole tool down when Postgres hiccups
 * is a worse outage than the abuse it prevents, and the byte and token caps in
 * `limits.ts` still bound the cost of any single run.
 */
export async function consumeRun(
  identity: string,
  opts: { now?: Date; limit?: number; tool?: string } = {},
): Promise<RateLimitResult> {
  const { now = new Date(), limit = FREE_RUNS_PER_DAY, tool = 'geo' } = opts
  const day = startOfUtcDay(now)
  const resetsAt = nextUtcMidnight(now)

  try {
    const supabase = createServiceClient()

    // Atomic increment in one round trip; the RPC returns the new count.
    const { data, error } = await supabase.rpc('increment_free_tool_run', {
      p_identity: identity,
      p_day: day,
      p_tool: tool,
    })

    if (error) {
      return { allowed: true, remaining: limit - 1, limit, resetsAt, degraded: error.message }
    }

    const used = typeof data === 'number' ? data : Number(data ?? 0)
    return {
      allowed: used <= limit,
      remaining: Math.max(0, limit - used),
      limit,
      resetsAt,
    }
  } catch (err) {
    return {
      allowed: true,
      remaining: limit - 1,
      limit,
      resetsAt,
      degraded: err instanceof Error ? err.message : String(err),
    }
  }
}

/** Read the current count without consuming one. */
export async function peekRuns(
  identity: string,
  opts: { now?: Date; limit?: number; tool?: string } = {},
): Promise<RateLimitResult> {
  const { now = new Date(), limit = FREE_RUNS_PER_DAY, tool = 'geo' } = opts
  const day = startOfUtcDay(now)
  const resetsAt = nextUtcMidnight(now)

  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('free_tool_runs')
      .select('run_count')
      .eq('identity', identity)
      .eq('day', day)
      .eq('tool', tool)
      .maybeSingle()

    if (error) return { allowed: true, remaining: limit, limit, resetsAt, degraded: error.message }

    const used = (data?.run_count as number | undefined) ?? 0
    return { allowed: used < limit, remaining: Math.max(0, limit - used), limit, resetsAt }
  } catch (err) {
    return {
      allowed: true,
      remaining: limit,
      limit,
      resetsAt,
      degraded: err instanceof Error ? err.message : String(err),
    }
  }
}
