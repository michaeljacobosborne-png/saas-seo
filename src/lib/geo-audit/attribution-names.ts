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

const ORG_TYPES = /^(Organization|LocalBusiness|OnlineBusiness|Corporation|ProfessionalService|NewsMediaOrganization)$/i
const LEGAL_SUFFIX = /[\s,]+(?:ltd|limited|llc|l\.l\.c|inc|incorporated|plc|gmbh|llp|corp|corporation|co|pty|bv|sa|ag)\.?$/i
const GENERIC_TAIL = /\s+(?:agency|digital|media|marketing|group|studio|studios|consulting|consultancy|consultants|seo|solutions|services|partners)$/i
/** What a site calls its publication, as opposed to the organisation: "HubSpot Blog". */
const PUBLICATION_TAIL = /\s+(?:blog|news|newsroom|insights|magazine|journal|resources|library|learning centre|learning center|knowledge base)$/i

export interface DeclaredOrganization {
  name: string | null
  sameAs: string[]
  /** The @id it is declared or referenced by, when it has one. */
  id: string | null
  /** Where it was found: a node of its own, or inside another node's publisher, author and so on. */
  via: 'node' | 'nested'
}

/**
 * Every Organization the markup declares, wherever it sits. Large publishers
 * declare it as the publisher of their WebSite and Article rather than as a
 * node of its own; blog.hubspot.com declares only a reference,
 * {"@type": "Organization", "@id": ".../#organization"}, with no name.
 * Entries sharing an @id are merged, so a reference picks up a name declared
 * elsewhere on the page.
 */
export function organizations(page: ExtractedPage): DeclaredOrganization[] {
  const found: { raw: Record<string, unknown>; via: 'node' | 'nested' }[] = []
  const walk = (v: unknown, depth: number, top: boolean) => {
    if (depth > 6 || v == null || typeof v !== 'object') return
    if (Array.isArray(v)) {
      for (const x of v) walk(x, depth + 1, false)
      return
    }
    const o = v as Record<string, unknown>
    const t = o['@type']
    const types = typeof t === 'string' ? [t] : Array.isArray(t) ? t.filter((x): x is string => typeof x === 'string') : []
    if (types.some((x) => ORG_TYPES.test(x))) found.push({ raw: o, via: top ? 'node' : 'nested' })
    for (const [k, child] of Object.entries(o)) if (k !== '@graph') walk(child, depth + 1, false)
  }
  for (const node of page.structuredData) walk(node.raw, 0, true)

  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  const byKey = new Map<string, DeclaredOrganization>()
  for (const { raw, via } of found) {
    const id = str(raw['@id'])
    const key = id ?? `anon-${byKey.size}`
    const prev = byKey.get(key)
    const sameAs = typeof raw.sameAs === 'string' ? [raw.sameAs] : Array.isArray(raw.sameAs) ? raw.sameAs.filter((x): x is string => typeof x === 'string') : []
    byKey.set(key, {
      name: prev?.name ?? str(raw.name) ?? str(raw.legalName),
      sameAs: [...new Set([...(prev?.sameAs ?? []), ...sameAs])],
      id,
      via: prev?.via === 'node' || via === 'node' ? 'node' : 'nested',
    })
  }
  return [...byKey.values()]
}

/** The label a domain is named for: "hubspot" for blog.hubspot.com, "clickslice" for www.clickslice.co.uk. */
export function domainLabel(url: string): string {
  try {
    const labels = new URL(url).hostname.toLowerCase().split('.')
    const sld = labels.length > 2 && /^(?:co|com|org|net|ac|gov|edu)$/.test(labels[labels.length - 2]) && labels[labels.length - 1].length === 2
    return labels[labels.length - (sld ? 3 : 2)] ?? ''
  } catch {
    return ''
  }
}

const squash = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

export interface BrandNames {
  /** What the copy should be checked for, most specific first. */
  candidates: string[]
  /** The trading name to show in findings ("Candour", not "Candour Agency Ltd"). */
  display: string
}

/**
 * Strip a legal suffix, a generic descriptor, then a publication descriptor,
 * keeping at least one word.
 * "Candour Agency Ltd" → ["Candour Agency Ltd", "Candour Agency", "Candour"].
 * "HubSpot Blog" → ["HubSpot Blog", "HubSpot"].
 */
export function nameVariants(name: string): string[] {
  const out = [name.trim()]
  let n = name.trim()
  for (const re of [LEGAL_SUFFIX, GENERIC_TAIL, PUBLICATION_TAIL]) {
    const stripped = n.replace(re, '').trim()
    if (stripped && stripped !== n && stripped.length >= 2) {
      n = stripped
      out.push(n)
    }
  }
  return [...new Set(out)]
}

