import { describe, expect, it } from 'vitest'
import { extractPage } from './extract'
import { assessCitability } from './assess-citability'
import { brandNames, findPeople, isClientFeedback, isPlausibleAttribution, mentionsBrand, nameVariants } from './attribution-names'
import type { KeyPageResult } from './crawl'

/**
 * Every case here is a false finding the engine produced about a real site in
 * the 2026-10-07 outreach audits, rebuilt from that site's own markup. Each one
 * would have put a wrong claim in front of a prospect.
 */

const NOW = new Date('2026-10-07T12:00:00Z')

const page = (url: string, head: string, body: string) =>
  extractPage(`<!doctype html><html><head>${head}</head><body><main>${body}</main></body></html>`, url)

const about = (url: string, head: string, body: string): KeyPageResult => ({
  role: 'about',
  url,
  linkText: 'About',
  page: page(url, head, body),
  ok: true,
  status: 200,
})

const signal = (home: ReturnType<typeof page>, keyPages: KeyPageResult[], id: string) =>
  assessCitability({ home, keyPages, now: NOW }).signals.find((s) => s.id === id)!

const ld = (o: unknown) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`
const prose = (n: number) => ' Lorem ipsum dolor sit amet consectetur.'.repeat(n)

// ── varn.co.uk ───────────────────────────────────────────────────────────────

const VARN_HEAD = `<title>SEO, GEO & Data Agency | Varn</title>${ld({ '@type': 'Organization', name: 'Varn' })}`

// Verbatim structure of varn.co.uk/about-us/ (2026-10-07).
const VARN_STAFF_QUOTES = `
<section class="flexible-section testimonial"><div class="vr-container vr-testimonial"><div class="mixed-content">
<p class="longer-copy text-mblue"> “We’re unashamedly nerdy about SEO, GEO, AI search and data, revelling in the intricacies of algorithms and analytics.” </p>
</div><div class="author-data"><div class="author-content"><p class="name">Tom Vaughton</p><p class="position">CEO at Varn</p></div>
<img src="x.png" alt="Tom, CEO of Varn."></div></div></section>
<section class="flexible-section testimonial"><div class="vr-container vr-testimonial"><div class="mixed-content">
<p class="longer-copy text-mblue"> “We think life is simply too short not to make it fun. We focus on making sure our clients and our team are happy; the result being meaningful partnerships and outstanding delivery of our search, data, SEO and GEO services.” </p>
</div><div class="author-data"><div class="author-content"><p class="name">Vicky Walker</p><p class="position">Comms Director</p></div>
<img src="y.png" alt="Vicky, Comms Director at Varn."></div></div></section>`

describe('varn.co.uk: the About page names the CEO', () => {
  it('finds Tom Vaughton as a person of the organisation', () => {
    const p = page('https://varn.co.uk/about-us/', VARN_HEAD, `<h1>About us</h1><p>${prose(6)}</p>${VARN_STAFF_QUOTES}`)
    const people = findPeople(p, brandNames(p))
    expect(people.map((x) => x.name)).toContain('Tom Vaughton')
    expect(people.find((x) => x.name === 'Tom Vaughton')!.source).toBe('staff-quote')
  })

  it('no longer reports named authorship as absent', () => {
    const home = page('https://varn.co.uk/', VARN_HEAD, `<h1>Specialist SEO, GEO, data & analytics agency</h1><p>${prose(8)}</p>`)
    const s = signal(home, [about('https://varn.co.uk/about-us/', VARN_HEAD, `<h1>About us</h1><p>${prose(6)}</p>${VARN_STAFF_QUOTES}`)], 'named-authorship')
    expect(s.band).not.toBe('absent')
    expect(s.detail).toContain('Tom Vaughton')
  })

  it("does not count the CEO's own quote as client feedback", () => {
    const home = page('https://varn.co.uk/', VARN_HEAD, `<h1>Varn</h1><p>${prose(8)}</p>${VARN_STAFF_QUOTES}`)
    const s = signal(home, [], 'original-evidence')
    expect(s.detail).not.toMatch(/client feedback/i)
    expect(s.detail).not.toContain('Tom Vaughton')
  })
})

// ── withcandour.co.uk ────────────────────────────────────────────────────────

const CANDOUR_HEAD =
  '<title>SEO & AI Agency: Digital growth specialists</title>' +
  ld({ '@graph': [{ '@type': 'Organization', name: 'Candour Agency Ltd' }, { '@type': 'WebSite', name: 'Candour' }] })

describe('withcandour.co.uk: the brand is "Candour", not "Candour Agency Ltd"', () => {
  it('derives the trading name from the legal one', () => {
    expect(nameVariants('Candour Agency Ltd')).toEqual(['Candour Agency Ltd', 'Candour Agency', 'Candour'])
    expect(nameVariants('Zelst Limited')).toEqual(['Zelst Limited', 'Zelst'])
  })

  it('finds the brand in the copy and reports it by its trading name', () => {
    const home = page(
      'https://withcandour.co.uk/',
      CANDOUR_HEAD,
      `<h2>A not award-winning agency</h2><p>Candour is a digital agency which places results for our clients over plaudits for us. We will work with you as transparent, frank partners. Our approach embraces feedback and open conversation as a foundation for brilliant work.</p>
       <h2>Talk to us about organic results</h2><p>Candour builds brands, develops websites and drives business results with search engine optimisation, digital PR and design for ambitious organisations across the UK and beyond.</p>`,
    )
    const s = signal(home, [], 'brand-proximity')
    expect(s.band).toBe('strong')
    expect(s.detail).toContain('"Candour"')
    expect(s.detail).not.toContain('Ltd')
  })

  it('matches the short form with its capital, so the noun "candour" is not the brand', () => {
    const b = brandNames(page('https://withcandour.co.uk/', CANDOUR_HEAD, '<p>x</p>'))!
    expect(mentionsBrand('Candour is a digital agency', b)).toBe(true)
    expect(mentionsBrand('we value candour in feedback', b)).toBe(false)
  })
})

// ── zelst.co.uk ──────────────────────────────────────────────────────────────

const ZELST_HEAD = `<title>Seen Everywhere Optimisation | Zelst</title>${ld({ '@type': 'LocalBusiness', name: 'Zelst Limited' })}`
const ZELST_SECTION = `<h2>SEO + Content + Social Media + AI + PPC = Seen Everywhere Optimisation</h2>
<p>Zelst’s proven methodology positions your brand everywhere your audience is searching for answers, across search engines, social platforms and AI assistants alike, so you are found wherever the question is asked.</p>`

describe('zelst.co.uk: brand, founder and coined term', () => {
  it('finds "Zelst" in the copy although the declared name is "Zelst Limited"', () => {
    const home = page('https://www.zelst.co.uk/', ZELST_HEAD, `<h1>Seen Everywhere Optimisation</h1>${ZELST_SECTION}${ZELST_SECTION}`)
    const s = signal(home, [], 'brand-proximity')
    expect(s.band).not.toBe('absent')
    expect(s.detail).toContain('"Zelst"')
  })

  it('reads the founder as "Peter Van Zelst", not "Peter Van"', () => {
    const p = page(
      'https://www.zelst.co.uk/about-us/',
      ZELST_HEAD,
      '<p>Zelst is one of the longest-standing and most experienced digital marketing agencies in the UK, founded in 2006 by Peter Van Zelst. We specialise in search.</p>',
    )
    expect(findPeople(p, brandNames(p)).map((x) => x.name)).toEqual(['Peter Van Zelst'])
  })

  it('does not treat an agency sentence that mentions the founder as his credential', () => {
    const home = page('https://www.zelst.co.uk/', ZELST_HEAD, `<p>${prose(8)}</p>`)
    const s = signal(
      home,
      [about('https://www.zelst.co.uk/about-us/', ZELST_HEAD, '<p>Zelst is one of the longest-standing and most experienced digital marketing agencies in the UK, founded in 2006 by Peter Van Zelst. We specialise in search, social and paid media for ambitious brands.</p>')],
      'named-authorship',
    )
    expect(s.band).toBe('adequate')
    expect(s.detail).toContain('Peter Van Zelst')
  })

  it('credits "Seen Everywhere Optimisation" even when the next sentence starts with the brand', () => {
    const home = page('https://www.zelst.co.uk/', ZELST_HEAD, `<h1>Seen Everywhere Optimisation</h1>${ZELST_SECTION}${ZELST_SECTION}${ZELST_SECTION}`)
    const s = signal(home, [], 'proprietary-terms')
    expect(s.band).not.toBe('absent')
    expect(s.detail).toContain('Seen Everywhere Optimisation')
  })
})

// ── screamingfrog.co.uk ──────────────────────────────────────────────────────

const SF_HEAD = `<title>Screaming Frog | SEO Agency & SEO Software</title>${ld({ '@type': 'Organization', name: 'Screaming Frog' })}`
const sfTeaser = (date: string, author: string, title: string, excerpt: string) => `
<div class="sf-post-preview__content"><p class="sf-post-preview__post-info"> ${date} by ${author} </p>
<h2 class="sf-post-preview__title"><a href="/blog/x/">${title}</a></h2>
<p>${excerpt}... &nbsp;<a href="/blog/x/">Continue Reading</a></p></div>`
const SF_BLOG = [
  sfTeaser('9 September, 2026', 'Mark Porter', "Screaming Frog Crawling Clinic Returns to brightonSEO San Diego '26!", "We're packing our bags for our 4th trip to San Diego, heading back to one of our favourite events of the year: brightonSEO San Diego"),
  sfTeaser('19 May, 2026', 'Dan Sharp', 'Screaming Frog SEO Spider Update – Version 24.0', 'We are delighted to announce the release of version 24.0 with lots of smaller quality of life improvements'),
  sfTeaser('29 April, 2026', 'Dan Sharp', 'Screaming Frog Log File Analyser Update – Version 7.0', 'Upload raw server log files, verify bots, and get valuable insight into crawling'),
].join('')

describe('screamingfrog.co.uk: bylines, UI labels and places', () => {
  it('finds the dated bylines as named people', () => {
    const p = page('https://www.screamingfrog.co.uk/', SF_HEAD, SF_BLOG)
    const names = findPeople(p, brandNames(p)).map((x) => x.name)
    expect(names).toContain('Mark Porter')
    expect(names).toContain('Dan Sharp')
    expect(names).not.toContain('Dan Sharp Screaming')
  })

  it('does not credit "Continue Reading" or "San Diego" as coined terms', () => {
    const home = page('https://www.screamingfrog.co.uk/', SF_HEAD, `<h1>We are a UK based SEO agency</h1><p>${prose(6)}</p>${SF_BLOG}`)
    const s = signal(home, [], 'proprietary-terms')
    expect(s.detail).not.toContain('Continue Reading')
    expect(s.detail).not.toContain('San Diego')
    expect(s.detail).not.toContain('Dan Sharp')
  })

  it("does not take a client's quote on the About page as the agency's own person", () => {
    const p = page(
      'https://www.screamingfrog.co.uk/about/',
      SF_HEAD,
      `<div class="sf-quotation"><p class="sf-quotation__quote"> Screaming Frog have shown great flexibility in solving the unique problems facing our company. Even better, they always have the skillset required to deal with the problem at hand. </p>
       <div class="sf-quotation__source sf-quotation__source--client"><div class="sf-quotation__source-details"><p class="sf-quotation__source-name"> Will Hodson </p><p class="sf-quotation__source-role"> Co-Founder &#8211; The Big Deal </p></div></div></div>`,
    )
    expect(findPeople(p, brandNames(p)).map((x) => x.name)).not.toContain('Will Hodson')
  })
})

