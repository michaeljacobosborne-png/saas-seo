import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractPage } from './extract'
import { assessCitability } from './assess-citability'
import { brandReading } from './attribution-names'

/**
 * The brand profile stopped being a gate and became a prompt (2026-11-22). One of
 * the two places the prompt earns its keep is a tracked page where the engine's
 * reading of the site's own name looks uncertain, so the report says how it read
 * the name and whether that name ties to the domain. Descriptive only: no score
 * depends on it.
 */
const page = (ld: unknown[], title: string, url = 'https://acme.example/') =>
  extractPage(
    `<html><head><title>${title}</title>${ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join('')}</head><body><main><h1>Hello</h1><p>${'Words that make a readable page. '.repeat(20)}</p></main></body></html>`,
    url,
  )

describe('brandReading', () => {
  it('is confident when the declared organisation names the domain', () => {
    const r = brandReading(page([{ '@type': 'Organization', name: 'Acme Digital Ltd' }], 'Home | Acme'))
    expect(r).toMatchObject({ display: 'Acme', confident: true, basis: 'organization' })
    expect(r.counted).toContain('Acme')
  })

  it('is confident when the name is only the domain’s own, found in the title', () => {
    const r = brandReading(page([], 'Services | Acme'))
    expect(r.confident).toBe(true)
    expect(r.display).toBe('Acme')
  })

  it('is uncertain when no counted name relates to the domain', () => {
    const r = brandReading(page([], 'Home | Fabrikam'))
    expect(r).toMatchObject({ display: 'Fabrikam', confident: false, basis: 'title' })
  })

  it('is uncertain, with no name, when none could be read', () => {
    const r = brandReading(page([], 'Digital growth specialists for ambitious brands and teams everywhere'))
    expect(r).toEqual({ display: null, counted: [], confident: false, basis: 'none' })
  })

  it('reads a long encyclopedia article as confident: Wikipedia is in its own counted names', () => {
    const html = readFileSync(join(__dirname, '__fixtures__', 'wikipedia-coffee-2026-11-16.html'), 'utf8')
    const r = brandReading(extractPage(html, 'https://en.wikipedia.org/wiki/Coffee'))
    expect(r.confident).toBe(true)
    expect(r.counted).toEqual(expect.arrayContaining(['Wikimedia Foundation', 'Wikipedia']))
  })
})

describe('the report carries the reading', () => {
  it('as citability.brand, beside the six signals, changing none of them', () => {
    const home = page([{ '@type': 'Organization', name: 'Acme' }], 'Home | Acme')
    const c = assessCitability({ home, keyPages: [], now: new Date('2026-11-22T10:00:00Z') })
    expect(c.brand).toMatchObject({ display: 'Acme', confident: true })
    expect(c.signals).toHaveLength(6)
  })
})
