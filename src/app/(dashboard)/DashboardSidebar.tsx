'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard, Building2, Search, Bookmark, FileText, BarChart2,
  Settings, X, Menu, Lock, Sparkles,
} from 'lucide-react'
import SignOutButton from './SignOutButton'
import ThemeToggle from '@/app/_components/ThemeToggle'

// lucide-react v1+ dropped brand icons — use inline SVG for Facebook and X
function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  )
}

function XTwitterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

// `freeAccess` marks the routes a free-tier user can actually open. The rest are
// shown greyed out with a lock icon and route to /pricing on click.
const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, freeAccess: true },
  { href: '/brand', label: 'Brand', icon: Building2, freeAccess: false },
  { href: '/keywords', label: 'Keywords', icon: Search, freeAccess: false },
  { href: '/keywords/saved', label: 'Saved Keywords', icon: Bookmark, freeAccess: false },
  { href: '/articles', label: 'Articles', icon: FileText, freeAccess: true },
  { href: '/content-audit', label: 'Content Audit', icon: BarChart2, freeAccess: false },
  { href: '/settings', label: 'Settings', icon: Settings, freeAccess: true },
]

export default function DashboardSidebar({ userEmail, accountType }: { userEmail: string; accountType: 'free' | 'paid' }) {
  const isFree = accountType === 'free'
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="h-16 flex items-center px-6 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontFamily: 'var(--font-playfair, "Playfair Display", serif)', fontSize: '22px', fontWeight: 900, color: 'var(--cream)', letterSpacing: '-0.01em' }}>
          Byline<span style={{ color: 'var(--copper)' }}>.</span>
        </span>
        {/* Close button — only meaningful inside the mobile drawer */}
        <button
          className="ml-auto md:hidden transition-colors"
          style={{ color: 'var(--cream-faint)' }}
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon, freeAccess }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          const locked = isFree && !freeAccess
          if (locked) {
            // Greyed, lock-iconed entry that nudges free users to upgrade.
            return (
              <Link
                key={href}
                href="/pricing"
                onClick={() => setMobileOpen(false)}
                title="Upgrade to unlock"
                className="flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors group"
                style={{ color: 'var(--cream-faint)' }}
              >
                <Icon className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--cream-faint)' }} />
                <span className="flex-1">{label}</span>
                <Lock className="w-3.5 h-3.5 flex-shrink-0 opacity-70 group-hover:opacity-100 transition-opacity" />
              </Link>
            )
          }
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors"
              style={{ color: active ? 'var(--cream)' : 'var(--cream-dim)', background: active ? 'rgba(184,115,51,0.12)' : undefined }}
            >
              <Icon className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--copper)' }} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
        {isFree && (
          <Link
            href="/pricing"
            onClick={() => setMobileOpen(false)}
            className="flex items-center justify-center gap-2 px-3 py-2.5 mb-3 text-sm font-semibold rounded-lg transition-colors"
            style={{ background: 'var(--copper)', color: '#fff' }}
          >
            <Sparkles className="w-4 h-4" />
            Upgrade
          </Link>
        )}
        <ThemeToggle />
        <div className="flex items-center gap-3 px-3 mt-3 mb-3">
          <a href="https://x.com/bylineseo" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--cream-faint)' }} className="hover:text-[var(--cream-dim)] transition-colors">
            <XTwitterIcon className="w-3.5 h-3.5" />
          </a>
          <a href="https://facebook.com/bylineseo" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--cream-faint)' }} className="hover:text-[var(--cream-dim)] transition-colors">
            <FacebookIcon className="w-3.5 h-3.5" />
          </a>
        </div>
        <div className="px-3 py-1 text-xs truncate mb-1" style={{ color: 'var(--cream-faint)' }}>{userEmail}</div>
        <SignOutButton />
      </div>
    </>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 flex-col flex-shrink-0" style={{ background: 'var(--ink-card)', borderRight: '1px solid var(--border)' }}>
        {sidebarContent}
      </aside>

      {/* Mobile top bar with hamburger */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 flex items-center px-4 gap-3"
        style={{ background: 'var(--ink-card)', borderBottom: '1px solid var(--border)' }}
      >
        <button
          onClick={() => setMobileOpen(true)}
          className="transition-colors"
          style={{ color: 'var(--cream-dim)' }}
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <span style={{ fontFamily: 'var(--font-playfair, "Playfair Display", serif)', fontSize: '20px', fontWeight: 900, color: 'var(--cream)', letterSpacing: '-0.01em' }}>
          Byline<span style={{ color: 'var(--copper)' }}>.</span>
        </span>
      </div>

      {/* Mobile slide-in drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 flex flex-col h-full z-10" style={{ background: 'var(--ink-card)' }}>
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  )
}
