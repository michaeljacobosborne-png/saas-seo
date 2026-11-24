import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { readAccountToken } from '@/lib/account-tokens'
import { bumpEmailChangeEpoch, emailChangeEpoch } from '@/lib/account-security'

/**
 * The owner's way to object, from the notice sent to the OLD address. It kills
 * every pending confirmation for the account. It works only while the account
 * still has the email it had when the change was requested; once a change has
 * gone through, this link says so and points at support.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { token?: unknown } | null
  const t = readAccountToken(body?.token, 'cancel')
  if (!t) return NextResponse.json({ ok: false, code: 'expired', message: 'This link has expired.' }, { status: 400 })

  const { data } = await createServiceClient().auth.admin.getUserById(t.u)
  const user = data?.user
  if (!user) return NextResponse.json({ ok: false, code: 'expired', message: 'This link has expired.' }, { status: 400 })
  if (user.email?.toLowerCase() !== t.o) {
    return NextResponse.json({ ok: false, code: 'already-changed', message: 'The email on this account has already been changed, so this link can no longer undo it. Write to hi@bylineseo.com straight away, from this address.' }, { status: 409 })
  }
  // Already cancelled or superseded (counter moved on): nothing pending, say so as success.
  if (emailChangeEpoch(user) === t.e) await bumpEmailChangeEpoch(user)
  return NextResponse.json({ ok: true })
}
