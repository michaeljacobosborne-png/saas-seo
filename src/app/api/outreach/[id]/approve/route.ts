// POST /api/outreach/[id]/approve — owner-only. The human approval gate.
// Sends the drafted outreach email via GoHighLevel and advances the prospect to
// 'sent'. Optionally accepts edited { subject, html } to override the draft.
//
// Guardrails before any send:
//   - prospect must be in 'ready_for_review'
//   - OUTREACH_UNSUBSCRIBE_URL must be configured (CAN-SPAM one-click unsubscribe)

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isOwner } from '@/lib/owner'
import { ghlUpsertContact, ghlSendEmail } from '@/lib/ghl'

const OUTREACH_FROM = process.env.OUTREACH_FROM_EMAIL || 'michael@lc.bylineseo.com'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isOwner())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Legal guardrail: never send cold email without a working unsubscribe path.
  if (!process.env.OUTREACH_UNSUBSCRIBE_URL) {
    return NextResponse.json(
      { error: 'OUTREACH_UNSUBSCRIBE_URL is not set — refusing to send cold email without one-click unsubscribe.' },
      { status: 412 },
    )
  }

  const { id } = await params
  let body: { subject?: string; html?: string } = {}
  try {
    body = await request.json()
  } catch {
    /* no overrides */
  }

  const supabase = createServiceClient()
  const { data: prospect, error } = await supabase
    .from('outreach_prospects')
    .select('id, email, domain, contact_name, status, draft_subject, draft_html')
    .eq('id', id)
    .single()

  if (error || !prospect) return NextResponse.json({ error: 'Prospect not found' }, { status: 404 })
  if (prospect.status !== 'ready_for_review') {
    return NextResponse.json(
      { error: `Prospect is '${prospect.status}', expected 'ready_for_review'` },
      { status: 409 },
    )
  }

  const subject = (body.subject ?? prospect.draft_subject ?? '').trim()
  const html = (body.html ?? prospect.draft_html ?? '').trim()
  if (!subject || !html) {
    return NextResponse.json({ error: 'Draft is empty — re-run prepare' }, { status: 422 })
  }

  // Upsert into GHL (tagged so nurture/reporting can segment outreach separately).
  const contactId = await ghlUpsertContact({
    email: prospect.email,
    firstName: (prospect.contact_name ?? '').trim().split(/\s+/)[0] || undefined,
    tags: ['outreach_prospect', 'byline_lead', 'source_outreach_agent'],
  })
  if (!contactId) {
    await supabase
      .from('outreach_prospects')
      .update({ last_error: 'GHL contact upsert failed', updated_at: new Date().toISOString() })
      .eq('id', id)
    return NextResponse.json({ error: 'Failed to create/find GHL contact' }, { status: 502 })
  }

  const sent = await ghlSendEmail({
    contactId,
    toEmail: prospect.email,
    subject,
    html,
    fromEmail: OUTREACH_FROM,
  })
  if (!sent) {
    await supabase
      .from('outreach_prospects')
      .update({ ghl_contact_id: contactId, last_error: 'GHL send failed', updated_at: new Date().toISOString() })
      .eq('id', id)
    return NextResponse.json({ error: 'GHL send failed' }, { status: 502 })
  }

  await supabase
    .from('outreach_prospects')
    .update({
      status: 'sent',
      ghl_contact_id: contactId,
      step: 1,
      sent_at: new Date().toISOString(),
      last_error: null,
      updated_at: new Date().toISOString(),
      // Phase 3 sequencer will read this; first follow-up ~3 days out.
      next_action_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq('id', id)

  return NextResponse.json({ ok: true, sent: true, contactId })
}
