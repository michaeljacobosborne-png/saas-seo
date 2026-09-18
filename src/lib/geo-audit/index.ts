/**
 * Audit orchestration: fetch → parse → extract → score → report.
 *
 * The route is a thin wrapper over `runAudit`. Everything that decides what a
 * report says lives here and in the modules it calls, so it can be tested
 * without a network or a model.
 */

import { crawlKeyPages, findKeyPages, pageForRole, type KeyPageResult } from './crawl'
import { assessAccess, type AccessReport } from './access'
import { fetchLlmsTxt, fetchRobotsTxt } from './robots'
import { extractPage, truncate, type ExtractedPage } from './extract'
import { fetchPage, normaliseUrl, type FetchOptions } from './fetch'
import { narrate, type NarrateOutput } from './narrate'
// Phase B superseded the per-tool factor lists (score-geo / score-ao) with one
// shared core. Those modules remain only for their helper exports.
import { scoreRetrievability } from './score-retrievability'
import { assessCitability } from './assess-citability'
import { diagnoseGap } from './gap'
import { findBandInconsistencies, findScoreInconsistencies } from './scoring'
import type { AuditReport, ChainOfCustody, InspectedPage } from './types'

export * from './types'
export { extractPage } from './extract'
export { fetchPage, normaliseUrl } from './fetch'
export { computeTotals, deriveStatus, gradeForScore, findScoreInconsistencies } from './scoring'
export { assessFreshness, relationToNow, parseDate } from './dates'

export interface RunAuditOptions extends FetchOptions {
  /** The audit clock. Injected so date logic is testable and never guessed. */
  now?: Date
  /** Set false to skip following internal links (used in tests). */
  crawl?: boolean
  maxCrawlPages?: number
  /** Set false to skip the model and use deterministic wording. */
  useModel?: boolean
  onProgress?: (message: string, step: number, total: number) => void
}

export const AUDIT_STEPS = 4

export class AuditError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message)
    this.name = 'AuditError'
  }
}

