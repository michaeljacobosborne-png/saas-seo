import 'server-only'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/service'

// ─── time helpers ────────────────────────────────────────────────────────────
export function monthStart(): Date {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth(), 1)
}
function weekAgo(): Date {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
}

// ─── auth.users lookup (emails + signup dates live here, NOT on profiles) ──────
export async function getAuthUsers(): Promise<Map<string, { email: string; createdAt: string }>> {
  const svc = createServiceClient()
  const map = new Map<string, { email: string; createdAt: string }>()
  let page = 1
  // listUsers paginates (max 1000/page); loop until a short/empty page.
  for (;;) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 1000 })
    if (error || !data?.users?.length) break
    for (const u of data.users) {
      map.set(u.id, { email: u.email ?? '(no email)', createdAt: u.created_at })
    }
    if (data.users.length < 1000) break
    page++
  }
  return map
}

// ─── Stripe business metrics ──────────────────────────────────────────────────
export interface StripeMetrics {
  configured: boolean
  /** Monthly-normalized recurring revenue, in cents (annual plans ÷ 12). */
  mrrCents: number
  activePaid: number
  newThisMonth: number
  churnedThisMonth: number
  planBreakdown: { label: string; count: number; monthlyCents: number }[]
  /** stripe customer id → monthly-normalized contribution in cents. */
  customerMrr: Map<string, number>
}

const ZERO_STRIPE: StripeMetrics = {
  configured: false,
  mrrCents: 0,
  activePaid: 0,
  newThisMonth: 0,
  churnedThisMonth: 0,
  planBreakdown: [],
  customerMrr: new Map(),
}

/** Map a Stripe price id back to a human plan label using the STRIPE_PRICE_* env vars. */
function priceLabel(priceId: string | null | undefined): string | null {
  if (!priceId) return null
  const map: Record<string, string> = {}
  const add = (env: string, label: string) => {
    const v = process.env[env]
    if (v) map[v] = label
  }
  add('STRIPE_PRICE_STARTER_MONTHLY', 'Starter (monthly)')
  add('STRIPE_PRICE_STARTER_ANNUAL', 'Starter (annual)')
  add('STRIPE_PRICE_PRO_MONTHLY', 'Growth (monthly)')
  add('STRIPE_PRICE_PRO_ANNUAL', 'Growth (annual)')
  add('STRIPE_PRICE_AGENCY_MONTHLY', 'Multi-Brand (monthly)')
  add('STRIPE_PRICE_AGENCY_ANNUAL', 'Multi-Brand (annual)')
  return map[priceId] ?? null
}

export async function getStripeMetrics(): Promise<StripeMetrics> {
  let stripe: Stripe
  try {
    stripe = getStripe()
  } catch {
    return ZERO_STRIPE // STRIPE_SECRET_KEY not configured — degrade gracefully
  }

  const monthStartSec = Math.floor(monthStart().getTime() / 1000)

  let mrrCents = 0
  let activePaid = 0
  const customerMrr = new Map<string, number>()
  const planMap = new Map<string, { count: number; monthlyCents: number }>()

  try {
    // Active subscriptions → MRR, plan breakdown, per-customer contribution.
    for await (const sub of stripe.subscriptions.list({ status: 'active', limit: 100 })) {
      activePaid++
      let subMonthly = 0
      for (const item of sub.items.data) {
        const price = item.price
        const qty = item.quantity ?? 1
        const amount = (price.unit_amount ?? 0) * qty
        const monthly = price.recurring?.interval === 'year' ? Math.round(amount / 12) : amount
        subMonthly += monthly

        const label =
          priceLabel(price.id) ??
          price.nickname ??
          `$${((price.unit_amount ?? 0) / 100).toFixed(0)}/${price.recurring?.interval ?? 'one-time'}`
        const cur = planMap.get(label) ?? { count: 0, monthlyCents: 0 }
        cur.count += 1
        cur.monthlyCents += monthly
        planMap.set(label, cur)
      }
      mrrCents += subMonthly
      if (typeof sub.customer === 'string') {
        customerMrr.set(sub.customer, (customerMrr.get(sub.customer) ?? 0) + subMonthly)
      }
    }

    // New subscriptions created this month (any status).
    let newThisMonth = 0
    for await (const _sub of stripe.subscriptions.list({ status: 'all', created: { gte: monthStartSec }, limit: 100 })) {
      void _sub
      newThisMonth++
    }

    // Churn — canceled subscriptions whose cancellation landed this month.
    let churnedThisMonth = 0
    for await (const sub of stripe.subscriptions.list({ status: 'canceled', limit: 100 })) {
      if (sub.canceled_at && sub.canceled_at >= monthStartSec) churnedThisMonth++
    }

    const planBreakdown = Array.from(planMap.entries())
      .map(([label, v]) => ({ label, count: v.count, monthlyCents: v.monthlyCents }))
      .sort((a, b) => b.monthlyCents - a.monthlyCents)

    return { configured: true, mrrCents, activePaid, newThisMonth, churnedThisMonth, planBreakdown, customerMrr }
  } catch (err) {
    console.error('getStripeMetrics failed:', err instanceof Error ? err.message : String(err))
    return { ...ZERO_STRIPE, configured: true }
  }
}

