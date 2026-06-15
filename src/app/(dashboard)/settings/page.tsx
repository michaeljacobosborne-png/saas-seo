import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CreditCard, CheckCircle2, AlertCircle, Settings, Globe, ChevronRight } from 'lucide-react'
import ManageBillingButton from './manage-billing-button'
import SearchConsoleSection from './search-console-section'

// Maps the internal plan key stored on the subscription (set from checkout
// metadata) to the customer-facing plan name shown on /pricing.
const PLAN_NAMES: Record<string, string> = {
  starter: 'Starter',
  pro: 'Growth',
  agency: 'Multi-Brand',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  trialing: 'Trial',
  past_due: 'Past due',
  canceled: 'Canceled',
  unpaid: 'Unpaid',
}

const STATUS_CLASSES: Record<string, string> = {
  active: 'text-green-400 bg-green-900/30 border-green-700/40',
  trialing: 'text-amber-400 bg-amber-900/30 border-amber-700/40',
  past_due: 'text-red-400 bg-red-900/30 border-red-700/40',
  canceled: 'text-[var(--cream-faint)] bg-[var(--ink-deep)] border-[rgba(184,115,51,0.15)]',
  unpaid: 'text-red-400 bg-red-900/30 border-red-700/40',
}

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Pick the subscription that reflects the user's CURRENT plan: the live
  // (active/trialing/past_due) one, most recently created. Ordering by
  // `current_period_end` was wrong — an older annual sub outlives a newer
  // monthly one, so e.g. a Growth-annual → Multi-Brand-monthly switcher would
  // see the stale Growth row win and show the wrong plan. Fall back to the most
  // recent row of any status so a fully-cancelled account still shows its plan.
  // `subscriptions` is not in the generated Supabase types, so cast as any.
  const SUB_COLS = 'plan, status, current_period_end, cancel_at_period_end, stripe_customer_id'
  const { data: liveSub } = await (supabase as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .from('subscriptions')
    .select(SUB_COLS)
    .eq('user_id', user.id)
    .in('status', ['active', 'trialing', 'past_due'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  let sub = liveSub
  if (!sub) {
    const { data: latestSub } = await (supabase as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .from('subscriptions')
      .select(SUB_COLS)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    sub = latestSub
  }

  // `profiles.account_type` is the source of truth for paid access — the
  // dashboard gate (and comped accounts) rely on it, and it's set even when the
  // subscription row is missing (webhook lag/failure) or stale. Use it as the
  // fallback signal so we never tell a paying user they're on "Free".
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('account_type')
    .eq('user_id', user.id)
    .maybeSingle()
  const isPaid = profile?.account_type === 'paid'

  // Search Console is per brand profile. Use the user's primary (oldest) brand
  // profile, and load its connection state server-side so the section renders
  // without a flash.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: brandProfile } = await (supabase as any)
    .from('brand_profiles')
    .select('id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  const brandProfileId: string | null = brandProfile?.id ?? null

  let gscInitial = { connected: false, property_url: null as string | null, has_property: false }
  if (brandProfileId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: gscConn } = await (supabase as any)
      .from('search_console_connections')
      .select('property_url')
      .eq('user_id', user.id)
      .eq('brand_profile_id', brandProfileId)
      .maybeSingle()
    if (gscConn) {
      gscInitial = {
        connected: true,
        property_url: gscConn.property_url ?? null,
        has_property: !!gscConn.property_url,
      }
    }
  }

  // Prefer the subscription row's plan (most specific). If there's no row but the
  // account is paid, show a neutral "Active" rather than a wrong/"Free" tier.
  const planName = sub?.plan
    ? (PLAN_NAMES[sub.plan] ?? sub.plan)
    : isPaid
      ? 'Active'
      : 'Free'
  // Same idea for status: a paid account with no row still has live access.
  const status: string | null = sub?.status ?? (isPaid ? 'active' : null)
  const hasBilling = !!sub?.stripe_customer_id
  const isCanceling = !!sub?.cancel_at_period_end
  const periodEnd = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null

  return (
    <div className="p-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 rounded-lg" style={{ background: 'rgba(184,115,51,0.1)' }}>
          <Settings className="w-5 h-5" style={{ color: '#B87333' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#F7F3EC' }}>Settings</h1>
          <p className="text-sm" style={{ color: 'var(--cream-faint)' }}>Manage your account and billing</p>
        </div>
      </div>

      {/* Billing card */}
      <div className="rounded-2xl p-6" style={{ background: 'var(--ink-card)', border: '1px solid rgba(184,115,51,0.18)' }}>
        <div className="flex items-center gap-2 mb-5">
          <CreditCard className="w-4 h-4" style={{ color: '#B87333' }} />
          <h2 className="text-base font-semibold" style={{ color: '#F7F3EC' }}>Billing &amp; Subscription</h2>
        </div>

        <div className="space-y-4">
          {/* Plan */}
          <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid rgba(184,115,51,0.1)' }}>
            <span className="text-sm" style={{ color: 'var(--cream-dim)' }}>Current plan</span>
            <span className="text-sm font-semibold" style={{ color: '#F7F3EC' }}>{planName}</span>
          </div>

          {/* Status */}
          <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid rgba(184,115,51,0.1)' }}>
            <span className="text-sm" style={{ color: 'var(--cream-dim)' }}>Status</span>
            {status ? (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${STATUS_CLASSES[status] ?? 'text-[var(--cream-dim)] bg-[var(--ink-deep)] border-[rgba(184,115,51,0.15)]'}`}>
                {status === 'active' || status === 'trialing'
                  ? <CheckCircle2 className="w-3 h-3" />
                  : <AlertCircle className="w-3 h-3" />}
                {STATUS_LABELS[status] ?? status}
              </span>
            ) : (
              <span className="text-sm" style={{ color: 'var(--cream-faint)' }}>No active subscription</span>
            )}
          </div>

          {/* Renewal / access-until */}
          {periodEnd && (
            <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid rgba(184,115,51,0.1)' }}>
              <span className="text-sm" style={{ color: 'var(--cream-dim)' }}>
                {isCanceling || status === 'canceled' ? 'Access until' : 'Next renewal'}
              </span>
              <span className="text-sm" style={{ color: '#F7F3EC' }}>{periodEnd}</span>
            </div>
          )}

          {/* Manage via Stripe customer portal */}
          <div className="pt-2">
            <ManageBillingButton hasBilling={hasBilling} />
          </div>
        </div>
      </div>

      {/* Search Console — useSearchParams needs a Suspense boundary */}
      <Suspense fallback={null}>
        <SearchConsoleSection brandProfileId={brandProfileId} initial={gscInitial} />
      </Suspense>

      {/* Publishing connections */}
      <Link
        href="/settings/connections"
        className="flex items-center justify-between rounded-2xl p-6 mt-6 transition-colors hover:bg-[var(--ink)]"
        style={{ background: 'var(--ink-card)', border: '1px solid rgba(184,115,51,0.18)' }}
      >
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4" style={{ color: '#B87333' }} />
          <div>
            <h2 className="text-base font-semibold" style={{ color: '#F7F3EC' }}>Publishing Connections</h2>
            <p className="text-sm" style={{ color: 'var(--cream-faint)' }}>Connect WordPress to publish articles in one click</p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 shrink-0" style={{ color: 'var(--cream-faint)' }} />
      </Link>
    </div>
  )
}
