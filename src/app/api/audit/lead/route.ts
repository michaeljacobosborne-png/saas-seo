import { NextResponse } from 'next/server'

// Lightweight lead capture for the public content-audit funnel. There's no email
// system wired yet, so for now we just log the lead server-side — enough to see
// conversions in the Vercel logs without over-engineering. When an ESP/CRM is
// added, forward `email` here.
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

  console.log(
    `[audit-lead] email=${email} url=${(body.url ?? '').trim()} gaps=${body.gapCount ?? 0}`
  )

  return NextResponse.json({ ok: true })
}
