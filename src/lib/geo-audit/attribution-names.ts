/**
 * Who a page belongs to and who is named on it, read the way a person would.
 *
 * Every helper here exists because the engine reported something false about a
 * real site (2026-10-07 outreach audits):
 *   - withcandour.co.uk and zelst.co.uk: brand proximity "absent" because the
 *     check searched the copy for the legal name ("Candour Agency Ltd",
 *     "Zelst Limited") while the copy says "Candour" and "Zelst".
 *   - varn.co.uk: named authorship "absent" although the About page names the
 *     CEO; and the CEO's own quote counted as "named client feedback".
 *   - screamingfrog.co.uk: named authorship "absent" although the homepage
 *     carries "19 May, 2026 by Dan Sharp" bylines.
 *
 * The rule throughout: a false absence in front of a prospect is the worst
 * output the engine can produce, so when a name is plainly on the page we find
 * it, and when we cannot tell staff from client we claim neither.
 */
import type { ExtractedPage, Testimonial } from './extract'

// ── Brand names ──────────────────────────────────────────────────────────────

const ORG_TYPES = /^(Organization|LocalBusiness|OnlineBusiness|Corporation|ProfessionalService)$/i
const LEGAL_SUFFIX = /[\s,]+(?:ltd|limited|llc|l\.l\.c|inc|incorporated|plc|gmbh|llp|corp|corporation|co|pty|bv|sa|ag)\.?$/i
const GENERIC_TAIL = /\s+(?:agency|digital|media|marketing|group|studio|studios|consulting|consultancy|consultants|seo|solutions|services|partners)$/i

export interface BrandNames {
  /** What the copy should be checked for, most specific first. */
  candidates: string[]
  /** The trading name to show in findings ("Candour", not "Candour Agency Ltd"). */
  display: string
}

/**
 * Strip a legal suffix, then a generic descriptor, keeping at least one word.
 * "Candour Agency Ltd" → ["Candour Agency Ltd", "Candour Agency", "Candour"].
 */
export function nameVariants(name: string): string[] {
  const out = [name.trim()]
  let n = name.trim()
  for (const re of [LEGAL_SUFFIX, GENERIC_TAIL]) {
    const stripped = n.replace(re, '').trim()
    if (stripped && stripped !== n && stripped.length >= 2) {
      n = stripped
      out.push(n)
    }
  }
  return [...new Set(out)]
}

