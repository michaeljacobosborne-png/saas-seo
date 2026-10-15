import { NextRequest, NextResponse } from 'next/server'

const GHL_WEBHOOK = 'https://services.leadconnectorhq.com/hooks/9Mx4ppVDgVvcOROtK9C8/webhook-trigger/486502a8-2405-4234-a00b-d49e45c4c15b'

export async function POST(req: NextRequest) {
  try {
    const { email, source } = await req.json()

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    const ghlRes = await fetch(GHL_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.toLowerCase().trim(),
        source: source ?? 'waitlist',
        tags: ['byline-waitlist'],
        submittedAt: new Date().toISOString(),
      }),
    })

    if (!ghlRes.ok) {
      console.error('GHL webhook failed', ghlRes.status, await ghlRes.text())
      // Still return 200 — don't block the user on GHL hiccups
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Waitlist error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
