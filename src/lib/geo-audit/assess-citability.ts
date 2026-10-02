/**
 * Citability — if an engine lifts this passage, does anything in it force
 * attribution back to you?
 *
 * This is the half of the picture no other free tool separates out. It is
 * heuristic, so it is BANDED rather than scored: there is no defensible
 * arithmetic that makes "named author" worth seven points.
 *
 * Six attribution-bearing signals:
 *
 *   1. Named authorship      a real person, resolvable, with credentials
 *   2. Entity resolution     Organization schema + sameAs that actually resolve
 *   3. Brand-claim proximity the brand name sits WITH the claim, not only in nav
 *   4. Original evidence     figures, dates, named methodology, first-hand testing
 *   5. Proprietary terms     coined terms and named frameworks nothing else owns
 *   6. Freshness/provenance  dates, versioning, sources cited
 *
 * Wording rule enforced by test: findings here describe what the page CARRIES.
 * They never assert that the site is being retrieved without attribution — that
 * is an inference about engine behaviour, not something a page fetch can show.
 */

import { assessFreshness } from './dates'
import { countWords, truncate, type ContentBlock, type ExtractedPage } from './extract'
import { pageForRole, type KeyPageResult } from './crawl'
import { SignalBuilder, bandCounts, overallBand } from './scoring'
import { BAND_LABELS, type Citability, type CitabilitySignal, type Evidence } from './types'

export interface CitabilityInput {
  home: ExtractedPage
  keyPages: KeyPageResult[]
  now: Date
}

const ev = (url: string, kind: Evidence['kind'], snippet: string): Evidence => ({
  url,
  kind,
  snippet: truncate(snippet, 300),
})

export function assessCitability(input: CitabilityInput): Citability {
  const signals: CitabilitySignal[] = [
    namedAuthorship(input),
    entityResolution(input),
    brandClaimProximity(input),
    originalEvidence(input),
    proprietaryTerms(input),
    freshnessProvenance(input),
  ]

  const band = overallBand(signals)
  return { band, label: BAND_LABELS[band], signals, counts: bandCounts(signals) }
}

// ── 1. Named authorship ───────────────────────────────────────────────────────

function namedAuthorship({ home, keyPages }: CitabilityInput): CitabilitySignal {
  const s = new SignalBuilder('named-authorship', 'Named authorship')
  const about = pageForRole(keyPages, 'about')
  const aboutPage = about?.page ?? null

  const person = findPersonName(home) ?? (aboutPage ? findPersonName(aboutPage) : null)
  const bio = findBio(home) ?? (aboutPage ? findBio(aboutPage) : null)
  const credential = findCredential(home) ?? (aboutPage ? findCredential(aboutPage) : null)

  // Invariant: never claim authorship is absent sitewide on the strength of one
  // page. If an About page is linked we say so, and if we could not read it we
  // say that too rather than treating it as missing.
  if (about && !about.ok) {
    s.unverified(
      `An About page is linked at ${about.url} but could not be fetched, so authorship could not be confirmed from it.`,
    )
    return s.build()
  }
  if (about?.ok) {
    s.missing(`An About page is published at ${about.url} and was inspected.`)
  }

  if (person && credential) {
    s.found('strong', `A named person is identified (${person}) with stated experience or specialism.`, [
      ev(home.url, 'jsonld', `Person: ${person}`),
      ev(credential.url, 'text', credential.text),
    ])
  } else if (person) {
    s.found('adequate', `A named person is identified (${person}), but no experience, qualification or specialism is stated alongside the name.`, ev(home.url, 'jsonld', `Person: ${person}`))
  } else if (bio) {
    s.found('weak', 'A first-person bio describes who is behind the work, but no name is attached that an engine could attribute to.', ev(bio.url, 'text', bio.text))
  } else if (!about) {
    s.missing(
      'No About or team page was linked from the inspected page, and no named author or byline appears in the markup, so nothing in the copy carries a person to attribute it to.',
    )
  } else {
    s.missing(
      'No named author, byline or founder is identified in the markup or visible content, so nothing in the copy carries a person to attribute it to.',
    )
  }

  return s.build()
}

function findPersonName(page: ExtractedPage): string | null {
  for (const node of page.structuredData) {
    if (!node.types.some((t) => /^Person$/i.test(t))) continue
    const name = node.raw.name
    if (typeof name === 'string' && name.trim() && !name.includes('@')) return name.trim()
  }
  return null
}