// ─── Supabase user metrics ────────────────────────────────────────────────────
export interface UserMetrics {
  totalUsers: number
  freeUsers: number
  newThisWeek: number
  newThisMonth: number
}

export async function getUserMetrics(): Promise<UserMetrics> {
  const svc = createServiceClient()
  const ms = monthStart().toISOString()
  const wk = weekAgo().toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = svc as any
  const [total, free, newWeek, newMonth] = await Promise.all([
    p.from('profiles').select('id', { count: 'exact', head: true }),
    p.from('profiles').select('id', { count: 'exact', head: true }).eq('account_type', 'free'),
    p.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', wk),
    p.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', ms),
  ])
  return {
    totalUsers: total.count ?? 0,
    freeUsers: free.count ?? 0,
    newThisWeek: newWeek.count ?? 0,
    newThisMonth: newMonth.count ?? 0,
  }
}

// ─── Feature usage (current month) ────────────────────────────────────────────
export interface FeatureUsage {
  articlesThisMonth: number
  byStatus: Record<string, number>
  agentSessions: number | null
  keywordProjects: number | null
  auditsRun: number | null
}

export async function getFeatureUsage(): Promise<FeatureUsage> {
  const svc = createServiceClient()
  const ms = monthStart().toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = svc as any

  const { data: arts } = await p.from('articles').select('status').gte('created_at', ms)
  const byStatus: Record<string, number> = {}
  for (const a of (arts ?? []) as { status: string }[]) {
    byStatus[a.status] = (byStatus[a.status] ?? 0) + 1
  }

  // Agent sessions ≈ article-scoped agent_memory rows written this month.
  const agentRes = await p
    .from('agent_memory')
    .select('id', { count: 'exact', head: true })
    .eq('memory_type', 'article')
    .gte('created_at', ms)
  const agentSessions = agentRes.error ? null : (agentRes.count ?? 0)

  const kwRes = await p
    .from('keyword_projects')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', ms)
  const keywordProjects = kwRes.error ? null : (kwRes.count ?? 0)

  return {
    articlesThisMonth: arts?.length ?? 0,
    byStatus,
    agentSessions,
    keywordProjects,
    auditsRun: null, // no audit-run log table exists yet
  }
}

// ─── Top accounts ─────────────────────────────────────────────────────────────
export interface TopAccount {
  userId: string
  email: string
  accountType: string
  createdAt: string | null
  articleCount: number
  agentSessions: number
  mrrCents: number | null // null = not in the top-20 MRR-resolved slice
}

