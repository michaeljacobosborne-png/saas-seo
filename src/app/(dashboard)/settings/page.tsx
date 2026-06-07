import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CreditCard, CheckCircle2, AlertCircle, Settings } from 'lucide-react'
import ManageBillingButton from './manage-billing-button'

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
  canceled: 'text-[#7A6555] bg-[#2A2420] border-[rgba(184,115,51,0.15)]',
  unpaid: 'text-red-400 bg-red-900/30 border-red-700/40',
}

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // `subscriptions` is not in the generated Supabase types, so cast as any.
  // Most recent row wins (an old canceled sub may coexist with a new one).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sub } = await (supabase as any)
    .from('subscriptions')
    .select('plan, status, current_period_end, cancel_at_period_end, stripe_customer_id')
    .eq('user_id', user.id)
    .order('current_period_end', { ascending: false })
    .limit(1)
    .maybeSingle()

  const planName = sub?.plan ? (PLAN_NAMES[sub.plan] ?? sub.plan) : 'Free'
  const status: string | null = sub?.status ?? null
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
          <p className="text-sm" style={{ color: '#7A6555' }}>Manage your account and billing</p>
        </div>
      </div>

      {/* Billing card */}
      <div className="rounded-2xl p-6" style={{ background: '#231F1B', border: '1px solid rgba(184,115,51,0.18)' }}>
        <div className="flex items-center gap-2 mb-5">
          <CreditCard className="w-4 h-4" style={{ color: '#B87333' }} />
          <h2 className="text-base font-semibold" style={{ color: '#F7F3EC' }}>Billing &amp; Subscription</h2>
        </div>

        <div className="space-y-4">
          {/* Plan */}
          <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid rgba(184,115,51,0.1)' }}>
            <span className="text-sm" style={{ color: '#A89070' }}>Current plan</span>
            <span className="text-sm font-semibold" style={{ color: '#F7F3EC' }}>{planName}</span>
          </div>

          {/* Status */}
          <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid rgba(184,115,51,0.1)' }}>
            <span className="text-sm" style={{ color: '#A89070' }}>Status</span>
            {status ? (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${STATUS_CLASSES[status] ?? 'text-[#A89070] bg-[#2A2420] border-[rgba(184,115,51,0.15)]'}`}>
                {status === 'active' || status === 'trialing'
                  ? <CheckCircle2 className="w-3 h-3" />
                  : <AlertCircle className="w-3 h-3" />}
                {STATUS_LABELS[status] ?? status}
              </span>
            ) : (
              <span className="text-sm" style={{ color: '#7A6555' }}>No active subscription</span>
            )}
          </div>

          {/* Renewal / access-until */}
          {periodEnd && (
            <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid rgba(184,115,51,0.1)' }}>
              <span className="text-sm" style={{ color: '#A89070' }}>
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
    </div>
  )
}
