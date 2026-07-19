// POST /api/outreach/import — owner-only.
// Ingest a hand-picked prospect list. Body: { prospects: [{ email, domain, name? }] }.
// Upserts into outreach_prospects (unique on email); new rows start at status 'new'.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isOwner } from '@/lib/owner'

function cleanDomain(raw: string): string {
  const v = (raw ?? '').trim()
  if (!v) return ''
  try {
    const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`
    return new URL(withScheme).hostname.replace(/^www\./i, '')
  } catch {
    return v.replace(/^www\./i, '')
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: Request) {
  if (!(await isOwner())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { prospects?: Array<{ email?: string; domain?: string; name?: string }> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const rows = Array.isArray(body.prospects) ? body.prospects : []
  if (rows.length === 0) return NextResponse.json({ error: 'prospects array is required' }, { status: 400 })
  if (rows.length > 500) return NextResponse.json({ error: 'Max 500 prospects per import' }, { status: 400 })

  const seen = new Set<string>()
  const valid: Array<{ email: string; domain: string; contact_name: string | null; status: string }> = []
  const skipped: Array<{ input: unknown; why: string }> = []

  for (const r of rows) {
    const email = (r.email ?? '').trim().toLowerCase()
    const domain = cleanDomain(r.domain ?? '')
    if (!EMAIL_RE.test(email)) {
      skipped.push({ input: r, why: 'invalid email' })
      continue
    }
    if (!domain) {
      skipped.push({ input: r, why: 'missing/invalid domain' })
      continue
    }
    if (seen.has(email)) {
      skipped.push({ input: r, why: 'duplicate in batch' })
      continue
    }
    seen.add(email)
    valid.push({ email, domain, contact_name: (r.name ?? '').trim() || null, status: 'new' })
  }

  if (valid.length === 0) {
    return NextResponse.json({ error: 'No valid prospects', skipped }, { status: 400 })
  }

  const supabase = createServiceClient()
  // Upsert on email; don't clobber prospects already in-flight.
  const { data, error } = await supabase
    .from('outreach_prospects')
    .upsert(valid, { onConflict: 'email', ignoreDuplicates: true })
    .select('id, email')

  if (error) {
    console.error('[outreach/import] DB error:', error)
    return NextResponse.json({ error: 'Failed to import' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, imported: data?.length ?? 0, skipped })
}
