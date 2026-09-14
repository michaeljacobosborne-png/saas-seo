/**
 * HTML → structured evidence.
 *
 * Everything the scorers reason about comes from here. Nothing downstream sees
 * raw HTML, so a finding can only be made about something actually found in the
 * document. Headings are real h1–h6 elements — a div with a "heading" class is
 * not a heading, and is deliberately not counted.
 */

import * as cheerio from 'cheerio'
import type { AnyNode, Element } from 'domhandler'
import { parseDate, type ExtractedDate } from './dates'

export interface Heading {
  level: number
  text: string
}

export interface PageLink {
  href: string
  /** Resolved against the page URL; empty when unresolvable. */
  absolute: string
  text: string
  internal: boolean
  rel: string
}

export interface ListBlock {
  ordered: boolean
  items: string[]
}

export interface TableBlock {
  caption: string
  headerCells: string[]
  rowCount: number
}

export interface StructuredDataNode {
  /** Normalised list of @type values — schema.org allows arrays here. */
  types: string[]
  raw: Record<string, unknown>
  source: 'json-ld' | 'microdata'
}

export interface Testimonial {
  quote: string
  attribution: string
}

export interface ExtractedPage {
  url: string
  title: string
  metaDescription: string
  lang: string
  canonical: string
  headings: Heading[]
  /** Text of the main content region, nav/header/footer removed where possible. */
  mainText: string
  /** Text of the whole body, used only as a fallback. */
  bodyText: string
  wordCount: number
  paragraphs: string[]
  links: PageLink[]
  lists: ListBlock[]
  tables: TableBlock[]
  structuredData: StructuredDataNode[]
  structuredDataTypes: string[]
  dates: ExtractedDate[]
  emails: string[]
  phones: string[]
  socialLinks: string[]
  boldTerms: string[]
  images: { alt: string; src: string }[]
  testimonials: Testimonial[]
  /** Numbers appearing in the prose, e.g. "156%", "3 steps", "2,400 users". */
  statistics: string[]
  /** Outbound links that look like citations to third-party sources. */
  outboundCitations: PageLink[]
  /**
   * False when the page yielded too little readable text to assess. The engine
   * reports an incomplete audit rather than scoring a page it could not read.
   */
  hasMeaningfulContent: boolean
}

/** Below this word count in the main content we treat extraction as failed. */
export const MIN_MEANINGFUL_WORDS = 60

const SOCIAL_HOSTS = [
  'linkedin.com', 'twitter.com', 'x.com', 'facebook.com', 'instagram.com',
  'youtube.com', 'medium.com', 'github.com', 'tiktok.com', 'threads.net',
]

const BOILERPLATE_SELECTORS = 'script,style,noscript,template,svg,iframe,object,embed'

