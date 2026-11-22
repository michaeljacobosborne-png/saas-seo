import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardSidebar from './DashboardSidebar'
import SupportWidget from '@/app/_components/SupportWidget'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('user_id', user.id)
    .in('status', ['active', 'trialing'])
    .limit(1)
    .maybeSingle()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('account_type')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!sub) {
    // No active/trialing subscription: free-tier users now get the stripped-down
    // in-app experience, and comped/paid profiles pass through (their sub row may
    // not have landed yet). Only genuinely unprovisioned users (no profile row at
    // all) are sent to pricing.
    if (!profile) redirect('/pricing')
  }

  // Drives the free-tier sidebar (locked nav + Upgrade CTA). A user with an active
  // subscription is always treated as paid regardless of the stored account_type.
  const accountType: 'free' | 'paid' = sub ? 'paid' : (profile?.account_type === 'free' ? 'free' : 'paid')

  // No brand-profile gate (2026-11-22). A new account lands on the dashboard and can
  // track a page or run an audit straight away; neither needs a brand. The profile
  // is asked for where it earns its keep: a dismissible prompt on the dashboard,
  // the article generator, and a tracked page where the engine's reading of the
  // site's name looks uncertain.

  return (
    <div className="flex h-screen" style={{ background: 'var(--ink)' }}>
      {/* Sidebar: desktop rail + mobile hamburger/drawer (client component) */}
      <DashboardSidebar userEmail={user.email ?? ''} accountType={accountType} />

      {/* Main content — pt-14 on mobile clears the fixed hamburger top bar */}
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0" style={{ background: 'var(--ink)' }}>
        {children}
      </main>

      {/* Floating customer-support agent (available across the dashboard) */}
      <SupportWidget />
    </div>
  )
}
