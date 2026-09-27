/**
 * Retrievability — can an engine reach, parse, chunk and extract this page?
 *
 * Entirely rule-derived: every check here has a right answer the user can verify
 * against their own markup. Four groups with published weights:
 *
 *   Access         30   can it be fetched and indexed at all
 *   Parseability   25   is the content readable without running scripts
 *   Chunkability   25   can it be split into coherent, self-contained sections
 *   Extractability 20   can a clean answer be lifted out of it
 *
 * Scoring is ADDITIVE internally — points are awarded for what is present, so an
 * unassessable check is excluded rather than counted as a failure. The UI
 * presents the same numbers as deductions (`group.deduction = maxScore - score`),
 * which reads better without inverting the arithmetic. Inverting it would break
 * the unverified path: "we could not check this" and "this is broken" must never
 * produce the same number.
 */


import { countWords, truncate, type ExtractedPage } from './extract'
import { summariseAccess, type AccessReport } from './access'
import {
  isPolicyBlock,
  summarise as summariseCrawlerProbe,
  type CrawlerAccessReport,
} from './crawler-access'
import { FactorBuilder, clamp, computeTotals, deriveStatus } from './scoring'
import {
  STATUS_LABELS,
  type Evidence,
  type Factor,
  type Retrievability,
  type RetrievabilityGroup,
  type RetrievabilityGroupId,
} from './types'

export interface RetrievabilityInput {
  home: ExtractedPage
  access: AccessReport | null
  now: Date
  /**
   * False when the page yielded too little readable text to judge its content.
   *
   * Access and Parseability are still assessed — they describe the raw HTML and
   * are the useful findings on a JavaScript-only page. Chunkability and
   * Extractability become `unverified`, because "no headings in an empty shell"
   * is a statement about what we could read, not about the page.
   */
  contentReadable?: boolean
  /**
   * Live crawler probe results, when the run performed one.
   *
   * robots.txt is a declaration; this is enforcement. When present it decides
   * `access-crawlers`, because a 403 at the edge stops a crawler whatever
   * robots.txt permits — which is the case Cloudflare's 2025 default created and
   * most site owners cannot see. Absent, scoring is exactly as before, so scores
   * from runs without a probe stay comparable.
   */
  crawlerAccess?: CrawlerAccessReport | null
}

const ev = (url: string, kind: Evidence['kind'], snippet: string): Evidence => ({
  url,
  kind,
  snippet: truncate(snippet, 300),
})

const QUESTION_WORD = /^(what|why|how|when|where|who|which|can|do|does|is|are|should|will)\b/i

const GROUP_NAMES: Record<RetrievabilityGroupId, string> = {
  access: 'Access',
  parseability: 'Parseability',
  chunkability: 'Chunkability',
  extractability: 'Extractability',
}

export function scoreRetrievability(input: RetrievabilityInput): Retrievability {
  const readable = input.contentReadable !== false
  const unreadableReason =
    'The page did not yield enough readable text to judge its content structure. This describes what we could read, not a fault in the page.'

  const groups: RetrievabilityGroup[] = [
    buildGroup('access', scoreAccess(input)),
    buildGroup('parseability', scoreParseability(input)),
    buildGroup(
      'chunkability',
      readable ? scoreChunkability(input) : unverifiedChecks(CHUNK_CHECKS, unreadableReason),
    ),
    buildGroup(
      'extractability',
      readable ? scoreExtractability(input) : unverifiedChecks(EXTRACT_CHECKS, unreadableReason),
    ),
  ]

  const allChecks = groups.flatMap((g) => g.checks)
  const totals = computeTotals(allChecks)

  return {
    score: totals.score,
    grade: totals.grade,
    rawScore: totals.rawScore,
    assessedMaxScore: totals.assessedMaxScore,
    totalMaxScore: totals.totalMaxScore,
    scoreWithheld: totals.scoreWithheld,
    withheldReason: totals.withheldReason,
    confidence: totals.confidence,
    groups,
  }
}

