import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { LayoutDashboard, Building2, Search, FileText, BarChart2, X, Globe, Settings, MessageCircle } from 'lucide-react'
import SignOutButton from './SignOutButton'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/brand', label: 'Brand', icon: Building2 },
  { href: '/keywords', label: 'Keywords', icon: Search },
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
    <div className="flex h-screen" style={{ background: '#1C1917' }}>
      {/* Sidebar */}
      <aside className="w-60 flex flex-col flex-shrink-0" style={{ background: '#231F1B', borderRight: '1px solid rgba(184,115,51,0.18)' }}>
        {/* Logo */}
        <div className="h-16 flex items-center px-6" style={{ borderBottom: '1px solid rgba(184,115,51,0.18)' }}>
          <span style={{ fontFamily: 'var(--font-playfair, "Playfair Display", serif)', fontSize: '22px', fontWeight: 900, color: '#F7F3EC', letterSpacing: '-0.01em' }}>
            byline<span style={{ color: '#B87333' }}>.</span>
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors group"
              style={{ color: '#A89070' }}
            >
              <Icon className="w-4 h-4 flex-shrink-0" style={{ color: '#B87333' }} />
              {label}
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 py-4" style={{ borderTop: '1px solid rgba(184,115,51,0.18)' }}>
          {/* Social links */}
          <div className="flex items-center gap-3 px-3 mb-3">
            <a href="https://x.com/bylineseo" target="_blank" rel="noopener noreferrer" style={{ color: '#7A6555' }} className="hover:text-[#A89070] transition-colors">
              <X className="w-3.5 h-3.5" />
            </a>
            <a href="https://facebook.com/bylineseo" target="_blank" rel="noopener noreferrer" style={{ color: '#7A6555' }} className="hover:text-[#A89070] transition-colors">
              <Globe className="w-3.5 h-3.5" />
            </a>
          </div>
          <div className="px-3 py-1 text-xs truncate mb-1" style={{ color: '#7A6555' }}>{user.email}</div>
          <SignOutButton />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto" style={{ background: '#1C1917' }}>
        {children}
      </main>

      {/* Floating chat bubble */}
      <Link
        href="/brand"
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center rounded-full shadow-lg transition-transform hover:scale-110"
        style={{ background: '#B87333', width: '52px', height: '52px' }}
        title="Go to Brand"
      >
        <MessageCircle className="w-6 h-6" style={{ color: '#F7F3EC' }} />
      </Link>
    </div>
  )
}
