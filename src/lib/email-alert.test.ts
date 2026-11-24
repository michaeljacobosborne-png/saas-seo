import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * A failed transactional send must be reported to the owner outside the email
 * channel, not only logged, because several flows show the customer a neutral
 * message whatever happens to the mail (2026-11-24).
 */
const { consumeRun, sendTelegramMessage } = vi.hoisted(() => ({ consumeRun: vi.fn(), sendTelegramMessage: vi.fn() }))
vi.mock('@/lib/geo-audit/rate-limit', () => ({ consumeRun }))
vi.mock('@/lib/telegram', () => ({ sendTelegramMessage }))

import { sendEmail } from './email'

const errors: string[] = []
beforeEach(() => {
  vi.clearAllMocks()
  errors.length = 0
  vi.spyOn(console, 'error').mockImplementation((...a) => { errors.push(a.join(' ')) })
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  consumeRun.mockResolvedValue({ allowed: true })
  sendTelegramMessage.mockResolvedValue({ ok: true })
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

const mail = { to: 'customer@example.com', subject: 'Reset your Byline password', text: 'x' }

describe('a failed send is reported, not swallowed', () => {
  it('alerts the owner when the key is missing', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    const r = await sendEmail(mail)
    expect(r.ok).toBe(false)
    expect(sendTelegramMessage).toHaveBeenCalledTimes(1)
    expect(sendTelegramMessage.mock.calls[0][0]).toMatch(/RESEND_API_KEY is not set/)
  })

  it('alerts the owner with the provider reason when Resend refuses', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"message":"The bylineseo.com domain is not verified"}', { status: 403 })))
    const r = await sendEmail(mail)
    expect(r).toEqual({ ok: false, error: 'Resend 403' })
    expect(sendTelegramMessage.mock.calls[0][0]).toMatch(/Resend 403: .*not verified/)
  })

  it('logs a greppable line without the customer\'s full address', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    await sendEmail(mail)
    const line = errors.find((l) => l.includes('[EMAIL-SEND-FAILED]'))!
    expect(line).toContain('to=*@example.com')
    expect(line).not.toContain('customer@')
    expect(sendTelegramMessage.mock.calls[0][0]).not.toContain('customer@')
  })

  it('stops messaging the owner once the daily budget is spent, but keeps logging', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    consumeRun.mockResolvedValue({ allowed: false })
    await sendEmail(mail)
    expect(sendTelegramMessage).not.toHaveBeenCalled()
    expect(errors.some((l) => l.includes('[EMAIL-SEND-FAILED]'))).toBe(true)
  })

  it('does not alert on a successful send', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"id":"abc"}', { status: 200 })))
    expect(await sendEmail(mail)).toEqual({ ok: true, id: 'abc' })
    expect(sendTelegramMessage).not.toHaveBeenCalled()
  })
})
