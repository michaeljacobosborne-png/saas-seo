import { describe, expect, it } from 'vitest'
import { resolveLimits } from './usage'
import { FREE_LIMITS, PLAN_ALIASES, PLAN_LIMITS, checkTrackedPageAllowance, domainOf, monthWindowUtc } from './plans'

const TIER_WORDS = /\b(solo|starter|growth|pro|agency|multi|free|team)\b/i

describe('plan limits', () => {
  it('match the agreed numbers', () => {
    // Solo and Pro are metered on pages monitored alone: no domain cap (null), not zero.
    expect(PLAN_LIMITS.starter).toMatchObject({ domains: null, trackedPages: 15, auditsPerMonth: 100, historyDays: 90, articles: 8 })
    expect(PLAN_LIMITS.pro).toMatchObject({ domains: null, trackedPages: 100, auditsPerMonth: 500, historyDays: 365, articles: 30 })
    expect(PLAN_LIMITS.agency).toMatchObject({ domains: 20, trackedPages: 500, auditsPerMonth: 2000, historyDays: null, articles: 100 })
    expect(FREE_LIMITS).toMatchObject({ auditsPerMonth: 10, trackedPages: 0, draftScoresPerMonth: 10 })
  })

  it('never promise re-scoring faster than the column allows (7 days)', () => {
    for (const p of Object.values(PLAN_LIMITS)) expect(p.rescoreIntervalDays).toBeGreaterThanOrEqual(7)
  })

  it('keep the stored plan values accounts are identified by', () => {
    expect(PLAN_ALIASES).toMatchObject({ starter: 'starter', pro: 'pro', agency: 'agency', team: 'agency' })
  })
})

describe('domainOf', () => {
  it('folds www and subdomains into one site', () => {
    expect(domainOf('https://www.example.com/a')).toBe('example.com')
    expect(domainOf('https://blog.example.com/a')).toBe('example.com')
    expect(domainOf('https://shop.example.co.uk/a')).toBe('example.co.uk')
    expect(domainOf('not a url')).toBeNull()
  })
})

describe('checkTrackedPageAllowance', () => {
  const solo = { trackedPages: PLAN_LIMITS.starter.trackedPages, domains: PLAN_LIMITS.starter.domains }

  it('refuses free accounts without naming a tier', () => {
    const r = checkTrackedPageAllowance({ limits: FREE_LIMITS, activeUrls: [], newUrl: 'https://a.com/x' })
    expect(r).toMatchObject({ ok: false, code: 'NOT_INCLUDED' })
    expect((r as { message: string }).message).toContain('not included in your current Byline subscription')
    expect((r as { message: string }).message).toContain('https://app.bylineseo.com/pricing')
    expect((r as { message: string }).message.replace(/Byline|bylineseo/gi, '')).not.toMatch(TIER_WORDS)
  })

  it('stops at the page limit and states it', () => {
    const active = Array.from({ length: 15 }, (_, i) => `https://a.com/p${i}`)
    const r = checkTrackedPageAllowance({ limits: solo, activeUrls: active, newUrl: 'https://a.com/new' })
    expect(r).toMatchObject({ ok: false, code: 'PAGE_LIMIT' })
    expect((r as { message: string }).message).toContain('up to 15 pages')
    expect((r as { message: string }).message).not.toMatch(TIER_WORDS)
  })

  it('says exactly what the page limit is when it is exceeded, and never names a tier', () => {
    const active = Array.from({ length: 15 }, (_, i) => `https://site${i}.com/`)
    const r = checkTrackedPageAllowance({ limits: solo, activeUrls: active, newUrl: 'https://another.com/' })
    expect(r).toEqual({
      ok: false,
      code: 'PAGE_LIMIT',
      message: 'Your subscription monitors up to 15 pages, and you are monitoring 15. Stop monitoring one to add another, or see https://app.bylineseo.com/pricing.',
    })
    expect((r as { message: string }).message.replace(/Byline|bylineseo/gi, '')).not.toMatch(TIER_WORDS)
    expect((r as { message: string }).message).not.toMatch(/domain/i)
  })

  it('does not cap domains on Solo or Pro: pages are the only meter', () => {
    for (const lim of [PLAN_LIMITS.starter, PLAN_LIMITS.pro]) {
      // A freelancer: one page on each of many client sites.
      const sites = Array.from({ length: lim.trackedPages - 1 }, (_, i) => `https://client${i}.com/`)
      expect(checkTrackedPageAllowance({ limits: lim, activeUrls: sites, newUrl: 'https://one-more-client.com/' }).ok).toBe(true)
      const full = [...sites, 'https://one-more-client.com/']
      expect(checkTrackedPageAllowance({ limits: lim, activeUrls: full, newUrl: 'https://yet-another.com/' })).toMatchObject({ ok: false, code: 'PAGE_LIMIT' })
    }
  })

  it('reads an absent domain cap as no cap, never as zero', () => {
    const active = ['https://a.com/x', 'https://b.com/x']
    expect(checkTrackedPageAllowance({ limits: { trackedPages: 15, domains: null }, activeUrls: active, newUrl: 'https://c.com/x' }).ok).toBe(true)
    // A limits object with no domains key at all, as an old or partial plan row would be.
    const partial = { trackedPages: 15 } as unknown as { trackedPages: number; domains: number | null }
    expect(checkTrackedPageAllowance({ limits: partial, activeUrls: active, newUrl: 'https://c.com/x' }).ok).toBe(true)
    const undef = { trackedPages: 15, domains: undefined } as unknown as { trackedPages: number; domains: number | null }
    expect(checkTrackedPageAllowance({ limits: undef, activeUrls: active, newUrl: 'https://c.com/x' }).ok).toBe(true)
  })

  it('allows a second page on a domain already monitored, and re-adding a monitored page at the limit', () => {
    expect(checkTrackedPageAllowance({ limits: solo, activeUrls: ['https://a.com/x'], newUrl: 'https://www.a.com/y' }).ok).toBe(true)
    const full = Array.from({ length: 15 }, (_, i) => `https://a.com/p${i}`)
    expect(checkTrackedPageAllowance({ limits: solo, activeUrls: full, newUrl: full[3] }).ok).toBe(true)
  })

  it('keeps the domain limit on Agency, where serving client domains is the feature, and states it', () => {
    const r = checkTrackedPageAllowance({ limits: { trackedPages: 500, domains: 2 }, activeUrls: ['https://a.com/x', 'https://b.com/x'], newUrl: 'https://c.com/x' })
    expect(r).toMatchObject({ ok: false, code: 'DOMAIN_LIMIT' })
    expect((r as { message: string }).message).toContain('up to 2 domains,')
    expect((r as { message: string }).message).not.toMatch(TIER_WORDS)
  })

  it('lets Agency span 20 domains and refuses the 21st', () => {
    const lim = PLAN_LIMITS.agency
    const active = Array.from({ length: 20 }, (_, i) => `https://site${i}.com/`)
    expect(checkTrackedPageAllowance({ limits: lim, activeUrls: active.slice(0, 19), newUrl: active[19] }).ok).toBe(true)
    expect(checkTrackedPageAllowance({ limits: lim, activeUrls: active, newUrl: 'https://site20.com/' })).toMatchObject({ ok: false, code: 'DOMAIN_LIMIT' })
  })
})

