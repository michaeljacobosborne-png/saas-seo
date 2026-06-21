import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/service'
import { getStripeMetrics } from '../../_lib/admin-data'
import UsageTable from '../../_components/UsageTable'

// Always render live — never statically prerender or cache account detail.
export const dynamic = 'force-dynamic'
export const revalidate = 0

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

// subscriptions.plan is one of starter|pro|agency — map to the public plan names.
const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  pro: 'Growth',
  agency: 'Multi-Brand',
}

function usd(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function money(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}/mo`
}
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

const CARD: React.CSSProperties = {
  background: 'var(--ink-card)',
  border: '1px solid rgba(184,115,51,0.12)',
}

interface UsageRow {
  feature: string
  model: string | null
  input_tokens: number | string | null
  output_tokens: number | string | null
  cost_usd: number | string | null
  created_at: string
}

function num(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0
  return typeof v === 'string' ? parseFloat(v) || 0 : v
}

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const svc = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = svc as any

  const [userRes, stripe, subsRes, artsRes, agentRes, usageRes] = await Promise.all([
    svc.auth.admin.getUserById(id),
    getStripeMetrics(),
    p.from('subscriptions').select('stripe_customer_id, status, plan').eq('user_id', id),
    p.from('articles').select('status').eq('user_id', id),
    p.from('agent_memory').select('id', { count: 'exact', head: true }).eq('user_id', id).eq('memory_type', 'article'),
    p
      .from('usage_events')
      .select('feature, model, input_tokens, output_tokens, cost_usd, created_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(500),
  ])

  const user = userRes.data?.user
  const email = user?.email ?? '(unknown)'
  const signupDate = user?.created_at

  // ─── account type, plan, MRR (after coupons) ────────────────────────────────
  const subs = (subsRes.data ?? []) as { stripe_customer_id: string | null; status: string; plan: string | null }[]
  const activeSub = subs.find((s) => s.status === 'active' || s.status === 'trialing')
  const accountType = activeSub ? 'Paid' : 'Free'
  const planName = activeSub?.plan ? (PLAN_LABELS[activeSub.plan] ?? activeSub.plan) : null
  const custId = activeSub?.stripe_customer_id ?? null
  const mrrCents = custId ? (stripe.customerMrr.get(custId) ?? 0) : 0

  // ─── articles by status ─────────────────────────────────────────────────────
  const arts = (artsRes.data ?? []) as { status: string }[]
  const byStatus: Record<string, number> = {}
  for (const a of arts) byStatus[a.status] = (byStatus[a.status] ?? 0) + 1
  const draftCount = (byStatus['draft'] ?? 0) + (byStatus['brief_ready'] ?? 0)
  const readyCount = byStatus['ready'] ?? 0
  const publishedCount = byStatus['published'] ?? 0

  const agentSessions = agentRes.error ? 0 : (agentRes.count ?? 0)

  // ─── usage events: feature breakdown + timeline ─────────────────────────────
  const usageRows = (usageRes?.data ?? []) as UsageRow[]
  const tableMissing = !!usageRes?.error

  const featMap = new Map<string, { input: number; output: number; cost: number; calls: number }>()
  for (const r of usageRows) {
    const cur = featMap.get(r.feature) ?? { input: 0, output: 0, cost: 0, calls: 0 }
    cur.input += num(r.input_tokens)
    cur.output += num(r.output_tokens)
    cur.cost += num(r.cost_usd)
    cur.calls += 1
    featMap.set(r.feature, cur)
  }
  const byFeature = Array.from(featMap.entries())
    .map(([feature, v]) => ({ feature, ...v }))
    .sort((a, b) => b.cost - a.cost)
  const totalCost = byFeature.reduce((s, f) => s + f.cost, 0)

  // 30-day timeline grouped by date.
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
  const dayMap = new Map<string, { calls: number; cost: number }>()
  for (const r of usageRows) {
    const t = new Date(r.created_at).getTime()
    if (t < cutoff) continue
    const day = r.created_at.slice(0, 10)
    const cur = dayMap.get(day) ?? { calls: 0, cost: 0 }
    cur.calls += 1
    cur.cost += num(r.cost_usd)
    dayMap.set(day, cur)
  }
  const timeline = Array.from(dayMap.entries())
    .map(([day, v]) => ({ day, ...v }))
    .sort((a, b) => b.day.localeCompare(a.day))

  return (
    <div className="p-8 max-w-6xl mx-auto" style={{ background: 'var(--ink)', minHeight: '100vh' }}>
      <Link href="/admin" className="text-sm text-[var(--copper)] hover:underline">
        ← Back to dashboard
      </Link>

      {/* ─── User header ─────────────────────────────────────────────────────── */}
      <div className="mt-4 mb-10">
        <h1 className="text-2xl font-bold text-[var(--cream)] break-all">{email}</h1>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-[var(--cream-dim)]">
          <span>
            <span className="text-[var(--cream-faint)]">Signed up</span> {fmtDate(signupDate)}
          </span>
          <span>
            <span className="text-[var(--cream-faint)]">Type</span>{' '}
            <span className={accountType === 'Paid' ? 'text-green-400' : ''}>{accountType}</span>
          </span>
          {planName && (
            <span>
              <span className="text-[var(--cream-faint)]">Plan</span> {planName}
            </span>
          )}
          <span>
            <span className="text-[var(--cream-faint)]">MRR</span>{' '}
            <span className="text-[var(--copper)]">{mrrCents > 0 ? money(mrrCents) : '$0'}</span>
          </span>
          <span className="text-[var(--cream-dim)] opacity-60">{id}</span>
        </div>
      </div>

      {/* ─── Summary cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {[
          { label: 'Drafts', value: draftCount },
          { label: 'Ready', value: readyCount },
          { label: 'Published', value: publishedCount },
          { label: 'Agent Sessions', value: agentSessions },
        ].map((c) => (
          <div key={c.label} className="rounded-xl p-5" style={CARD}>
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--cream-dim)]">{c.label}</div>
            <div className="mt-2 text-2xl font-bold tabular-nums text-[var(--cream)]">{c.value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {tableMissing ? (
        <div className="rounded-lg px-4 py-3 text-sm text-[var(--cream-dim)]" style={{ background: 'rgba(184,115,51,0.08)' }}>
          The <code>usage_events</code> table isn&apos;t present yet — apply migration{' '}
          <code>20260618_usage_events.sql</code> to start collecting cost data.
        </div>
      ) : (
        <>
          {/* ─── Token & cost by feature ─────────────────────────────────────── */}
          <section className="mb-10">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--cream-faint)] mb-1">
              Token &amp; cost by feature
            </h2>
            <p className="mb-4 text-xs text-[var(--cream-dim)]">
              Total cost {usd(totalCost)} across {usageRows.length.toLocaleString()} events
            </p>
            <UsageTable
              columns={[
                { key: 'feature', label: 'Feature' },
                { key: 'calls', label: 'Calls', align: 'right' },
                { key: 'input', label: 'Input tokens', align: 'right' },
                { key: 'output', label: 'Output tokens', align: 'right' },
                { key: 'cost', label: 'Cost', align: 'right' },
              ]}
              rows={byFeature.map((f) => ({
                feature: featureLabel(f.feature),
                calls: f.calls.toLocaleString(),
                input: Math.round(f.input).toLocaleString(),
                output: Math.round(f.output).toLocaleString(),
                cost: usd(f.cost),
              }))}
              empty="No usage events for this account."
            />
          </section>

          {/* ─── 30-day timeline ─────────────────────────────────────────────── */}
          <section className="mb-10">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--cream-faint)] mb-4">
              Last 30 days
            </h2>
            <UsageTable
              columns={[
                { key: 'day', label: 'Date' },
                { key: 'calls', label: 'Calls', align: 'right' },
                { key: 'cost', label: 'Cost', align: 'right' },
              ]}
              rows={timeline.map((d) => ({
                day: fmtDate(d.day),
                calls: d.calls.toLocaleString(),
                cost: usd(d.cost),
              }))}
              empty="No usage in the last 30 days."
            />
          </section>

          {/* ─── All usage events ────────────────────────────────────────────── */}
          <section className="mb-10">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--cream-faint)] mb-1">
              Usage events
            </h2>
            <p className="mb-4 text-xs text-[var(--cream-dim)]">Most recent 100</p>
            <UsageTable
              columns={[
                { key: 'when', label: 'When' },
                { key: 'feature', label: 'Feature' },
                { key: 'model', label: 'Model' },
                { key: 'input', label: 'Input', align: 'right' },
                { key: 'output', label: 'Output', align: 'right' },
                { key: 'cost', label: 'Cost', align: 'right' },
              ]}
              rows={usageRows.slice(0, 100).map((r) => ({
                when: fmtDateTime(r.created_at),
                feature: featureLabel(r.feature),
                model: r.model ?? '—',
                input: Math.round(num(r.input_tokens)).toLocaleString(),
                output: Math.round(num(r.output_tokens)).toLocaleString(),
                cost: usd(num(r.cost_usd)),
              }))}
              empty="No usage events for this account."
            />
          </section>
        </>
      )}
    </div>
  )
}
