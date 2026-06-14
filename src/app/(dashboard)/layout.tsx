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

  if (!sub) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('account_type')
      .eq('user_id', user.id)
      .maybeSingle()

    // No active/trialing subscription: allow through only if the profile grants
    // paid access (e.g. comped accounts, or before the subscription row lands).
    // Genuinely free or unprovisioned users get sent to pricing.
    if (!profile || profile.account_type === 'free') redirect('/pricing')
  }

  return (
    <div className="flex h-screen" style={{ background: 'var(--ink)' }}>
      {/* Sidebar: desktop rail + mobile hamburger/drawer (client component) */}
      <DashboardSidebar userEmail={user.email ?? ''} />

      {/* Main content — pt-14 on mobile clears the fixed hamburger top bar */}
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0" style={{ background: 'var(--ink)' }}>
        {children}
      </main>

      {/* Floating customer-support agent (available across the dashboard) */}
      <SupportWidget />
    </div>
  )
}
