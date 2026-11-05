import { createHash } from 'crypto'

const PIXEL_ID = 'a2_j8679g6sf5so'
const CAPI_URL = `https://ads-api.reddit.com/api/v3/pixels/${PIXEL_ID}/conversion_events`

function sha256(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex')
}

export interface RedditCapiOptions {
  trackingType: 'Lead' | 'SignUp' | 'Purchase' | 'PageVisit' | 'ViewContent'
  email?: string
  externalId?: string
  ipAddress?: string
  userAgent?: string
  clickId?: string
  conversionId?: string // must match browser pixel conversionId for deduplication
  value?: number
  currency?: string
}

export async function sendRedditCapiEvent(opts: RedditCapiOptions): Promise<void> {
  const token = process.env.REDDIT_CAPI_TOKEN
  if (!token) {
    console.warn('[reddit-capi] REDDIT_CAPI_TOKEN not set — skipping')
    return
  }

  const body = {
    data: {
      events: [
        {
          event_at: Date.now(),
          action_source: 'website',
          type: { tracking_type: opts.trackingType },
          ...(opts.clickId ? { click_id: opts.clickId } : {}),
          user: {
            ...(opts.email ? { email: sha256(opts.email) } : {}),
            ...(opts.externalId ? { external_id: sha256(opts.externalId) } : {}),
            ...(opts.ipAddress ? { ip_address: opts.ipAddress } : {}),
            ...(opts.userAgent ? { user_agent: opts.userAgent } : {}),
          },
          metadata: {
            ...(opts.conversionId ? { conversion_id: opts.conversionId } : {}),
            ...(opts.value !== undefined ? { value: opts.value, currency: opts.currency ?? 'USD' } : {}),
          },
        },
      ],
    },
  }

  try {
    const res = await fetch(CAPI_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text()
      console.error(`[reddit-capi] ${opts.trackingType} failed ${res.status}: ${text}`)
    } else {
      console.log(`[reddit-capi] ${opts.trackingType} sent OK (conversionId=${opts.conversionId ?? 'none'})`)
    }
  } catch (err) {
    console.error('[reddit-capi] fetch error:', err)
  }
}
