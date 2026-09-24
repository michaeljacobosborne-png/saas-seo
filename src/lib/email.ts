// Transactional email helper via the Resend REST API (no SDK dependency).
//
// NOTE: As of this writing Resend is NOT yet configured in this project — there is no
// RESEND_API_KEY in the environment and no `resend` package installed. This helper calls
// the REST endpoint directly and degrades gracefully (no-op) when RESEND_API_KEY is unset,
// so support flows never break. Set RESEND_API_KEY and SUPPORT_EMAIL_FROM to enable.

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

const DEFAULT_FROM = 'Byline Support <hi@bylineseo.com>'

/**
 * Send an email via Resend. Returns a result object instead of throwing.
 * No-ops (skipped: true) when RESEND_API_KEY is not configured.
 */
export async function sendEmail({ to, subject, text, html }: SendEmailInput): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — skipping email send to', to)
    return { ok: false, skipped: true }
  }

  const from = process.env.SUPPORT_EMAIL_FROM
    ? `Byline Support <${process.env.SUPPORT_EMAIL_FROM}>`
    : DEFAULT_FROM

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, text, ...(html ? { html } : {}) }),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error('[email] send failed', res.status, detail)
      return { ok: false, error: `Resend ${res.status}` }
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string }
    return { ok: true, id: data.id }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    console.error('[email] send threw', msg)
    return { ok: false, error: msg }
  }
}