function findBio(page: ExtractedPage): { url: string; text: string } | null {
  const markers = /\b(i built|i started|i founded|my name is|note from (the )?founder|about (me|the founder)|i help|i work with)\b/i
  for (const p of page.paragraphs) {
    if (p.length > 80 && markers.test(p)) return { url: page.url, text: truncate(p, 300) }
  }
  return null
}

function findCredential(page: ExtractedPage): { url: string; text: string } | null {
  const markers = /\b(\d+\+?\s*years?(?:\s+of)?\s+(?:experience|in)|certified|accredited|qualified|specialis[ez]|worked (?:with|across)|clients? (?:include|across)|degree|award)\b/i
  for (const p of page.paragraphs) {
    if (markers.test(p)) return { url: page.url, text: truncate(p, 300) }
  }
  return null
}

// ── 2. Entity resolution ──────────────────────────────────────────────────────

function entityResolution({ home }: CitabilityInput): CitabilitySignal {
  const s = new SignalBuilder('entity-resolution', 'Entity resolution')

  const orgNode = home.structuredData.find((n) =>
    n.types.some((t) => /^(Organization|LocalBusiness|OnlineBusiness|Corporation|ProfessionalService)$/i.test(t)),
  )
  const orgName = typeof orgNode?.raw.name === 'string' ? orgNode.raw.name.trim() : null
  const sameAs = readSameAs(orgNode?.raw.sameAs)
  const contact = [...home.emails, ...home.phones]

  if (orgName && sameAs.length >= 2) {
    s.found('strong', `An Organization entity is declared as "${orgName}" with ${sameAs.length} sameAs profiles, which is what lets an engine resolve the brand to a known entity rather than a string.`, [
      ev(home.url, 'jsonld', `${orgName} — sameAs: ${sameAs.slice(0, 3).join(', ')}`),
    ])
  } else if (orgName && (sameAs.length === 1 || home.socialLinks.length > 0)) {
    s.found('adequate', `An Organization entity is declared as "${orgName}", with ${sameAs.length ? 'one sameAs profile' : 'linked social profiles but no sameAs in the markup'}.`, ev(home.url, 'jsonld', orgName))
  } else if (orgName) {
    s.found('weak', `An Organization entity is declared as "${orgName}", but with no sameAs profiles an engine has nothing to resolve the name against.`, ev(home.url, 'jsonld', orgName))
  } else {
    s.missing('No Organization, LocalBusiness or ProfessionalService entity is declared in structured data, so the brand exists on the page only as text.')
  }

  if (contact.length) {
    s.found('adequate', `Contact details are published on the page (${contact.slice(0, 2).join(', ')}).`, ev(home.url, 'contact', contact.slice(0, 2).join(', ')))
  }

  return s.build()
}

function readSameAs(v: unknown): string[] {
  if (typeof v === 'string') return [v]
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string')
  return []
}

// ── 3. Brand-claim proximity ──────────────────────────────────────────────────

/**
 * The signal this whole tool is built around.
 *
 * A claim with the brand name beside it carries attribution when it is lifted.
 * A claim whose only nearby brand mention is in the nav or footer does not — the
 * block travels without the name. Measured per block, because proximity is a
 * property of a block, not of a page.
 */
function brandClaimProximity({ home }: CitabilityInput): CitabilitySignal {
  const s = new SignalBuilder('brand-proximity', 'Brand-claim proximity')

  const brand = findBrandName(home)
  if (!brand) {
    s.missing('No consistent brand name could be read from the markup or title, so proximity to claims could not be established.')
    return s.build()
  }

  const substantive = home.blocks.filter((b) => b.wordCount >= 25)
  if (substantive.length === 0) {
    s.unverified('No substantive content blocks were found, so brand-claim proximity could not be assessed.')
    return s.build()
  }

  const needle = brand.toLowerCase()
  const withBrand = substantive.filter(
    (b) => b.text.toLowerCase().includes(needle) || (b.headingText ?? '').toLowerCase().includes(needle),
  )
  const share = withBrand.length / substantive.length

  if (share >= 0.3) {
    s.found('strong', `"${brand}" appears inside ${withBrand.length} of ${substantive.length} substantive sections, so claims travel with the brand name attached when they are quoted.`, ev(home.url, 'text', `${withBrand[0].headingText ?? 'section'}: ${truncate(withBrand[0].text, 160)}`))
  } else if (share >= 0.1) {
    s.found('adequate', `"${brand}" appears inside ${withBrand.length} of ${substantive.length} substantive sections. The remaining sections carry no attribution anchor, so a quote lifted from them would not name you.`, ev(home.url, 'text', truncate(withBrand[0].text, 200)))
  } else if (withBrand.length > 0) {
    s.found('weak', `"${brand}" appears inside only ${withBrand.length} of ${substantive.length} substantive sections. Most sections carry no attribution anchor of their own.`, ev(home.url, 'text', truncate(withBrand[0].text, 200)))
  } else {
    s.missing(`"${brand}" does not appear inside any of the ${substantive.length} substantive sections — it is present only in the page chrome. Passages lifted from this page carry no attribution anchors.`)
  }

  return s.build()
}

