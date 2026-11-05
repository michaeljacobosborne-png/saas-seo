import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractPage } from './extract'
import { assessCitability } from './assess-citability'
import { brandNames, mentionsBrand, organizations } from './attribution-names'
import { parseDate } from './dates'
import { scoreRetrievability } from './score-retrievability'

/**
 * Four findings the engine got wrong on blog.hubspot.com (2026-11-03, engine
 * 2026.14), caught by hand before a teardown went out. Fixtures: the three
 * article pages as fetched that day.
 */
const load = (f: string, url: string) => extractPage(readFileSync(join(__dirname, '__fixtures__', f), 'utf8'), url)
const service = load('hubspot-service-ai-2026-11-03.html', 'https://blog.hubspot.com/service/problems-ai-solves-in-service')
const sales = load('hubspot-sales-linkedin-2026-11-03.html', 'https://blog.hubspot.com/sales/linkedin-summary-examples')
const marketing = load('hubspot-marketing-chatgpt-ads-2026-11-03.html', 'https://blog.hubspot.com/marketing/chatgpt-ads-vs-google-search-ads')
const NOW = new Date('2026-11-03T12:00:00Z')
const signal = (home: typeof service, id: string) => assessCitability({ home, keyPages: [], now: NOW }).signals.find((s) => s.id === id)!

describe('1. an Organization declared only as a nested publisher reference', () => {
  it('is found, with its @id and no name', () => {
    const orgs = organizations(service)
    expect(orgs).toHaveLength(1)
    expect(orgs[0]).toMatchObject({ id: 'https://blog.hubspot.com/#organization', name: null, via: 'nested' })
  })

  it('reads as weak and says exactly what is declared, never "none declared"', () => {
    for (const page of [service, sales, marketing]) {
      const s = signal(page, 'entity-resolution')
      expect(s.band).toBe('weak')
      expect(s.detail).toContain('declared as publisher only by reference (https://blog.hubspot.com/#organization)')
      expect(s.detail).not.toMatch(/No Organization/)
    }
  })

  it('picks up a name declared elsewhere under the same @id', () => {
    const html = `<html><head><title>X</title><script type="application/ld+json">${JSON.stringify({
      '@graph': [
        { '@type': 'Article', publisher: { '@type': 'Organization', '@id': '#org' } },
        { '@type': 'Organization', '@id': '#org', name: 'Acme', sameAs: ['https://x.com/acme', 'https://linkedin.com/company/acme'] },
      ],
    })}</script></head><body><p>Hi</p></body></html>`
    const orgs = organizations(extractPage(html, 'https://acme.com/'))
    expect(orgs).toEqual([expect.objectContaining({ name: 'Acme', sameAs: ['https://x.com/acme', 'https://linkedin.com/company/acme'], via: 'node' })])
  })
})

describe('2. the brand is the organisation, not the website', () => {
  it('reads "HubSpot" from the site name "HubSpot Blog"', () => {
    expect(brandNames(service)?.display).toBe('HubSpot')
  })

  it('finds HubSpot named beside its own data in the article body', () => {
    const s = signal(service, 'brand-proximity')
    expect(s.band).not.toBe('absent')
    expect(s.detail).toMatch(/"HubSpot" appears inside \d+ of \d+ substantive sections/)
  })

  it('counts any capitalisation but all lowercase', () => {
    const aimclear = { candidates: ['Aimclear'], display: 'Aimclear' }
    expect(mentionsBrand('AIMCLEAR engineers multi-surface marketing systems', aimclear)).toBe(true)
    const candour = { candidates: ['Candour'], display: 'Candour' }
    expect(mentionsBrand('We value candour above all.', candour)).toBe(false)
    expect(mentionsBrand('Why Candour?', candour)).toBe(true)
  })

  it('keeps a declared organisation name over a domain that adds a word, and shortens one that starts with the domain name', () => {
    const page = (org: string, url: string) =>
      extractPage(`<html><head><title>Home</title><script type="application/ld+json">${JSON.stringify({ '@type': 'Organization', name: org })}</script></head><body><main><p>Body text.</p></main></body></html>`, url)
    // withcandour.co.uk: the brand is "Candour", not "with Candour".
    expect(brandNames(page('Candour Agency Ltd', 'https://withcandour.co.uk/'))?.display).toBe('Candour')
    // inter-dev.co.il: the hyphen in the domain does not stop the match.
    expect(brandNames(page('Inter-Dev B2B Digital Marketing Agency', 'https://inter-dev.co.il/'))?.display).toBe('Inter-Dev')
    // typeamedia.net and bigfinseo.com: the domain names the full form, which stays.
    expect(brandNames(page('Type A Media', 'https://typeamedia.net/'))?.display).toBe('Type A Media')
    expect(brandNames(page('Big Fin SEO', 'https://bigfinseo.com/'))?.display).toBe('Big Fin SEO')
    // aimclear.com declares "AIMCLEAR®": the mark is not part of the name.
    expect(brandNames(page('AIMCLEAR®', 'https://aimclear.com/'))?.display).toBe('AIMCLEAR')
  })

  it('prefers the page\x27s own spelling of the domain name over a tagline', () => {
    const html = '<html><head><title>Global Ecommerce SEO &amp; GEO | Global Ecommerce SEO &amp; GEO</title></head><body><main><p>Re:signal helps global brands grow. Re:signal works across markets and languages for ecommerce teams with long words to count here.</p></main></body></html>'
    expect(brandNames(extractPage(html, 'https://resignal.com/'))?.display).toBe('Re:signal')
  })
})

describe('3. the opening paragraph comes from the content, not the header menu', () => {
  const NAV_BLURB = 'Insights and strategies for managing contacts, pipelines, and customer relationships at scale'

  it('never reads the mega-menu blurb as a paragraph', () => {
    for (const page of [service, sales, marketing]) expect(page.paragraphs).not.toContain(NAV_BLURB)
  })

  it('quotes the article\x27s own opening under Direct answers', () => {
    const answers = scoreRetrievability({ home: service, access: null, now: NOW }).groups.flatMap((g) => g.checks).find((c) => c.id === 'extract-answers')!
    expect(answers.evidence.map((e) => e.snippet).join(' ')).toContain('Customer service expectations are at an all-time high.')
    expect(answers.evidence.map((e) => e.snippet).join(' ')).not.toContain(NAV_BLURB)
  })
})

describe('4. the two smaller ones', () => {
  it('does not count a placeholder address in example copy as contact details', () => {
    expect(sales.emails).toEqual([])
    expect(signal(sales, 'entity-resolution').detail).not.toMatch(/Contact details/)
  })

  it('rejects an impossible date instead of rolling it into the future', () => {
    expect(parseDate('2026-29-10', 'time[datetime]')).toBeNull()
    expect(parseDate('2026-02-30', 'time[datetime]')).toBeNull()
    expect(parseDate('2026-10-29', 'time[datetime]')?.iso).toBe('2026-10-29')
    for (const page of [sales, marketing]) expect(page.dates.some((d) => d.iso > '2026-11-03')).toBe(false)
  })
})
