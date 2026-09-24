'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { analytics } from '@/lib/analytics'

// Fires a GA4 `page_view` and a Meta Pixel `PageView` on every client-side
// route change (and on initial load). Mirrors the PostHogPageView pattern.
// Must be rendered inside a <Suspense> boundary because useSearchParams()
// opts the subtree into client-side rendering.
export function AnalyticsPageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!pathname) return
    let url = window.origin + pathname
    const search = searchParams.toString()
    if (search) url += `?${search}`
    analytics.pageView(url)
  }, [pathname, searchParams])

  return null
}
