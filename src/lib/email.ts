// Transactional email helper via the Resend REST API (no SDK dependency).
//
// NOTE: As of this writing Resend is NOT yet configured in this project — there is no
// RESEND_API_KEY in the environment and no `resend` package installed. This helper calls
// the REST endpoint directly and degrades gracefully (no-op) when RESEND_API_KEY is unset,
// so support flows never break. Set RESEND_API_KEY and SUPPORT_EMAIL_FROM to enable.

import { reportEmailFailure } from '@/lib/email-alert'

export interface EmailResult {
  ok: boolean
  skipped?: boolean
  id?: string
  error?: string
}

export interface SendEmailInput {
  to: string
  subject: string
  /** Plain-text body. */
  text: string
  /** Optional HTML body. */
  html?: string
}

/**
 * Everything the app sends goes out from the verified sending subdomain. The root
 * domain is not verified on the Resend account, so a From on it is refused. Replies
 * go to a real mailbox, because customers are told to write to it.
 */
export const EMAIL_FROM = 'Byline SEO <support@send.bylineseo.com>'
export const EMAIL_REPLY_TO = 'hi@bylineseo.com'

/**
 * Send an email via Resend. Returns a result object instead of throwing.
 * No-ops (skipped: true) when RESEND_API_KEY is not configured.
 */
export async function sendEmail({ to, subject, text, html }: SendEmailInput): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  // A real Resend key starts with re_. Anything else (empty, or the "[SENSITIVE]" placeholder a Vercel env pull writes) cannot send.
  if (!apiKey || !apiKey.startsWith('re_')) {
    await reportEmailFailure({ to, subject, reason: apiKey ? 'RESEND_API_KEY is not a Resend key (wrong value or a placeholder)' : 'RESEND_API_KEY is not set' })
    return { ok: false, skipped: true }
  }


  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: EMAIL_FROM, reply_to: EMAIL_REPLY_TO, to, subject, text, ...(html ? { html } : {}) }),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      await reportEmailFailure({ to, subject, reason: `Resend ${res.status}: ${detail.slice(0, 200)}` })
      return { ok: false, error: `Resend ${res.status}` }
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string }
    return { ok: true, id: data.id }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    await reportEmailFailure({ to, subject, reason: `request threw: ${msg}` })
    return { ok: false, error: msg }
  }
}