export async function runAudit(
  rawUrl: string,
  type: 'geo' | 'ao',
  options: RunAuditOptions = {},
): Promise<AuditReport> {
  const {
    now = new Date(),
    crawl = true,
    maxCrawlPages = 3,
    useModel = true,
    onProgress = () => {},
    ...fetchOptions
  } = options

  const url = normaliseUrl(rawUrl)
  const notes: string[] = []
  const pagesInspected: InspectedPage[] = []

  // ── 1. Fetch ────────────────────────────────────────────────────────────────
  onProgress('Fetching the page…', 1, AUDIT_STEPS)
  const fetched = await fetchPage(url, fetchOptions)

  if (!fetched.ok) {
    throw new AuditError(fetched.note ?? 'Could not fetch that URL.', fetched.status)
  }
  if (fetched.renderedBy) notes.push(`Page content was obtained via the ${fetched.renderedBy} renderer.`)

  // ── 2. Extract, and validate the extraction before scoring anything ─────────
  onProgress('Reading the page content…', 2, AUDIT_STEPS)
  const home = extractPage(fetched.html, fetched.finalUrl)

  // ── 2a. Crawler access. Two small same-origin fetches, run in parallel. ─────
  onProgress('Checking crawler access…', 3, AUDIT_STEPS)
  const [robotsResult, llmsResult] = await Promise.all([
    fetchRobotsTxt(fetched.finalUrl, { fetchImpl: fetchOptions.fetchImpl, userAgent: fetched.userAgent }),
    fetchLlmsTxt(fetched.finalUrl, { fetchImpl: fetchOptions.fetchImpl }),
  ])

  const access = assessAccess({
    robots: robotsResult,
    llmsTxt: llmsResult,
    requestedUrl: url,
    finalUrl: fetched.finalUrl,
    httpStatus: fetched.status,
    headers: fetched.headers,
    metaRobots: home.metaRobots,
    canonical: home.canonical || null,
    jsOnlySuspected: fetched.jsOnlySuspected,
  })

  if (robotsResult.state === 'unknown' && robotsResult.note) notes.push(robotsResult.note)

  const couldNotFetch = [...fetched.couldNotFetch]
  if (robotsResult.state === 'unknown') {
    couldNotFetch.push({ url: robotsResult.url, reason: robotsResult.note ?? 'robots.txt unreadable' })
  }

  const truncations = fetched.truncation ? [fetched.truncation] : []
  if (fetched.truncation) notes.push(fetched.truncation.disclosure)

  const chainOfCustody: ChainOfCustody = {
    fetchedAt: now.toISOString(),
    userAgent: fetched.userAgent,
    renderMode: fetched.renderMode,
    renderedBy: fetched.renderedBy,
    requestedUrl: url,
    finalUrl: fetched.finalUrl,
    httpStatus: fetched.status,
    elapsedMs: fetched.elapsedMs,
    couldNotFetch,
    truncations,
  }

  pagesInspected.push({
    url,
    finalUrl: fetched.finalUrl,
    status: fetched.status,
    ok: true,
    wordCount: home.wordCount,
    renderedBy: fetched.renderedBy,
    note: fetched.note,
  })

  if (!home.hasMeaningfulContent) {
    // Access is still fully assessable here, and on a JS-only page it is the
    // most useful part of the report — so it is passed through, not discarded.
    return incompleteReport({
      type,
      url,
      finalUrl: fetched.finalUrl,
      now,
      home,
      pagesInspected,
      notes,
      fetchNote: fetched.note,
      chainOfCustody,
      access,
    })
  }

  // ── 3. Follow the internal links sitewide claims depend on ──────────────────
  let keyPages: KeyPageResult[] = []
  if (crawl) {
    onProgress('Checking linked pages…', 3, AUDIT_STEPS)
    const candidates = findKeyPages(home.links)
    if (candidates.length) {
      keyPages = await crawlKeyPages(candidates, { ...fetchOptions, maxPages: maxCrawlPages })
      for (const result of keyPages) {
        pagesInspected.push({
          url: result.url,
          finalUrl: result.page?.url ?? result.url,
          status: result.status,
          ok: result.ok,
          wordCount: result.page?.wordCount ?? 0,
          note: result.note,
        })
        if (!result.ok) {
          notes.push(`Could not inspect the ${result.role} page at ${result.url}: ${result.note ?? 'unknown error'}.`)
        }
      }
    }
  } else {
    onProgress('Checking linked pages…', 3, AUDIT_STEPS)
  }

  // ── 4. Score deterministically, then write prose about the result ──────────
  //
  // One scoring core for both tools. GEO and AO differ only in how the report is
  // presented and what the prose emphasises — never in how the numbers are
  // produced, because two scoring systems is two systems to keep honest.
  const retrievability = scoreRetrievability({ home, access, now })
  const citability = assessCitability({ home, keyPages, now })
  const gap = diagnoseGap(retrievability, citability)

  // `breakdown` is the flattened retrievability checks, so it sums to the score
  // the report publishes. Legacy renderers iterate this unchanged.
  const factors = retrievability.groups.flatMap((g) => g.checks)

  const problems = [
    ...findScoreInconsistencies(factors, retrievability),
    ...findBandInconsistencies(citability.signals, citability.band),
  ]
  if (problems.length) {
    // A scoring bug must never reach a prospect as a confident number.
    notes.push(...problems.map((p) => `Score consistency problem: ${p}`))
    if (process.env.NODE_ENV !== 'production') {
      throw new Error(`Inconsistent audit scoring: ${problems.join('; ')}`)
    }
  }

  onProgress('Writing your report…', 4, AUDIT_STEPS)
  let narration: NarrateOutput
  if (useModel) {
    narration = await narrate({
      type,
      url: fetched.finalUrl,
      factors,
      alreadyPresent: summarisePresent(home, keyPages),
      scoreWithheld: retrievability.scoreWithheld,
    })
    if (narration.usedFallback) {
      notes.push('Recommendations were generated without the language model; wording is plainer than usual.')
    }
    if (narration.truncation) {
      chainOfCustody.truncations.push(narration.truncation)
      notes.push(narration.truncation.disclosure)
    }
  } else {
    const { fallbackNarration } = await import('./narrate')
    narration = {
      ...fallbackNarration({ type, url: fetched.finalUrl, factors, alreadyPresent: [], scoreWithheld: retrievability.scoreWithheld }),
      usedFallback: true,
      truncation: null,
    }
  }

  return {
    // Legacy surface. /report/[token] and the stored audit_results rows key off
    // score + grade + breakdown, so `score` mirrors Retrievability and old
    // renderers keep working unchanged. Citability is never blended into it.
    score: retrievability.scoreWithheld ? 0 : retrievability.score,
    grade: retrievability.grade,
    breakdown: factors,
    recommendations: narration.recommendations,
    quickWins: narration.quickWins,
    tool: type,
    url,
    finalUrl: fetched.finalUrl,
    analyzedAt: now.toISOString(),
    rawScore: retrievability.rawScore,
    assessedMaxScore: retrievability.assessedMaxScore,
    totalMaxScore: retrievability.totalMaxScore,
    scoreWithheld: retrievability.scoreWithheld,
    withheldReason: retrievability.withheldReason,
    confidence: retrievability.confidence,
    incomplete:
      retrievability.scoreWithheld ||
      retrievability.groups.some((g) => !g.scored) ||
      citability.signals.some((s) => s.band === 'unverified') ||
      pagesInspected.some((p) => !p.ok),
    pagesInspected,
    notes,
    chainOfCustody,
    access,
    retrievability,
    citability,
    gap,
  }
}

