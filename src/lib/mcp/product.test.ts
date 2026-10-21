/** Decision 27: entitlements in one place, metering per account and per credential, MCP decoupled from the dashboard. */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { apiKeyResolver, chainResolvers, generateApiKey, oauthResolver, type McpPrincipal } from './auth'
import { PLAN_MODEL, TOOL_CAPABILITY, entitlementFor, quotaExhaustedMessage, type PlanModel } from './entitlements'
import { meter, usageRecord, type UsageSink } from './metering'
import { TOOL_INPUTS } from './schemas'

const TIER_WORDS = /starter|growth|multi.?brand|free|pro\b|agency|team|tier|plan\b/i

describe('entitlements', () => {
  it('maps every tool to a capability', () => {
    expect(Object.keys(TOOL_CAPABILITY).sort()).toEqual(Object.keys(TOOL_INPUTS).sort())
  })

  it('keeps the crawler test free and comparison never free (decision 22)', () => {
    expect(entitlementFor('free', false, 'check_crawler_access').allowed).toBe(true)
    for (const tool of ['run_audit', 'get_audit', 'list_audits', 'compare_audits'] as const) {
      expect(entitlementFor('free', false, tool).allowed).toBe(false)
    }
    for (const plan of ['starter', 'growth', 'multi_brand'] as const) {
      expect(entitlementFor(plan, false, 'compare_audits').allowed).toBe(true)
    }
  })

  it('lets the owner use everything unmetered', () => {
    expect(entitlementFor('free', true, 'compare_audits')).toEqual({ allowed: true, capability: 'compare', monthlyAllowance: null })
  })

  it('never names a tier in anything a caller sees', () => {
    const denied = entitlementFor('free', false, 'run_audit')
    expect(denied.allowed).toBe(false)
    if (!denied.allowed) expect(denied.message).not.toMatch(TIER_WORDS)
    expect(quotaExhaustedMessage('audit', 150, 150)).not.toMatch(TIER_WORDS)
  })

  it('changes the commercial model by editing the table only', () => {
    const none = { crawler_check: 0, audit: 0, stored_audits: 0, compare: 0, score_draft: 0 }
    const separate: PlanModel = {
      ...PLAN_MODEL,
      model: 'separate_data_layer_plan',
      allowances: { ...PLAN_MODEL.allowances, starter: none },
    }
    expect(entitlementFor('starter', false, 'run_audit', separate).allowed).toBe(false)
    expect(entitlementFor('starter', false, 'run_audit').allowed).toBe(true)
  })
})

describe('OAuth resolver', () => {
  const deps = {
    verifyToken: vi.fn(async (t: string) => (t === 'good.jwt.token' ? { userId: 'u1', clientId: 'claude-ai' } : null)),
    planFor: async () => 'growth' as const,
    isOwner: async () => false,
  }
  const req = (token?: string) => new Request('https://mcp.bylineseo.com/mcp', { headers: token ? { authorization: `Bearer ${token}` } : {} })

  it('accepts a verified token and records the client for metering', async () => {
    expect(await oauthResolver(deps).resolve(req('good.jwt.token'))).toEqual({ userId: 'u1', keyId: 'claude-ai', plan: 'growth', isOwner: false, via: 'oauth' })
  })

  it('rejects unverified or missing tokens, and leaves API keys to the key resolver', async () => {
    expect(await oauthResolver(deps).resolve(req('bad'))).toBeNull()
    expect(await oauthResolver(deps).resolve(req())).toBeNull()
    deps.verifyToken.mockClear()
    expect(await oauthResolver(deps).resolve(req(generateApiKey().key))).toBeNull()
    expect(deps.verifyToken).not.toHaveBeenCalled()
  })

  it('chains OAuth first, then API keys', async () => {
    const { key, hash } = generateApiKey()
    const keys = apiKeyResolver({
      lookupKey: async (h) => (h === hash ? { keyId: 'k1', userId: 'u2', keyHash: hash, revoked: false } : null),
      planFor: async () => 'starter',
      isOwner: async () => false,
    })
    const chain = chainResolvers(oauthResolver(deps), keys)
    expect((await chain.resolve(req('good.jwt.token')))?.via).toBe('oauth')
    expect((await chain.resolve(req(key)))?.via).toBe('api_key')
    expect(await chain.resolve(req('nope'))).toBeNull()
  })
})

describe('metering', () => {
  const principal: McpPrincipal = { userId: 'u1', keyId: 'claude-ai', plan: 'growth', isOwner: false, via: 'oauth' }

  it('records account AND credential on every call', () => {
    const r = usageRecord(principal, {
      tool: 'run_audit', targetDomain: 'acme.io', outcome: 'ok', reason: null,
      durationMs: 1234.6, modelCostUsd: 0.0015, engineVersion: '2026.10', at: new Date('2026-10-04T00:00:00Z'),
    })
    expect(r).toMatchObject({ userId: 'u1', credentialId: 'claude-ai', via: 'oauth', durationMs: 1235, at: '2026-10-04T00:00:00.000Z' })
  })

  it('never fails the call when the sink fails', async () => {
    const sink: UsageSink = { record: async () => { throw new Error('db down') } }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(meter(sink, usageRecord(principal, { tool: 'score_draft', targetDomain: null, outcome: 'ok', reason: null, durationMs: 1, modelCostUsd: 0, engineVersion: null }))).resolves.toBeUndefined()
    spy.mockRestore()
  })
})

describe('decoupling (decision 27)', () => {
  it('src/lib/mcp imports only itself, the geo-audit library and the data layer', () => {
    const dir = __dirname
    const allowed = [/^\.\//, /^\.\.\/(geo-audit|supabase)\//,/^@\/lib\/geo-audit/, /^@\/lib\/supabase/, /^node:/, /^zod$/, /^vitest$/, /^@supabase\//, /^@modelcontextprotocol\//]
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.ts'))) {
      const src = readFileSync(join(dir, f), 'utf8')
      for (const m of src.matchAll(/from\s+'([^']+)'/g)) {
        expect(allowed.some((re) => re.test(m[1])), `${f} imports ${m[1]}`).toBe(true)
      }
    }
  })
})
