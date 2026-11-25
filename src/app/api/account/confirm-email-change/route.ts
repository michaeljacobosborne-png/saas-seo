import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendEmail } from '@/lib/email'
import { readAccountToken } from '@/lib/account-tokens'
import { bumpEmailChangeEpoch, emailChangeEpoch } from '@/lib/account-security'
import { emailChangedEmail } from '@/lib/account-emails'

/**
 * Switch the account's email. Called when the link sent to the NEW address is
 * used (a button on /confirm-email-change, so a mail scanner opening the link
 * switches nothing). It checks the link is genuine, unexpired, not cancelled, and
 * that the account still has the email it had when the change was requested,
 * which also makes it single use.
 */
const fail = (status: number, code: string, message: string) => NextResponse.json({ ok: false, code, message }, { status })

const DEAD = 'This confirmation link has expired, was cancelled, or has already been used. Request the change again from Settings.'

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { token?: unknown } | null
  const t = readAccountToken(body?.token, 'confirm')
  if (!t || !t.n) return fail(400, 'expired', DEAD)

  const admin = createServiceClient()
  const { data, error } = await admin.auth.admin.getUserById(t.u)
  const user = data?.user
  if (error || !user || user.email?.toLowerCase() !== t.o || emailChangeEpoch(user) !== t.e) return fail(400, 'expired', DEAD)

  const { error: updateError } = await bumpEmailChangeEpoch(user, { email: t.n, email_confirm: true })
  if (updateError) {
    // Do not say anything about the other account; only that this address cannot be used.
    return fail(409, 'unavailable', 'This address cannot be used for the account. Request the change again with a different address.')
  }

  await sendEmail({ to: t.o, ...emailChangedEmail(t.n) })
  return NextResponse.json({ ok: true, email: t.n })
}
