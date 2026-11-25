import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Change password and change email (2026-11-24). A session alone must not be
 * enough to change either; an email never switches on submission, only when the
 * new address is confirmed; the old address is always told; a cancel or a
 * password change kills any pending change; and the answers never say whether
 * another account holds an address.
 */
const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  signInWithPassword: vi.fn(),
  probeSignOut: vi.fn(),
  adminGetUser: vi.fn(),
  adminUpdate: vi.fn(),
  sendEmail: vi.fn(),
  consumeRun: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: h.getUser, updateUser: h.updateUser, signOut: h.signOut } }) }))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => ({ auth: { admin: { getUserById: h.adminGetUser, updateUserById: h.adminUpdate } } }) }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: { signInWithPassword: h.signInWithPassword, signOut: h.probeSignOut } }) }))
vi.mock('@/lib/email', () => ({ sendEmail: h.sendEmail }))
vi.mock('@/lib/geo-audit/rate-limit', () => ({ consumeRun: h.consumeRun }))

import { POST as changePassword } from '@/app/api/account/change-password/route'
import { POST as changeEmail } from '@/app/api/account/change-email/route'
import { POST as confirmChange } from '@/app/api/account/confirm-email-change/route'
import { POST as cancelChange } from '@/app/api/account/cancel-email-change/route'
import { signAccountToken, readAccountToken } from './account-tokens'
import { EMAIL_CHANGE_REQUESTED_MESSAGE } from './account-emails'

const USER = { id: 'u1', email: 'Owner@Example.com', app_metadata: { providers: ['email'], email_change_epoch: 0 }, identities: [{ provider: 'email' }] }
const req = (body: unknown) => new Request('https://app.bylineseo.com/x', { method: 'POST', headers: { host: 'app.bylineseo.com', 'content-type': 'application/json' }, body: JSON.stringify(body) })
const confirmToken = (over = {}) => signAccountToken({ p: 'confirm', u: 'u1', o: 'owner@example.com', n: 'new@example.com', e: 0, x: Date.now() + 60_000, ...over })
const cancelToken = (over = {}) => signAccountToken({ p: 'cancel', u: 'u1', o: 'owner@example.com', e: 0, x: Date.now() + 60_000, ...over })

beforeEach(() => {
  vi.clearAllMocks()
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'
  h.getUser.mockResolvedValue({ data: { user: USER } })
  h.signInWithPassword.mockResolvedValue({ error: null })
  h.updateUser.mockResolvedValue({ error: null })
  h.signOut.mockResolvedValue({ error: null })
  h.adminUpdate.mockResolvedValue({ error: null })
  h.adminGetUser.mockResolvedValue({ data: { user: { ...USER, email: 'owner@example.com' } }, error: null })
  h.sendEmail.mockResolvedValue({ ok: true })
  h.consumeRun.mockResolvedValue({ allowed: true })
})

describe('change password', () => {
  it('refuses without the right current password and changes nothing', async () => {
    h.signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } })
    const res = await changePassword(req({ current_password: 'wrong', new_password: 'a-new-password' }))
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('wrong-password')
    expect(h.updateUser).not.toHaveBeenCalled()
    expect(h.sendEmail).not.toHaveBeenCalled()
  })

  it('refuses a signed-out caller and a short new password', async () => {
    h.getUser.mockResolvedValueOnce({ data: { user: null } })
    expect((await changePassword(req({ current_password: 'x', new_password: 'a-new-password' }))).status).toBe(401)
    const short = await changePassword(req({ current_password: 'right', new_password: 'short' }))
    expect((await short.json()).code).toBe('weak')
    expect(h.signInWithPassword).not.toHaveBeenCalled()
  })

  it('stops guessing once the daily budget is spent', async () => {
    h.consumeRun.mockResolvedValue({ allowed: false })
    const res = await changePassword(req({ current_password: 'x', new_password: 'a-new-password' }))
    expect(res.status).toBe(429)
    expect(h.signInWithPassword).not.toHaveBeenCalled()
  })

  it('on success sets it, ends the other sessions, cancels pending email changes, and tells the account address', async () => {
    const res = await changePassword(req({ current_password: 'right', new_password: 'a-new-password' }))
    expect(await res.json()).toEqual({ ok: true })
    expect(h.updateUser).toHaveBeenCalledWith({ password: 'a-new-password' })
    expect(h.signOut).toHaveBeenCalledWith({ scope: 'others' })
    expect(h.adminUpdate.mock.calls[0][1].app_metadata.email_change_epoch).toBe(1)
    const mail = h.sendEmail.mock.calls[0][0]
    expect(mail.to).toBe('Owner@Example.com')
    expect(mail.text).toMatch(/If it was not you/)
    expect(h.probeSignOut).toHaveBeenCalledWith({ scope: 'local' })
  })

  it('says plainly that a Google or GitHub account has no password to change', async () => {
    h.getUser.mockResolvedValue({ data: { user: { ...USER, app_metadata: { providers: ['google'] }, identities: [{ provider: 'google' }] } } })
    const res = await changePassword(req({ current_password: 'x', new_password: 'a-new-password' }))
    expect((await res.json()).code).toBe('no-password')
  })
})

