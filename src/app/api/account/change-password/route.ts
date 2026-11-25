import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'
import { passwordProblem, resetOrigin } from '@/lib/password-reset'
import { passwordChangedEmail } from '@/lib/account-emails'
import { bumpEmailChangeEpoch, checkCurrentPassword } from '@/lib/account-security'

/**
 * Change the password of the signed-in account. The current password is required
 * (a session alone is not enough), the new one follows the same rules as reset,
 * every other session is ended, any pending email change is cancelled, and the
 * account's address is told.
 */
const fail = (status: number, code: string, message: string) => NextResponse.json({ ok: false, code, message }, { status })

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { current_password?: unknown; new_password?: unknown } | null
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return fail(401, 'signed-out', 'Sign in again to change your password.')

  const problem = passwordProblem(body?.new_password)
  if (problem) return fail(400, 'weak', problem)

  const check = await checkCurrentPassword(user, body?.current_password)
  if (check === 'no-password') return fail(400, 'no-password', 'This account signs in with Google or GitHub and has no password to change. Use "Forgot your password?" on the sign-in page to set one.')
  if (check === 'limited') return fail(429, 'limited', 'Too many attempts today. Try again tomorrow, or reset your password by email.')
  if (check === 'wrong') return fail(400, 'wrong-password', 'Your current password is not correct.')

  const { error } = await supabase.auth.updateUser({ password: body!.new_password as string })
  if (error) return fail(400, 'rejected', error.message)

  await supabase.auth.signOut({ scope: 'others' })
  await bumpEmailChangeEpoch(user)
  await sendEmail({ to: user.email, ...passwordChangedEmail(resetOrigin(request.headers.get('host'))) })
  return NextResponse.json({ ok: true })
}