export function extractPage(html: string, pageUrl: string): ExtractedPage {
  const $ = cheerio.load(html)

  const title = text($('head > title').first())
  const metaDescription = attr($, 'meta[name="description"]', 'content')
  const lang = $('html').attr('lang')?.trim() ?? ''
  const canonical = attr($, 'link[rel="canonical"]', 'href')

  // Structured data must be read before we strip <script> tags.
  const structuredData = [...extractJsonLd($), ...extractMicrodata($)]
  const structuredDataTypes = unique(structuredData.flatMap((n) => n.types))
  const dates = extractDates($, structuredData)

  // Headings are read from the live DOM, not from class names.
  const headings: Heading[] = $('h1,h2,h3,h4,h5,h6')
    .toArray()
    .map((el) => ({
      level: Number((el as Element).tagName.slice(1)),
      text: normalise($(el).text()),
    }))
    .filter((h) => h.text.length > 0)

  const links = extractLinks($, pageUrl)
  const images = $('img')
    .toArray()
    .map((el) => ({ alt: normalise($(el).attr('alt') ?? ''), src: $(el).attr('src') ?? '' }))
    .filter((i) => i.src)

  // Strip non-content nodes before reading text.
  $(BOILERPLATE_SELECTORS).remove()

  const bodyText = normalise($('body').text())
  const mainText = extractMainText($) || bodyText
  const wordCount = countWords(mainText)

  const paragraphs = $('p')
    .toArray()
    .map((el) => normalise($(el).text()))
    .filter((p) => p.length > 0)

  const lists: ListBlock[] = $('ul,ol')
    .toArray()
    .map((el) => ({
      ordered: (el as Element).tagName === 'ol',
      items: $(el)
        .children('li')
        .toArray()
        .map((li) => normalise($(li).text()))
        .filter(Boolean),
    }))
    .filter((l) => l.items.length > 0)

  const tables: TableBlock[] = $('table')
    .toArray()
    .map((el) => ({
      caption: normalise($(el).find('caption').first().text()),
      headerCells: $(el)
        .find('th')
        .toArray()
        .map((th) => normalise($(th).text()))
        .filter(Boolean),
      rowCount: $(el).find('tr').length,
    }))

  const boldTerms = unique(
    $('strong,b')
      .toArray()
      .map((el) => normalise($(el).text()))
      .filter((t) => t.length > 1 && t.length < 80),
  )

  const emails = unique([
    ...links.filter((l) => l.href.startsWith('mailto:')).map((l) => l.href.slice(7).split('?')[0]),
    ...(bodyText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? []),
  ]).filter((e) => e.includes('@'))

  const phones = unique([
    ...links.filter((l) => l.href.startsWith('tel:')).map((l) => l.href.slice(4)),
    ...(bodyText.match(/(?:\+\d{1,3}[\s.-]?)?\(?\d{3,5}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g) ?? []).filter(
      (p) => p.replace(/\D/g, '').length >= 9,
    ),
  ])

  const socialLinks = unique(
    links.filter((l) => SOCIAL_HOSTS.some((h) => hostOf(l.absolute).endsWith(h))).map((l) => l.absolute),
  )

  return {
    url: pageUrl,
    title,
    metaDescription,
    lang,
    canonical,
    headings,
    mainText,
    bodyText,
    wordCount,
    paragraphs,
    links,
    lists,
    tables,
    structuredData,
    structuredDataTypes,
    dates,
    emails,
    phones,
    socialLinks,
    boldTerms,
    images,
    testimonials: extractTestimonials($, cheerio.load(html)),
    statistics: extractStatistics(paragraphs.length ? paragraphs : [mainText]),
    outboundCitations: links.filter(
      (l) => !l.internal && l.absolute.startsWith('http') && !SOCIAL_HOSTS.some((h) => hostOf(l.absolute).endsWith(h)),
    ),
    hasMeaningfulContent: wordCount >= MIN_MEANINGFUL_WORDS,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type Cheerio = cheerio.CheerioAPI

function text(sel: cheerio.Cheerio<AnyNode>): string {
  return normalise(sel.text())
}

function attr($: Cheerio, selector: string, name: string): string {
  return normalise($(selector).first().attr(name) ?? '')
}

export function normalise(s: string): string {
  return (s ?? '')
    // Zero-width and BOM characters are not matched by \s but show up as stray
    // gaps in extracted copy — page builders emit them constantly.
    .replace(/[\u200B-\u200D\uFEFF\u2060]/g, '')
    // Private Use Area codepoints are icon-font glyphs (Font Awesome, Elementor
    // icons and similar). They carry no text, but they are not whitespace, so
    // they survive trimming and pollute every snippet we quote as evidence.
    .replace(/[\uE000-\uF8FF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)]
}

export function countWords(s: string): number {
  const t = normalise(s)
  return t ? t.split(' ').length : 0
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return ''
  }
}

function extractLinks($: Cheerio, pageUrl: string): PageLink[] {
  const base = safeUrl(pageUrl)
  const baseHost = base ? base.hostname.toLowerCase().replace(/^www\./, '') : ''

  return $('a[href]')
    .toArray()
    .map((el) => {
      const href = ($(el).attr('href') ?? '').trim()
      let absolute = ''
      if (base && href && !/^(mailto:|tel:|javascript:|#)/i.test(href)) {
        try {
          absolute = new URL(href, base).toString()
        } catch {
          absolute = ''
        }
      }
      return {
        href,
        absolute,
        text: normalise($(el).text()),
        internal: absolute ? hostOf(absolute) === baseHost : false,
        rel: ($(el).attr('rel') ?? '').trim(),
      }
    })
    .filter((l) => l.href)
}

function safeUrl(url: string): URL | null {
  try {
    return new URL(url)
  } catch {
    return null
  }
}

/**
 * Prefer a real content region so site-wide chrome (nav menus, footers) does not
 * masquerade as page content. Falls back to body-minus-chrome, then to null.
 */
function extractMainText($: Cheerio): string {
  for (const selector of ['main', 'article', '[role="main"]', '#content', '.entry-content']) {
    const node = $(selector).first()
    if (node.length) {
      const t = normalise(node.text())
      if (countWords(t) >= MIN_MEANINGFUL_WORDS) return t
    }
  }

  const body = $('body').clone()
  body.find('nav,header,footer,aside,[role="navigation"],[role="banner"],[role="contentinfo"]').remove()
  const t = normalise(body.text())
  return countWords(t) >= MIN_MEANINGFUL_WORDS ? t : ''
}

function extractJsonLd($: Cheerio): StructuredDataNode[] {
  const nodes: StructuredDataNode[] = []

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text().trim()
    if (!raw) return
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return // Malformed JSON-LD is simply not counted as present.
    }
    for (const node of flattenJsonLd(parsed)) {
      const types = typesOf(node)
      if (types.length) nodes.push({ types, raw: node, source: 'json-ld' })
    }
  })

  return nodes
}