/** Check identities, so the unreadable path produces the same shape as the normal one. */
const CHUNK_CHECKS: [string, string, number][] = [
  ['chunk-hierarchy', 'Heading hierarchy', 12],
  ['chunk-sections', 'Self-contained sections', 8],
  ['chunk-lengths', 'Block length distribution', 5],
]
const EXTRACT_CHECKS: [string, string, number][] = [
  ['extract-answers', 'Direct answers', 10],
  ['extract-questions', 'Question coverage', 6],
  ['extract-density', 'Lists, tables and data', 4],
]

function unverifiedChecks(defs: [string, string, number][], reason: string): Factor[] {
  return defs.map(([id, name, maxScore]) =>
    new FactorBuilder(id, name, maxScore).unverified(reason).build(),
  )
}

function buildGroup(id: RetrievabilityGroupId, checks: Factor[]): RetrievabilityGroup {
  const scored = checks.filter((c) => c.scored)
  const score = scored.reduce((s, c) => s + c.score, 0)
  const maxScore = checks.reduce((s, c) => s + c.maxScore, 0)
  const assessedMax = scored.reduce((s, c) => s + c.maxScore, 0)
  const anyScored = scored.length > 0
  const status = anyScored ? deriveStatus(score, assessedMax) : 'unverified'

  return {
    id,
    name: GROUP_NAMES[id],
    score,
    maxScore,
    // Deduction is computed against what we could actually assess, so an
    // unverified check never shows up as points lost.
    deduction: anyScored ? assessedMax - score : 0,
    scored: anyScored,
    status,
    label: STATUS_LABELS[status],
    checks,
  }
}

// ── Access (30) ───────────────────────────────────────────────────────────────

/**
 * Fold the live probe into the crawler check.
 *
 * A retrieval crawler counts as blocked when robots.txt disallows it **or** the
 * origin attributably refused it. Enforcement outranks declaration: a
 * permissive robots.txt plus a 403 is still a crawler that cannot fetch the
 * page, and that divergence is the whole reason the probe exists.
 *
 * Only `ai-search` crawlers reach the score. Training crawlers are reported by
 * `reportTrainingProbe` and never scored — blocking them is a legitimate
 * editorial choice, and scoring it would push publishers against their own
 * interest.
 *
 * Returns null when there is nothing attributable to say, so the caller falls
 * back to the robots.txt-only path rather than scoring on absent evidence.
 */