export async function getTopAccounts(
  customerMrr: Map<string, number>,
  authUsers: Map<string, { email: string; createdAt: string }>
): Promise<TopAccount[]> {
  const svc = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = svc as any

  const [profsRes, artsRes, memRes, subsRes] = await Promise.all([
    p.from('profiles').select('user_id, account_type, created_at'),
    p.from('articles').select('user_id'),
    p.from('agent_memory').select('user_id, memory_type'),
    p.from('subscriptions').select('user_id, stripe_customer_id, status'),
  ])

  const articleCount = new Map<string, number>()
  for (const a of (artsRes.data ?? []) as { user_id: string }[]) {
    if (a.user_id) articleCount.set(a.user_id, (articleCount.get(a.user_id) ?? 0) + 1)
  }

  const agentCount = new Map<string, number>()
  for (const m of (memRes.data ?? []) as { user_id: string; memory_type: string }[]) {
    if (m.user_id && m.memory_type === 'article') {
      agentCount.set(m.user_id, (agentCount.get(m.user_id) ?? 0) + 1)
    }
  }

  const customerByUser = new Map<string, string>()
  for (const s of (subsRes.data ?? []) as { user_id: string; stripe_customer_id: string | null; status: string }[]) {
    if (s.stripe_customer_id && (s.status === 'active' || s.status === 'trialing')) {
      customerByUser.set(s.user_id, s.stripe_customer_id)
    }
  }

  const rows: TopAccount[] = ((profsRes.data ?? []) as { user_id: string; account_type: string | null; created_at: string | null }[])
    .map((pr) => ({
      userId: pr.user_id,
      email: authUsers.get(pr.user_id)?.email ?? '(unknown)',
      accountType: pr.account_type ?? 'free',
      createdAt: pr.created_at ?? authUsers.get(pr.user_id)?.createdAt ?? null,
      articleCount: articleCount.get(pr.user_id) ?? 0,
      agentSessions: agentCount.get(pr.user_id) ?? 0,
      mrrCents: null,
    }))
    .sort((a, b) => b.articleCount - a.articleCount)

  const top = rows.slice(0, 50)
  // Resolve MRR contribution for the top 20 only (reusing the active-subs map —
  // no extra Stripe calls needed).
  for (const r of top.slice(0, 20)) {
    const cust = customerByUser.get(r.userId)
    r.mrrCents = cust ? (customerMrr.get(cust) ?? 0) : 0
  }
  return top
}

// ─── Cost tracking (usage_events) ─────────────────────────────────────────────
export interface CostMetrics {
  tableMissing: boolean
  totalCostUsd: number
  byFeature: { feature: string; calls: number; totalCost: number; avgCost: number }[]
  byModel: { model: string; calls: number; totalCost: number }[]
}

export async function getCostMetrics(): Promise<CostMetrics> {
  const svc = createServiceClient()
  const ms = monthStart().toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (svc as any)
    .from('usage_events')
    .select('feature, model, cost_usd')
    .gte('created_at', ms)

  if (error) {
    // Most likely the migration hasn't been applied yet (relation missing).
    return { tableMissing: true, totalCostUsd: 0, byFeature: [], byModel: [] }
  }

  const rows = (data ?? []) as { feature: string; model: string; cost_usd: number | string }[]
  const featMap = new Map<string, { calls: number; cost: number }>()
  const modelMap = new Map<string, { calls: number; cost: number }>()
  let total = 0
  for (const r of rows) {
    const cost = typeof r.cost_usd === 'string' ? parseFloat(r.cost_usd) : (r.cost_usd ?? 0)
    total += cost
    const f = featMap.get(r.feature) ?? { calls: 0, cost: 0 }
    f.calls++; f.cost += cost; featMap.set(r.feature, f)
    const m = modelMap.get(r.model) ?? { calls: 0, cost: 0 }
    m.calls++; m.cost += cost; modelMap.set(r.model, m)
  }

  return {
    tableMissing: false,
    totalCostUsd: total,
    byFeature: Array.from(featMap.entries())
      .map(([feature, v]) => ({ feature, calls: v.calls, totalCost: v.cost, avgCost: v.calls ? v.cost / v.calls : 0 }))
      .sort((a, b) => b.totalCost - a.totalCost),
    byModel: Array.from(modelMap.entries())
      .map(([model, v]) => ({ model, calls: v.calls, totalCost: v.cost }))
      .sort((a, b) => b.totalCost - a.totalCost),
  }
}
