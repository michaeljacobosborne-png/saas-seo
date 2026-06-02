'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard, Building2, Search, FileText, BarChart2,
  X, Settings, Menu,
} from 'lucide-react'
import SignOutButton from './SignOutButton'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/brand', label: 'Brand', icon: Building2 },
  { href: '/keywords', label: 'Keywords', icon: Search },
  { href: '/articles', label: 'Articles', icon: FileText },
  { href: '/content-audit', label: 'Content Audit', icon: BarChart2 },
  { href: '/settings', label: 'Settings', icon: Settings },
]

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-label="Facebook"
    >
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  )
}

interface DashboardSidebarProps {
  userEmail: string
}

export default function DashboardSidebar({ userEmail }: DashboardSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  const sidebarContent = (
    <>
      {/* Logo row */}
      <div className="h-16 flex items-center px-6 flex-shrink-0" style={{ borderBottom: '1px solid rgba(184,115,51,0.18)' }}>
        <span style={{ fontFamily: 'var(--font-playfair, "Playfair Display", serif)', fontSize: '22px', fontWeight: 900, color: '#F7F3EC', letterSpacing: '-0.01em' }}>
          byline<span style={{ color: '#B87333' }}>.</span>
        </span>
        <button
          className="ml-auto md:hidden text-[#7A6555] hover:text-[#A89070] transition-colors"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors"
              style={{ color: active ? '#F7F3EC' : '#A89070', background: active ? 'rgba(184,115,51,0.12)' : undefined }}
            >
              <Icon className="w-4 h-4 flex-shrink-0" style={{ color: '#B87333' }} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Sidebar footer */}
      <div className="px-3 py-4 flex-shrink-0" style={{ borderTop: '1px solid rgba(184,115,51,0.18)' }}>
        <div className="flex items-center gap-3 px-3 mb-3">
          <a href="https://x.com/bylineseo" target="_blank" rel="noopener noreferrer" style={{ color: '#7A6555' }} className="hover:text-[#A89070] transition-colors">
            <X className="w-3.5 h-3.5" />
          </a>
          <a href="https://facebook.com/bylineseo" target="_blank" rel="noopener noreferrer" style={{ color: '#7A6555' }} className="hover:text-[#A89070] transition-colors">
            <FacebookIcon className="w-3.5 h-3.5" />
          </a>
        </div>
        <div className="px-3 py-1 text-xs truncate mb-1" style={{ color: '#7A6555' }}>{userEmail}</div>
        <SignOutButton />
      </div>
    </>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex w-60 flex-col flex-shrink-0"
        style={{ background: '#231F1B', borderRight: '1px solid rgba(184,115,51,0.18)' }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile top bar with hamburger */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 flex items-center px-4 gap-3"
        style={{ background: '#231F1B', borderBottom: '1px solid rgba(184,115,51,0.18)' }}
      >
        <button
          onClick={() => setMobileOpen(true)}
          className="text-[#A89070] hover:text-[#F7F3EC] transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <span style={{ fontFamily: 'var(--font-playfair, "Playfair Display", serif)', fontSize: '20px', fontWeight: 900, color: '#F7F3EC', letterSpacing: '-0.01em' }}>
          byline<span style={{ color: '#B87333' }}>.</span>
        </span>
      </div>

      {/* Mobile slide-in drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside
            className="relative w-64 flex flex-col h-full z-10"
            style={{ background: '#231F1B' }}
          >
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  )
}