function foldProbeIntoCrawlers(
  probe: CrawlerAccessReport,
  robotsBlockedTokens: Set<string>,
  /** Every retrieval crawler robots.txt gave a verdict on, probed or not. */
  robotsAssessedTokens: Set<string>,
): { score: number; detail: string; evidence: Evidence[] } | null {
  if (probe.baselineFailed) return null

  const s = summariseCrawlerProbe(probe)
  const retrieval = probe.probes.filter((p) => p.class === 'ai-search' && p.attributable)
  const probed = retrieval.filter(
    (p) => p.blockKind !== 'network-error' && p.blockKind !== 'rate-limited',
  )
  if (probed.length === 0) return null

  const blocked = probed.filter((p) => isPolicyBlock(p.blockKind) || robotsBlockedTokens.has(p.token))
  const allowed = probed.filter((p) => !blocked.includes(p))

  const evidence: Evidence[] = probed.map((p) =>
    ev(probe.url, 'header', `${p.token}: HTTP ${p.status ?? 'no response'} — ${p.evidence}`),
  )

  // Crawlers robots.txt assessed that we could not probe — Google-Extended and
  // Applebot-Extended are control tokens with no fetcher. They keep their
  // robots.txt verdict, so folding in the probe never silently assesses fewer
  // crawlers than the declaration-only path did. Dropping them would change the
  // denominator and make probed and unprobed runs incomparable.
  const probedTokens = new Set(probed.map((p) => p.token))
  const declarationOnly = [...robotsAssessedTokens].filter((t) => !probedTokens.has(t))
  const declarationBlocked = declarationOnly.filter((t) => robotsBlockedTokens.has(t))

  const total = probed.length + declarationOnly.length
  const okCount = allowed.length + (declarationOnly.length - declarationBlocked.length)
  const blockedCount = blocked.length + declarationBlocked.length

  if (declarationOnly.length) {
    evidence.push(
      ev(
        probe.url,
        'text',
        `${declarationOnly.join(', ')} assessed from robots.txt only — ${declarationOnly.length === 1 ? 'it is a' : 'these are'} robots.txt control token${declarationOnly.length === 1 ? '' : 's'} with no fetching user-agent to test.`,
      ),
    )
  }

  if (blockedCount === 0) {
    return {
      score: 14,
      detail:
        `All ${total} AI search crawlers are permitted: ${probed.length} were served the page when requested ` +
        `with their own user-agent${declarationOnly.length ? `, and ${declarationOnly.length} permitted by robots.txt` : ''}. ` +
        `Checked ${probe.checkedAt}.`,
      evidence,
    }
  }

  const divergent = blocked.filter((p) => p.divergence === 'robots-allows-origin-blocks')
  const lead = divergent.length
    ? `robots.txt permits ${divergent.map((p) => p.token).join(', ')}, but the origin refused ${divergent.length === 1 ? 'it' : 'them'} anyway` +
      `${divergent[0].edgeVendor ? ` (${divergent[0].edgeVendor})` : ''}. A permissive robots.txt does not help when the edge turns the request away.`
    : `${blockedCount} of ${total} AI search crawlers cannot reach this page.`

  const asym =
    s.asymmetry === 'retrieval-blocked-training-allowed'
      ? ' Training crawlers were served while retrieval crawlers were not, which is the opposite of what most publishers intend.'
      : ''

  return {
    score: Math.round((okCount / total) * 14),
    detail: `${lead}${asym} This records what the origin served to each user-agent, not whether any AI system has retrieved or cited the page.`,
    evidence,
  }
}

/**
 * Training and user-triggered probe results, reported and never scored, so the
 * user can see the whole picture without a legitimate editorial choice being
 * counted against them.
 */
function reportTrainingProbe(probe: CrawlerAccessReport): Factor | null {
  if (probe.baselineFailed) return null
  const rows = probe.probes.filter((p) => p.class !== 'ai-search' && p.attributable)
  if (rows.length === 0) return null

  const b = new FactorBuilder('access-training-crawlers', 'Training crawler access', 0)
  const blocked = rows.filter((p) => isPolicyBlock(p.blockKind))
  const served = rows.filter((p) => p.contentServed)

  b.unverified(
    blocked.length === 0
      ? `All ${rows.length} training crawlers were served the page. Reported for completeness — this is not scored, because allowing or blocking training crawlers is an editorial choice with no bearing on AI search visibility.`
      : `${blocked.map((p) => p.token).join(', ')} ${blocked.length === 1 ? 'was' : 'were'} refused; ${served.length} of ${rows.length} were served. Not scored: blocking training crawlers is a legitimate choice and does not remove a page from AI search.`,
  )
  for (const p of rows) {
    b.note(ev(probe.url, 'header', `${p.token}: HTTP ${p.status ?? 'no response'} — ${p.evidence}`))
  }
  return b.build()
}