/** Walks @graph containers and arrays so nested entities are not missed. */
function flattenJsonLd(value: unknown, depth = 0): Record<string, unknown>[] {
  if (depth > 6 || value == null) return []
  if (Array.isArray(value)) return value.flatMap((v) => flattenJsonLd(v, depth + 1))
  if (typeof value !== 'object') return []

  const obj = value as Record<string, unknown>
  const out: Record<string, unknown>[] = []
  if (typesOf(obj).length) out.push(obj)
  if (obj['@graph']) out.push(...flattenJsonLd(obj['@graph'], depth + 1))
  return out
}

/** schema.org allows `@type` to be a string or an array of strings. */
function typesOf(obj: Record<string, unknown>): string[] {
  const t = obj['@type']
  if (typeof t === 'string') return [t]
  if (Array.isArray(t)) return t.filter((x): x is string => typeof x === 'string')
  return []
}

function extractMicrodata($: Cheerio): StructuredDataNode[] {
  return $('[itemscope][itemtype]')
    .toArray()
    .map((el) => {
      const itemtype = ($(el).attr('itemtype') ?? '').trim()
      const type = itemtype.split('/').pop() ?? ''
      const props: Record<string, unknown> = {}
      $(el)
        .find('[itemprop]')
        .slice(0, 40)
        .each((_, propEl) => {
          const name = ($(propEl).attr('itemprop') ?? '').trim()
          if (!name) return
          props[name] =
            $(propEl).attr('content') ?? $(propEl).attr('datetime') ?? normalise($(propEl).text())
        })
      return { types: type ? [type] : [], raw: props, source: 'microdata' as const }
    })
    .filter((n) => n.types.length > 0)
}

function extractDates($: Cheerio, structuredData: StructuredDataNode[]): ExtractedDate[] {
  const found: ExtractedDate[] = []
  const push = (raw: unknown, source: string) => {
    if (typeof raw !== 'string') return
    const d = parseDate(raw, source)
    if (d) found.push(d)
  }

  for (const node of structuredData) {
    for (const key of ['datePublished', 'dateModified', 'dateCreated', 'uploadDate']) {
      push(node.raw[key], `${node.source}:${key}`)
    }
  }

  for (const name of [
    'article:published_time',
    'article:modified_time',
    'og:updated_time',
    'date',
    'last-modified',
  ]) {
    push($(`meta[property="${name}"], meta[name="${name}"]`).first().attr('content'), `meta:${name}`)
  }

  $('time[datetime]').each((_, el) => push($(el).attr('datetime'), 'time[datetime]'))

  return found
}

/**
 * Testimonials are recognised from schema (Review/Testimonial), from blockquotes
 * with a cited source, and from explicitly labelled feedback sections. A quote
 * without attribution is not counted — attribution is what makes it citable.
 */