export function brandNames(page: ExtractedPage): BrandNames | null {
  const raw: string[] = []
  for (const node of page.structuredData) {
    if (!node.types.some((t) => ORG_TYPES.test(t) || /^WebSite$/i.test(t))) continue
    for (const key of ['name', 'alternateName', 'legalName']) {
      const v = node.raw[key]
      for (const s of Array.isArray(v) ? v : [v]) {
        if (typeof s === 'string' && s.trim() && s.trim().length <= 60) raw.push(s.trim())
      }
    }
  }
  // A WebSite "name" is sometimes a tagline ("SEO & AI Agency: Digital growth
  // specialists"); a title suffix ("... | Zelst") is the most reliable short form.
  const parts = page.title.split(/\s[|\-–—]\s/)
  if (parts.length > 1 && parts[parts.length - 1].trim()) raw.push(parts[parts.length - 1].trim())
  if (raw.length === 0 && page.title) raw.push(page.title.trim())
  if (raw.length === 0) return null

  const candidates = [...new Set(raw.flatMap(nameVariants))]
    .filter((c) => c.split(/\s+/).length <= 5 && !/[:]/.test(c))
    .sort((a, b) => b.length - a.length)
  if (candidates.length === 0) return null

  // Display the shortest candidate that every longer form starts with, which is
  // the trading name when the variants agree ("Candour"), else the first name.
  const shortest = [...candidates].sort((a, b) => a.length - b.length)[0]
  const display = candidates.every((c) => c.toLowerCase().startsWith(shortest.toLowerCase())) ? shortest : candidates[0]
  return { candidates, display }
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Whole-word match. A derived short form ("Candour", "Zelst") is matched with
 * its capitalisation, so the brand "Candour" is found but the noun "candour"
 * in a sentence is not; full declared names match case-insensitively.
 */
export function mentionsBrand(text: string, brand: BrandNames): boolean {
  return brand.candidates.some((c) => {
    const exactCase = c === brand.display && !/\s/.test(c)
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escape(c)}(?=$|[^\\p{L}\\p{N}])`, exactCase ? 'u' : 'iu')
    return re.test(text)
  })
}

// ── Staff versus client ──────────────────────────────────────────────────────

/**
 * A quote attributed to someone "at" or "of" the brand is the organisation
 * speaking about itself ("Tom Vaughton CEO at Varn"). It names a person behind
 * the work, and it is not client evidence.
 */
export function isOwnStaff(t: Testimonial, brand: BrandNames | null): boolean {
  return Boolean(brand && mentionsBrand(t.attribution, brand))
}

/**
 * Client feedback needs a client: an organisation other than the brand named in
 * the attribution ("Simon Goble, Dogbuddy", "Founder, Cloudline Aviation").
 * "Vicky Walker Comms Director" names no organisation; on varn.co.uk she is
 * staff, and from the text alone it cannot be told either way, so it is not
 * reported as client feedback.
 */
export function isClientFeedback(t: Testimonial, brand: BrandNames | null): boolean {
  if (!isPlausibleAttribution(t) || isOwnStaff(t, brand)) return false
  const roleOnly = new RegExp(`^(?:[A-Z][a-z]+\\s+){0,3}${ROLE}$`)
  const segments = t.attribution
    .split(/\s*(?:,|–|—|\||\s-\s|\bat\b|\bof\b)\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
  return segments.slice(1).some((s) => !roleOnly.test(s))
}

/**
 * An attribution has to read like one: it starts with a person's name and is
 * short. On salt.agency a nav menu was taken as a testimonial "attributed to
 * Manager GSC BigQuery SQL Hero Hreflang Checker…", and reported as client
 * feedback.
 */
export function isPlausibleAttribution(t: Testimonial): boolean {
  const a = t.attribution.trim()
  if (a.length > 90) return false
  const m = new RegExp(`^${NAME}`).exec(a)
  if (m && plausibleName(m[1])) return true
  // "Founder, Cloudline Aviation": a role and a named company is attribution too.
  return new RegExp(`^(?:[A-Z][a-z]+\\s+){0,2}${ROLE}\\b\\s*(?:,|at|of|–|—|-)\\s*\\S`).test(a)
}

// ── Visible person names ─────────────────────────────────────────────────────

// Case-sensitive on purpose: a card reads "CEO at Varn" or "Comms Director",
// and a loose match would let "search engine optimisation manager" in as a name.
const ROLE =
  '(?:[Cc]o-?[Ff]ounder|[Ff]ounder|CEO|CTO|CMO|COO|CFO|Chief [A-Z][a-z]+ Officer|Managing Director|[Dd]irector|Head of [A-Z][a-z]+|[Oo]wner|President|Partner|Principal|Lead|Manager)'

/** Capitalised words that start many headings and are never part of a name. */
const NOT_A_NAME = new Set(
  (
    'the our your we you and for with from about home search engine optimisation optimization seo digital media marketing agency ' +
    'content social paid technical local google ai data analytics services service team meet case studies study blog news ' +
    'contact book call read more learn view all latest client clients award awards brand brands growth strategy web website ' +
    'design build email account sales product products business pr link links ppc performance creative global international ' +
    'london uk us usa new north south east west senior junior associate group company limited ltd inc'
  ).split(' '),
)

const NAME_WORD = "[A-Z][a-z]+(?:[-'’][A-Z][a-z]+)?"
// The third word is lazy so "Vicky Walker Comms Director" reads as the name
// "Vicky Walker", not "Vicky Walker Comms".
const NAME = `(${NAME_WORD}\\s+${NAME_WORD}(?:\\s+${NAME_WORD})??)`

function plausibleName(name: string): boolean {
  const words = name.split(/\s+/)
  return words.length >= 2 && words.length <= 4 && words.every((w) => !NOT_A_NAME.has(w.toLowerCase()))
}

/** "Name Role" where Role is not followed by a different organisation. */
function roleIsOwn(after: string, brand: BrandNames | null): boolean {
  const org = /^\s*(?:at|of|,|–|—|-|&#8211;)\s*(.{2,60})/.exec(after)
  if (!org) return true
  return Boolean(brand && mentionsBrand(org[1], brand))
}

export interface NamedPerson {
  name: string
  /** The text the name was read from, for the evidence pane. */
  context: string
  source: 'jsonld' | 'byline' | 'staff-quote' | 'role'
}

/**
 * People named on the page as belonging to it, in order of reliability:
 * a Person in structured data, a dated byline ("19 May, 2026 by Dan Sharp"),
 * a quote attributed to someone at the brand, then "Name Role" in the copy.
 * Names that appear only as a client's attribution are excluded.
 */
export function findPeople(page: ExtractedPage, brand: BrandNames | null): NamedPerson[] {
  const out: NamedPerson[] = []
  const add = (p: NamedPerson) => {
    if (!out.some((o) => o.name === p.name)) out.push(p)
  }

  for (const node of page.structuredData) {
    if (!node.types.some((t) => /^Person$/i.test(t))) continue
    const name = node.raw.name
    if (typeof name === 'string' && name.trim() && !name.includes('@')) {
      add({ name: name.trim(), context: `Person: ${name.trim()}`, source: 'jsonld' })
    }
  }

  const text = page.mainText || page.bodyText
  // A byline needs a date or an authorship verb before "by", so "powered by
  // Google Search" and "trusted by Big Brands" never read as people.
  // Two words, with a surname particle allowed between them, so "founded in
  // 2006 by Peter Van Zelst" reads as "Peter Van Zelst" and "19 May, 2026 by
  // Dan Sharp Screaming Frog" stops at "Dan Sharp".
  const PARTICLE = '(?:(?:[Vv]an|[Vv]on|[Dd]e|[Dd]er|[Dd]en|[Ll]a|[Ll]e|[Dd]u|[Dd]i|[Dd]a|[Dd]el)\\s+)?'
  const byline = new RegExp(`(?:\\b(?:written|posted|published|authored)\\s+by|\\b(?:19|20)\\d{2},?\\s+by|\\bby:)\\s+(${NAME_WORD}\\s+${PARTICLE}${NAME_WORD})`, 'g')
  for (const m of text.matchAll(byline)) {
    if (plausibleName(m[1])) add({ name: m[1], context: m[0].trim(), source: 'byline' })
  }

  const clientNames = new Set<string>()
  for (const t of page.testimonials) {
    const m = new RegExp(`^${NAME}`).exec(t.attribution)
    if (!m || !plausibleName(m[1])) continue
    if (isOwnStaff(t, brand)) add({ name: m[1], context: t.attribution, source: 'staff-quote' })
    else clientNames.add(m[1])
  }

  const withRole = new RegExp(`${NAME}\\s+((?:[A-Z][a-z]+\\s+){0,2}${ROLE})\\b(.{0,70})`, 'g')
  for (const m of text.matchAll(withRole)) {
    const name = m[1]
    if (!plausibleName(name)) continue
    if (clientNames.has(name)) continue
    if (!roleIsOwn(m[3], brand)) continue
    add({ name, context: `${name} ${m[2]}`.trim(), source: 'role' })
  }

  return out
}
