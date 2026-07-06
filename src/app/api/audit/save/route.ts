/**
 * POST /api/audit/save
 *
 * Saves an audit result for an authenticated user — no email required.
 * Used by the dashboard GEO Analyzer and AO Analyzer pages where the user
 * is already logged in. Returns the share_token for the saved result.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

function extractDomain(rawUrl: string): string {
  const raw = (rawUrl ?? '').trim()
  if (!raw) return ''
  try {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    return new URL(withScheme).hostname.replace(/^www\./i, '')
  } catch {
    return raw
  }
}

export async function POST(request: Request) {
  // Auth required
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { url?: string; result?: unknown; tool?: string; source?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.result) {
    return NextResponse.json({ error: 'result is required' }, { status: 400 })
  }

  const domain = extractDomain(body.url ?? '')
  const tool = body.tool ?? 'geo'
  const source = body.source ?? `${tool}_analyzer_dashboard`

  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient
    .from('audit_results')
    .insert({
      domain: domain || null,
      result: body.result,
      source,
      url: (body.url ?? '').trim() || null,
      user_id: user.id,
      tool,
    })
    .select('id, share_token')
    .single()

  if (error) {
    console.error('[audit/save] DB error:', error)
    return NextResponse.json({ error: 'Failed to save result' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    resultId: data.id,
    shareToken: data.share_token,
  })
}