function findBrandName(page: ExtractedPage): string | null {
  for (const node of page.structuredData) {
    if (node.types.some((t) => /^(Organization|LocalBusiness|OnlineBusiness|WebSite|ProfessionalService)$/i.test(t))) {
      const name = node.raw.name
      if (typeof name === 'string' && name.trim()) return name.trim()
    }
  }
  const parts = page.title.split(/\s[|\-–—]\s/)
  if (parts.length > 1) return parts[parts.length - 1].trim() || null
  return page.title || null
}

// ── 4. Original evidence ──────────────────────────────────────────────────────

function originalEvidence({ home }: CitabilityInput): CitabilitySignal {
  const s = new SignalBuilder('original-evidence', 'Original evidence')

  const stats = home.statistics
  const testimonial = home.testimonials[0]
  const methodology = home.paragraphs.find((p) =>
    /\b(we (tested|measured|analysed|analyzed|surveyed|audited|reviewed)|our (research|study|analysis|data|testing)|in our (experience|testing)|across \d+)\b/i.test(p),
  )

  if (stats.length >= 3 && (testimonial || methodology)) {
    s.found('strong', `${stats.length} specific figures appear in the copy, alongside ${testimonial ? 'attributed client feedback' : 'a first-person methodology statement'} — material an engine can attribute rather than paraphrase.`, [
      ev(home.url, 'text', stats[0]),
      testimonial ? ev(home.url, 'text', `${testimonial.quote} — ${testimonial.attribution}`) : ev(home.url, 'text', truncate(methodology!, 200)),
    ])
  } else if (testimonial) {
    s.found('adequate', `Named client feedback is published (attributed to ${testimonial.attribution}), which is first-hand evidence an engine can attribute.`, ev(home.url, 'text', `${testimonial.quote} — ${testimonial.attribution}`))
  } else if (stats.length >= 2) {
    s.found('adequate', `${stats.length} specific figures appear in the copy.`, ev(home.url, 'text', stats[0]))
  } else if (methodology) {
    s.found('weak', 'A first-person methodology statement is present, but without figures or named sources to anchor it.', ev(home.url, 'text', truncate(methodology, 200)))
  } else if (stats.length === 1) {
    s.found('weak', 'One specific figure appears in the copy.', ev(home.url, 'text', stats[0]))
  } else {
    s.missing('No original figures, named methodology or attributed first-hand evidence was found. There is nothing here that an engine could only have got from you.')
  }

  if (home.outboundCitations.length >= 2) {
    s.found('adequate', `${home.outboundCitations.length} outbound links point to third-party sources.`, ev(home.url, 'link', home.outboundCitations.slice(0, 2).map((l) => l.absolute).join(', ')))
  }

  return s.build()
}

// ── 5. Proprietary terms ──────────────────────────────────────────────────────

/**
 * Terms nothing else on the web owns — a coined framework, a named method, a
 * distinctive multi-word capitalised phrase used consistently.
 *
 * Detected as repeated Title-Case multi-word phrases that are not sentence
 * openers and not the brand name itself. Conservative by design: a false
 * positive here reads as flattery, which is worse than saying nothing.
 */