function scoreAccess({ home, access, crawlerAccess }: RetrievabilityInput): Factor[] {
  const crawlers = new FactorBuilder('access-crawlers', 'AI crawler access', 14)
  const indexing = new FactorBuilder('access-indexing', 'Indexing directives', 10)
  const reachable = new FactorBuilder('access-reachable', 'Fetch and canonical', 6)

  if (!access) {
    crawlers.unverified('Crawler access was not assessed on this run.')
    indexing.unverified('Indexing directives were not assessed on this run.')
    reachable.unverified('Fetch details were not assessed on this run.')
    return [crawlers.build(), indexing.build(), reachable.build()]
  }

  const s = summariseAccess(access)
  const scoredTotal = s.searchAllowed.length + s.searchBlocked.length

  // Live probe first when we have one: enforcement outranks declaration.
  //
  // But only when robots.txt was actually readable. An unreadable robots.txt
  // (5xx, timeout) is indeterminate, and per RFC 9309 a compliant crawler treats
  // an unavailable robots.txt as disallow-all — so observing that the origin
  // *would* serve us proves nothing about whether a crawler will ask. Awarding
  // marks there would turn a real risk into a pass.
  const robotsReadable = access.robots.state !== 'unknown'
  const folded =
    crawlerAccess && robotsReadable
      ? foldProbeIntoCrawlers(
          crawlerAccess,
          new Set(s.searchBlocked.map((c) => c.token)),
          new Set([...s.searchAllowed, ...s.searchBlocked].map((c) => c.token)),
        )
      : null

  if (folded) {
    crawlers.award(folded.score, folded.detail, ...folded.evidence)
    if (crawlerAccess) {
      for (const c of crawlerAccess.caveats) crawlers.note(ev(crawlerAccess.url, 'text', c))
    }
  } else if (scoredTotal === 0) {
    crawlers.unverified(
      access.robots.note ?? 'robots.txt could not be read, so AI crawler access could not be determined.',
    )
  } else if (s.searchBlocked.length === 0) {
    crawlers.award(
      14,
      `All ${scoredTotal} AI search crawlers are permitted by robots.txt.`,
      ev(access.robots.url || access.finalUrl, 'text', s.searchAllowed.map((c) => c.token).join(', ')),
    )
  } else {
    crawlers.award(
      Math.round((s.searchAllowed.length / scoredTotal) * 14),
      `${s.searchBlocked.length} of ${scoredTotal} AI search crawlers are blocked (${s.searchBlocked.map((c) => c.token).join(', ')}). ${s.searchBlocked[0].reason}`,
      ev(access.robots.url || access.finalUrl, 'text', s.searchBlocked.map((c) => `${c.token}: ${c.reason}`).join(' | ')),
    )
  }
  // Only meaningful on the robots.txt-only path; the probe reports its own
  // unknowns through its caveats, and adding this there would double-count.
  if (!folded && s.searchUnknown.length) {
    crawlers.miss(`${s.searchUnknown.length} crawler(s) could not be checked and are excluded from this score.`)
  }

  // Probe ran but did not feed the score (unreadable robots.txt, or nothing
  // attributable). The observation is still worth showing — it just cannot earn
  // marks — so it rides along as evidence rather than being discarded.
  if (crawlerAccess && !folded && !crawlerAccess.baselineFailed) {
    const rows = crawlerAccess.probes.filter((p) => p.class === 'ai-search' && p.attributable)
    if (rows.length) {
      crawlers.note(
        ev(
          crawlerAccess.url,
          'text',
          !robotsReadable
            ? `robots.txt was unreadable, so crawler permission is indeterminate and not scored. Separately, the origin served ${rows.filter((p) => p.contentServed).length} of ${rows.length} AI search crawlers when asked directly.`
            : `Live probe: ${rows.filter((p) => p.contentServed).length} of ${rows.length} AI search crawlers were served.`,
        ),
      )
      for (const p of rows) {
        crawlers.note(ev(crawlerAccess.url, 'header', `${p.token}: HTTP ${p.status ?? 'no response'} — ${p.evidence}`))
      }
    }
  }

  if (access.directives.noindex) {
    indexing.miss(
      `The page carries a noindex directive via ${access.directives.noindexSource === 'meta' ? 'its robots meta tag' : 'the X-Robots-Tag header'}, which asks every engine to leave it out of results.`,
    )
    indexing.note(ev(access.finalUrl, 'meta', access.directives.metaRobots ?? access.directives.xRobotsTag ?? 'noindex'))
  } else {
    indexing.award(10, 'No noindex directive blocks the page from being used.')
  }

  if (access.httpStatus === 200) {
    reachable.award(2, `The page returns HTTP ${access.httpStatus}.`)
  } else {
    reachable.miss(`The page returned HTTP ${access.httpStatus ?? 'unknown'}.`)
  }

  if (access.canonicalMismatch) {
    reachable.miss(`The canonical URL points elsewhere (${access.canonical}), so engines may credit that URL instead.`)
    reachable.note(ev(access.finalUrl, 'meta', `canonical: ${access.canonical}`))
  } else if (home.canonical) {
    reachable.award(2, 'A canonical URL is declared and matches the page analysed.')
  } else {
    reachable.miss('No canonical URL is declared, so duplicate or parameterised versions of this page compete with it.')
  }

  // A sitemap declared in robots.txt is how a crawler finds the rest of the
  // site without guessing. Cheap to add, genuinely checkable, and most sites
  // that care have one.
  if (access.robots.sitemaps.length) {
    reachable.award(2, `robots.txt declares ${access.robots.sitemaps.length} sitemap(s), so crawlers can discover the rest of the site.`, ev(access.robots.url, 'link', access.robots.sitemaps[0]))
  } else if (access.robots.state === 'present') {
    reachable.miss('robots.txt declares no Sitemap, so crawlers have to discover pages by following links alone.')
  } else if (access.robots.state === 'missing') {
    reachable.miss('No robots.txt is published, so no sitemap is declared to crawlers.')
  }

  // Training-crawler rows ride along as an unverified (never scored) factor, so
  // the picture is complete without a legitimate editorial choice costing points.
  const training = crawlerAccess ? reportTrainingProbe(crawlerAccess) : null
  const out = [crawlers.build(), indexing.build(), reachable.build()]
  if (training) out.push(training)
  return out
}

