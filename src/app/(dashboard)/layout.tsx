import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardSidebar from './DashboardSidebar'
import ChatWidget from '@/components/ChatWidget'

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

    if (profile?.account_type !== 'free') redirect('/pricing')
  }

  return (
    <div className="flex h-screen" style={{ background: '#1C1917' }}>
      <DashboardSidebar userEmail={user.email ?? ''} />

      {/* Main content -- on mobile add top padding to clear the sticky header */}
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0" style={{ background: '#1C1917' }}>
        {children}
      </main>

      <ChatWidget />
    </div>
  )
}