function proprietaryTerms({ home }: CitabilityInput): CitabilitySignal {
  const s = new SignalBuilder('proprietary-terms', 'Proprietary terms')

  const brand = (findBrandName(home) ?? '').toLowerCase()
  const candidates = findCoinedTerms(home, brand)

  const framework = home.mainText.match(
    /\b(?:our|the)\s+([A-Z][A-Za-z]+(?:[- ][A-Z][A-Za-z]+){0,3})\s+(?:framework|method|methodology|approach|model|process|system|formula)\b/,
  )

  if (framework) {
    s.found('strong', `A named framework is used ("${framework[1]} ${framework[0].split(' ').pop()}"), which is the kind of term an engine cannot source anywhere else.`, ev(home.url, 'text', truncate(framework[0], 160)))
  } else if (candidates.length >= 2) {
    s.found('adequate', `Distinctive repeated terms appear (${candidates.slice(0, 3).map((c) => `"${c.term}"`).join(', ')}), which give a quote something identifiable to carry.`, ev(home.url, 'text', candidates.slice(0, 3).map((c) => `${c.term} (×${c.count})`).join(', ')))
  } else if (candidates.length === 1) {
    s.found('weak', `One distinctive repeated term appears ("${candidates[0].term}").`, ev(home.url, 'text', `${candidates[0].term} (×${candidates[0].count})`))
  } else {
    s.missing('No coined term, named framework or distinctive repeated phrase was found. The vocabulary is generic, so a quote carries nothing that points back here.')
  }

  return s.build()
}

const STOPWORD_HEAD = /^(The|This|That|These|Those|Our|Your|We|You|It|And|But|For|With|From|How|What|Why|When|Where|Who|Which|A|An|In|On|At|To|Of|If|As|By|So|Not|All|More|Most|Every|Each|Some|Start|Get|See|Read|Learn|Contact|Book|Free|New|Best|Top)\b/

function findCoinedTerms(page: ExtractedPage, brandLower: string): { term: string; count: number }[] {
  const counts = new Map<string, number>()
  // Two-to-four word Title Case runs.
  const pattern = /\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){1,3})\b/g
  let m: RegExpExecArray | null

  while ((m = pattern.exec(page.mainText)) !== null) {
    const term = m[1]
    if (STOPWORD_HEAD.test(term)) continue
    if (term.toLowerCase() === brandLower) continue
    if (brandLower && term.toLowerCase().includes(brandLower)) continue
    counts.set(term, (counts.get(term) ?? 0) + 1)
  }

  return [...counts.entries()]
    .filter(([, n]) => n >= 3)
    .map(([term, count]) => ({ term, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
}

// ── 6. Freshness and provenance ───────────────────────────────────────────────

function freshnessProvenance({ home, keyPages, now }: CitabilityInput): CitabilitySignal {
  const s = new SignalBuilder('freshness-provenance', 'Freshness and provenance')

  const blog = pageForRole(keyPages, 'blog')
  const dates = [...home.dates, ...(blog?.page?.dates ?? [])]

  if (dates.length === 0) {
    s.missing('No published or updated date was found in the markup, so nothing dates the claims on this page.')
    return s.build()
  }

  const f = assessFreshness(dates, now)
  if (f.futureDates.length) {
    s.missing(`${f.futureDates.length} date(s) are set after today (${f.futureDates.map((d) => d.iso).join(', ')}), which usually indicates a templating error.`)
  }

  if (!f.mostRecent || f.daysOld === null) {
    s.missing('Every date found is in the future, so there is no usable recency signal.')
    return s.build()
  }

  const evidence = ev(home.url, 'date', `${f.mostRecent.source}: ${f.mostRecent.iso}`)
  if (f.bucket === 'current') {
    s.found('strong', `Publication metadata is present and the most recent update is ${f.mostRecent.iso}, ${f.daysOld} days ago.`, evidence)
  } else if (f.bucket === 'recent') {
    s.found('adequate', `Publication metadata is present; the most recent update is ${f.mostRecent.iso}, about ${Math.round(f.daysOld / 30)} months ago.`, evidence)
  } else if (f.bucket === 'aging') {
    s.found('weak', `Publication metadata is present, but the most recent update is ${f.mostRecent.iso}, about ${Math.round(f.daysOld / 30)} months ago.`, evidence)
  } else {
    s.found('weak', `Publication metadata is present, but the most recent update is ${f.mostRecent.iso}, over ${Math.floor(f.daysOld / 365)} year(s) ago.`, evidence)
  }

  if (home.outboundCitations.length) {
    s.found('adequate', `${home.outboundCitations.length} outbound source link(s) give the claims traceable provenance.`, ev(home.url, 'link', home.outboundCitations[0].absolute))
  }

  return s.build()
}

export { countWords, type ContentBlock }
