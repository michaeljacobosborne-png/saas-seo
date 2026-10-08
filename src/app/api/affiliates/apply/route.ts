import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: Request) {
  let body: {
    name?: string
    email?: string
    website?: string
    platforms?: string[]
    audienceSize?: string
    promoPlan?: string
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const name = (body.name ?? '').trim()
  const email = (body.email ?? '').trim()

  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
  }

  console.log('[affiliate] new application:', email)

  try {
    const supabase = createServiceClient()
    const { error } = await supabase.from('affiliate_leads').insert({
      name,
      email,
      website: (body.website ?? '').trim() || null,
      platforms: body.platforms ?? [],
      audience_size: body.audienceSize ?? null,
      promo_plan: (body.promoPlan ?? '').trim() || null,
    })

    if (error) {
      console.error('[affiliate] insert error:', error)
      return NextResponse.json({ error: 'Failed to save application' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[affiliate] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
