// Client-side Reddit Pixel (rdt) helper. The base pixel + init + PageVisit is
// loaded once from <RedditPixel /> (src/components/RedditPixel.tsx) in the root
// layout; this module is the single place we fire Reddit conversion events
// (SignUp, Lead, Purchase, …).
//
// Safe to call during SSR / before the pixel script loads: it no-ops if
// `window` or `window.rdt` isn't available yet.

declare global {
  interface Window {
    rdt?: (...args: unknown[]) => void
  }
}

export function rdt(event: string, data?: Record<string, unknown>): void {
  if (typeof window === 'undefined' || typeof window.rdt !== 'function') return
  window.rdt('track', event, data)
}