// ── Parseability (25) ─────────────────────────────────────────────────────────

function scoreParseability({ home, access }: RetrievabilityInput): Factor[] {
  const serverText = new FactorBuilder('parse-server-text', 'Server-rendered content', 12)
  const structured = new FactorBuilder('parse-structured-data', 'Structured data validity', 8)
  const cleanliness = new FactorBuilder('parse-dom', 'Markup cleanliness', 5)

  // Thresholds are printed alongside the measured value, so every verdict here
  // is falsifiable against the user's own page.
  if (access?.jsOnlyContent) {
    serverText.miss(
      'The raw HTML contains almost no readable text, so this content appears only after JavaScript runs. AI crawlers such as GPTBot and PerplexityBot do not execute JavaScript and cannot see it.',
    )
  } else if (home.wordCount >= 1200) {
    serverText.award(9, `${home.wordCount} words of content are present in the raw HTML (target: 1,200+), with no JavaScript required.`, ev(home.url, 'text', truncate(home.mainText, 200)))
  } else if (home.wordCount >= 600) {
    serverText.award(6, `${home.wordCount} words are present in the raw HTML. That reads as a complete page, but pages that get quoted usually carry 1,200+ words of substance.`)
  } else if (home.wordCount >= 200) {
    serverText.award(3, `${home.wordCount} words are present in the raw HTML — readable, but thin for a page meant to be quoted (target: 1,200+).`)
  } else {
    serverText.award(1, `Only ${home.wordCount} words are present in the raw HTML (target: 1,200+).`)
  }

  // Text-to-markup ratio: content buried in a megabyte of div soup is harder to
  // extract cleanly even when the word count looks healthy.
  const ratio = home.wordCount > 0 && home.bodyText.length > 0 ? home.mainText.length / home.bodyText.length : 0
  if (ratio >= 0.6) {
    serverText.award(3, `${Math.round(ratio * 100)}% of the body text sits in the main content region (target: 60%+), so the page is mostly content rather than chrome.`)
  } else if (ratio >= 0.35) {
    serverText.award(1, `${Math.round(ratio * 100)}% of the body text sits in the main content region (target: 60%+); the rest is navigation, footer or boilerplate.`)
  } else if (ratio > 0) {
    serverText.miss(`Only ${Math.round(ratio * 100)}% of the body text sits in an identifiable main content region (target: 60%+).`)
  }

  const blocks = home.jsonLdBlocks
  const invalid = blocks.filter((b) => !b.valid)
  const types = home.structuredDataTypes
  const hasEntity = types.some((t) => /^(Organization|LocalBusiness|OnlineBusiness|Person|ProfessionalService|Corporation)$/i.test(t))
  const hasContentType = types.some((t) =>
    /^(Article|BlogPosting|NewsArticle|FAQPage|HowTo|Product|Service|Review|Course|Event|BreadcrumbList)$/i.test(t),
  )

  if (blocks.length === 0) {
    structured.miss('No JSON-LD structured data was found.')
  } else if (invalid.length > 0) {
    structured.award(
      Math.round(((blocks.length - invalid.length) / blocks.length) * 4),
      `${invalid.length} of ${blocks.length} JSON-LD block(s) contain a syntax error and are ignored by every consumer. First error at line ${invalid[0].startLine}: ${invalid[0].error}`,
      ev(home.url, 'jsonld', `line ${invalid[0].startLine}: ${invalid[0].error ?? 'parse error'}`),
    )
  } else {
    // Valid markup is the floor, not the bar. Full marks need markup that
    // actually describes both the publisher and the content.
    structured.award(3, `${blocks.length} JSON-LD block(s) parse cleanly (${types.join(', ')}).`, ev(home.url, 'jsonld', types.join(', ')))
    if (hasEntity) {
      structured.award(3, 'An entity type identifies who publishes the page.')
    } else {
      structured.miss('No Organization, LocalBusiness or Person type is declared, so the markup does not say who publishes this.')
    }
    if (hasContentType) {
      structured.award(2, 'A content-level type describes what is on the page.')
    } else {
      structured.miss('No content-level type (Article, FAQPage, Service and similar) describes what is on the page.')
    }
  }

  // Semantic landmarks are what let a parser find the content region at all.
  const hasLandmark = /<(main|article)\b/i.test(home.mainText) || home.blocks.length > 0
  const h = home.headings.length
  if (h >= 5 && home.paragraphs.length >= 5 && hasLandmark) {
    cleanliness.award(5, `The document exposes ${h} real heading elements and ${home.paragraphs.length} paragraph elements inside an identifiable content region.`)
  } else if (h > 0 && home.paragraphs.length > 0) {
    cleanliness.award(3, `The document exposes ${h} heading and ${home.paragraphs.length} paragraph elements (target: 5+ of each inside a main or article region).`)
  } else if (h > 0 || home.paragraphs.length > 0) {
    cleanliness.award(1, 'The document uses some semantic elements, but either headings or paragraphs are missing.')
  } else {
    cleanliness.miss('No semantic heading or paragraph elements were found — the text is not structurally marked up.')
  }

  return [serverText.build(), structured.build(), cleanliness.build()]
}