function extractTestimonials($stripped: Cheerio, $full: Cheerio): Testimonial[] {
  const out: Testimonial[] = []

  $full('[itemtype*="Review" i], [class*="testimonial" i], [class*="review" i]')
    .slice(0, 20)
    .each((_, el) => {
      const quote = normalise($full(el).find('p,q,blockquote').first().text() || $full(el).text())
      const attribution = normalise(
        $full(el).find('cite,[itemprop="author"],[class*="author" i],[class*="name" i]').first().text(),
      )
      if (quote.length > 40 && attribution) out.push({ quote: truncate(quote, 400), attribution })
    })

  $stripped('blockquote').slice(0, 20).each((_, el) => {
    const quote = normalise($stripped(el).text())
    const attribution = normalise($stripped(el).find('cite,footer').first().text())
    if (quote.length > 40 && attribution) out.push({ quote: truncate(quote, 400), attribution })
  })

  out.push(...findFeedbackSections($stripped))

  return dedupeTestimonials(out).slice(0, 5)
}

const FEEDBACK_MARKER =
  /\b(testimonial|client feedback|customer feedback|what (?:our )?(?:clients?|customers?) say|rated \d(?:\.\d)? out of \d|★|reviews?)\b/i

const ATTRIBUTION =
  /\b(?:founder|co-founder|ceo|cto|cmo|coo|director|owner|manager|head of|president|partner|principal)\b[^.|]{0,60}/i

/**
 * Finds testimonial blocks that carry no schema and no `testimonial` class —
 * the common case on page builders, where the section is identified only by a
 * label like "Client Feedback" and an attribution line.
 *
 * We take the SMALLEST element containing both a feedback marker and a role
 * attribution, so the match is the testimonial widget rather than the whole page.
 */
function findFeedbackSections($: Cheerio): Testimonial[] {
  const candidates: { el: Element; text: string }[] = []

  $('section,div,article,aside').each((_, el) => {
    const text = normalise($(el).text())
    if (text.length < 120 || text.length > 2500) return
    if (!FEEDBACK_MARKER.test(text) || !ATTRIBUTION.test(text)) return
    candidates.push({ el: el as Element, text })
  })

  if (candidates.length === 0) return []

  candidates.sort((a, b) => a.text.length - b.text.length)
  const best = candidates[0]

  const attributionMatch = best.text.match(ATTRIBUTION)
  if (!attributionMatch) return []
  // Stop the attribution before a rating line or any figure that follows it,
  // otherwise "Founder, Cloudline Aviation" swallows "Rated 5 out of 5".
  const attribution = normalise(attributionMatch[0].split(/\s+Rated\b|\s+\d/i)[0])

  // The quote is what remains once the section label, heading, rating line and
  // attribution are removed.
  const headings = $(best.el)
    .find('h1,h2,h3,h4,h5,h6')
    .toArray()
    .map((h) => normalise($(h).text()))

  let quote = best.text
  for (const h of headings) quote = quote.replace(h, ' ')
  // Remove the trimmed attribution, not the greedy regex match — the match runs
  // past the attribution and would take the start of the quote with it.
  quote = quote
    .replace(attribution, ' ')
    .replace(/\brated \d(?:\.\d)? out of \d\b/i, ' ')
    .replace(/\b(client|customer) feedback\b/i, ' ')
  quote = normalise(quote)

  // Removing text from the middle can leave a partial word at the front; keep
  // only from the first proper sentence start so the quote reads correctly.
  const sentenceStart = quote.search(/[A-Z]/)
  if (sentenceStart > 0) quote = quote.slice(sentenceStart)

  if (quote.length < 80) return []
  return [{ quote: truncate(quote, 400), attribution }]
}

function dedupeTestimonials(items: Testimonial[]): Testimonial[] {
  const seen = new Set<string>()
  return items.filter((t) => {
    const key = t.quote.slice(0, 80).toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Sentences carrying a concrete figure. Years, list ordinals and bare prices
 * are excluded — "01. SEO Audit" is a section number, not a statistic.
 */
function extractStatistics(blocks: string[]): string[] {
  const out: string[] = []
  const pattern = /\b\d{1,3}(?:,\d{3})+|\b\d+(?:\.\d+)?\s?(?:%|percent|x\b)|\b\d+(?:\.\d+)?\s?(?:million|billion|thousand|k\b)/i

  for (const block of blocks) {
    for (const sentence of block.split(/(?<=[.!?])\s+/)) {
      const s = normalise(sentence)
      if (s.length < 20 || s.length > 300) continue
      if (!pattern.test(s)) continue
      if (/^\d{1,2}[.)]\s/.test(s)) continue // numbered list item
      out.push(truncate(s, 240))
      if (out.length >= 12) return out
    }
  }
  return out
}

export function truncate(s: string, max: number): string {
  const t = normalise(s)
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`
}
