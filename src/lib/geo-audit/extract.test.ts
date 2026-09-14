import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractPage, MIN_MEANINGFUL_WORDS } from './extract'

const COMMA_HTML = readFileSync(join(__dirname, '__fixtures__', 'comma-home.html'), 'utf8')
const COMMA_URL = 'https://commadigitalconsultancy.com/'

describe('extractPage — real page (Comma Digital Consultancy homepage)', () => {
  const page = extractPage(COMMA_HTML, COMMA_URL)

  // The old engine truncated at 15,000 characters. This fixture is ~237,000
  // characters and contains no heading at all in the first 15,000 — which is
  // exactly why the shipped report said "no H2/H3 headings detected".
  it('reads content that lies far beyond the old 15k truncation point', () => {
    expect(COMMA_HTML.length).toBeGreaterThan(200_000)
    expect(COMMA_HTML.slice(0, 15_000)).not.toMatch(/<h[1-6][\s>]/i)
    expect(page.wordCount).toBeGreaterThan(1000)
    expect(page.hasMeaningfulContent).toBe(true)
  })

  it('finds the real H1 and H2/H3 elements', () => {
    const h1s = page.headings.filter((h) => h.level === 1)
    expect(h1s).toHaveLength(1)
    expect(h1s[0].text).toContain('SEO Focused Content Marketing Agency')

    const h2s = page.headings.filter((h) => h.level === 2)
    const h3s = page.headings.filter((h) => h.level === 3)
    expect(h2s.length).toBeGreaterThanOrEqual(8)
    expect(h3s.length).toBeGreaterThanOrEqual(8)
    expect(h2s.map((h) => h.text)).toContain('What We Fix First')
    expect(h3s.map((h) => h.text)).toContain('SEO Audit')
  })

  it('finds the numbered sections', () => {
    const numbered = page.headings.filter((h) => /^\s*\d{1,2}[.)]\s*\S/.test(h.text))
    expect(numbered.map((h) => h.text)).toEqual(
      expect.arrayContaining(['1. Visibility', '2. Better Traffic', '3. Conversions']),
    )
  })

  it('finds the About and Blogs links', () => {
    const hrefs = page.links.map((l) => l.absolute)
    expect(hrefs).toContain('https://commadigitalconsultancy.com/about-us/')
    expect(hrefs).toContain('https://commadigitalconsultancy.com/blogs/')
  })

  it('finds the visible contact email', () => {
    expect(page.emails).toContain('connect@commadigitalconsultancy.com')
  })

  it('finds the attributed testimonial', () => {
    expect(page.testimonials.length).toBeGreaterThanOrEqual(1)
    const joined = page.testimonials.map((t) => `${t.quote} ${t.attribution}`).join(' ')
    expect(joined).toMatch(/Cloudline Aviation/i)
  })

  it('reads the testimonial attribution and quote cleanly', () => {
    const t = page.testimonials[0]
    expect(t.attribution).toBe('Founder, Cloudline Aviation')
    // The rating line must not bleed into the attribution.
    expect(t.attribution).not.toMatch(/Rated|\d/)
    // The quote must start at a word boundary, not mid-word.
    expect(t.quote).toMatch(/^Before working with Comma Digital Consultancy/)
  })

  it('reads structured data including array-valued @type inside @graph', () => {
    // "@type": ["OnlineBusiness", "Organization"] nested in an @graph — a naive
    // reader misses both the array form and the graph container.
    expect(page.structuredDataTypes).toEqual(
      expect.arrayContaining(['Organization', 'OnlineBusiness', 'WebSite', 'WebPage']),
    )
  })

  it('reads the publication dates from the markup', () => {
    const isoDates = page.dates.map((d) => d.iso)
    expect(isoDates).toContain('2026-01-26')
    expect(isoDates).toContain('2026-04-12')
  })

  it('finds the social profiles', () => {
    expect(page.socialLinks.join(' ')).toMatch(/linkedin|medium/i)
  })
})

describe('extractPage — headings must be real elements', () => {
  it('ignores elements that merely look like headings', () => {
    const html = `
      <html><body>
        <div class="heading h2 title">Not a heading</div>
        <span class="elementor-heading-title">Also not a heading</span>
        <h2 class="elementor-heading-title">A real heading</h2>
      </body></html>`
    const page = extractPage(html, 'https://example.com/')

    expect(page.headings).toHaveLength(1)
    expect(page.headings[0]).toEqual({ level: 2, text: 'A real heading' })
  })
})

describe('extractPage — thin and broken input', () => {
  it('flags a JavaScript shell as having no meaningful content', () => {
    const html = `<html><head><title>App</title></head><body><div id="root"></div><script>window.go()</script></body></html>`
    const page = extractPage(html, 'https://example.com/')

    expect(page.hasMeaningfulContent).toBe(false)
    expect(page.wordCount).toBeLessThan(MIN_MEANINGFUL_WORDS)
    expect(page.headings).toEqual([])
  })

  it('does not count script or style text as page content', () => {
    const html = `
      <html><body>
        <style>.a{color:red}.b{color:blue}.c{font-family:Georgia,serif}</style>
        <script>var x = "lots and lots of words that are not page content at all";</script>
        <p>Short.</p>
      </body></html>`
    const page = extractPage(html, 'https://example.com/')

    expect(page.mainText).not.toMatch(/color:red|var x/)
    expect(page.hasMeaningfulContent).toBe(false)
  })

  it('survives malformed JSON-LD without counting it as present', () => {
    const html = `
      <html><body>
        <script type="application/ld+json">{ this is not json }</script>
        <p>Some content here.</p>
      </body></html>`
    const page = extractPage(html, 'https://example.com/')

    expect(page.structuredData).toEqual([])
    expect(page.structuredDataTypes).toEqual([])
  })

  it('handles empty input without throwing', () => {
    const page = extractPage('', 'https://example.com/')
    expect(page.hasMeaningfulContent).toBe(false)
    expect(page.wordCount).toBe(0)
  })
})

describe('extractPage — invisible characters', () => {
  it('strips icon-font and zero-width codepoints from extracted text', () => {
    // Page builders inject Private Use Area glyphs (icon fonts) and zero-width
    // spaces into copy. Neither is whitespace, so both survive trimming and
    // would otherwise appear in evidence snippets shown to the user.
    const html = `<html><body><h2>Our Services​</h2><p>We help you.</p></body></html>`
    const page = extractPage(html, 'https://example.com/')

    expect(page.headings[0].text).toBe('Our Services')
    expect(page.paragraphs[0]).toBe('We help you.')
  })
})

describe('extractPage — statistics', () => {
  it('does not mistake section numbers for statistics', () => {
    const html = `<html><body><p>01. SEO Audit is the first step in the process we follow.</p></body></html>`
    expect(extractPage(html, 'https://example.com/').statistics).toEqual([])
  })

  it('recognises a genuine figure in prose', () => {
    const html = `<html><body><p>Organic traffic across the portfolio grew by 42% over the review period.</p></body></html>`
    expect(extractPage(html, 'https://example.com/').statistics.join(' ')).toContain('42%')
  })
})