// ── Chunkability (25) ─────────────────────────────────────────────────────────

function scoreChunkability({ home }: RetrievabilityInput): Factor[] {
  const hierarchy = new FactorBuilder('chunk-hierarchy', 'Heading hierarchy', 12)
  const sections = new FactorBuilder('chunk-sections', 'Self-contained sections', 8)
  const lengths = new FactorBuilder('chunk-lengths', 'Block length distribution', 5)

  const h1s = home.headings.filter((x) => x.level === 1)
  const h2s = home.headings.filter((x) => x.level === 2)
  const h3s = home.headings.filter((x) => x.level === 3)

  if (h1s.length === 1) {
    hierarchy.award(3, `A single H1 states the page topic ("${truncate(h1s[0].text, 80)}").`, ev(home.url, 'heading', h1s[0].text))
  } else if (h1s.length === 0) {
    hierarchy.miss('The page has no H1 element.')
  } else {
    hierarchy.award(1, `The page has ${h1s.length} H1 elements; exactly one makes the topic unambiguous.`)
  }

  if (h2s.length >= 6) {
    hierarchy.award(4, `${h2s.length} H2 sections divide the page into distinct topics (target: 6+).`, ev(home.url, 'heading', h2s.slice(0, 4).map((x) => x.text).join(' | ')))
  } else if (h2s.length >= 3) {
    hierarchy.award(2, `${h2s.length} H2 sections are present (target: 6+ for a page meant to be chunked).`, ev(home.url, 'heading', h2s.map((x) => x.text).join(' | ')))
  } else if (h2s.length >= 1) {
    hierarchy.award(1, `${h2s.length} H2 section(s) are present (target: 6+).`)
  } else {
    hierarchy.miss('No H2 elements divide the page into sections.')
  }

  // A second heading level is what lets a long section be chunked further.
  if (h3s.length >= 6) {
    hierarchy.award(2, `${h3s.length} H3 subsections add a second level of detail (target: 6+).`)
  } else if (h3s.length >= 3) {
    hierarchy.award(1, `${h3s.length} H3 subsections are present (target: 6+).`)
  } else {
    hierarchy.miss(`Only ${h3s.length} H3 subsections (target: 6+), so longer sections cannot be split further.`)
  }

  if (!hasSkippedLevels(home.headings)) {
    hierarchy.award(2, 'Heading levels descend in order without skipping a level.')
  } else {
    hierarchy.miss('Heading levels skip a level in places, which obscures the document outline.')
  }

  // Explicitly numbered sections are the strongest chunking signal a page can
  // carry — they tell an engine exactly where one step ends and the next begins.
  const numbered = home.headings.filter((x) => /^\s*\d{1,2}[.)]\s*\S/.test(x.text)).map((x) => x.text)
  if (numbered.length >= 3) {
    hierarchy.award(
      2,
      `A numbered sequence walks through ${numbered.length} steps (${numbered.slice(0, 3).join(', ')}).`,
      ev(home.url, 'heading', numbered.slice(0, 4).join(' | ')),
    )
  }

  // A section only stands alone if it has a heading AND enough prose beneath it
  // to make sense once lifted away from the page. 40 words is about two
  // sentences — below that the heading is doing the work, not the passage.
  const substantive = home.blocks.filter((b) => b.headingText && b.wordCount >= 40)
  if (substantive.length >= 8) {
    sections.award(8, `${substantive.length} sections pair a heading with 40+ words of prose (target: 8+), so each can stand alone when quoted.`, ev(home.url, 'text', `${substantive[0].headingText}: ${truncate(substantive[0].text, 160)}`))
  } else if (substantive.length >= 4) {
    sections.award(5, `${substantive.length} sections pair a heading with 40+ words of prose (target: 8+).`, ev(home.url, 'text', `${substantive[0].headingText}: ${truncate(substantive[0].text, 160)}`))
  } else if (substantive.length >= 1) {
    sections.award(2, `${substantive.length} section(s) pair a heading with 40+ words of prose (target: 8+). The rest are too thin to quote on their own.`)
  } else {
    sections.miss('No section pairs a heading with enough prose to stand alone when lifted out of the page (target: 8+ sections of 40+ words).')
  }

  const quotable = home.blocks.filter((b) => b.wordCount >= 40 && b.wordCount <= 180)
  const share = home.blocks.length ? quotable.length / home.blocks.length : 0
  if (home.blocks.length === 0) {
    lengths.unverified('No content blocks could be identified, so block length could not be assessed.')
  } else if (share >= 0.65) {
    lengths.award(5, `${Math.round(share * 100)}% of sections are in the 40–180 word range that quotes cleanly (target: 65%+).`)
  } else if (share >= 0.4) {
    lengths.award(3, `${Math.round(share * 100)}% of sections are in the 40–180 word range (target: 65%+); the rest are very short or very long.`)
  } else if (share > 0) {
    lengths.award(1, `Only ${Math.round(share * 100)}% of sections are in the 40–180 word range (target: 65%+).`)
  } else {
    lengths.miss('No section falls in the 40–180 word range that quotes cleanly.')
  }

  return [hierarchy.build(), sections.build(), lengths.build()]
}

