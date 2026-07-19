// GET /api/outreach — owner-only. The review queue.
// Optional ?status=ready_for_review to filter. Returns prospects newest-first.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isOwner } from '@/lib/owner'

export async function GET(request: Request) {
  if (!(await isOwner())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const status = new URL(request.url).searchParams.get('status')
  const supabase = createServiceClient()
  let query = supabase
    .from('outreach_prospects')
    .select(
      'id, email, domain, contact_name, status, chosen_audit, audit_reason, share_token, draft_subject, draft_html, step, sent_at, last_error, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(200)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) {
    console.error('[outreach/list] DB error:', error)
    return NextResponse.json({ error: 'Failed to load prospects' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, prospects: data ?? [] })
}
