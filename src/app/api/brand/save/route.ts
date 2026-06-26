import { NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ghlUpsertContact, ghlAddTags } from '@/lib/ghl'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body = await request.json() as Record<string, any>

  // Agent sends company_name; edit modal sends brand_name
  const isAgentFormat = 'company_name' in body

  // Load the existing profile FIRST so this save is a non-destructive MERGE, not a
  // REPLACE. A partial payload — the agent re-run that only re-collects a few
  // fields, or the edit modal (which doesn't expose the expertise fields) — must
  // never blank out work the user already saved.
  // (Data-loss bug: re-running the brand chat wiped the entire profile.)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from('brand_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prev: Record<string, any> = existing ?? {}

  // Write the incoming value only when it carries something meaningful; otherwise
  // keep whatever is already stored (or null on a brand-new insert). This is what
  // makes the save non-destructive: an absent/empty field preserves the prior value.
  const mergeStr = (incoming: unknown, column: string): string | null => {
    const v = typeof incoming === 'string' ? incoming.trim() : ''
    if (v) return v
    return prev[column] ?? null
  }
  const mergeArr = (incoming: unknown, column: string): string[] => {
    if (Array.isArray(incoming)) {
      const cleaned = incoming.filter((x): x is string => typeof x === 'string' && x.trim() !== '')
      if (cleaned.length) return cleaned
    }
    return Array.isArray(prev[column]) ? prev[column] : []
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: Record<string, any> = {
    user_id: user.id,
    brand_name: mergeStr(isAgentFormat ? body.company_name : body.brand_name, 'brand_name'),
    industry: mergeStr(body.industry, 'industry'),
    target_audience: mergeStr(body.target_audience, 'target_audience'),
    // Agent's descriptive brand_voice maps to tone_notes; edit modal sends tone_notes directly
    tone_notes: mergeStr(isAgentFormat ? body.brand_voice : body.tone_notes, 'tone_notes'),
    content_goals: mergeStr(body.content_goals, 'content_goals'),
    avoid_topics: mergeStr(body.avoid_topics, 'avoid_topics'),
    tone_examples: mergeStr(body.tone_examples, 'tone_examples'),
    competitors: mergeArr(body.competitors, 'competitors'),
    expertise_notes: mergeStr(body.expertise_notes, 'expertise_notes'),
    signature_angles: mergeStr(body.signature_angles, 'signature_angles'),
    avoid_phrases: mergeStr(body.avoid_phrases, 'avoid_phrases'),
    expertise_skipped:
      typeof body.expertise_skipped === 'boolean'
        ? body.expertise_skipped
        : (prev.expertise_skipped ?? false),
  }

  // Only touch these when explicitly included in the request, then merge as usual.
  if ('website_url' in body) payload.website_url = mergeStr(body.website_url, 'website_url')
  if ('primary_keywords' in body) payload.primary_keywords = mergeArr(body.primary_keywords, 'primary_keywords')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('brand_profiles')
    .upsert(payload, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Mark the brand profile complete in GoHighLevel so the onboarding workflow can
  // skip/branch Email 2. Best-effort, after the response, never throws/blocks.
  if (user.email) {
    const email = user.email
    after(async () => {
      const contactId = await ghlUpsertContact({
        email,
        customFields: { brand_profile_complete: true },
      })
      if (!contactId) return
      await ghlAddTags(contactId, ['brand_profile_complete'])
    })
  }

  return NextResponse.json({ success: true })
}
