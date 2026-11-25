/**
 * Password reset: the parts that must not drift.
 *
 * The request endpoint answers identically whether or not the address has an
 * account (RESET_REQUEST_MESSAGE), so it cannot be used to learn who is
 * registered. The link we email carries a Supabase recovery token hash to our own
 * reset page, which only spends the token when the new password is submitted: a
 * mail scanner or link previewer that opens the link does not use it up.
 */

export const RESET_REQUEST_MESSAGE =
  'If that address has an account, we have sent a link to reset the password. It is valid for one hour and works once.'

export const MIN_PASSWORD_LENGTH = 8

export function isPlausibleEmail(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

export const CANONICAL_ORIGIN = 'https://app.bylineseo.com'

/**
 * The site a link in an account email points at.
 *
 * In production it is ALWAYS the canonical site, whatever host the request
 * arrived on: nothing about where a request came from can reach a customer's
 * inbox. Only on a Vercel preview (so the branch can be walked end to end) or a
 * local dev server is the request host used, and then only if it is one of ours;
 * an unknown host falls back to the canonical site.
 */
export function resetOrigin(
  host: string | null,
  deploy: { nodeEnv?: string; vercelEnv?: string } = { nodeEnv: process.env.NODE_ENV, vercelEnv: process.env.VERCEL_ENV },
  canonical = CANONICAL_ORIGIN,
): string {
  if (deploy.vercelEnv === 'production' && deploy.nodeEnv === 'production') return canonical
  const h = (host ?? '').toLowerCase()
  const bare = h.split(':')[0]
  if (bare === 'app.bylineseo.com') return `https://${bare}`
  if (bare === 'localhost' || bare === '127.0.0.1') return `http://${h}`
  if (/^saas-seo-[a-z0-9-]+\.vercel\.app$/.test(bare)) return `https://${bare}`
  return canonical
}

export function resetLink(origin: string, tokenHash: string): string {
  return `${origin}/reset-password?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`
}

export function passwordProblem(password: unknown): string | null {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`
  }
  if (password.length > 128) return 'Use 128 characters or fewer.'
  return null
}

export const EXPIRED_LINK_MESSAGE =
  'This reset link has expired or has already been used. Request a new one and use the newest email.'

export function resetEmail(link: string, origin: string = CANONICAL_ORIGIN): { subject: string; text: string; html: string } {
  const subject = 'Reset your Byline password'
  const text = [
    'Hello,',
    '',
    'Someone asked to reset the password for the Byline account on this email address. To choose a new one, open this link:',
    '',
    link,
    '',
    'The link works once and expires in one hour. If you did not ask for this, ignore the email: your password has not changed and nobody can use the link without access to this inbox.',
    '',
    `If the link has expired, request a new one at ${origin}/forgot-password.`,
    '',
    'Byline',
    'bylineseo.com',
  ].join('\n')
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1c1a17;max-width:480px">
<p>Hello,</p>
<p>Someone asked to reset the password for the Byline account on this email address. To choose a new one, use the button below.</p>
<p><a href="${link}" style="display:inline-block;background:#B87333;color:#1c1a17;text-decoration:none;font-weight:bold;padding:10px 18px;border-radius:6px">Choose a new password</a></p>
<p>Or paste this link into your browser:<br><a href="${link}" style="color:#7a4a1c;word-break:break-all">${link}</a></p>
<p>The link works once and expires in one hour. If you did not ask for this, ignore the email: your password has not changed and nobody can use the link without access to this inbox.</p>
<p>If the link has expired, request a new one at <a href="${origin}/forgot-password" style="color:#7a4a1c">${origin.replace('https://', '').replace('http://', '')}/forgot-password</a>.</p>
<p>Byline<br>bylineseo.com</p>
</div>`
  return { subject, text, html }
}
