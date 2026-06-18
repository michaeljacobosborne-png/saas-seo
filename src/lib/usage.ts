import { createServiceClient } from '@/lib/supabase/service'

// ─── AI cost tracking ────────────────────────────────────────────────────────
// Token pricing in USD per token (rates as of mid-2025 — update as needed).
// Keyed by the exact model id passed to logUsageEvent. Unknown models cost 0.
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o':            { input: 2.50 / 1_000_000, output: 10.00 / 1_000_000 },
  'gpt-4o-mini':       { input: 0.15 / 1_000_000, output:  0.60 / 1_000_000 },
  'claude-sonnet-4-6': { input: 3.00 / 1_000_000, output: 15.00 / 1_000_000 },
  'claude-haiku-4-5-20251001': { input: 0.80 / 1_000_000, output: 4.00 / 1_000_000 },
}

/** Cost in USD for a single model call. Returns 0 for unpriced models. */
export function calcCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = MODEL_PRICING[model]
  if (!p) return 0
  return inputTokens * p.input + outputTokens * p.output
}

/**
 * Record one AI model invocation in usage_events. Fire-and-forget: never throws,
 * never blocks the caller's response. Uses the service-role client so the write
 * succeeds regardless of RLS (the table is closed to authenticated callers).
 * Callers should `void logUsageEvent(...)` (or wrap in Next's `after()`).
 */
export async function logUsageEvent(params: {
  userId: string
  feature: string
  model: string
  inputTokens: number
  outputTokens: number
}): Promise<void> {
  try {
    const inputTokens = params.inputTokens || 0
    const outputTokens = params.outputTokens || 0
    const cost = calcCostUsd(params.model, inputTokens, outputTokens)
    const svc = createServiceClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (svc as any).from('usage_events').insert({
      user_id: params.userId,
      feature: params.feature,
      model: params.model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: cost,
    })
    if (error) console.error('logUsageEvent insert failed:', error.message)
  } catch (err) {
    console.error('logUsageEvent failed:', err instanceof Error ? err.message : String(err))
  }
}

export const PLAN_LIMITS = {
  starter: { articles: 8, keywordSessions: 10, brandProfiles: 1 },
  pro: { articles: 30, keywordSessions: 60, brandProfiles: 1 },
  agency: { articles: 100, keywordSessions: 200, brandProfiles: 3 },
}

// DB subscription plan values map onto PLAN_LIMITS keys. 'team' is the renamed
// 'agency' tier — both spellings exist in the DB (see ARCHITECTURE.md).
const PLAN_ALIASES: Record<string, keyof typeof PLAN_LIMITS> = {
  starter: 'starter',
  pro: 'pro',
  agency: 'agency',
  team: 'agency',
}

// Resolve a user's plan tier. Free accounts get the lowest (starter) tier.
// Paid accounts read their tier from the active subscription, defaulting to
// starter when no active subscription row is found yet (e.g. comped accounts).
async function resolvePlan(
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  accountType?: string
): Promise<keyof typeof PLAN_LIMITS> {
  if (accountType === 'free') return 'starter'

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  return PLAN_ALIASES[sub?.plan as string] ?? 'starter'
}

// Check whether a user may start another keyword session this billing period.
// Mirrors the monthly (calendar-month) reset baked into increment_keyword_sessions:
// a counter whose reset timestamp predates the current month reads as 0 here, so a
// stale value from last month never blocks a user before the RPC resets it.
export async function checkKeywordSessionLimit(
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<{ allowed: boolean; used: number; limit: number; plan: keyof typeof PLAN_LIMITS }> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('account_type, keyword_sessions_used, keyword_sessions_reset_at')
    .eq('user_id', userId)
    .maybeSingle()

  const plan = await resolvePlan(userId, supabase, profile?.account_type)
  const limit = PLAN_LIMITS[plan]?.keywordSessions ?? PLAN_LIMITS.starter.keywordSessions

  const periodStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const resetAt = profile?.keyword_sessions_reset_at
    ? new Date(profile.keyword_sessions_reset_at)
    : null
  const used = !resetAt || resetAt < periodStart ? 0 : profile?.keyword_sessions_used ?? 0

  return { allowed: used < limit, used, limit, plan }
}

// Atomically record one consumed keyword session (with monthly reset). Returns the
// new used count, or -1 if the write failed. Failures are non-fatal — never block a
// request that already succeeded just because the counter couldn't be bumped.
export async function incrementKeywordSession(
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<number> {
  const { data, error } = await supabase.rpc('increment_keyword_sessions', { p_user_id: userId })
  if (error) {
    console.error('increment_keyword_sessions failed:', error.message)
    return -1
  }
  return (data as number) ?? -1
}

export async function checkArticleLimit(
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  const plan = (sub?.plan ?? 'starter') as keyof typeof PLAN_LIMITS
  const limit = PLAN_LIMITS[plan]?.articles ?? 0

  const periodStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  const { count } = await supabase
    .from('articles')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', periodStart)

  const used = count ?? 0

  return {
    allowed: limit === Infinity || used < limit,
    used,
    limit,
  }
}
