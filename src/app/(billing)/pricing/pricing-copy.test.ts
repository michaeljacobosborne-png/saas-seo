import { describe, expect, it } from 'vitest'
import { PLAN_LIMITS } from '@/lib/plans'
import { PRICING_FAQS } from './pricing-faqs'
import { FREE_FEATURES, MONITORING_POINTS, PLANS } from './pricing-plans'

const allCopy = [
  ...PLANS.flatMap((p) => [p.name, p.tagline, p.cta, ...p.features.map((f) => f.text)]),
  ...FREE_FEATURES,
  ...MONITORING_POINTS.flatMap((m) => [m.title, m.body]),
  ...PRICING_FAQS.flatMap((f) => [f.q, f.a]),
].join('\n')

describe('pricing copy', () => {
  it('never sells daily re-scoring (the interval column allows 7 to 90 days)', () => {
    expect(allCopy).not.toMatch(/daily\s+re-?scor/i)
    expect(allCopy).not.toMatch(/re-?scored\s+(every\s+day|daily)/i)
    expect(allCopy).not.toMatch(/scores?\s+(are\s+)?(updated|re-?recorded)\s+daily/i)
  })

  it('puts the daily crawler access check on every paid plan', () => {
    for (const p of PLANS) expect(p.features.map((f) => f.text)).toContain('Daily crawler access checks with change alerts')
  })

  it('has no em or en dashes, no spot counter and no founder pricing', () => {
    expect(allCopy).not.toMatch(/[–—]/)
    expect(allCopy).not.toMatch(/spots?\s+(left|remaining)|first 100|limited spots|founder|founding|locked/i)
    expect(JSON.stringify(PLANS)).not.toMatch(/founder/i)
  })

  it('takes every number from the enforced plan table', () => {
    const byId = Object.fromEntries(PLANS.map((p) => [p.id, p.features.map((f) => f.text).join('\n')]))
    for (const id of ['starter', 'pro', 'agency'] as const) {
      expect(byId[id]).toContain(`${PLAN_LIMITS[id].trackedPages.toLocaleString('en-US')} pages monitored`)
      expect(byId[id]).toContain(`${PLAN_LIMITS[id].auditsPerMonth.toLocaleString('en-US')} one-off audits`)
      expect(byId[id]).toContain(`${PLAN_LIMITS[id].articles} articles`)
    }
  })

  it('sells Solo and Pro purely on pages monitored: no domain count anywhere in what they promise', () => {
    for (const p of PLANS.filter((x) => x.id !== 'agency')) {
      expect([p.tagline, ...p.features.map((f) => f.text)].join('\n')).not.toMatch(/domain|one site|single site|1 site/i)
    }
    expect(PLANS[0].features.map((f) => f.text)).toContain('15 pages monitored')
    expect(PLANS[1].features.map((f) => f.text)).toContain('100 pages monitored')
  })

  it('keeps the domain count on Agency, where serving client domains is the feature', () => {
    expect(PLANS[2].features.map((f) => f.text).join('\n')).toContain('500 pages monitored across 20 domains')
  })

  it('does not describe a Solo or Pro domain limit in the questions either', () => {
    const faqs = PRICING_FAQS.map((f) => `${f.q}\n${f.a}`).join('\n')
    expect(faqs).not.toMatch(/on one domain|across 5 domains|1 domain|5 domains|page or domain limit/i)
    expect(faqs).toMatch(/across 20 domains/)
  })

  it('shows the agreed prices', () => {
    expect(PLANS.map((p) => p.monthlyPrice)).toEqual([49, 129, 599])
  })

  it('tags MCP and unbranded share links as coming soon until they ship', () => {
    const soon = PLANS.flatMap((p) => p.features.filter((f) => f.soon).map((f) => f.text))
    expect(soon).toEqual(['MCP access and API keys', 'MCP access and API keys', 'Unbranded share links'])
    expect(PLANS[0].features.some((f) => /mcp/i.test(f.text))).toBe(false)
  })
})
