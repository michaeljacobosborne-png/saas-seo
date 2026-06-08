import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { LayoutDashboard, Building2, Search, Bookmark, FileText, BarChart2, Settings, X, Globe } from 'lucide-react'
import SignOutButton from './SignOutButton'
import SupportWidget from '@/app/_components/SupportWidget'
import ThemeToggle from '@/app/_components/ThemeToggle'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/brand', label: 'Brand', icon: Building2 },
  { href: '/keywords', label: 'Keywords', icon: Search },
  { href: '/keywords/saved', label: 'Saved Keywords', icon: Bookmark },
  { href: '/articles', label: 'Articles', icon: FileText },
  { href: '/content-audit', label: 'Content Audit', icon: BarChart2 },
  { href: '/settings', label: 'Settings', icon: Settings },
]

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
    <div className="flex h-screen" style={{ background: 'var(--ink)' }}>
      {/* Sidebar */}
      <aside className="w-60 flex flex-col flex-shrink-0" style={{ background: 'var(--ink-card)', borderRight: '1px solid var(--border)' }}>
        {/* Logo */}
        <div className="h-16 flex items-center px-6" style={{ borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontFamily: 'var(--font-playfair, "Playfair Display", serif)', fontSize: '22px', fontWeight: 900, color: 'var(--cream)', letterSpacing: '-0.01em' }}>
            byline<span style={{ color: 'var(--copper)' }}>.</span>
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors group"
              style={{ color: 'var(--cream-dim)' }}
            >
              <Icon className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--copper)' }} />
              {label}
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 py-4" style={{ borderTop: '1px solid var(--border)' }}>
          {/* Theme toggle */}
          <ThemeToggle />
          {/* Social links */}
          <div className="flex items-center gap-3 px-3 mt-3 mb-3">
            <a href="https://x.com/bylineseo" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--cream-faint)' }} className="hover:text-[var(--cream-dim)] transition-colors">
              <X className="w-3.5 h-3.5" />
            </a>
            <a href="https://facebook.com/bylineseo" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--cream-faint)' }} className="hover:text-[var(--cream-dim)] transition-colors">
              <Globe className="w-3.5 h-3.5" />
            </a>
          </div>
          <div className="px-3 py-1 text-xs truncate mb-1" style={{ color: 'var(--cream-faint)' }}>{user.email}</div>
          <SignOutButton />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto" style={{ background: 'var(--ink)' }}>
        {children}
      </main>

      {/* Floating customer-support agent (available across the dashboard) */}
      <SupportWidget />
    </div>
  )
}
