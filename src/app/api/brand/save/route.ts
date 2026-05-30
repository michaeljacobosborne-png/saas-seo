import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body = await request.json() as Record<string, any>

  // Agent sends company_name; edit modal sends brand_name
  const isAgentFormat = 'company_name' in body

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: Record<string, any> = {
    user_id: user.id,
    brand_name: isAgentFormat ? (body.company_name ?? null) : (body.brand_name ?? null),
    industry: body.industry ?? null,
    target_audience: body.target_audience ?? null,
    // Agent's descriptive brand_voice maps to tone_notes; edit modal sends tone_notes directly
    tone_notes: isAgentFormat ? (body.brand_voice ?? null) : (body.tone_notes ?? null),
    content_goals: body.content_goals ?? null,
    avoid_topics: body.avoid_topics ?? null,
    tone_examples: body.tone_examples ?? null,
    competitors: Array.isArray(body.competitors) ? body.competitors : [],
  }

  // Only overwrite these if explicitly included in the payload
  if ('website_url' in body) payload.website_url = body.website_url || null
  if ('primary_keywords' in body) payload.primary_keywords = Array.isArray(body.primary_keywords) ? body.primary_keywords : []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('brand_profiles')
    .upsert(payload, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
