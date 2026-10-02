import { Suspense, cache } from 'react'
import {
  DollarSign, CreditCard, Users, UserPlus, TrendingDown, UserCheck,
  FileText, Sparkles, Search, Bot, BarChart2, Percent,
} from 'lucide-react'
import MetricCard from './_components/MetricCard'
import UsageTable from './_components/UsageTable'
import TopAccountsTable from './_components/TopAccountsTable'
import {
  getStripeMetrics, getUserMetrics, getFeatureUsage,
  getTopAccounts, getCostMetrics, getAuthUsers,
} from './_lib/admin-data'

// Always render live — never statically prerender or cache the owner dashboard.
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Per-request memoization: Stripe + auth.users are read by several sections.
// React cache() ensures each runs once per page render despite separate Suspense.
const stripeMetricsCached = cache(getStripeMetrics)
const authUsersCached = cache(getAuthUsers)

function money(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}
function usd(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const FEATURE_LABELS: Record<string, string> = {
  brief_gen: 'Brief generation',
  draft_gen: 'Draft generation',
  agent_review: 'Agent — review',
  agent_assist: 'Agent — assist',
  agent_auto: 'Agent — auto',
  keyword_research: 'Keyword research',
  audit: 'Content audit',
}
const featureLabel = (f: string) => FEATURE_LABELS[f] ?? f

// ─── shared bits ───────────────────────────────────────────────────────────
function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--cream-faint)]">{title}</h2>
      {hint && <p className="mt-1 text-xs text-[var(--cream-dim)]">{hint}</p>}
    </div>
  )
}

function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl p-5 h-[104px] animate-pulse" style={{ background: 'var(--ink-card)', border: '1px solid rgba(184,115,51,0.12)' }} />
      ))}
    </div>
  )
}

function TableSkeleton() {
  return <div className="rounded-xl h-48 animate-pulse" style={{ background: 'var(--ink-card)', border: '1px solid rgba(184,115,51,0.12)' }} />
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 text-xs text-[var(--cream-dim)] rounded-lg px-3 py-2" style={{ background: 'rgba(184,115,51,0.08)' }}>
      {children}
    </p>
  )
}

// ─── Section 1 — business metrics ────────────────────────────────────────────
async function BusinessMetrics() {
  const [stripe, users] = await Promise.all([stripeMetricsCached(), getUserMetrics()])
  const dragCents = stripe.listMrrCents - stripe.mrrCents
  const dragPct = stripe.listMrrCents > 0 ? (dragCents / stripe.listMrrCents) * 100 : 0
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricCard label="MRR" value={money(stripe.mrrCents)} sub={stripe.configured ? 'collected · after coupons' : 'Stripe not configured'} icon={DollarSign} />
        <MetricCard label="Active Paid" value={stripe.activePaid} sub="active subscriptions" icon={CreditCard} />
        <MetricCard label="Free Users" value={users.freeUsers} icon={UserCheck} />
        <MetricCard label="Total Users" value={users.totalUsers} icon={Users} />
        <MetricCard label="New This Month" value={users.newThisMonth} sub={`${users.newThisWeek.toLocaleString()} this week`} icon={UserPlus} />
        <MetricCard label="Churned This Month" value={stripe.churnedThisMonth} sub={`${stripe.newThisMonth.toLocaleString()} new subs this month`} icon={TrendingDown} />
      </div>

      {!stripe.configured && <Note>Stripe is not configured (no <code>STRIPE_SECRET_KEY</code>), so revenue metrics show 0.</Note>}

      {stripe.configured && (
        <Note>
          <span className="font-semibold text-[var(--cream-faint)]">List MRR</span> {money(stripe.listMrrCents)}
          {' · '}
          <span className="font-semibold text-[var(--cream-faint)]">Collected MRR</span> {money(stripe.mrrCents)}
          {' · '}
          <span className="font-semibold text-[var(--cream-faint)]">Discount drag</span> {money(dragCents)} ({dragPct.toFixed(1)}%)
        </Note>
      )}

      {stripe.planBreakdown.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--cream-faint)] mb-3">Plan breakdown</h3>
          <UsageTable
            columns={[
              { key: 'plan', label: 'Plan' },
              { key: 'count', label: 'Subscribers', align: 'right' },
              { key: 'mrr', label: 'MRR', align: 'right' },
            ]}
            rows={stripe.planBreakdown.map((p) => ({
              plan: p.label,
              count: p.count.toLocaleString(),
              mrr: `${money(p.monthlyCents)}/mo`,
            }))}
          />
        </div>
      )}
    </>
  )
}

