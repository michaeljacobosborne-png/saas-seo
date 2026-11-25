import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { EXPIRED_LINK_MESSAGE, passwordProblem } from '@/lib/password-reset'

/**
 * Spend a recovery token and set the new password. The token is only used here,
 * on submit, never on opening the link. On success the person is signed in and
 * every other session for the account is ended, since a reset usually means the
 * old password may have been seen by someone else.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { token_hash?: unknown; password?: unknown } | null
  const tokenHash = typeof body?.token_hash === 'string' ? body.token_hash : ''
  const problem = passwordProblem(body?.password)
  if (!tokenHash) return NextResponse.json({ ok: false, code: 'expired', message: EXPIRED_LINK_MESSAGE }, { status: 400 })
  if (problem) return NextResponse.json({ ok: false, code: 'weak', message: problem }, { status: 400 })

  const supabase = await createClient()
  const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
  if (verifyError) return NextResponse.json({ ok: false, code: 'expired', message: EXPIRED_LINK_MESSAGE }, { status: 400 })

  const { error: updateError } = await supabase.auth.updateUser({ password: body!.password as string })
  if (updateError) {
    // e.g. the new password equals the old one, or the project's password rules.
    return NextResponse.json({ ok: false, code: 'rejected', message: updateError.message }, { status: 400 })
  }
  await supabase.auth.signOut({ scope: 'others' })
  return NextResponse.json({ ok: true })
}
