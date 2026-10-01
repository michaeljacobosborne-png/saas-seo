/**
 * Derive a brand profile draft from the customer's live site.
 *
 * Onboarding asks for one URL and fills in everything it can, so the user only
 * corrects rather than composes. Two kinds of value come out of here:
 *
 * - **Read** values (name, website, description) come straight from the page's
 *   own markup, and carry the markup they came from as evidence.
 * - **Suggested** values (industry, audience, tone, goals, keywords) are a
 *   model's reading of the page. Each is shown as a suggestion to confirm, and
 *   carries a quote from the page only when that quote is verifiably on it.
 *
 * Nothing here scores anything.
 */

import type { ExtractedPage } from '@/lib/geo-audit/extract'
import {
  type CrawlerAccessReport,
  type CrawlerProbe,
  isPolicyBlock,
} from '@/lib/geo-audit/crawler-access'

export type FieldSource = 'json-ld' | 'og:site_name' | 'title' | 'meta-description' | 'meta-author' | 'url' | 'page-text' | 'model'

export interface DerivedField<T = string> {
  value: T
  source: FieldSource
  /** The page text the value rests on. Null for a suggestion with no verified quote. */
  evidence: string | null
  /** True when a model suggested it rather than it being read from markup. */
  suggested: boolean
}

export interface DerivedProfile {
  website_url: DerivedField
  brand_name: DerivedField | null
  description: DerivedField | null
  /** Read from the site's own markup when it names an author. */
  author_name: DerivedField | null
  industry: DerivedField | null
  target_audience: DerivedField | null
  tone_notes: DerivedField | null
  content_goals: DerivedField | null
  primary_keywords: DerivedField<string[]> | null
}

// ── Read from markup ──────────────────────────────────────────────────────────

const TITLE_SEPARATORS = /\s+[|–—\-:·•]\s+/

function letters(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function hostLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return letters(host.split('.')[0] ?? '')
  } catch {
    return ''
  }
}

function orgName(page: ExtractedPage): string | null {
  for (const type of ['Organization', 'Corporation', 'LocalBusiness', 'WebSite']) {
    const node = page.structuredData.find((n) => n.types.some((t) => t === type || t.endsWith(type)))
    const name = node?.raw.name
    if (typeof name === 'string' && name.trim()) return name.trim()
  }
  return null
}

