import { describe, expect, it } from 'vitest'
import { FREE_LIMITS, PLAN_ALIASES, PLAN_LIMITS, checkTrackedPageAllowance, domainOf, monthWindowUtc } from './plans'

const TIER_WORDS = /\b(solo|starter|growth|pro|agency|multi|free|team)\b/i

describe('plan limits', () => {
  it('match the agreed numbers', () => {
    expect(PLAN_LIMITS.starter).toMatchObject({ domains: 1, trackedPages: 15, auditsPerMonth: 100, historyDays: 90, articles: 8 })
    expect(PLAN_LIMITS.pro).toMatchObject({ domains: 5, trackedPages: 100, auditsPerMonth: 500, historyDays: 365, articles: 30 })
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
  const solo = { trackedPages: 15, domains: 1 }

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

  it('stops at the domain limit and states it', () => {
    const r = checkTrackedPageAllowance({ limits: solo, activeUrls: ['https://a.com/x'], newUrl: 'https://b.com/x' })
    expect(r).toMatchObject({ ok: false, code: 'DOMAIN_LIMIT' })
    expect((r as { message: string }).message).toContain('up to 1 domain,')
    expect((r as { message: string }).message).not.toMatch(TIER_WORDS)
  })

  it('allows a second page on a domain already monitored, and re-adding a monitored page at the limit', () => {
    expect(checkTrackedPageAllowance({ limits: solo, activeUrls: ['https://a.com/x'], newUrl: 'https://www.a.com/y' }).ok).toBe(true)
    const full = Array.from({ length: 15 }, (_, i) => `https://a.com/p${i}`)
    expect(checkTrackedPageAllowance({ limits: solo, activeUrls: full, newUrl: full[3] }).ok).toBe(true)
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
