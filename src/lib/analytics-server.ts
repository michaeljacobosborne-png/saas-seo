// Server-side GA4 via the Measurement Protocol. Used to record conversions
// that are confirmed on the backend (e.g. a Stripe subscription activating)
// where no browser/gtag session is available.
//
// Requires NEXT_PUBLIC_GA4_ID (measurement_id) and GA4_API_SECRET.

export interface Ga4PurchaseInput {
  /**
   * GA4 client id. We don't have the browser's gtag client_id in a webhook, so
   * callers pass a stable surrogate (e.g. the user id) — the purchase is still
   * recorded, though it won't join to the originating web session.
   */
  clientId: string
  value: number
  currency?: string
  transactionId: string
  plan: string
  userId?: string
}

export interface Ga4Result {
  skipped?: boolean
  ok?: boolean
  status?: number
  error?: string
}

/** Send a GA4 `purchase` event via the Measurement Protocol. Never throws. */
export async function sendGa4Purchase(input: Ga4PurchaseInput): Promise<Ga4Result> {
  const measurementId = process.env.NEXT_PUBLIC_GA4_ID
  const apiSecret = process.env.GA4_API_SECRET

  if (!measurementId || !apiSecret) {
    console.warn('[ga4-mp] Skipping purchase — missing NEXT_PUBLIC_GA4_ID or GA4_API_SECRET')
    return { skipped: true }
  }

  const payload = {
    client_id: input.clientId,
    ...(input.userId ? { user_id: input.userId } : {}),
    events: [
      {
        name: 'purchase',
        params: {
          transaction_id: input.transactionId,
          currency: input.currency ?? 'USD',
          value: input.value,
          items: [{ item_name: input.plan, item_category: 'subscription' }],
        },
      },
    ],
  }

  try {
    const res = await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    )

    if (!res.ok) {
      const text = await res.text()
      console.error(`[ga4-mp] purchase failed (${res.status}):`, text)
      return { ok: false, status: res.status, error: text }
    }
    return { ok: true, status: res.status }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[ga4-mp] purchase request error:', msg)
    return { ok: false, error: msg }
  }
}
