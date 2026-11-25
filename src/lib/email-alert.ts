import { consumeRun } from '@/lib/geo-audit/rate-limit'
import { sendTelegramMessage } from '@/lib/telegram'

/**
 * A transactional email that failed to send must not fail silently. Several
 * flows (password reset, cancellation confirmation, access alerts) deliberately
 * show the customer a neutral message whatever happens to the email, so without
 * this a broken key or an unverified sender domain looks identical to a working
 * one, indefinitely.
 *
 * Two outputs: a greppable error line in the logs, and a Telegram message to the
 * owner. Telegram on purpose: the failure being reported is the email channel, so
 * the alert cannot ride on it. At most two alerts a day, so an outage that fails
 * every send does not become a flood.
 */
export const EMAIL_FAILURE_TAG = '[EMAIL-SEND-FAILED]'
const ALERTS_PER_DAY = 2

export async function reportEmailFailure(input: { to: string; subject: string; reason: string }): Promise<void> {
  // Never log or alert the full recipient address: keep the domain, drop the local part.
  const domain = input.to.includes('@') ? input.to.split('@')[1] : 'unknown'
  console.error(`${EMAIL_FAILURE_TAG} subject="${input.subject}" to=*@${domain} reason=${input.reason}`)
  try {
    const budget = await consumeRun('global', { tool: 'email-failure-alert', limit: ALERTS_PER_DAY })
    if (!budget.allowed) return
    await sendTelegramMessage(
      `Byline email send failed.\nSubject: ${input.subject}\nReason: ${input.reason}\n\nCustomers are still shown a neutral message, so nothing on screen says this is broken. Check RESEND_API_KEY and that the sender domain is verified in Resend. Further failures today are logged (search ${EMAIL_FAILURE_TAG}) but not sent here.`,
    )
  } catch (err) {
    console.error(`${EMAIL_FAILURE_TAG} alert itself failed`, err instanceof Error ? err.message : err)
  }
}
