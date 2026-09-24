/**
 * Deterministic GEO scoring.
 *
 * Every point awarded here traces to something the extractor found, and every
 * award carries evidence naming the URL and the supporting snippet. The model
 * never sees these numbers — it only writes prose about them afterwards.
 *
 * The seven factor names and weights are unchanged from the previous version so
 * historical reports remain comparable.
 */

import { assessFreshness } from './dates'
import { countWords, truncate, type ExtractedPage } from './extract'
import { pageForRole, type KeyPageResult } from './crawl'
import { summariseAccess, type AccessReport } from './access'
import { FactorBuilder } from './scoring'
import type { Evidence, Factor } from './types'

export interface ScoreInput {
  home: ExtractedPage
  keyPages: KeyPageResult[]
  now: Date
  /** Absent when access was not assessed (tests, or a run that skipped it). */
  access?: AccessReport | null
}

const ev = (url: string, kind: Evidence['kind'], snippet: string): Evidence => ({
  url,
  kind,
  snippet: truncate(snippet, 300),
})

const QUESTION_WORDS = /^(what|why|how|when|where|who|which|can|do|does|is|are|should|will)\b/i

export function scoreGeo(input: ScoreInput): Factor[] {
  return [
    scoreCrawlerAccess(input),
    scoreSchema(input),
    scoreAuthorEntity(input),
    scoreDirectAnswers(input),
    scoreCitableClaims(input),
    scoreContentStructure(input),
    scoreBrandClarity(input),
    scoreFreshness(input),
  ]
}

// ── 0. AI crawler access (15) ─────────────────────────────────────────────────
// Only AI *search* crawlers are scored. Training crawlers and user-triggered
// fetchers are reported in `report.access` and deliberately excluded here.

export function scoreCrawlerAccess({ access }: ScoreInput): Factor {
  const f = new FactorBuilder('crawler-access', 'AI crawler access', 15)

  if (!access) {
    f.unverified('Crawler access was not assessed on this run.')
    return f.build()
  }

  const s = summariseAccess(access)
  const scoredTotal = s.searchAllowed.length + s.searchBlocked.length

  // Every scored crawler unknown means robots.txt itself was unreadable. That is
  // genuinely unassessable and must not be scored as either allowed or blocked.
  if (scoredTotal === 0) {
    f.unverified(
      access.robots.note ??
        'robots.txt could not be read, so AI crawler access could not be determined.',
    )
    return f.build()
  }

  const ratio = s.searchAllowed.length / scoredTotal
  const awarded = Math.round(ratio * 9)
  if (s.searchBlocked.length === 0) {
    f.award(9, `All ${scoredTotal} AI search crawlers are permitted by robots.txt.`, ev(access.robots.url || access.finalUrl, 'text', s.searchAllowed.map((c) => c.token).join(', ')))
  } else {
    f.award(
      awarded,
      `${s.searchBlocked.length} of ${scoredTotal} AI search crawlers are blocked by robots.txt (${s.searchBlocked.map((c) => c.token).join(', ')}). ${s.searchBlocked[0].reason}`,
      ev(access.robots.url || access.finalUrl, 'text', s.searchBlocked.map((c) => `${c.token}: ${c.reason}`).join(' | ')),
    )
  }

  if (s.searchUnknown.length) {
    f.miss(`${s.searchUnknown.length} crawler(s) could not be checked and are excluded from this score.`)
  }

  // Indexing directives are a harder block than robots.txt: robots stops the
  // fetch, noindex stops the page being used even when it was fetched.
  if (access.directives.noindex) {
    f.miss(
      `The page carries a noindex directive via ${access.directives.noindexSource === 'meta' ? 'its robots meta tag' : 'the X-Robots-Tag response header'}, which asks every engine to leave it out of results entirely.`,
    )
    f.note(ev(access.finalUrl, 'meta', access.directives.metaRobots ?? access.directives.xRobotsTag ?? 'noindex'))
  } else {
    f.award(3, 'No noindex directive blocks the page from being used.')
  }

  if (access.jsOnlyContent) {
    f.miss(
      'The raw HTML contains almost no readable text, so this content appears only after JavaScript runs. AI crawlers such as GPTBot and PerplexityBot do not execute JavaScript, so they cannot see it.',
    )
  } else {
    f.award(3, 'The page content is present in the raw HTML, so crawlers that do not run JavaScript can read it.')
  }

  if (access.canonicalMismatch) {
    f.miss(`The canonical URL points elsewhere (${access.canonical}), so engines may credit that URL instead of this one.`)
    f.note(ev(access.finalUrl, 'meta', `canonical: ${access.canonical}`))
  }

  return f.build()
}

