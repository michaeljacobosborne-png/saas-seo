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
  const sb = supabase as any

  // Check if profile already exists
  const { data: existing } = await sb
    .from('brand_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  // Build full candidate payload
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candidate: Record<string, any> = {
    brand_name: isAgentFormat ? body.company_name : body.brand_name,
    industry: body.industry,
    target_audience: body.target_audience,
    tone_notes: isAgentFormat ? body.brand_voice : body.tone_notes,
    content_goals: body.content_goals,
    avoid_topics: body.avoid_topics,
    tone_examples: body.tone_examples,
    competitors: Array.isArray(body.competitors) ? body.competitors : undefined,
    expertise_notes: body.expertise_notes,
    signature_angles: body.signature_angles,
    avoid_phrases: body.avoid_phrases,
    expertise_skipped: body.expertise_skipped,
    website_url: 'website_url' in body ? (body.website_url || null) : undefined,
    primary_keywords: 'primary_keywords' in body
      ? (Array.isArray(body.primary_keywords) ? body.primary_keywords : [])
      : undefined,
  }

  // Strip undefined and null — never overwrite existing data with nothing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: Record<string, any> = Object.fromEntries(
    Object.entries(candidate).filter(([, v]) => v !== undefined && v !== null && v !== '')
  )

  let error
  if (existing) {
    // Update — only touch fields that were actually provided
    ;({ error } = await sb
      .from('brand_profiles')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('user_id', user.id))
  } else {
    // Insert — new profile
    ;({ error } = await sb
      .from('brand_profiles')
      .insert({ user_id: user.id, ...payload }))
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