// ─── Section 2 — feature usage ───────────────────────────────────────────────
async function FeatureUsageSection() {
  const f = await getFeatureUsage()
  const dash = (v: number | null) => (v === null ? '—' : v)
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard label="Articles This Month" value={f.articlesThisMonth} icon={FileText} />
      <MetricCard label="Briefs Ready" value={f.byStatus['brief_ready'] ?? 0} icon={FileText} />
      <MetricCard label="Drafts Ready" value={f.byStatus['ready'] ?? 0} icon={Sparkles} />
      <MetricCard label="Published" value={f.byStatus['published'] ?? 0} icon={FileText} />
      <MetricCard label="Agent Sessions" value={dash(f.agentSessions)} icon={Bot} />
      <MetricCard label="Keyword Projects" value={dash(f.keywordProjects)} icon={Search} />
      <MetricCard label="Audits Run" value={dash(f.auditsRun)} sub="not logged yet" icon={BarChart2} />
    </div>
  )
}

// ─── Section 3 — top accounts ────────────────────────────────────────────────
async function TopAccountsSection() {
  const [stripe, authUsers] = await Promise.all([stripeMetricsCached(), authUsersCached()])
  const accounts = await getTopAccounts(stripe.customerMrr, authUsers)
  return <TopAccountsTable accounts={accounts} />
}

// ─── Section 4 — cost tracking ───────────────────────────────────────────────
async function CostTrackingSection() {
  const [cost, stripe] = await Promise.all([getCostMetrics(), stripeMetricsCached()])
  const mrrUsd = stripe.mrrCents / 100
  const margin = mrrUsd > 0 ? ((mrrUsd - cost.totalCostUsd) / mrrUsd) * 100 : null

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Cost This Month" value={usd(cost.totalCostUsd)} icon={DollarSign} />
        <MetricCard
          label="Gross Margin"
          value={margin === null ? '—' : `${margin.toFixed(1)}%`}
          sub="(MRR − cost) ÷ MRR"
          icon={Percent}
        />
      </div>

      {cost.tableMissing ? (
        <Note>The <code>usage_events</code> table isn&apos;t present yet — apply migration <code>20260618_usage_events.sql</code> to start collecting cost data.</Note>
      ) : cost.totalCostUsd === 0 ? (
        <Note>Cost tracking active — data will appear as articles are generated.</Note>
      ) : null}

      {!cost.tableMissing && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--cream-faint)] mb-3">Cost by feature</h3>
            <UsageTable
              columns={[
                { key: 'feature', label: 'Feature' },
                { key: 'calls', label: 'Calls', align: 'right' },
                { key: 'total', label: 'Total', align: 'right' },
                { key: 'avg', label: 'Avg/call', align: 'right' },
              ]}
              rows={cost.byFeature.map((r) => ({
                feature: featureLabel(r.feature),
                calls: r.calls.toLocaleString(),
                total: usd(r.totalCost),
                avg: usd(r.avgCost),
              }))}
              empty="No usage events this month."
            />
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--cream-faint)] mb-3">Cost by model</h3>
            <UsageTable
              columns={[
                { key: 'model', label: 'Model' },
                { key: 'calls', label: 'Calls', align: 'right' },
                { key: 'total', label: 'Total', align: 'right' },
              ]}
              rows={cost.byModel.map((r) => ({
                model: r.model,
                calls: r.calls.toLocaleString(),
                total: usd(r.totalCost),
              }))}
              empty="No usage events this month."
            />
          </div>
        </div>
      )}
    </>
  )
}

// ─── page ────────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const monthLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  return (
    <div className="p-8 max-w-6xl mx-auto" style={{ background: 'var(--ink)', minHeight: '100vh' }}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--cream)]">Admin</h1>
        <p className="mt-1 text-sm text-[var(--cream-dim)]">Business, usage, and cost metrics · {monthLabel}</p>
      </div>

      <section className="mb-10">
        <SectionHeading title="Business metrics" />
        <Suspense fallback={<CardSkeleton count={6} />}>
          <BusinessMetrics />
        </Suspense>
      </section>

      <section className="mb-10">
        <SectionHeading title="Feature usage" hint="Current month" />
        <Suspense fallback={<CardSkeleton count={4} />}>
          <FeatureUsageSection />
        </Suspense>
      </section>

      <section className="mb-10">
        <SectionHeading title="Top accounts" hint="By articles generated · MRR resolved for the top 20" />
        <Suspense fallback={<TableSkeleton />}>
          <TopAccountsSection />
        </Suspense>
      </section>

      <section className="mb-10">
        <SectionHeading title="Cost tracking" hint="Current month" />
        <Suspense fallback={<CardSkeleton count={2} />}>
          <CostTrackingSection />
        </Suspense>
      </section>
    </div>
  )
}