// ── 1. Schema markup (15) ──────────────────────────────────────────────────────

function scoreSchema({ home }: ScoreInput): Factor {
  const f = new FactorBuilder('schema', 'Schema markup', 15)
  const types = home.structuredDataTypes

  if (types.length === 0) {
    f.miss('No JSON-LD or microdata structured data was found on the inspected page.')
    return f.build()
  }

  f.award(4, `Structured data is present (${types.join(', ')}).`, ev(home.url, 'jsonld', types.join(', ')))

  const entityTypes = types.filter((t) => /^(Organization|LocalBusiness|OnlineBusiness|Person|Corporation|ProfessionalService)$/i.test(t))
  if (entityTypes.length) {
    f.award(4, `An entity type is declared (${entityTypes.join(', ')}), which is what identifies the business to an AI engine.`)
  } else {
    f.miss('No Organization, LocalBusiness or Person type is declared, so the business itself is not described in the markup.')
  }

  if (types.some((t) => /^(WebSite|WebPage)$/i.test(t))) {
    f.award(2, 'WebSite/WebPage markup describes the page in context.')
  } else {
    f.miss('No WebSite or WebPage type is declared.')
  }

  const contentTypes = types.filter((t) =>
    /^(Article|BlogPosting|NewsArticle|FAQPage|HowTo|Product|Service|Review|BreadcrumbList|Course|Event)$/i.test(t),
  )
  if (contentTypes.length) {
    f.award(5, `Content-level markup is present (${contentTypes.join(', ')}).`)
  } else {
    f.miss('No content-level markup such as Article, FAQPage or Service describes what is on the page.')
  }

  return f.build()
}

// ── 2. Author / entity signals (15) ────────────────────────────────────────────

function scoreAuthorEntity({ home, keyPages }: ScoreInput): Factor {
  const f = new FactorBuilder('author', 'Author/entity signals', 15)
  const about = pageForRole(keyPages, 'about')

  // An About page linked from the homepage counts as present even before we
  // read it — but we only describe its contents if we actually fetched it.
  if (about) {
    if (about.ok && about.page) {
      f.award(4, `An About page is published at ${about.url} and was inspected.`, ev(about.url, 'link', about.linkText))
    } else {
      f.award(2, `An About page is linked at ${about.url}, but it could not be fetched to verify its contents.`, ev(home.url, 'link', about.linkText))
    }
  } else {
    f.miss('No About or team page was linked from the inspected page.')
  }

  const aboutPage = about?.page ?? null
  const personName = findPersonName(home) ?? (aboutPage ? findPersonName(aboutPage) : null)
  if (personName) {
    f.award(3, `A named person is identified (${personName}).`, ev(home.url, 'jsonld', `Person: ${personName}`))
  } else {
    f.miss('No named author or founder is identified in the markup or visible content.')
  }

  const bio = findBio(home) ?? (aboutPage ? findBio(aboutPage) : null)
  if (bio) {
    f.award(4, 'A first-person bio or founder note describes who is behind the work.', ev(bio.url, 'text', bio.text))
  } else {
    f.miss('No author or founder bio was found on the pages inspected.')
  }

  const socials = [...home.socialLinks, ...(aboutPage?.socialLinks ?? [])]
  if (socials.length) {
    f.award(2, `Professional profiles are linked (${socials.slice(0, 3).join(', ')}).`, ev(home.url, 'social', socials.slice(0, 3).join(', ')))
  } else {
    f.miss('No professional or social profiles are linked.')
  }

  const credential = findCredentialSignal(home) ?? (aboutPage ? findCredentialSignal(aboutPage) : null)
  if (credential) {
    f.award(2, 'Experience or specialism is stated in the copy.', ev(credential.url, 'text', credential.text))
  } else {
    f.miss('No stated experience, qualifications or specialism was found.')
  }

  return f.build()
}

function findPersonName(page: ExtractedPage): string | null {
  for (const node of page.structuredData) {
    if (!node.types.some((t) => /^Person$/i.test(t))) continue
    const name = node.raw.name
    // A mailbox in the name slot is not a person's name.
    if (typeof name === 'string' && name.trim() && !name.includes('@')) return name.trim()
  }
  return null
}

