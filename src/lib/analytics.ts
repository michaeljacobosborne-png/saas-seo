// Client-side analytics. A single typed surface that fires BOTH GA4 (gtag.js)
// and the Meta Pixel (fbq) on every call. Import `analytics` from here rather
// than calling gtag/fbq directly anywhere in the app, so event naming and the
// GA4<->Meta event mapping stay in one place.
//
// All functions are safe to call during SSR / before the scripts load: they
// no-op if `window`, `gtag`, or `fbq` aren't available yet.

import { subscriptionEventId } from './analytics-events'

type Params = Record<string, unknown>

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    fbq?: (...args: unknown[]) => void
    dataLayer?: unknown[]
  }
}

// Our generic event names -> Meta standard event names. Anything not in this
// map is sent to Meta as a custom event via `trackCustom`.
const FB_STANDARD: Record<string, string> = {
  page_view: 'PageView',
  sign_up: 'Lead',
  begin_checkout: 'InitiateCheckout',
  purchase: 'Subscribe',
}

function gtagEvent(event: string, params?: Params): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  window.gtag('event', event, params ?? {})
}

function fbqTrack(event: string, params?: Params, eventID?: string): void {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return
  const standard = FB_STANDARD[event] ? FB_STANDARD[event] : null
  const method = standard ? 'track' : 'trackCustom'
  const name = standard ?? event
  if (eventID) {
    window.fbq(method, name, params ?? {}, { eventID })
  } else {
    window.fbq(method, name, params ?? {})
  }
}

export const analytics = {
  /** Generic passthrough — fires the GA4 event and the matching Meta event. */
  track(event: string, params?: Params): void {
    gtagEvent(event, params)
    fbqTrack(event, params)
  },

  /** Manual SPA page view. Sent on every client-side route change. */
  pageView(url: string): void {
    let pagePath = url
    try {
      pagePath = new URL(url).pathname
    } catch {
      // url wasn't absolute; fall back to the raw value
    }
    gtagEvent('page_view', { page_location: url, page_path: pagePath })
    fbqTrack('page_view')
  },

  /** Fired when a user completes Supabase auth signup. */
  signUp(userId: string): void {
    gtagEvent('sign_up', { method: 'supabase', user_id: userId })
    fbqTrack('sign_up')
  },

  /** Fired when a user clicks a pricing/upgrade button. */
  beginCheckout(plan: string, value: number): void {
    const params = {
      currency: 'USD',
      value,
      items: [{ item_name: plan, item_category: 'subscription' }],
    }
    gtagEvent('begin_checkout', params)
    fbqTrack('begin_checkout', { currency: 'USD', value, content_name: plan, content_type: 'product' })
  },

  /**
   * Fired client-side when a subscription is confirmed active. The Meta event
   * carries an event_id derived from the subscription so it deduplicates
   * against the server-side Conversions API event. (GA4's authoritative
   * `purchase` is sent server-side via the Measurement Protocol.)
   */
  purchase(plan: string, value: number, subscriptionId: string): void {
    gtagEvent('purchase', {
      transaction_id: subscriptionId,
      currency: 'USD',
      value,
      items: [{ item_name: plan, item_category: 'subscription' }],
    })
    fbqTrack(
      'purchase',
      { currency: 'USD', value, content_name: plan, content_type: 'product' },
      subscriptionEventId(subscriptionId),
    )
  },
}
