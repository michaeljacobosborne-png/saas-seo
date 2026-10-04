import { describe, expect, it, vi } from 'vitest'
import { apiKeyResolver, bearerToken, generateApiKey, hashApiKey, isWellFormedApiKey, planTier, type StoredKey } from './auth'
import { checkLimits, DOMAIN_BUDGET, MONTHLY_QUOTA, RATE, targetDomainOf, type CallRecord } from './limits'
import { checkCrawlerAccessInput, compareAuditsInput, getAuditInput, isNonPublicHost, publicUrl, runAuditInput, scoreDraftInput } from './schemas'

const req = (auth?: string) => new Request('https://app.bylineseo.com/api/mcp', { headers: auth ? { authorization: auth } : {} })

describe('auth: API keys', () => {
  it('generates well-formed keys and stores only a hash', () => {
    const k = generateApiKey()
    expect(isWellFormedApiKey(k.key)).toBe(true)
    expect(k.hash).toBe(hashApiKey(k.key))
    expect(k.hash).not.toContain(k.key)
    expect(k.key.startsWith(k.prefix)).toBe(true)
    expect(generateApiKey().key).not.toBe(k.key)
  })

  it('reads only a Bearer token', () => {
    expect(bearerToken(req('Bearer abc'))).toBe('abc')
    expect(bearerToken(req('Basic abc'))).toBeNull()
    expect(bearerToken(req())).toBeNull()
  })

  it('maps subscription plans like the dashboard does', () => {
    expect(planTier('starter')).toBe('starter')
    expect(planTier('pro')).toBe('growth')
    expect(planTier('agency')).toBe('multi_brand')
    expect(planTier('team')).toBe('multi_brand')
    expect(planTier(null)).toBe('free')
  })

  const key = generateApiKey()
  const stored: StoredKey = { keyId: 'k1', userId: 'u1', keyHash: key.hash, revoked: false }
  const deps = (row: StoredKey | null) => ({
    lookupKey: vi.fn(async (h: string) => (row && h === row.keyHash ? row : null)),
    planFor: async () => 'growth' as const,
    isOwner: async () => false,
  })

  it('resolves a valid key to a principal', async () => {
    const p = await apiKeyResolver(deps(stored)).resolve(req(`Bearer ${key.key}`))
    expect(p).toEqual({ userId: 'u1', keyId: 'k1', plan: 'growth', isOwner: false, via: 'api_key' })
  })

  it('rejects revoked, unknown, malformed and missing credentials without touching storage for malformed ones', async () => {
    expect(await apiKeyResolver(deps({ ...stored, revoked: true })).resolve(req(`Bearer ${key.key}`))).toBeNull()
    expect(await apiKeyResolver(deps(null)).resolve(req(`Bearer ${key.key}`))).toBeNull()
    const d = deps(stored)
    expect(await apiKeyResolver(d).resolve(req('Bearer not-a-key'))).toBeNull()
    expect(d.lookupKey).not.toHaveBeenCalled()
    expect(await apiKeyResolver(deps(stored)).resolve(req())).toBeNull()
  })

  it('ignores credentials in the query string', async () => {
    const r = new Request(`https://app.bylineseo.com/api/mcp?key=${key.key}`)
    expect(await apiKeyResolver(deps(stored)).resolve(r)).toBeNull()
  })
})

describe('schemas: SSRF guard and inputs', () => {
  it('blocks non-public hosts', () => {
    for (const h of ['localhost', 'app.localhost', 'printer.local', 'metadata.google.internal', '127.0.0.1', '10.0.0.5', '172.16.3.4', '192.168.1.1', '169.254.169.254', '100.64.0.1', '::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1', 'intranet'])
      expect(isNonPublicHost(h), h).toBe(true)
    for (const h of ['example.com', 'www.builtvisible.com', '8.8.8.8', '172.32.0.1', '2606:4700::1111']) expect(isNonPublicHost(h), h).toBe(false)
  })

  it('accepts public URLs and bare domains, rejects others', () => {
    expect(publicUrl.parse('acme.io')).toBe('https://acme.io')
    expect(publicUrl.safeParse('http://169.254.169.254/latest/meta-data').success).toBe(false)
    expect(publicUrl.safeParse('file:///etc/passwd').success).toBe(false)
    expect(publicUrl.safeParse('ftp://acme.io').success).toBe(false)
    expect(publicUrl.safeParse('https://user:pass@acme.io').success).toBe(false)
    expect(publicUrl.safeParse('https://localhost:3000').success).toBe(false)
  })

  it('applies defaults and exactly-one rules', () => {
    expect(runAuditInput.parse({ url: 'acme.io' })).toEqual({ url: 'https://acme.io', tool: 'geo', save: true })
    expect(checkCrawlerAccessInput.safeParse({ url: '10.0.0.1' }).success).toBe(false)
    const id = '7d9f3c1e-2b4a-4c8d-9e6f-1a2b3c4d5e6f'
    expect(getAuditInput.safeParse({ audit_id: id }).success).toBe(true)
    expect(getAuditInput.safeParse({}).success).toBe(false)
    expect(getAuditInput.safeParse({ audit_id: id, share_token: id }).success).toBe(false)
    expect(compareAuditsInput.safeParse({ audit_id_a: id, audit_id_b: id }).success).toBe(false)
    expect(compareAuditsInput.safeParse({ url: 'acme.io', since: '2026-09-01T00:00:00Z' }).success).toBe(true)
    expect(scoreDraftInput.safeParse({ markdown: '# x', html: '<p>x</p>' }).success).toBe(false)
  })
})