describe('monthWindowUtc', () => {
  it('covers the calendar month in UTC', () => {
    const w = monthWindowUtc(new Date('2026-12-31T23:59:00Z'))
    expect(w.start.toISOString()).toBe('2026-12-01T00:00:00.000Z')
    expect(w.next.toISOString()).toBe('2027-01-01T00:00:00.000Z')
  })
})

describe('resolved plans, as stored subscription rows resolve them', () => {
  // A stub of the one query resolvePlan makes: subscriptions where user and active.
  const clientFor = (plan: string | null) => ({
    from: () => {
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'in', 'limit']) chain[m] = () => chain
      chain.maybeSingle = async () => ({ data: plan ? { plan } : null })
      return chain
    },
  })
  type Lim = { trackedPages: number; domains: number | null }

  it('give Solo, Pro and the old team spelling the right caps, and no domain cap below Agency', async () => {
    const solo = await resolveLimits('u', clientFor('starter'), 'paid')
    const pro = await resolveLimits('u', clientFor('pro'), 'paid')
    const team = await resolveLimits('u', clientFor('team'), 'paid')
    expect(solo.plan).toBe('starter')
    expect((solo.limits as Lim).domains).toBeNull()
    expect((pro.limits as Lim).domains).toBeNull()
    expect(team.plan).toBe('agency')
    expect((team.limits as Lim).domains).toBe(20)
  })

  it('lets a Solo or Pro subscriber monitor pages on several domains', async () => {
    for (const plan of ['starter', 'pro']) {
      const { limits } = await resolveLimits('u', clientFor(plan), 'paid')
      const active = ['https://a.com/', 'https://b.com/', 'https://c.com/']
      expect(checkTrackedPageAllowance({ limits: limits as Lim, activeUrls: active, newUrl: 'https://d.com/' }).ok).toBe(true)
    }
  })

  it('treats an account with paid access but no subscription row as Solo, with no domain wall', async () => {
    const { plan, limits } = await resolveLimits('u', clientFor(null), 'paid')
    expect(plan).toBe('starter')
    expect(checkTrackedPageAllowance({ limits: limits as Lim, activeUrls: ['https://a.com/'], newUrl: 'https://b.com/' }).ok).toBe(true)
  })
})