function findBio(page: ExtractedPage): { url: string; text: string } | null {
  const markers = /\b(i built|i started|i founded|my name is|note from (the )?founder|about (me|the founder)|i help|i work with)\b/i
  for (const p of page.paragraphs) {
    if (p.length > 80 && markers.test(p)) return { url: page.url, text: truncate(p, 300) }
  }
  const headingMatch = page.headings.find((h) => /note from (the )?founder|about (me|us|the founder)|our story|who we are/i.test(h.text))
  if (headingMatch) {
    const nearby = page.paragraphs.find((p) => p.length > 120)
    if (nearby) return { url: page.url, text: truncate(nearby, 300) }
  }
  return null
}

function findCredentialSignal(page: ExtractedPage): { url: string; text: string } | null {
  const markers = /\b(\d+\+?\s*years?(?:\s+of)?\s+(?:experience|in)|certified|accredited|qualified|specialis[ez]|worked (?:with|across)|clients? (?:include|across)|degree|award)\b/i
  for (const p of page.paragraphs) {
    if (markers.test(p)) return { url: page.url, text: truncate(p, 300) }
  }
  return null
}

// ── 3. Direct answer content (20) ──────────────────────────────────────────────

function scoreDirectAnswers({ home }: ScoreInput): Factor {
  const f = new FactorBuilder('direct-answers', 'Direct answer content', 20)

  const hasFaqSchema = home.structuredDataTypes.some((t) => /^(FAQPage|QAPage|Question)$/i.test(t))
  // A heading is only a question if it asks one. Opening with "What"/"How" is a
  // weaker, separate signal and must not be described as a question.
  const explicitQuestions = home.headings.filter((h) => h.text.includes('?'))
  const questionOpeners = home.headings.filter((h) => !h.text.includes('?') && QUESTION_WORDS.test(h.text))

  if (hasFaqSchema) {
    f.award(6, 'FAQ structured data marks up question-and-answer pairs explicitly.', ev(home.url, 'jsonld', 'FAQPage'))
  } else if (explicitQuestions.length >= 3) {
    f.award(3, `${explicitQuestions.length} headings are phrased as questions, though without FAQ structured data.`, ev(home.url, 'heading', explicitQuestions.slice(0, 3).map((h) => h.text).join(' | ')))
  } else {
    f.miss('No FAQ structured data and no question-and-answer section was found on the inspected page.')
  }

  if (explicitQuestions.length >= 1) {
    f.award(Math.min(4, explicitQuestions.length * 2), `Headings are phrased as questions (${explicitQuestions.slice(0, 2).map((h) => h.text).join('; ')}).`, ev(home.url, 'heading', explicitQuestions[0].text))
  } else if (questionOpeners.length >= 2) {
    f.award(2, `${questionOpeners.length} headings open with a question word but are not phrased as questions (${questionOpeners.slice(0, 2).map((h) => h.text).join('; ')}). Rewriting these as the question a reader would type makes the section easier to match to a query.`, ev(home.url, 'heading', questionOpeners[0].text))
  } else {
    f.miss('No heading is phrased as a question a reader would actually ask.')
  }

  const opener = findOpeningAnswer(home)
  if (opener) {
    f.award(5, 'The page opens with a concise statement of what the business does, which is the form an AI answer can lift directly.', ev(home.url, 'text', opener))
  } else {
    f.miss('The opening content does not state plainly what the business does in a short, liftable sentence.')
  }

  const concise = home.paragraphs.filter((p) => {
    const w = countWords(p)
    return w >= 12 && w <= 80
  })
  if (concise.length >= 5) {
    f.award(5, `${concise.length} self-contained paragraphs are short enough to be quoted as an answer.`, ev(home.url, 'text', truncate(concise[0], 200)))
  } else if (concise.length >= 2) {
    f.award(2, `Only ${concise.length} paragraphs are in the concise range that quotes well.`)
  } else {
    f.miss('Paragraphs are not in a length range that quotes cleanly as an answer.')
  }

  return f.build()
}

function findOpeningAnswer(page: ExtractedPage): string | null {
  for (const p of page.paragraphs.slice(0, 6)) {
    const w = countWords(p)
    if (w >= 12 && p.length <= 300) return truncate(p, 300)
  }
  return null
}

