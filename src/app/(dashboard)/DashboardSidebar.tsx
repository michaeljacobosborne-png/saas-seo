'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard, Building2, Search, Bookmark, FileText, BarChart2,
  Settings, X, Menu, Facebook,
} from 'lucide-react'
import SignOutButton from './SignOutButton'
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

export default function DashboardSidebar({ userEmail }: { userEmail: string }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="h-16 flex items-center px-6 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontFamily: 'var(--font-playfair, "Playfair Display", serif)', fontSize: '22px', fontWeight: 900, color: 'var(--cream)', letterSpacing: '-0.01em' }}>
          byline<span style={{ color: 'var(--copper)' }}>.</span>
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
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
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
        <ThemeToggle />
        <div className="flex items-center gap-3 px-3 mt-3 mb-3">
          <a href="https://x.com/bylineseo" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--cream-faint)' }} className="hover:text-[var(--cream-dim)] transition-colors">
            <X className="w-3.5 h-3.5" />
          </a>
          <a href="https://facebook.com/bylineseo" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--cream-faint)' }} className="hover:text-[var(--cream-dim)] transition-colors">
            <Facebook className="w-3.5 h-3.5" />
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
          byline<span style={{ color: 'var(--copper)' }}>.</span>
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
