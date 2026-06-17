import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
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

  // Brand-new users must set up their brand profile before doing anything else.
  // Skip /brand itself (where they set it up) and /settings (account utilities)
  // so they're never trapped in a redirect loop.
  const pathname = (await headers()).get('x-pathname') ?? ''
  if (!pathname.startsWith('/brand') && !pathname.startsWith('/settings')) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: brandProfile } = await (supabase as any)
      .from('brand_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!brandProfile) redirect('/brand')
  }

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