// ── 4. Factual citable claims (15) ─────────────────────────────────────────────

function scoreCitableClaims({ home }: ScoreInput): Factor {
  const f = new FactorBuilder('citable-claims', 'Factual citable claims', 15)

  if (home.statistics.length >= 3) {
    f.award(5, `${home.statistics.length} specific figures appear in the copy.`, ev(home.url, 'text', home.statistics[0]))
  } else if (home.statistics.length >= 1) {
    f.award(2, `${home.statistics.length} specific figure(s) appear in the copy.`, ev(home.url, 'text', home.statistics[0]))
  } else {
    f.miss('No concrete figures or data points appear in the copy.')
  }

  if (home.outboundCitations.length >= 2) {
    f.award(5, `${home.outboundCitations.length} outbound links point to third-party sources.`, ev(home.url, 'link', home.outboundCitations.slice(0, 2).map((l) => l.absolute).join(', ')))
  } else if (home.outboundCitations.length === 1) {
    f.award(2, 'One outbound link points to a third-party source.', ev(home.url, 'link', home.outboundCitations[0].absolute))
  } else {
    f.miss('No outbound links to third-party sources were found, so no claim on the page is traceable to a source.')
  }

  if (home.testimonials.length) {
    const t = home.testimonials[0]
    f.award(5, `Named client feedback is published (attributed to ${t.attribution}), which is first-hand evidence an AI engine can attribute.`, ev(home.url, 'text', `${t.quote} — ${t.attribution}`))
  } else {
    f.miss('No attributed client feedback, case result or other first-hand evidence was found.')
  }

  return f.build()
}

// ── 5. Content structure (15) ──────────────────────────────────────────────────

function scoreContentStructure({ home }: ScoreInput): Factor {
  const f = new FactorBuilder('structure', 'Content structure', 15)

  const h1s = home.headings.filter((h) => h.level === 1)
  if (h1s.length === 1) {
    f.award(3, `A single H1 states the page topic ("${truncate(h1s[0].text, 80)}").`, ev(home.url, 'heading', h1s[0].text))
  } else if (h1s.length === 0) {
    f.miss('The page has no H1 element.')
  } else {
    f.award(1, `The page has ${h1s.length} H1 elements; exactly one makes the topic unambiguous.`)
  }

  const h2s = home.headings.filter((h) => h.level === 2)
  const h3s = home.headings.filter((h) => h.level === 3)
  if (h2s.length >= 4) {
    f.award(4, `${h2s.length} H2 sections divide the page into distinct topics.`, ev(home.url, 'heading', h2s.slice(0, 4).map((h) => h.text).join(' | ')))
  } else if (h2s.length >= 1) {
    f.award(2, `${h2s.length} H2 section(s) are present.`, ev(home.url, 'heading', h2s.map((h) => h.text).join(' | ')))
  } else {
    f.miss('No H2 elements divide the page into sections.')
  }

  if (h3s.length >= 3) {
    f.award(2, `${h3s.length} H3 subsections add a second level of detail.`, ev(home.url, 'heading', h3s.slice(0, 3).map((h) => h.text).join(' | ')))
  }

  if (!hasSkippedLevels(home.headings)) {
    f.award(2, 'Heading levels descend in order without skipping a level.')
  } else {
    f.miss('Heading levels skip a level in places, which obscures the document outline.')
  }

  if (home.lists.length >= 2) {
    f.award(2, `${home.lists.length} lists break content into scannable items.`, ev(home.url, 'list', home.lists[0].items.slice(0, 3).join(' / ')))
  } else if (home.lists.length === 1) {
    f.award(1, 'One list is present.')
  } else {
    f.miss('No bulleted or numbered lists were found.')
  }

  const numbered = findNumberedSections(home)
  if (numbered.length >= 3) {
    f.award(1, `A numbered sequence walks through ${numbered.length} steps (${numbered.slice(0, 3).join(', ')}).`, ev(home.url, 'heading', numbered.slice(0, 4).join(' | ')))
  }

  if (home.tables.length) {
    f.award(1, `${home.tables.length} table(s) present comparable data.`, ev(home.url, 'table', home.tables[0].headerCells.join(' | ')))
  }

  return f.build()
}

function hasSkippedLevels(headings: { level: number }[]): boolean {
  let previous = 0
  for (const h of headings) {
    if (previous && h.level > previous + 1) return true
    previous = h.level
  }
  return false
}

