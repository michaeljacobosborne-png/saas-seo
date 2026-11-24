import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The request endpoint must not reveal which addresses have accounts, must not
 * build a link from an attacker-controlled Host header, and the reset endpoint
 * must report an expired or used token plainly (2026-11-23).
 */
const { generateLink, sendEmail, consumeRun, verifyOtp, updateUser, signOut, pending } = vi.hoisted(() => ({
  generateLink: vi.fn(),
  sendEmail: vi.fn(),
  consumeRun: vi.fn(),
  verifyOtp: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  pending: [] as Promise<unknown>[],
}))

vi.mock('next/server', async () => {
  const actual = await vi.importActual<typeof import('next/server')>('next/server')
  return { ...actual, after: (fn: () => Promise<void>) => { pending.push(fn()) } }
})
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => ({ auth: { admin: { generateLink } } }) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { verifyOtp, updateUser, signOut } }) }))
vi.mock('@/lib/email', () => ({ sendEmail }))
vi.mock('@/lib/geo-audit/rate-limit', () => ({ consumeRun, identityFor: () => 'caller' }))

import { POST as forgot } from '@/app/api/auth/forgot-password/route'
import { POST as reset } from '@/app/api/auth/reset-password/route'
import { RESET_REQUEST_MESSAGE, resetEmail, resetLink, resetOrigin, passwordProblem } from './password-reset'

const req = (url: string, body: unknown, host = 'app.bylineseo.com') =>
  new Request(url, { method: 'POST', headers: { host, 'content-type': 'application/json' }, body: JSON.stringify(body) })
const settle = () => Promise.all(pending.splice(0))

beforeEach(() => {
  vi.clearAllMocks()
  consumeRun.mockResolvedValue({ allowed: true })
  sendEmail.mockResolvedValue({ ok: true })
})

describe('requesting a reset', () => {
  it('gives the same status and body for an address with an account and one without', async () => {
    generateLink.mockResolvedValueOnce({ data: { properties: { hashed_token: 'abc' } }, error: null })
    const known = await forgot(req('https://x/api/auth/forgot-password', { email: 'real@example.com' }))
    await settle()
    generateLink.mockResolvedValueOnce({ data: null, error: { message: 'User not found' } })
    const unknown = await forgot(req('https://x/api/auth/forgot-password', { email: 'nobody@example.com' }))
    await settle()
    expect(known.status).toBe(200)
    expect(unknown.status).toBe(200)
    expect(await known.json()).toEqual(await unknown.json())
    expect((await forgot(req('https://x', { email: 'a@b.co' }))).status).toBe(200)
    expect(RESET_REQUEST_MESSAGE).toMatch(/^If that address has an account/)
  })

  it('sends mail only when an account exists', async () => {
    generateLink.mockResolvedValueOnce({ data: null, error: { message: 'User not found' } })
    await forgot(req('https://x', { email: 'nobody@example.com' }))
    await settle()
    expect(sendEmail).not.toHaveBeenCalled()
    generateLink.mockResolvedValueOnce({ data: { properties: { hashed_token: 'abc' } }, error: null })
    await forgot(req('https://x', { email: 'Real@Example.com' }))
    await settle()
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(sendEmail.mock.calls[0][0].to).toBe('real@example.com')
    expect(sendEmail.mock.calls[0][0].text).toContain('https://app.bylineseo.com/reset-password?token_hash=abc&type=recovery')
  })

  it('sends nothing, still says the same thing, when the rate limit is hit', async () => {
    consumeRun.mockResolvedValue({ allowed: false })
    const res = await forgot(req('https://x', { email: 'real@example.com' }))
    await settle()
    expect(res.status).toBe(200)
    expect(generateLink).not.toHaveBeenCalled()
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('rejects input that is not an email without touching anything', async () => {
    const res = await forgot(req('https://x', { email: 'not-an-email' }))
    expect(res.status).toBe(400)
    expect(generateLink).not.toHaveBeenCalled()
  })

  it('never builds the link from a Host header that is not ours', () => {
    expect(resetOrigin('evil.example.com')).toBe('https://app.bylineseo.com')
    expect(resetOrigin('app.bylineseo.com.evil.com')).toBe('https://app.bylineseo.com')
    expect(resetOrigin('saas-seo-git-password-reset-x.vercel.app')).toBe('https://saas-seo-git-password-reset-x.vercel.app')
    expect(resetOrigin(null)).toBe('https://app.bylineseo.com')
  })
})

describe('the email', () => {
  it('is plain, names Byline, carries the link, and says what to do if not asked for', () => {
    const m = resetEmail(resetLink('https://app.bylineseo.com', 'tok'))
    expect(m.subject).toBe('Reset your Byline password')
    for (const body of [m.text, m.html]) {
      expect(body).toContain('/reset-password?token_hash=tok&type=recovery')
      expect(body).toMatch(/If you did not ask for this, ignore the email/)
    }
    expect(m.text).not.toMatch(/[–—]/)
    expect(m.html).not.toMatch(/[–—]/)
  })
})

describe('setting the new password', () => {
  it('says plainly that an expired or used link has expired, and does not set anything', async () => {
    verifyOtp.mockResolvedValue({ error: { message: 'Email link is invalid or has expired' } })
    const res = await reset(req('https://x', { token_hash: 'old', password: 'long-enough-1' }))
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('expired')
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('treats a missing token as expired', async () => {
    const res = await reset(req('https://x', { password: 'long-enough-1' }))
    expect((await res.json()).code).toBe('expired')
    expect(verifyOtp).not.toHaveBeenCalled()
  })

  it('rejects a short password before spending the token', async () => {
    const res = await reset(req('https://x', { token_hash: 'tok', password: 'short' }))
    expect((await res.json()).code).toBe('weak')
    expect(verifyOtp).not.toHaveBeenCalled()
    expect(passwordProblem('12345678')).toBeNull()
  })

  it('on success sets the password, then ends the account\'s other sessions', async () => {
    verifyOtp.mockResolvedValue({ error: null })
    updateUser.mockResolvedValue({ error: null })
    signOut.mockResolvedValue({ error: null })
    const res = await reset(req('https://x', { token_hash: 'tok', password: 'long-enough-1' }))
    expect(await res.json()).toEqual({ ok: true })
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 'tok', type: 'recovery' })
    expect(updateUser).toHaveBeenCalledWith({ password: 'long-enough-1' })
    expect(signOut).toHaveBeenCalledWith({ scope: 'others' })
  })
})
