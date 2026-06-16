'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// Auth-aware nav links for the marketing homepage. Logged out: Pricing / Log in /
// Get started. Logged in: Help / Settings / Dashboard. Rendered client-side so the
// homepage itself stays a server component; falls back to the logged-out links until
// the auth check resolves.
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