describe('limits', () => {
  const now = Date.UTC(2026, 9, 15, 12, 0, 0)
  const calls = (n: number, over: Partial<CallRecord> = {}, spacingMs = 1000): CallRecord[] =>
    Array.from({ length: n }, (_, i) => ({ tool: 'check_crawler_access', targetDomain: 'other.com', at: now - (i + 1) * spacingMs, ...over }))

  it('enforces the per-minute rate', () => {
    const r = checkLimits({ tool: 'get_audit', targetDomain: null, plan: 'growth', isOwner: false, history: calls(RATE.perMinute, { tool: 'get_audit', targetDomain: null }), now })
    expect(r).toMatchObject({ ok: false, reason: 'rate' })
  })

  it('caps concurrent audits', () => {
    const inFlight = calls(RATE.concurrentAudits, { tool: 'run_audit', inFlight: true }, 70_000)
    expect(checkLimits({ tool: 'run_audit', targetDomain: 'acme.io', plan: 'growth', isOwner: false, history: inFlight, now })).toMatchObject({ ok: false, reason: 'concurrency' })
  })

  it('caps probes of one target domain, even for the owner', () => {
    const sameDomain = calls(DOMAIN_BUDGET.max, { targetDomain: 'acme.io' }, 70_000)
    for (const isOwner of [false, true]) {
      const r = checkLimits({ tool: 'check_crawler_access', targetDomain: 'acme.io', plan: 'multi_brand', isOwner, history: sameDomain, now })
      expect(r).toMatchObject({ ok: false, reason: 'domain' })
    }
    expect(checkLimits({ tool: 'check_crawler_access', targetDomain: 'elsewhere.io', plan: 'multi_brand', isOwner: false, history: sameDomain, now }).ok).toBe(true)
  })

  it('applies monthly quotas by plan and tool class, and says when they reset', () => {
    const quota = MONTHLY_QUOTA.starter.audit!
    const used = Array.from({ length: quota }, (_, i): CallRecord => ({ tool: 'run_audit', targetDomain: `s${i}.com`, at: now - 86_400_000 + i }))
    const r = checkLimits({ tool: 'run_audit', targetDomain: 'acme.io', plan: 'starter', isOwner: false, history: used, now })
    expect(r).toMatchObject({ ok: false, reason: 'quota' })
    expect(checkLimits({ tool: 'run_audit', targetDomain: 'acme.io', plan: 'growth', isOwner: false, history: used, now })).toMatchObject({ ok: true, remaining: MONTHLY_QUOTA.growth.audit! - quota - 1 })
    // Last month's calls do not count.
    const lastMonth = used.map((c) => ({ ...c, at: Date.UTC(2026, 8, 20) }))
    expect(checkLimits({ tool: 'run_audit', targetDomain: 'acme.io', plan: 'starter', isOwner: false, history: lastMonth, now }).ok).toBe(true)
  })

  it('says "not in plan" rather than "quota used" for tools a plan excludes', () => {
    expect(checkLimits({ tool: 'run_audit', targetDomain: 'acme.io', plan: 'free', isOwner: false, history: [], now })).toMatchObject({ ok: false, reason: 'not_in_plan' })
  })

  it('exempts the owner from quota and rate, not from the domain cap', () => {
    const many = calls(50, { tool: 'run_audit', targetDomain: 'x.com' }, 100)
    expect(checkLimits({ tool: 'run_audit', targetDomain: 'acme.io', plan: 'free', isOwner: true, history: many, now }).ok).toBe(true)
  })

  it('normalises the target domain', () => {
    expect(targetDomainOf('https://WWW.Acme.io/blog/post')).toBe('acme.io')
  })
})