function ogSiteName(html: string): string | null {
  const m =
    html.match(/<meta[^>]+property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:site_name["']/i)
  return m?.[1]?.trim() || null
}

/**
 * The brand name from a <title>, which is usually "Name | Tagline" or
 * "Page — Name". Prefer the segment that matches the domain; otherwise the
 * shortest, which is the name far more often than it is the tagline.
 */
export function brandFromTitle(title: string, url: string): string | null {
  const segments = title.split(TITLE_SEPARATORS).map((s) => s.trim()).filter(Boolean)
  if (!segments.length) return null
  const label = hostLabel(url)
  const matching = label ? segments.find((s) => letters(s) === label || (letters(s).length >= 3 && label.includes(letters(s)))) : undefined
  if (matching) return matching
  if (segments.length === 1) return segments[0].length <= 40 ? segments[0] : null
  return [...segments].sort((a, b) => a.length - b.length)[0]
}

export function readIdentity(page: ExtractedPage, html: string, finalUrl: string) {
  let origin = finalUrl
  try {
    origin = new URL(finalUrl).origin
  } catch {
    /* keep as given */
  }

  const website_url: DerivedField = { value: origin, source: 'url', evidence: finalUrl, suggested: false }

  let brand_name: DerivedField | null = null
  const fromLd = orgName(page)
  const fromOg = ogSiteName(html)
  const fromTitle = page.title ? brandFromTitle(page.title, finalUrl) : null
  if (fromLd) brand_name = { value: fromLd, source: 'json-ld', evidence: `"name": "${fromLd}"`, suggested: false }
  else if (fromOg) brand_name = { value: fromOg, source: 'og:site_name', evidence: `og:site_name = ${fromOg}`, suggested: false }
  else if (fromTitle) brand_name = { value: fromTitle, source: 'title', evidence: `<title>${page.title}</title>`, suggested: false }

  const description: DerivedField | null = page.metaDescription
    ? { value: page.metaDescription, source: 'meta-description', evidence: page.metaDescription, suggested: false }
    : null

  return { website_url, brand_name, description, author_name: readAuthor(page, html) }
}

/**
 * A named author, when the site states one: a Person node in structured data,
 * or `<meta name="author">`. Offered for the user to confirm; on the live page
 * the byline is verified again by the audit (decision 17).
 */
function readAuthor(page: ExtractedPage, html: string): DerivedField | null {
  const person = page.structuredData.find((n) => n.types.some((t) => /^Person$/i.test(t)) && typeof n.raw.name === 'string')
  const name = typeof person?.raw.name === 'string' ? person.raw.name.trim() : ''
  if (name && !name.includes('@')) return { value: name, source: 'json-ld', evidence: `Person: ${name}`, suggested: false }
  const meta =
    html.match(/<meta[^>]+name=["']author["'][^>]*content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*name=["']author["']/i)
  const fromMeta = meta?.[1]?.trim()
  if (fromMeta && fromMeta.length <= 80 && !fromMeta.includes('@')) {
    return { value: fromMeta, source: 'meta-author', evidence: `<meta name="author" content="${fromMeta}">`, suggested: false }
  }
  return null
}

// ── Model suggestions ─────────────────────────────────────────────────────────

export const SUGGEST_FIELDS = ['industry', 'target_audience', 'tone_notes', 'content_goals'] as const

/** The page text a model sees. Bounded so the call stays cheap. */
export function pageDigest(page: ExtractedPage): string {
  const headings = page.headings.slice(0, 20).map((h) => `${'#'.repeat(h.level)} ${h.text}`).join('\n')
  const text = (page.mainText || page.bodyText).slice(0, 3500)
  return `TITLE: ${page.title}\nDESCRIPTION: ${page.metaDescription}\nHEADINGS:\n${headings}\n\nTEXT:\n${text}`
}

export const SUGGEST_PROMPT = `You read a company's homepage and draft its brand profile for a content-writing tool. The user will review every field.

Return ONLY a JSON object with these keys. Each of the first four is {"value": string, "quote": string}, where "quote" is a short phrase copied EXACTLY from the page text that the value is based on, or "" if there is none.
- industry: the market or category, 2-6 words
- target_audience: who the site is written for, one sentence
- tone_notes: how the site sounds, one sentence of concrete style notes
- content_goals: what content on this site is trying to achieve, one sentence
- primary_keywords: array of 3-6 search phrases a buyer would type, lowercase

Use "" for any value the page does not support. Do not invent facts, customers or numbers.`

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * Parse the model's JSON into suggestions. A quote is kept as evidence only if
 * it is actually on the page; a value with no support is still offered, but
 * with no evidence, so the UI can show it as an unverified suggestion.
 */
export function parseSuggestions(raw: string, page: ExtractedPage): Pick<DerivedProfile, (typeof SUGGEST_FIELDS)[number] | 'primary_keywords'> {
  const out: Pick<DerivedProfile, (typeof SUGGEST_FIELDS)[number] | 'primary_keywords'> = {
    industry: null,
    target_audience: null,
    tone_notes: null,
    content_goals: null,
    primary_keywords: null,
  }
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) return out

  let json: Record<string, unknown>
  try {
    json = JSON.parse(raw.slice(start, end + 1))
  } catch {
    return out
  }

  const haystack = norm(`${page.title} ${page.metaDescription} ${page.headings.map((h) => h.text).join(' ')} ${page.mainText || page.bodyText}`)

  for (const key of SUGGEST_FIELDS) {
    const f = json[key] as { value?: unknown; quote?: unknown } | string | undefined
    const value = typeof f === 'string' ? f : typeof f?.value === 'string' ? f.value : ''
    const quote = typeof f === 'object' && f && typeof f.quote === 'string' ? f.quote : ''
    if (!value.trim()) continue
    const verified = quote.trim().length >= 4 && haystack.includes(norm(quote))
    out[key] = { value: value.trim().slice(0, 400), source: 'model', evidence: verified ? quote.trim() : null, suggested: true }
  }

  if (Array.isArray(json.primary_keywords)) {
    const kws = [...new Set(json.primary_keywords.filter((k): k is string => typeof k === 'string').map((k) => k.trim().toLowerCase()).filter(Boolean))].slice(0, 6)
    if (kws.length) out.primary_keywords = { value: kws, source: 'model', evidence: null, suggested: true }
  }

  return out
}

// ── Crawler access, for display ───────────────────────────────────────────────

export type AccessRowState = 'served' | 'refused' | 'robots-disallowed' | 'unknown'

export interface AccessRow {
  token: string
  label: string
  vendor: string
  state: AccessRowState
  /** The response observation or robots.txt rule the state rests on. */
  evidence: string
}

export interface OnboardingAccess {
  checkedAt: string
  url: string
  /** AI search (retrieval) crawlers only — the ones that decide whether a page can be quoted. */
  rows: AccessRow[]
  served: number
  total: number
  headline: string
  caveats: string[]
}

function rowState(p: CrawlerProbe, baselineFailed: boolean): AccessRowState {
  if (baselineFailed || p.blockKind === 'network-error' || p.blockKind === 'rate-limited') return 'unknown'
  if (p.robotsVerdict === 'disallowed') return 'robots-disallowed'
  if (p.contentServed) return 'served'
  if (isPolicyBlock(p.blockKind)) return 'refused'
  return 'unknown'
}

/**
 * Present the probe as facts, not a score. Only AI search crawlers are shown:
 * blocking a training crawler is an editorial choice, not a problem to flag at
 * someone's first minute in the product.
 */
export function onboardingAccess(report: CrawlerAccessReport): OnboardingAccess {
  const retrieval = report.probes.filter((p) => p.class === 'ai-search')
  const rows: AccessRow[] = retrieval.map((p) => {
    const state = rowState(p, report.baselineFailed)
    const evidence =
      state === 'robots-disallowed'
        ? `robots.txt disallows ${p.token} for this page`
        : p.status === null
          ? p.evidence || 'No response'
          : `HTTP ${p.status}${p.evidence ? ` — ${p.evidence}` : ''}`
    return { token: p.token, label: p.label, vendor: p.vendor, state, evidence }
  })

  const served = rows.filter((r) => r.state === 'served').length
  const unknown = rows.filter((r) => r.state === 'unknown').length
  const total = rows.length

  let headline: string
  if (report.baselineFailed) {
    headline = 'We could not load your homepage even as an ordinary browser, so crawler access is unknown for now.'
  } else if (served === total) {
    headline = `All ${total} AI search crawlers we tested were served your homepage.`
  } else if (served === 0 && unknown === total) {
    headline = 'Crawler access could not be determined on this run.'
  } else {
    headline = `${served} of ${total} AI search crawlers we tested were served your homepage.`
  }

  return { checkedAt: report.checkedAt, url: report.url, rows, served, total, headline, caveats: report.caveats }
}
