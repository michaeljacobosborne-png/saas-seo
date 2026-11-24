import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'
import { isPlausibleEmail, resetOrigin } from '@/lib/password-reset'
import { EMAIL_CHANGE_REQUESTED_MESSAGE, emailChangeConfirmEmail, emailChangeRequestedEmail } from '@/lib/account-emails'
import { CANCEL_TTL_MS, CONFIRM_TTL_MS, signAccountToken } from '@/lib/account-tokens'
import { checkCurrentPassword, emailChangeEpoch } from '@/lib/account-security'

/**
 * Ask to change the account's email. Nothing changes here. A confirmation link
 * goes to the NEW address and only using it switches the account; the OLD address
 * is told straight away, naming the new one, with a link to cancel. Until the new
 * address is confirmed the old one keeps working.
 *
 * The answer does not say whether the new address already belongs to another
 * account, so this form cannot be used to find out who is registered.
 */
const fail = (status: number, code: string, message: string) => NextResponse.json({ ok: false, code, message }, { status })

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { current_password?: unknown; new_email?: unknown } | null
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return fail(401, 'signed-out', 'Sign in again to change your email.')

  if (!isPlausibleEmail(body?.new_email)) return fail(400, 'invalid', 'Enter a valid email address.')
  const newEmail = body.new_email.trim().toLowerCase()
  const oldEmail = user.email.toLowerCase()
  if (newEmail === oldEmail) return fail(400, 'same', 'That is already the email on this account.')

  const check = await checkCurrentPassword(user, body?.current_password)
  if (check === 'no-password') return fail(400, 'no-password', 'This account signs in with Google or GitHub, so its email belongs to that sign-in and cannot be changed here.')
  if (check === 'limited') return fail(429, 'limited', 'Too many attempts today. Try again tomorrow.')
  if (check === 'wrong') return fail(400, 'wrong-password', 'Your current password is not correct.')

  const origin = resetOrigin(request.headers.get('host'))
  const epoch = emailChangeEpoch(user)
  const now = Date.now()
  const confirm = signAccountToken({ p: 'confirm', u: user.id, o: oldEmail, n: newEmail, e: epoch, x: now + CONFIRM_TTL_MS })
  const cancel = signAccountToken({ p: 'cancel', u: user.id, o: oldEmail, e: epoch, x: now + CANCEL_TTL_MS })

  // Warn the owner first: it is the only notice they get if a session was taken over.
  await sendEmail({ to: oldEmail, ...emailChangeRequestedEmail(newEmail, `${origin}/cancel-email-change?token=${encodeURIComponent(cancel)}`, origin) })
  await sendEmail({ to: newEmail, ...emailChangeConfirmEmail(`${origin}/confirm-email-change?token=${encodeURIComponent(confirm)}`) })

  return NextResponse.json({ ok: true, message: EMAIL_CHANGE_REQUESTED_MESSAGE })
}
