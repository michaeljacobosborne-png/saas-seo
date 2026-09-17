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

import { assessFreshness } from './dates'
import { countWords, truncate, type ExtractedPage } from './extract'
import { summariseAccess, type AccessReport } from './access'
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

function scoreAccess({ home, access }: RetrievabilityInput): Factor[] {
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

  if (scoredTotal === 0) {
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
  if (s.searchUnknown.length) {
    crawlers.miss(`${s.searchUnknown.length} crawler(s) could not be checked and are excluded from this score.`)
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
    reachable.award(4, `The page returns HTTP ${access.httpStatus}.`)
  } else {
    reachable.miss(`The page returned HTTP ${access.httpStatus ?? 'unknown'}.`)
  }
  if (access.canonicalMismatch) {
    reachable.miss(`The canonical URL points elsewhere (${access.canonical}), so engines may credit that URL instead.`)
    reachable.note(ev(access.finalUrl, 'meta', `canonical: ${access.canonical}`))
  } else {
    reachable.award(2, home.canonical ? 'The canonical URL matches the page analysed.' : 'No conflicting canonical URL.')
  }

  return [crawlers.build(), indexing.build(), reachable.build()]
}

// ── Parseability (25) ─────────────────────────────────────────────────────────

function scoreParseability({ home, access }: RetrievabilityInput): Factor[] {
  const serverText = new FactorBuilder('parse-server-text', 'Server-rendered content', 12)
  const structured = new FactorBuilder('parse-structured-data', 'Structured data validity', 8)
  const cleanliness = new FactorBuilder('parse-dom', 'Markup cleanliness', 5)

  if (access?.jsOnlyContent) {
    serverText.miss(
      'The raw HTML contains almost no readable text, so this content appears only after JavaScript runs. AI crawlers such as GPTBot and PerplexityBot do not execute JavaScript and cannot see it.',
    )
  } else if (home.wordCount >= 600) {
    serverText.award(12, `${home.wordCount} words of content are present in the raw HTML, with no JavaScript required.`, ev(home.url, 'text', truncate(home.mainText, 200)))
  } else if (home.wordCount >= 200) {
    serverText.award(8, `${home.wordCount} words are present in the raw HTML — readable, but thin for a page meant to be quoted.`)
  } else {
    serverText.award(3, `Only ${home.wordCount} words are present in the raw HTML.`)
  }

  const blocks = home.jsonLdBlocks
  const invalid = blocks.filter((b) => !b.valid)
  if (blocks.length === 0) {
    structured.miss('No JSON-LD structured data was found.')
  } else if (invalid.length === 0) {
    structured.award(8, `${blocks.length} JSON-LD block(s) parse cleanly (${home.structuredDataTypes.join(', ')}).`, ev(home.url, 'jsonld', home.structuredDataTypes.join(', ')))
  } else {
    structured.award(
      Math.round(((blocks.length - invalid.length) / blocks.length) * 8),
      `${invalid.length} of ${blocks.length} JSON-LD block(s) contain a syntax error and are ignored by every consumer. First error at line ${invalid[0].startLine}: ${invalid[0].error}`,
      ev(home.url, 'jsonld', `line ${invalid[0].startLine}: ${invalid[0].error ?? 'parse error'}`),
    )
  }

  const h = home.headings.length
  if (h > 0 && home.paragraphs.length > 0) {
    cleanliness.award(5, `The document exposes ${h} real heading elements and ${home.paragraphs.length} paragraph elements.`)
  } else if (h > 0 || home.paragraphs.length > 0) {
    cleanliness.award(2, 'The document uses some semantic elements, but either headings or paragraphs are missing.')
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
    hierarchy.award(4, `A single H1 states the page topic ("${truncate(h1s[0].text, 80)}").`, ev(home.url, 'heading', h1s[0].text))
  } else if (h1s.length === 0) {
    hierarchy.miss('The page has no H1 element.')
  } else {
    hierarchy.award(1, `The page has ${h1s.length} H1 elements; exactly one makes the topic unambiguous.`)
  }

  if (h2s.length >= 4) {
    hierarchy.award(4, `${h2s.length} H2 sections divide the page into distinct topics.`, ev(home.url, 'heading', h2s.slice(0, 4).map((x) => x.text).join(' | ')))
  } else if (h2s.length >= 1) {
    hierarchy.award(2, `${h2s.length} H2 section(s) are present.`)
  } else {
    hierarchy.miss('No H2 elements divide the page into sections.')
  }

  if (h3s.length >= 3) hierarchy.award(2, `${h3s.length} H3 subsections add a second level of detail.`)

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

  const substantive = home.blocks.filter((b) => b.headingText && b.wordCount >= 20)
  if (substantive.length >= 5) {
    sections.award(8, `${substantive.length} sections pair a heading with enough prose to stand alone when quoted.`, ev(home.url, 'text', `${substantive[0].headingText}: ${truncate(substantive[0].text, 160)}`))
  } else if (substantive.length >= 2) {
    sections.award(4, `${substantive.length} sections pair a heading with substantive prose.`)
  } else {
    sections.miss('Few sections pair a heading with enough prose to stand alone when lifted out of the page.')
  }

  const quotable = home.blocks.filter((b) => b.wordCount >= 20 && b.wordCount <= 180)
  const share = home.blocks.length ? quotable.length / home.blocks.length : 0
  if (share >= 0.5) {
    lengths.award(5, `${Math.round(share * 100)}% of sections are in the 20–180 word range that quotes cleanly.`)
  } else if (share >= 0.25) {
    lengths.award(3, `${Math.round(share * 100)}% of sections are in the range that quotes cleanly; the rest are very short or very long.`)
  } else if (home.blocks.length === 0) {
    lengths.unverified('No content blocks could be identified, so block length could not be assessed.')
  } else {
    lengths.miss('Most sections are either too short to be useful or too long to quote whole.')
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