/**
 * The page fetched but contained too little readable text to assess. We report
 * that plainly instead of scoring a page we could not read.
 */
function incompleteReport(args: {
  type: 'geo' | 'ao'
  url: string
  finalUrl: string
  now: Date
  home: ExtractedPage
  pagesInspected: InspectedPage[]
  notes: string[]
  fetchNote?: string
  chainOfCustody: ChainOfCustody
  access: AccessReport
}): AuditReport {
  const { type, url, finalUrl, now, home, pagesInspected, notes, fetchNote, chainOfCustody, access } = args

  const reason = access.jsOnlyContent
    ? `Only ${home.wordCount} words of readable text are present in the raw HTML, so this page's content appears only after JavaScript runs. AI crawlers such as GPTBot and PerplexityBot do not execute JavaScript, so they cannot see this content either.`
    : (fetchNote ??
      `Only ${home.wordCount} words of readable text could be extracted from this page.`)

  // Same scoring core as a normal run. Access and Parseability describe the raw
  // HTML and stay assessable here; the content-dependent groups are marked
  // unverified rather than scored zero.
  const retrievability = scoreRetrievability({ home, access, now, contentReadable: false })
  const citability = assessCitability({ home, keyPages: [], now })
  const gap = diagnoseGap(retrievability, citability)
  const factors = retrievability.groups.flatMap((g) => g.checks)

  return {
    score: 0,
    grade: 'N/A',
    breakdown: factors,
    recommendations: [
      {
        priority: 'high',
        title: 'This page could not be read well enough to audit',
        description: `${reason} Re-run against a page that serves its content in HTML, or make the key content server-rendered so crawlers can read it without running scripts.`,
        impact: 'Content a crawler cannot read cannot be quoted by anything.',
      },
    ],
    quickWins: [],
    tool: type,
    url,
    finalUrl,
    analyzedAt: now.toISOString(),
    rawScore: retrievability.rawScore,
    assessedMaxScore: retrievability.assessedMaxScore,
    totalMaxScore: retrievability.totalMaxScore,
    scoreWithheld: true,
    withheldReason: reason,
    confidence: 'low',
    incomplete: true,
    pagesInspected,
    notes,
    chainOfCustody,
    access,
    retrievability: { ...retrievability, scoreWithheld: true, withheldReason: reason },
    citability,
    gap,
  }
}

/** Feeds the model a list of things it must not tell the owner to add. */
function summarisePresent(home: ExtractedPage, keyPages: KeyPageResult[]): string[] {
  const present: string[] = []

  if (home.emails.length) present.push(`Contact email published on the page: ${home.emails[0]}`)
  if (home.phones.length) present.push(`Phone number published on the page: ${home.phones[0]}`)
  if (home.testimonials.length) {
    present.push(`Attributed client testimonial (${home.testimonials[0].attribution})`)
  }
  if (home.socialLinks.length) present.push(`Social/professional profiles linked: ${home.socialLinks.slice(0, 3).join(', ')}`)

  const h1 = home.headings.find((h) => h.level === 1)
  if (h1) present.push(`H1: "${truncate(h1.text, 100)}"`)

  const h2s = home.headings.filter((h) => h.level === 2)
  if (h2s.length) present.push(`${h2s.length} real H2 headings, including: ${h2s.slice(0, 5).map((h) => `"${truncate(h.text, 60)}"`).join(', ')}`)

  const h3s = home.headings.filter((h) => h.level === 3)
  if (h3s.length) present.push(`${h3s.length} real H3 headings`)

  if (home.structuredDataTypes.length) {
    present.push(`Structured data types already present: ${home.structuredDataTypes.join(', ')}`)
  }
  if (home.lists.length) present.push(`${home.lists.length} lists`)
  if (home.tables.length) present.push(`${home.tables.length} tables`)

  for (const role of ['about', 'blog', 'caseStudies'] as const) {
    const result = pageForRole(keyPages, role)
    if (result?.ok) present.push(`A ${role} page exists and was inspected: ${result.url}`)
    else if (result) present.push(`A ${role} page is linked at ${result.url} (could not be fetched)`)
  }

  if (home.dates.length) {
    present.push(`Publication dates in markup: ${home.dates.slice(0, 3).map((d) => d.iso).join(', ')}`)
  }

  return present
}
