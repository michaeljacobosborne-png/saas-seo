import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractPage } from './extract'
import { assessCitability } from './assess-citability'
import { brandNames, mentionsBrand, organizations, ownOrganizations } from './attribution-names'
import { scoreRetrievability } from './score-retrievability'
import { ENGINE_VERSION } from './types'

/**
 * Three findings the engine got wrong on en.wikipedia.org/wiki/Coffee
 * (re-run 2026-11-16, engine 2026.15), found before anything citing that page
 * went out. Fixture: the page as fetched that day, scripts, styles and images
 * removed. The JSON-LD, the language switcher, the page-tools menu and the
 * category footer are all as served.
 *
 *  1. Brand-claim proximity said "Contributors to Wikimedia projects" (the
 *     Article's author credit) appeared in 2 of 42 sections. That string is on
 *     the page once, in the markup. The 2 sections matched "Wikipedia" in the
 *     page-tools menu and the hidden category list, which the report did not
 *     say, and which are page furniture, not claim text.
 *  2. A brand is the site's own organisation. The author credit, and partner or
 *     client organisations nested in the markup, are not.
 *  3. Structured data validity said "No Organization ... is declared" while
 *     Entity resolution named one. Both read the same JSON-LD.
 */
const html = readFileSync(join(__dirname, '__fixtures__', 'wikipedia-coffee-2026-11-16.html'), 'utf8')
const URL_ = 'https://en.wikipedia.org/wiki/Coffee'
const NOW = new Date('2026-11-16T12:00:00Z')
const coffee = extractPage(html, URL_)
const signal = (home: typeof coffee, id: string) => assessCitability({ home, keyPages: [], now: NOW }).signals.find((s) => s.id === id)!
const structured = (home: typeof coffee) => scoreRetrievability({ home, access: null, now: NOW }).groups.flatMap((g) => g.checks).find((c) => c.id === 'parse-structured-data')!

const page = (body: string, ld: unknown[] = [], title = 'Home') =>
  extractPage(
    `<html><head><title>${title}</title>${ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join('')}</head><body>${body}</body></html>`,
    'https://acme.example/',
  )
const PROSE = 'Our team plans, builds and runs online stores for independent retailers, from the first audit through launch and the months of steady improvement that follow it afterwards.'

describe('the fixture is the page that failed', () => {
  it('declares the author credit and the publisher only as organisations nested in the Article', () => {
    const orgs = organizations(coffee)
    expect(orgs.map((o) => o.name)).toEqual(['Contributors to Wikimedia projects', 'Wikimedia Foundation, Inc.'])
    expect(orgs.every((o) => o.via === 'nested')).toBe(true)
    expect(coffee.structuredDataTypes).toEqual(['Article'])
  })

  it('has 42 substantive sections, the first holding the language switcher and the last the category list', () => {
    const substantive = coffee.blocks.filter((b) => b.wordCount >= 25)
    expect(substantive).toHaveLength(42)
    expect(coffee.blocks[0].text).toContain('Afrikaans')
    expect(coffee.blocks[coffee.blocks.length - 1].text).toContain('Wikipedia indefinitely move-protected pages')
  })
})

describe('1. the finding names what it counted, and menus do not count', () => {
  it('finds no section of body text naming the site: 0 of 42, absent', () => {
    const s = signal(coffee, 'brand-proximity')
    expect(s.band).toBe('absent')
    expect(s.detail).toContain('none of the 42 substantive sections')
    expect(s.detail).not.toMatch(/appears inside/)
  })

  it('does not print the author credit as the brand', () => {
    expect(signal(coffee, 'brand-proximity').detail).not.toContain('Contributors to Wikimedia projects')
  })

  it('prints exactly the names it counted, all of them', () => {
    const names = brandNames(coffee)!
    const detail = signal(coffee, 'brand-proximity').detail
    for (const label of names.counted) expect(detail).toContain(`"${label}"`)
    expect(names.counted.length).toBeGreaterThan(0)
  })

  it('prints a second name when it counts a second name', () => {
    const home = page(`<main><h2>What we do</h2><p>${PROSE} Northwind builds them.</p></main>`, [{ '@type': 'Organization', name: 'Northwind Traders' }], 'Home | Fabrikam')
    const names = brandNames(home)!
    expect(names.counted).toEqual(expect.arrayContaining(['Northwind Traders', 'Fabrikam']))
    const detail = signal(home, 'brand-proximity').detail
    expect(detail).toContain('"Northwind Traders"')
    expect(detail).toContain('"Fabrikam"')
  })

  it('does not count a menu link or a category list inside the main region as a mention', () => {
    const home = page(
      `<main><h1>Welcome</h1><nav><ul><li><a href="/x">Acme shop</a></li><li>${PROSE}</li></ul></nav><h2>Services</h2><p>${PROSE}</p><div class="catlinks"><ul><li>Acme pages ${PROSE}</li></ul></div></main>`,
      [{ '@type': 'Organization', name: 'Acme' }],
    )
    const s = signal(home, 'brand-proximity')
    expect(s.band).toBe('absent')
  })

  it('still counts a claim sitting in a list item', () => {
    const home = page(
      `<main><h2>Services</h2><ul><li>Acme ${PROSE}</li></ul><h2>Process</h2><ul><li>Acme ${PROSE}</li></ul></main>`,
      [{ '@type': 'Organization', name: 'Acme' }],
    )
    const s = signal(home, 'brand-proximity')
    expect(s.band).toBe('strong')
    expect(s.detail).toContain('"Acme" appears inside 2 of 2')
  })
})

