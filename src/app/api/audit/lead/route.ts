import { NextResponse, after } from 'next/server'
import { ghlUpsertContact, ghlAddToWorkflow, ghlUpdateCustomField } from '@/lib/ghl'

// Reduce a raw URL/host to a bare domain for storage as a GHL custom field
// (used to personalize the post-audit nurture sequence). Defensive — falls back
// to the trimmed input if it isn't a parseable URL.
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

// Lightweight lead capture for the public content-audit funnel. Logs the lead
// server-side and (best-effort) pushes it into GoHighLevel so the post-audit
// nurture sequence runs from a GHL workflow.
export async function POST(request: Request) {
  let body: { email?: string; url?: string; gapCount?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const email = (body.email ?? '').trim()
  // Loose sanity check — we're not authenticating, just avoiding empty noise.
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
  }

  const domain = extractDomain(body.url ?? '')

  console.log(
    `[audit-lead] email=${email} url=${(body.url ?? '').trim()} gaps=${body.gapCount ?? 0}`
  )

  // Push into GoHighLevel AFTER the response is sent — `after()` keeps the
  // serverless function alive for this work without delaying the lead form's
  // response (a bare `void` would be dropped once we return on Vercel). The GHL
  // helpers never throw. Sequenced: upsert first to get the contactId, then add
  // to the nurture workflow and stamp the audited domain.
  after(async () => {
    const contactId = await ghlUpsertContact({ email, tags: ['audit_lead', 'byline_lead'] })
    if (!contactId) return
    const workflowId = process.env.GHL_WORKFLOW_AUDIT_NURTURE_ID
    if (workflowId) await ghlAddToWorkflow(contactId, workflowId)
    if (domain) await ghlUpdateCustomField(contactId, 'audit_domain', domain)
  })

  return NextResponse.json({ ok: true })
}