describe('change email: the request', () => {
  it('needs the current password and sends nothing without it', async () => {
    h.signInWithPassword.mockResolvedValue({ error: { message: 'bad' } })
    const res = await changeEmail(req({ current_password: 'wrong', new_email: 'new@example.com' }))
    expect(res.status).toBe(400)
    expect(h.sendEmail).not.toHaveBeenCalled()
  })

  it('switches nothing on submission', async () => {
    await changeEmail(req({ current_password: 'right', new_email: 'new@example.com' }))
    expect(h.adminUpdate).not.toHaveBeenCalled()
    expect(h.updateUser).not.toHaveBeenCalled()
  })

  it('warns the OLD address, naming the new one with a cancel link, and sends the confirmation to the NEW one', async () => {
    const res = await changeEmail(req({ current_password: 'right', new_email: 'New@Example.com' }))
    expect(await res.json()).toEqual({ ok: true, message: EMAIL_CHANGE_REQUESTED_MESSAGE })
    const [oldMail, newMail] = h.sendEmail.mock.calls.map((c) => c[0])
    expect(oldMail.to).toBe('owner@example.com')
    expect(oldMail.text).toContain('new@example.com')
    expect(oldMail.text).toMatch(/\/cancel-email-change\?token=/)
    expect(oldMail.text).toMatch(/If it was not you/)
    expect(newMail.to).toBe('new@example.com')
    expect(newMail.text).toMatch(/\/confirm-email-change\?token=/)
    expect(newMail.text).toMatch(/Nothing has changed yet/)
  })

  it('answers the same whether or not the new address belongs to someone else (it does not look)', async () => {
    const a = await (await changeEmail(req({ current_password: 'right', new_email: 'free@example.com' }))).json()
    const b = await (await changeEmail(req({ current_password: 'right', new_email: 'taken@example.com' }))).json()
    expect(a).toEqual(b)
    expect(EMAIL_CHANGE_REQUESTED_MESSAGE).not.toMatch(/already (belongs|registered|has an account)/i)
  })

  it('rejects the same address and a non-email', async () => {
    expect((await (await changeEmail(req({ current_password: 'right', new_email: 'OWNER@example.com' }))).json()).code).toBe('same')
    expect((await (await changeEmail(req({ current_password: 'right', new_email: 'nope' }))).json()).code).toBe('invalid')
  })
})

describe('change email: confirming and cancelling', () => {
  it('switches the account only when a genuine, current confirmation is used, and then tells the old address', async () => {
    const res = await confirmChange(req({ token: confirmToken() }))
    expect(await res.json()).toEqual({ ok: true, email: 'new@example.com' })
    expect(h.adminUpdate).toHaveBeenCalledTimes(1)
    expect(h.adminUpdate.mock.calls[0][1]).toMatchObject({ email: 'new@example.com', email_confirm: true })
    expect(h.adminUpdate.mock.calls[0][1].app_metadata.email_change_epoch).toBe(1)
    const mail = h.sendEmail.mock.calls[0][0]
    expect(mail.to).toBe('owner@example.com')
    expect(mail.text).toContain('new@example.com')
  })

  it('refuses a forged, tampered, expired or wrong-purpose token', async () => {
    const good = confirmToken()
    const [body, sig] = good.split('.')
    const tampered = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, 'base64url').toString()), n: 'evil@example.com' })).toString('base64url') + '.' + sig
    for (const token of [tampered, 'garbage', confirmToken({ x: Date.now() - 1 }), cancelToken(), undefined]) {
      const res = await confirmChange(req({ token }))
      expect(res.status).toBe(400)
    }
    expect(h.adminUpdate).not.toHaveBeenCalled()
  })

  it('is single use: once the email has changed the same link does nothing', async () => {
    h.adminGetUser.mockResolvedValue({ data: { user: { ...USER, email: 'new@example.com', app_metadata: { providers: ['email'], email_change_epoch: 1 } } }, error: null })
    expect((await confirmChange(req({ token: confirmToken() }))).status).toBe(400)
    expect(h.adminUpdate).not.toHaveBeenCalled()
  })

  it('is dead after a cancel or a password change moves the counter on', async () => {
    h.adminGetUser.mockResolvedValue({ data: { user: { ...USER, email: 'owner@example.com', app_metadata: { providers: ['email'], email_change_epoch: 1 } } }, error: null })
    expect((await confirmChange(req({ token: confirmToken() }))).status).toBe(400)
    expect(h.adminUpdate).not.toHaveBeenCalled()
  })

  it('says only that the address cannot be used when another account holds it', async () => {
    h.adminUpdate.mockResolvedValue({ error: { message: 'A user with this email address has already been registered', code: 'email_exists' } })
    const res = await confirmChange(req({ token: confirmToken() }))
    const body = await res.json()
    expect(res.status).toBe(409)
    expect(body.code).toBe('unavailable')
    expect(body.message).not.toMatch(/registered|account (exists|holds)|already has/i)
    expect(h.sendEmail).not.toHaveBeenCalled()
  })

  it('the owner can cancel from the old-address link: the counter moves on and a later confirmation fails', async () => {
    expect(await (await cancelChange(req({ token: cancelToken() }))).json()).toEqual({ ok: true })
    expect(h.adminUpdate.mock.calls[0][1].app_metadata.email_change_epoch).toBe(1)
  })

  it('cancelling after the change has gone through says so and points at support, and changes nothing', async () => {
    h.adminGetUser.mockResolvedValue({ data: { user: { ...USER, email: 'new@example.com' } }, error: null })
    const res = await cancelChange(req({ token: cancelToken() }))
    expect(res.status).toBe(409)
    expect((await res.json()).message).toMatch(/hi@bylineseo\.com/)
    expect(h.adminUpdate).not.toHaveBeenCalled()
  })
})

describe('tokens', () => {
  it('round-trip, and are bound to their purpose', () => {
    expect(readAccountToken(confirmToken(), 'confirm')?.n).toBe('new@example.com')
    expect(readAccountToken(confirmToken(), 'cancel')).toBeNull()
  })
})