describe('2. a brand is the site’s own organisation', () => {
  it('is the publisher, never the author credit', () => {
    expect(ownOrganizations(coffee).map((o) => o.name)).toEqual(['Wikimedia Foundation, Inc.'])
    const names = brandNames(coffee)!
    expect(names.display).toBe('Wikimedia Foundation')
    expect(names.candidates).not.toContain('Contributors to Wikimedia projects')
  })

  it('does not credit a partner or client organisation named in the markup', () => {
    const ld = [
      { '@context': 'https://schema.org', '@type': 'Organization', name: 'Acme', memberOf: { '@type': 'Organization', name: 'Shopify' }, sponsor: { '@type': 'Organization', name: 'Webflow' } },
    ]
    const home = page(`<main><h2>Platforms</h2><p>Shopify ${PROSE}</p><h2>Also</h2><p>Webflow Shopify ${PROSE}</p></main>`, ld)
    expect(brandNames(home)!.candidates).toEqual(['Acme'])
    expect(mentionsBrand('Shopify stores for everyone, built carefully and quickly', brandNames(home)!)).toBe(false)
    const s = signal(home, 'brand-proximity')
    expect(s.band).not.toBe('strong')
    expect(s.detail).not.toMatch(/Shopify|Webflow/)
  })

  it('still reads a publisher organisation declared only by reference', () => {
    const home = page(`<main><p>${PROSE}</p></main>`, [{ '@type': 'Article', headline: 'x', publisher: { '@type': 'Organization', '@id': 'https://acme.example/#org' } }])
    expect(ownOrganizations(home)).toHaveLength(1)
  })
})

describe('3. one definition of "an Organization is declared"', () => {
  it('Structured data validity and Entity resolution agree on Wikipedia', () => {
    const v = structured(coffee)
    expect(v.detail).not.toMatch(/No Organization/)
    expect(v.score).toBe(8)
    const e = signal(coffee, 'entity-resolution')
    expect(e.detail).toContain('Wikimedia Foundation, Inc.')
    expect(e.detail).not.toContain('Contributors to Wikimedia projects')
    expect(v.detail).toContain('Wikimedia Foundation, Inc.')
  })

  it('an organisation named only as author does not say who publishes, and both lines say so', () => {
    const home = page(`<main><p>${PROSE}</p></main>`, [{ '@type': 'Article', headline: 'x', author: { '@type': 'Organization', name: 'Some Contributors' } }])
    const v = structured(home)
    const e = signal(home, 'entity-resolution')
    expect(v.score).toBe(5)
    expect(v.detail).toMatch(/only as author|not as the publisher/i)
    expect(e.detail).toMatch(/only as author|not as the publisher/i)
    expect(e.detail).toContain('Some Contributors')
  })

  it('still scores nothing for entity when no organisation is declared anywhere', () => {
    const home = page(`<main><p>${PROSE}</p></main>`, [{ '@type': 'Article', headline: 'x' }])
    expect(structured(home).detail).toMatch(/No Organization/)
    expect(signal(home, 'entity-resolution').detail).toMatch(/No Organization/)
  })
})

describe('the engine version', () => {
  it('is 2026.16, because scores and findings moved (DECISIONS 43)', () => {
    expect(ENGINE_VERSION).toBe('2026.16')
  })
})

/**
 * Two over-corrections in the first version of the 2026.16 fix, found on 2026-11-17
 * while explaining the three study rows it moved. Both removed names that are
 * the site's own: a header and a footer inside main are that section's own, not
 * the page's, and a declared parent organisation is the same company.
 */
describe('4. what the fix must not throw away', () => {
  it('counts a section intro that sits in a header inside main', () => {
    const home = page(
      `<main><section><header><h2>Platform</h2><p>Acme ${PROSE}</p></header><p>${PROSE}</p></section><section><header><h2>Process</h2><p>Acme ${PROSE}</p></header><p>${PROSE}</p></section></main>`,
      [{ '@type': 'Organization', name: 'Acme' }],
    )
    const s = signal(home, 'brand-proximity')
    expect(s.band).toBe('strong')
    expect(s.detail).toContain('"Acme" appears inside 2 of 2')
  })

  it('counts a closing call to action that sits in a footer inside main', () => {
    const home = page(
      `<main><h2>Services</h2><p>${PROSE}</p><p>${PROSE}</p><footer><p>Acme ${PROSE}</p></footer></main>`,
      [{ '@type': 'Organization', name: 'Acme' }],
    )
    expect(signal(home, 'brand-proximity').band).not.toBe('absent')
  })

  it('still ignores a nav, an aside and a category list', () => {
    const home = page(
      `<main><h2>Services</h2><p>${PROSE}</p><nav><p>Acme ${PROSE}</p></nav><aside><p>Acme ${PROSE}</p></aside><div id="catlinks"><p>Acme ${PROSE}</p></div></main>`,
      [{ '@type': 'Organization', name: 'Acme' }],
    )
    expect(signal(home, 'brand-proximity').band).toBe('absent')
  })

  it('counts the name of a declared parent organisation, which is the same company', () => {
    const home = page(
      `<main><h2>Services</h2><p>Acme Group ${PROSE}</p><h2>Clients</h2><p>Acme Group ${PROSE}</p></main>`,
      [{ '@type': 'Organization', name: 'Acme Group Law Firm Marketing', parentOrganization: { '@type': 'Organization', name: 'Acme Group' } }],
    )
    expect(brandNames(home)!.candidates).toContain('Acme Group')
    expect(signal(home, 'brand-proximity').band).toBe('strong')
  })
})
