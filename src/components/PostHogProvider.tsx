'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com'

// Initialise once on the client
if (typeof window !== 'undefined' && POSTHOG_KEY) {
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: true,         // auto-capture every route change
    capture_pageleave: true,
    session_recording: {
      maskAllInputs: false,         // we want to see what users type
      maskInputOptions: { password: true },
    },
    person_profiles: 'identified_only',
  })
}

/** Identify the logged-in user so events are tied to their account */
function UserIdentifier() {
  const ph = usePostHog()
  useEffect(() => {
    if (!ph || !POSTHOG_KEY) return
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) ph.identify(user.id, { email: user.email })
      else ph.reset()
    })
  }, [ph])
  return null
}

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  if (!POSTHOG_KEY) return <>{children}</>

  return (
    <PHProvider client={posthog}>
      <UserIdentifier />
      {children}
    </PHProvider>
  )
}

// ── Event helpers ────────────────────────────────────────────────────────────
// Import `track` anywhere to fire a product event.

export function track(event: string, props?: Record<string, unknown>) {
  if (typeof window === 'undefined' || !POSTHOG_KEY) return
  posthog.capture(event, props)
}