/**
 * The brand is the publishing organisation's own name (DECISIONS 41). The rule,
 * replacing three instance patches (legal name, capitalisation, site name):
 *   1. Read it from the Organization in the markup, nested or referenced
 *      included, then the WebSite name, then the title suffix.
 *   2. Strip legal suffixes, business descriptors and publication descriptors
 *      from each ("Candour Agency Ltd" → "Candour", "HubSpot Blog" → "HubSpot").
 *   3. Prefer the form that matches the domain, ignoring case and punctuation.
 *      If no declared name does, take the page's own spelling of the domain
 *      name ("Re:signal" for resignal.com), so a tagline never stands in.
 * Matching (mentionsBrand) then accepts any capitalisation except all lowercase.
 */
export function brandNames(page: ExtractedPage): BrandNames | null {
  const raw: string[] = []
  for (const org of organizations(page)) if (org.name && org.name.length <= 60) raw.push(org.name)
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

  const label = squash(domainLabel(page.url))
  const clean = (s: string) => s.replace(/[®™©]/g, '').trim()
  let candidates = [...new Set(raw.map(clean).flatMap(nameVariants))]
    .filter((c) => (c.split(/\s+/).length <= 5 && !/[:]/.test(c)) || squash(c) === label)
    .sort((a, b) => b.length - a.length)

  // The domain's own name: a declared form that matches it, or the page's
  // spelling of it. An all-lowercase form defers to the page's capitalised one.
  let domainForm = label ? candidates.find((c) => squash(c) === label) ?? null : null
  if ((!domainForm || domainForm === domainForm.toLowerCase()) && label.length >= 3) {
    const spelled = spellingOnPage(page, label)
    if (spelled) {
      domainForm = spelled
      candidates = [spelled, ...candidates.filter((c) => c !== spelled)]
    }
  }
  // Also the domain's name when a declared name starts with it ("Inter-Dev"
  // inside "Inter-Dev B2B Digital Marketing Agency").
  if (!domainForm && label.length >= 3) {
    for (const c of candidates) {
      const words = c.split(/\s+/)
      for (let n = 1; n < words.length && !domainForm; n++) {
        const head = words.slice(0, n).join(' ')
        if (squash(head) === label) domainForm = head
      }
    }
    if (domainForm) candidates = [domainForm, ...candidates]
  }
  if (candidates.length === 0) return null

  // A declared organisation name is the brand, unless it starts with the
  // domain's own name, which is then the shorter trading form. withcandour.co.uk
  // declares "Candour Agency Ltd": the brand is "Candour", not "with Candour".
  const orgNames = organizations(page).map((o) => o.name).filter((n): n is string => Boolean(n)).map(clean)
  const orgShort = orgNames.length ? nameVariants(orgNames[0]).sort((a, b) => a.length - b.length)[0] : null
  const shortest = [...candidates].sort((a, b) => a.length - b.length)[0]
  const fallback = candidates.every((c) => c.toLowerCase().startsWith(shortest.toLowerCase())) ? shortest : candidates[0]
  const display =
    orgShort && !(domainForm && orgShort.toLowerCase().startsWith(domainForm.toLowerCase()))
      ? orgShort
      : (domainForm ?? fallback)
  if (!candidates.includes(display)) candidates.unshift(display)
  return { candidates, display }
}

/** The most common capitalised spelling on the page of a word or pair that squashes to the domain label. */
function spellingOnPage(page: ExtractedPage, label: string): string | null {
  const text = `${page.title} ${page.bodyText}`
  const counts = new Map<string, number>()
  const words = text.match(/[\p{L}\p{N}][\p{L}\p{N}:'’&.-]*/gu) ?? []
  for (let i = 0; i < words.length; i++) {
    for (const cand of [words[i], i + 1 < words.length ? `${words[i]} ${words[i + 1]}` : '']) {
      const c = cand.replace(/[.:'’-]+$/, '')
      if (c && squash(c) === label && c !== c.toLowerCase()) counts.set(c, (counts.get(c) ?? 0) + 1)
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Whole-word match in any capitalisation except all lowercase: "AIMCLEAR",
 * "Aimclear" and "Beam" are the brand, while "candour" in a sentence is the
 * common noun. A brand written in lowercase as a style ("hubspot") is rare in
 * running copy and is not counted.
 */
export function mentionsBrand(text: string, brand: BrandNames): boolean {
  return brand.candidates.some((c) => {
    const re = new RegExp(`(?:^|[^\\p{L}\\p{N}])(${escape(c)})(?=$|[^\\p{L}\\p{N}])`, 'giu')
    for (const m of text.matchAll(re)) if (m[1] !== m[1].toLowerCase()) return true
    return false
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
    'london uk us usa new north south east west senior junior associate group company limited ltd inc ' +
    // Job titles are never part of a name: digitaloft.co.uk was read as "Manager Amy".
    'manager director founder cofounder co-founder ceo cto cmo coo cfo head lead officer executive assistant specialist ' +
    'consultant coordinator strategist analyst editor writer designer developer engineer partner principal owner president ' +
    'account accounts operations marketing sales client success'
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
