// POST /api/outreach/prepare — owner-only.
// Runs the agent on pending prospects: picks the best audit, runs it, saves the
// result, and drafts the email. Advances 'new' → 'ready_for_review'. Sends NOTHING.
//
// Body (all optional): { id?: string, limit?: number }
//   - id:    prepare one specific prospect
//   - limit: how many 'new' prospects to prepare this call (default 1, max 5)
//
// Each audit can take up to ~60s, so batches are small by design. For unattended
// bulk processing, a Vercel cron calling this repeatedly is the Phase 3 path.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isOwner } from '@/lib/owner'
import { prepareProspect } from '@/lib/outreach'

export const maxDuration = 300

interface ProspectRow {
  id: string
  email: string
  domain: string
  contact_name: string | null
}

export async function POST(request: Request) {
  if (!(await isOwner())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { id?: string; limit?: number } = {}
  try {
    body = await request.json()
  } catch {
    /* empty body is fine */
  }

  const supabase = createServiceClient()

  // Select the working set.
  let targets: ProspectRow[] = []
  if (body.id) {
    const { data } = await supabase
      .from('outreach_prospects')
      .select('id, email, domain, contact_name')
      .eq('id', body.id)
      .single()
    if (data) targets = [data as ProspectRow]
  } else {
    const limit = Math.min(Math.max(1, body.limit ?? 1), 5)
    const { data } = await supabase
      .from('outreach_prospects')
      .select('id, email, domain, contact_name')
      .eq('status', 'new')
      .order('created_at', { ascending: true })
      .limit(limit)
    targets = (data ?? []) as ProspectRow[]
  }

  if (targets.length === 0) {
    return NextResponse.json({ ok: true, prepared: 0, results: [], message: 'No prospects to prepare' })
  }

  const results: Array<{ id: string; ok: boolean; chosenAudit?: string; error?: string }> = []

  for (const p of targets) {
    // Mark in-flight so a concurrent call won't grab the same row.
    await supabase
      .from('outreach_prospects')
      .update({ status: 'preparing', updated_at: new Date().toISOString(), last_error: null })
      .eq('id', p.id)

    try {
      const draft = await prepareProspect({ email: p.email, domain: p.domain, contact_name: p.contact_name })
      await supabase
        .from('outreach_prospects')
        .update({
          status: 'ready_for_review',
          chosen_audit: draft.chosenAudit,
          audit_reason: draft.auditReason,
          audit_result_id: draft.auditResultId,
          share_token: draft.shareToken,
          draft_subject: draft.subject,
          draft_html: draft.html,
          updated_at: new Date().toISOString(),
        })
        .eq('id', p.id)
      results.push({ id: p.id, ok: true, chosenAudit: draft.chosenAudit })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[outreach/prepare] failed for', p.domain, message)
      await supabase
        .from('outreach_prospects')
        .update({ status: 'failed', last_error: message, updated_at: new Date().toISOString() })
        .eq('id', p.id)
      results.push({ id: p.id, ok: false, error: message })
    }
  }

  return NextResponse.json({ ok: true, prepared: results.filter((r) => r.ok).length, results })
}