function findNumberedSections(page: ExtractedPage): string[] {
  return page.headings.filter((h) => /^\s*(\d{1,2})[.)]\s*\S/.test(h.text)).map((h) => h.text)
}

// ── 6. Brand / entity clarity (10) ─────────────────────────────────────────────

function scoreBrandClarity({ home }: ScoreInput): Factor {
  const f = new FactorBuilder('brand', 'Brand/entity clarity', 10)

  const brand = findBrandName(home)
  if (brand) {
    f.award(3, `The brand is named consistently as "${brand}".`, ev(home.url, 'meta', brand))
  } else {
    f.miss('No consistent brand name could be read from the title, headings or markup.')
  }

  const descriptor = home.metaDescription || findOpeningAnswer(home)
  if (descriptor) {
    f.award(3, 'The page states what the business does near the top.', ev(home.url, home.metaDescription ? 'meta' : 'text', descriptor))
  } else {
    f.miss('Nothing near the top of the page states what the business does.')
  }

  const contact = [...home.emails, ...home.phones]
  if (contact.length) {
    f.award(2, `Contact details are published on the page (${contact.slice(0, 2).join(', ')}).`, ev(home.url, 'contact', contact.slice(0, 2).join(', ')))
  } else {
    f.miss('No email address or phone number is visible on the inspected page.')
  }

  if (brand && home.structuredDataTypes.some((t) => /^(Organization|LocalBusiness|OnlineBusiness|ProfessionalService)$/i.test(t))) {
    f.award(2, 'The brand name in the copy matches the entity declared in structured data.')
  } else {
    f.miss('The brand is not backed by an Organization entity in structured data.')
  }

  return f.build()
}

function findBrandName(page: ExtractedPage): string | null {
  for (const node of page.structuredData) {
    if (node.types.some((t) => /^(Organization|LocalBusiness|OnlineBusiness|WebSite|ProfessionalService)$/i.test(t))) {
      const name = node.raw.name
      if (typeof name === 'string' && name.trim()) return name.trim()
    }
  }
  // Fall back to the trailing segment of the title, e.g. "Page title - Brand".
  const parts = page.title.split(/\s[|\-–—]\s/)
  if (parts.length > 1) return parts[parts.length - 1].trim() || null
  return page.title || null
}

// ── 7. Freshness signals (10) ──────────────────────────────────────────────────

function scoreFreshness({ home, keyPages, now }: ScoreInput): Factor {
  const f = new FactorBuilder('freshness', 'Freshness signals', 10)

  const blog = pageForRole(keyPages, 'blog')
  const dates = [...home.dates, ...(blog?.page?.dates ?? [])]
  const freshness = assessFreshness(dates, now)

  if (dates.length === 0) {
    f.miss('No published or updated date was found in the markup of the pages inspected.')
    return f.build()
  }

  f.award(4, `Publication metadata is present (${dates.length} date field(s)).`, ev(home.url, 'date', dates.slice(0, 3).map((d) => `${d.source}: ${d.iso}`).join(', ')))

  if (freshness.futureDates.length) {
    f.miss(`${freshness.futureDates.length} date(s) are set after today (${freshness.futureDates.map((d) => d.iso).join(', ')}), which usually indicates a templating error.`)
  }

  if (!freshness.mostRecent || freshness.daysOld === null) {
    f.miss('Every date found is in the future, so there is no usable recency signal.')
    return f.build()
  }

  const { daysOld, bucket, mostRecent } = freshness
  const evidence = ev(home.url, 'date', `${mostRecent.source}: ${mostRecent.iso}`)

  if (bucket === 'current') {
    f.award(6, `The most recent update is ${mostRecent.iso}, ${daysOld} days ago.`, evidence)
  } else if (bucket === 'recent') {
    f.award(4, `The most recent update is ${mostRecent.iso}, about ${Math.round(daysOld / 30)} months ago.`, evidence)
  } else if (bucket === 'aging') {
    f.award(2, `The most recent update is ${mostRecent.iso}, about ${Math.round(daysOld / 30)} months ago.`, evidence)
  } else {
    f.miss(`The most recent update is ${mostRecent.iso}, over ${Math.floor(daysOld / 365)} year(s) ago.`)
    f.note(evidence)
  }

  return f.build()
}