function hasSkippedLevels(headings: { level: number }[]): boolean {
  let previous = 0
  for (const h of headings) {
    if (previous && h.level > previous + 1) return true
    previous = h.level
  }
  return false
}

// ── Extractability (20) ───────────────────────────────────────────────────────

function scoreExtractability({ home }: RetrievabilityInput): Factor[] {
  const answers = new FactorBuilder('extract-answers', 'Direct answers', 10)
  const questions = new FactorBuilder('extract-questions', 'Question coverage', 6)
  const density = new FactorBuilder('extract-density', 'Lists, tables and data', 4)

  const opener = home.paragraphs.find((p) => countWords(p) >= 12)
  if (opener && opener.length <= 300) {
    answers.award(5, `The page opens with a self-contained statement of ${opener.length} characters — the form an engine can lift directly.`, ev(home.url, 'text', opener))
  } else if (opener) {
    answers.award(2, `The opening paragraph is ${opener.length} characters, above the ~300 that lifts cleanly.`)
  } else {
    answers.miss('No opening paragraph states a self-contained answer.')
  }

  const definition = home.paragraphs.find((p) => /\b(is|are)\s+(a|an|the)\s+\w+/i.test(p) && p.length <= 300)
  if (definition) {
    answers.award(5, 'A definition-style sentence states plainly what the subject is.', ev(home.url, 'text', definition))
  } else {
    answers.miss('No definition-style sentence ("X is a …") states plainly what the subject is.')
  }

  const hasFaqSchema = home.structuredDataTypes.some((t) => /^(FAQPage|QAPage|Question)$/i.test(t))
  const explicit = home.headings.filter((x) => x.text.includes('?'))
  const openers = home.headings.filter((x) => !x.text.includes('?') && QUESTION_WORD.test(x.text))

  if (hasFaqSchema) {
    questions.award(6, 'FAQ structured data marks question-and-answer pairs explicitly.', ev(home.url, 'jsonld', 'FAQPage'))
  } else if (explicit.length >= 3) {
    questions.award(4, `${explicit.length} headings are phrased as questions, though without FAQ structured data.`, ev(home.url, 'heading', explicit.slice(0, 3).map((x) => x.text).join(' | ')))
  } else if (explicit.length >= 1) {
    questions.award(3, `${explicit.length} heading(s) are phrased as questions.`, ev(home.url, 'heading', explicit[0].text))
  } else if (openers.length >= 2) {
    questions.award(2, `${openers.length} headings open with a question word but are not phrased as questions (${openers.slice(0, 2).map((x) => x.text).join('; ')}). Rewriting them as the question a reader would type makes the section easier to match to a query.`, ev(home.url, 'heading', openers[0].text))
  } else {
    questions.miss('No heading is phrased as a question a reader would actually ask.')
  }

  if (home.lists.length >= 2) {
    density.award(2, `${home.lists.length} lists break content into scannable items.`, ev(home.url, 'list', home.lists[0].items.slice(0, 3).join(' / ')))
  } else if (home.lists.length === 1) {
    density.award(1, 'One list is present.')
  } else {
    density.miss('No bulleted or numbered lists were found.')
  }

  if (home.tables.length) {
    density.award(1, `${home.tables.length} table(s) present comparable values side by side.`, ev(home.url, 'table', home.tables[0].headerCells.join(' | ')))
  }
  if (home.statistics.length >= 2) {
    density.award(1, `${home.statistics.length} specific figures appear in the copy.`, ev(home.url, 'text', home.statistics[0]))
  } else {
    density.miss('Few or no concrete figures appear in the copy.')
  }

  return [answers.build(), questions.build(), density.build()]
}

export { clamp }
