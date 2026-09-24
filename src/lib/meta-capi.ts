// Server-side Meta Conversions API (CAPI). Sends conversion events directly
// from our backend to Meta, complementing the browser Pixel. Pixel + CAPI
// events that share an event_id are deduplicated by Meta into one event.
//
// Node-only (uses `crypto`). Do not import this from client components.

import crypto from 'crypto'

const GRAPH_VERSION = 'v18.0'

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex')
}

export interface MetaCapiEvent {
  /** Meta standard event name, e.g. "Subscribe", "Purchase". */
  eventName: string
  /** Dedup key shared with the browser Pixel event. */
  eventId: string
  /** Unix seconds. Defaults to now. */
  eventTime?: number
  /** Raw email; hashed with SHA-256 before sending. */
  email?: string | null
  value?: number
  currency?: string
  /** Defaults to "website". */
  actionSource?: string
  eventSourceUrl?: string
}

export interface MetaCapiResult {
  skipped?: boolean
  ok?: boolean
  status?: number
  error?: string
}

/**
 * Send a single event to the Meta Conversions API. Never throws — returns a
 * result object so callers (e.g. the Stripe webhook) can log and continue
 * without failing the surrounding request.
 */
export async function sendMetaCapiEvent(ev: MetaCapiEvent): Promise<MetaCapiResult> {
  const pixelId = process.env.NEXT_PUBLIC_FB_PIXEL_ID
  const token = process.env.META_CAPI_ACCESS_TOKEN

  if (!pixelId || !token) {
    console.warn(
      `[meta-capi] Skipping "${ev.eventName}" — missing NEXT_PUBLIC_FB_PIXEL_ID or META_CAPI_ACCESS_TOKEN`,
    )
    return { skipped: true }
  }

  const userData: Record<string, string[]> = {}
  if (ev.email) userData.em = [sha256(ev.email)]

  const customData: Record<string, unknown> = { currency: ev.currency ?? 'USD' }
  if (ev.value != null) customData.value = ev.value

  const payload = {
    data: [
      {
        event_name: ev.eventName,
        event_time: ev.eventTime ?? Math.floor(Date.now() / 1000),
        event_id: ev.eventId,
        action_source: ev.actionSource ?? 'website',
        ...(ev.eventSourceUrl ? { event_source_url: ev.eventSourceUrl } : {}),
        user_data: userData,
        custom_data: customData,
      },
    ],
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(token)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    )

    if (!res.ok) {
      const text = await res.text()
      console.error(`[meta-capi] "${ev.eventName}" failed (${res.status}):`, text)
      return { ok: false, status: res.status, error: text }
    }
    return { ok: true, status: res.status }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[meta-capi] "${ev.eventName}" request error:`, msg)
    return { ok: false, error: msg }
  }
}
