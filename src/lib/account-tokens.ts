import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Signed, stateless tokens for the email-change flow: a confirmation link sent to
 * the NEW address, and a cancel link sent to the OLD one. No table: the token
 * carries what it needs and is bound to the account's current email and to a
 * counter in `app_metadata.email_change_epoch`, which only the server can write.
 *
 * - A confirmation stops working once the email has changed (the bound old
 *   address no longer matches), so it is single use without storing anything.
 * - The cancel link, a password change, or a completed change bumps the counter,
 *   which kills every pending confirmation for that account at once.
 *
 * The signing key is derived from the service key, so rotating that key
 * invalidates pending links; nothing else is affected.
 */
export type TokenPurpose = 'confirm' | 'cancel'

export interface AccountToken {
  p: TokenPurpose
  /** user id */
  u: string
  /** the account's email when the request was made, lower-case */
  o: string
  /** the requested new email, lower-case (confirm only) */
  n?: string
  /** email_change_epoch at the time of the request */
  e: number
  /** expiry, ms since epoch */
  x: number
}

export const CONFIRM_TTL_MS = 60 * 60 * 1000
export const CANCEL_TTL_MS = 3 * 24 * 60 * 60 * 1000

function key(): Buffer {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  return createHmac('sha256', 'byline-account-token').update(secret).digest()
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString('base64url')

export function signAccountToken(t: AccountToken): string {
  const body = b64(JSON.stringify(t))
  return `${body}.${b64(createHmac('sha256', key()).update(body).digest())}`
}

export function readAccountToken(token: unknown, purpose: TokenPurpose, now = Date.now()): AccountToken | null {
  if (typeof token !== 'string') return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expected = createHmac('sha256', key()).update(body).digest()
  let given: Buffer
  try { given = Buffer.from(sig, 'base64url') } catch { return null }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  try {
    const t = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as AccountToken
    if (t.p !== purpose || typeof t.u !== 'string' || typeof t.o !== 'string' || typeof t.e !== 'number' || t.x < now) return null
    if (purpose === 'confirm' && typeof t.n !== 'string') return null
    return t
  } catch {
    return null
  }
}
