import { NextResponse, after } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendEmail } from '@/lib/email'
import { consumeRun, identityFor } from '@/lib/geo-audit/rate-limit'
import { RESET_REQUEST_MESSAGE, isPlausibleEmail, resetEmail, resetLink, resetOrigin } from '@/lib/password-reset'

/**
 * Request a password reset. The response is the same whether or not the address
 * has an account, and the work (looking the account up, minting the token,
 * sending the mail) happens after the response so the timing does not reveal it
 * either. Rate limited per address and per caller so the form cannot be used to
 * flood someone's inbox.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: unknown } | null
  if (!isPlausibleEmail(body?.email)) {
    return NextResponse.json({ ok: false, message: 'Enter a valid email address.' }, { status: 400 })
  }
  const email = body.email.trim().toLowerCase()
  const origin = resetOrigin(request.headers.get('host'))
  const caller = identityFor(request.headers)

  after(async () => {
    try {
      const [perAddress, perCaller] = await Promise.all([
        consumeRun(email, { tool: 'pwreset-email', limit: 3 }),
        consumeRun(caller, { tool: 'pwreset-ip', limit: 10 }),
      ])
      if (!perAddress.allowed || !perCaller.allowed) return

      const { data, error } = await createServiceClient().auth.admin.generateLink({ type: 'recovery', email })
      // No account for this address (or generation failed): send nothing, say nothing.
      if (error || !data?.properties?.hashed_token) return

      const mail = resetEmail(resetLink(origin, data.properties.hashed_token))
      const sent = await sendEmail({ to: email, ...mail })
      if (!sent.ok) console.error('[password-reset] email not sent', sent.skipped ? 'RESEND_API_KEY unset' : sent.error)
    } catch (err) {
      console.error('[password-reset] failed', err instanceof Error ? err.message : err)
    }
  })

  return NextResponse.json({ ok: true, message: RESET_REQUEST_MESSAGE })
}