// ── salt.agency ──────────────────────────────────────────────────────────────

describe('salt.agency: a nav menu is not a testimonial', () => {
  it('rejects an "attribution" that is a run of menu labels', () => {
    expect(isPlausibleAttribution({ quote: 'x'.repeat(60), attribution: 'Manager GSC BigQuery SQL Hero Hreflang Checker Server Log File Goog' })).toBe(false)
  })

  it('keeps real attributions, named or role-and-company', () => {
    expect(isPlausibleAttribution({ quote: 'x', attribution: 'Simon Goble, Dogbuddy' })).toBe(true)
    expect(isPlausibleAttribution({ quote: 'x', attribution: 'Founder, Cloudline Aviation' })).toBe(true)
  })
})

describe('client feedback needs a named client', () => {
  const sf = { candidates: ['Screaming Frog'], display: 'Screaming Frog' }
  it('counts a quote naming an outside company (screamingfrog.co.uk)', () => {
    expect(isClientFeedback({ quote: 'x', attribution: 'Simon Goble, Dogbuddy' }, sf)).toBe(true)
    expect(isClientFeedback({ quote: 'x', attribution: 'Founder, Cloudline Aviation' }, sf)).toBe(true)
  })
  it('does not count a name and a role with no company (varn.co.uk, Vicky Walker)', () => {
    const varn = { candidates: ['Varn'], display: 'Varn' }
    expect(isClientFeedback({ quote: 'x', attribution: 'Vicky Walker Comms Director' }, varn)).toBe(false)
    expect(isClientFeedback({ quote: 'x', attribution: 'Tom Vaughton CEO at Varn' }, varn)).toBe(false)
  })
})

// ── yesoptimist.com ──────────────────────────────────────────────────────────

describe('yesoptimist.com: a named framework in heading case', () => {
  const head = `<title>SEO & AEO Consulting | Optimist</title>${ld({ '@type': 'Organization', name: 'Optimist' })}`

  it('credits "The Complete Organic Revenue Engine (CORE) Framework"', () => {
    const home = page('https://www.yesoptimist.com/', head, `<h2>The Complete Organic Revenue Engine (CORE) Framework</h2><p>${prose(6)}</p>`)
    const s = signal(home, [], 'proprietary-terms')
    expect(s.band).toBe('strong')
    expect(s.detail).toContain('Complete Organic Revenue Engine (CORE) Framework')
  })

  it('does not credit a generic heading like "The Content Process"', () => {
    const home = page('https://www.yesoptimist.com/', head, `<h2>The Content Process</h2><p>${prose(6)}</p>`)
    expect(signal(home, [], 'proprietary-terms').band).not.toBe('strong')
  })
})
