import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Owner-only. The /admin dashboard exposes business + cost metrics across ALL
// users, so it is gated to a single hardcoded owner email. Anyone else (logged
// in or not) is bounced to /login.
const OWNER_EMAIL = 'michaeljacobosborne@gmail.com'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email?.toLowerCase() !== OWNER_EMAIL) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--ink)' }}>
      {children}
    </div>
  )
}
