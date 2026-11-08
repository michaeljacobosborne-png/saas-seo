import { beforeEach, describe, expect, it, vi } from 'vitest'
import { identityFor, isQuotaExempt } from './rate-limit'

const OWNER = { id: 'u1', email: 'michaeljacobosborne@gmail.com', email_confirmed_at: '2026-01-01T00:00:00Z' }

describe('isQuotaExempt', () => {
  it('exempts the verified owner account', () => {
    expect(isQuotaExempt(OWNER)).toBe(true)
    expect(isQuotaExempt({ ...OWNER, email: ' MichaelJacobOsborne@Gmail.com ' })).toBe(true)
  })

  it('does not exempt anonymous or other users', () => {
    expect(isQuotaExempt(null)).toBe(false)
    expect(isQuotaExempt(undefined)).toBe(false)
    expect(isQuotaExempt({ ...OWNER, email: 'someone@example.com' })).toBe(false)
  })

  it('does not exempt an owner-email account whose email is unconfirmed', () => {
    expect(isQuotaExempt({ ...OWNER, email_confirmed_at: null })).toBe(false)
  })
})

// ── Route: the exemption must come from the verified session only ─────────────

const getUser = vi.fn()
const consumeRun = vi.fn()
const monthlyAuditBudget = vi.fn()

vi.mock('@/lib/audit-quota', () => ({ monthlyAuditBudget: (...args: unknown[]) => monthlyAuditBudget(...args) }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser } }),
}))

vi.mock('@/lib/geo-audit/rate-limit', async (orig) => ({
  ...(await orig<typeof import('./rate-limit')>()),
  consumeRun: (...args: unknown[]) => consumeRun(...args),
}))

vi.mock('@/lib/geo-audit', () => ({
  AUDIT_STEPS: 1,
  AuditError: class extends Error {},
  runAudit: async () => ({ score: 1 }),
}))

const exhausted = { allowed: false, remaining: 0, limit: 3, resetsAt: '2026-10-01T00:00:00.000Z' }

function req(headers: Record<string, string> = {}) {
  return new Request('https://bylineseo.com/api/free-tools/analyze', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.9', 'user-agent': 'UA', ...headers },
    body: JSON.stringify({ url: 'https://example.com', type: 'geo' }),
  })
}

describe('POST /api/free-tools/analyze quota', () => {
  beforeEach(() => {
    getUser.mockReset()
    consumeRun.mockReset().mockResolvedValue(exhausted)
    monthlyAuditBudget.mockReset()
  })

  it('lets the signed-in owner run past the limit, counted under their account', async () => {
    getUser.mockResolvedValue({ data: { user: OWNER } })
    const { POST } = await import('@/app/api/free-tools/analyze/route')
    const res = await POST(req())
    expect(res.status).toBe(200)
    expect(consumeRun).toHaveBeenCalledWith('user:u1', { tool: 'geo' })
  })

  it('still limits anonymous callers, whatever headers they send', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    const { POST } = await import('@/app/api/free-tools/analyze/route')
    const res = await POST(req({ 'x-user-email': OWNER.email, authorization: 'Bearer forged', 'x-real-ip': '127.0.0.1' }))
    expect(res.status).toBe(429)
    expect(consumeRun).toHaveBeenCalledWith(identityFor(req().headers), { tool: 'geo' })
  })

  it('limits a signed-in non-owner by their monthly allowance, not the daily one, and names no tier', async () => {
    getUser.mockResolvedValue({ data: { user: { ...OWNER, id: 'u2', email: 'customer@example.com' } } })
    monthlyAuditBudget.mockResolvedValue({ allowed: false, remaining: 0, limit: 10, used: 10, resetsAt: '2026-12-01T00:00:00.000Z' })
    const { POST } = await import('@/app/api/free-tools/analyze/route')
    const res = await POST(req())
    expect(res.status).toBe(429)
    expect(monthlyAuditBudget).toHaveBeenCalledWith('u2')
    expect(consumeRun).not.toHaveBeenCalled()
    const body = (await res.json()) as { error: string }
    expect(body.error).toContain("this month's 10 audits")
    expect(body.error).not.toMatch(/(solo|starter|growth|pro|agency|free)/i)
  })

  it('lets a signed-in non-owner run while they are inside their monthly allowance', async () => {
    getUser.mockResolvedValue({ data: { user: { ...OWNER, id: 'u2', email: 'customer@example.com' } } })
    monthlyAuditBudget.mockResolvedValue({ allowed: true, remaining: 4, limit: 10, used: 5, resetsAt: '2026-12-01T00:00:00.000Z' })
    const { POST } = await import('@/app/api/free-tools/analyze/route')
    expect((await POST(req())).status).toBe(200)
  })

  it('treats an auth lookup failure as anonymous', async () => {
    getUser.mockRejectedValue(new Error('auth down'))
    const { POST } = await import('@/app/api/free-tools/analyze/route')
    expect((await POST(req())).status).toBe(429)
  })
})
