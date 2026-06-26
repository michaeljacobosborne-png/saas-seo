import { NextResponse } from 'next/server'
import { sendMetaCapiEvent } from '@/lib/meta-capi'

export const runtime = 'nodejs'

// Server-side Meta Conversions API endpoint. Accepts a conversion event and
// forwards it to Meta (email is hashed inside sendMetaCapiEvent). Callers must
// supply an `event_id` that matches the corresponding browser Pixel event so
// Meta can deduplicate.
//
// Body: { event_name, event_id, event_time?, email?, value?, currency?, event_source_url? }
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      event_name?: string
      event_id?: string
      event_time?: number
      email?: string | null
      value?: number
      currency?: string
      event_source_url?: string
    }

    if (!body.event_name || !body.event_id) {
      return NextResponse.json(
        { error: 'event_name and event_id are required' },
        { status: 400 },
      )
    }

    const result = await sendMetaCapiEvent({
      eventName: body.event_name,
      eventId: body.event_id,
      eventTime: body.event_time,
      email: body.email,
      value: body.value,
      currency: body.currency,
      eventSourceUrl: body.event_source_url,
    })

    return NextResponse.json({ received: true, result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
