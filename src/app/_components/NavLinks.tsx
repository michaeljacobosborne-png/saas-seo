'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// Auth-aware nav links for the marketing homepage. Logged out: Pricing / Log in /
// Get started. Logged in: Help / Settings / Dashboard. Rendered client-side so the
// homepage itself stays a server component; falls back to the logged-out links until
// the auth check resolves.

function FreeToolsDropdown() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative hidden sm:block">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-sm text-[#A89070] hover:text-[#F7F3EC] transition-colors"
      >
        Free Tools
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 bg-[#1C1917] border border-white/10 rounded-xl shadow-xl py-1 z-50">
          <Link
            href="/geo-analyzer"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-sm text-[#A89070] hover:text-[#F7F3EC] hover:bg-white/5 transition-colors"
          >
            GEO Analyzer
            <span className="block text-xs text-[#57534E] mt-0.5">AI citation score</span>
          </Link>
          <Link
            href="/ao-analyzer"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-sm text-[#A89070] hover:text-[#F7F3EC] hover:bg-white/5 transition-colors"
          >
            AO Analyzer
            <span className="block text-xs text-[#57534E] mt-0.5">Answer optimization score</span>
          </Link>
          <Link
            href="/audit"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-sm text-[#A89070] hover:text-[#F7F3EC] hover:bg-white/5 transition-colors"
          >
            Content Gap Audit
            <span className="block text-xs text-[#57534E] mt-0.5">Find missing content</span>
          </Link>
        </div>
      )}
    </div>
  )
}

export default function NavLinks() {
  const [loggedIn, setLoggedIn] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let active = true

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (active) setLoggedIn(!!user)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setLoggedIn(!!session?.user)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const secondaryLink = 'text-sm text-[#A89070] hover:text-[#F7F3EC] transition-colors hidden sm:block'
  const primaryButton = 'px-4 py-2 rounded-lg bg-[#B87333] text-[#F7F3EC] text-sm font-semibold hover:bg-[#A0622A] transition-colors'

  if (loggedIn) {
    return (
      <div className="flex items-center gap-4">
        <FreeToolsDropdown />
        <a href="mailto:hi@bylineseo.com" className={secondaryLink}>
          Help
        </a>
        <Link href="/settings" className={secondaryLink}>
          Settings
        </Link>
        <Link href="/dashboard" className={primaryButton}>
          Dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4">
      <FreeToolsDropdown />
      <Link href="/pricing" className={secondaryLink}>
        Pricing
      </Link>
      <Link href="/login" className={secondaryLink}>
        Log in
      </Link>
      <Link href="/pricing" className={primaryButton}>
        Get started
      </Link>
    </div>
  )
}
