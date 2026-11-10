/**
 * The generator's provenance rule, enforced in code (Michael, 2026-10-04):
 *
 *   The article writer keeps only real citable information, or information the
 *   user supplied directly for that piece. Nothing else.
 *
 * A statistic, figure, percentage, study, quote, case study or customer result
 * survives only when it can be found in the sources supplied for this article.
 * Anything else is replaced, whole sentence, by a visible
 * `[ADD EVIDENCE: …]` placeholder. The figure is never kept, never moved to a
 * named firm, and never softened into a vaguer number: the placeholder names
 * what is needed with the figure removed.
 *
 * A prompt alone did not stop fabrication (generator audit 2026-10-02), so this
 * runs on every generated draft regardless of what the model was told.
 */

export interface EvidenceSource {
  /** Where it came from, e.g. "Supplied by the writer for this article" or a URL. */
  label: string
  text: string
  url?: string
}

export interface Replacement {
  original: string
  placeholder: string
  reason: string
}

export interface GuardOptions {
  /** The publishing brand, so unsupported superlatives about it are caught. */
  brandName?: string | null
}

export interface GuardResult {
  markdown: string
  replaced: Replacement[]
}

// ── Detection ────────────────────────────────────────────────────────────────

const MAGNITUDE = '(?:%|\\s?percent\\b|x\\b|×|\\s?(?:k|m|bn)\\b|\\s?(?:thousand|million|billion)\\b)'
/** Percentages, money, multipliers, ranges and multi-digit counts. Years and list counts are not statistics. */
const FIGURE = new RegExp(`(?:[$£€]\\s?\\d[\\d,.]*${MAGNITUDE}?(?:\\/(?:mo|month|year|yr|user|seat))?|\\b\\d[\\d,.]*(?:\\s?[-–]\\s?\\d[\\d,.]*)?${MAGNITUDE}|\\b\\d{2,}[\\d,.]*\\b)`, 'gi')
const YEAR = /^(?:19|20)\d{2}$/
const LIST_COUNT = /^\s*(?:best|top|ways|tips|steps|tools|reasons|mistakes|examples|questions|things|signs|strategies|tactics|ideas|minutes|seconds|characters|words)\b/i

export function figuresInText(text: string): string[] {
  const out: string[] = []
  for (const m of text.matchAll(FIGURE)) {
    const raw = m[0].trim()
    const bare = raw.replace(/[,.]$/, '')
    if (YEAR.test(bare)) continue
    const after = text.slice((m.index ?? 0) + m[0].length)
    const before = text.slice(0, m.index ?? 0)
    if (/^\d+$/.test(bare) && (LIST_COUNT.test(after) || /\btop\s*$/i.test(before) || /\bH$/i.test(before))) continue
    out.push(bare.toLowerCase().replace(/\s+/g, ''))
  }
  return out
}

/** Authority with no checkable source behind it. Never acceptable. */
const VAGUE_AUTHORITY =
  /\b(?:industry (?:benchmarks?|statistics|data|research|reports?|averages?)|(?:recent |many |several |some )?(?:studies|surveys|research|data|experts|analysts|reports) (?:show|shows|suggest|suggests|indicate|indicates|found|say|says|reveal|reveals|confirm|confirms)|according to (?:industry|experts|research|studies|recent (?:studies|research|data)|analysts|statistics|data)|(?:it is|it's) (?:estimated|reported|widely reported) that)\b/i

/** A named source: "according to X", "a 2024 X survey", "a study by X", "X found that". */
const NAMED_SOURCE =
  /\b(?:according to (?:a |an |the )?(?:\d{4} )?([A-Z][\w&.'-]*(?:\s+[A-Z][\w&.'-]*)*)|(?:a|an|the) (?:\d{4} )?([A-Z][\w&.'-]*(?:\s+[A-Z][\w&.'-]*)*) (?:study|survey|report|analysis|poll|index|benchmark)|(?:study|survey|report|research|analysis|data) (?:by|from) ([A-Z][\w&.'-]*(?:\s+[A-Z][\w&.'-]*)*)|([A-Z][\w&.'-]*(?:\s+[A-Z][\w&.'-]*)*) (?:found|reports|reported|estimates|estimated|surveyed) that)/

/**
 * Case studies and customer results the article has no material for. A
 * described company only counts when the sentence says what it did or got
 * ("a mid-sized tech company used…"), not when it is a hypothetical ("without
 * needing a large writing team").
 */
const RESULT_VERB = '(?:used|uses|saw|sees|grew|increased|achieved|cut|reduced|doubled|tripled|boosted|switched|implemented|adopted|improved|went from|was able to|were able to)'
const CASE_STUDY = new RegExp(
  `\\b(?:case study|one (?:of our |our )?(?:clients?|customers?|users?) ${RESULT_VERB}|(?:a|one) (?:mid-?sized|small|large|leading|fast-growing|b2b|saas|tech|e-?commerce|global|local)(?: [a-z-]+)? (?:company|startup|brand|agency|retailer|business|firm|client|team)\\b[^.]{0,40}\\b${RESULT_VERB}|our (?:users|customers|clients) ${RESULT_VERB}|(?:clients|customers|users) (?:have )?(?:achieved|seen|reported) (?:a |an )?\\d)`,
  'i',
)

/**
 * Product facts about the publishing brand: integrations, pricing, plans,
 * trials, certifications, customer counts. The sample run had "Byline SEO
 * integrates well… Google Analytics or WordPress", which nobody supplied.
 */
const PRODUCT_FACT = /\b(?:integrat\w*|connects? (?:with|to)|works with|plugins?|extensions?|API|free trial|money-back|plans? (?:start|from)|pricing|priced|per (?:month|seat|user)|discount|certified|SOC ?2|ISO ?27001|GDPR|HIPAA|customers? (?:include|like)|used by|trusted by)\b/i

/**
 * Stand-in products. With competitor names banned and no evidence supplied, the
 * model compared "Tool A", "Tool B" and "Tool C" with invented attributes
 * (sample run, 2026-10-04): product facts about products that do not exist.
 */
const ANONYMOUS_PRODUCT = /\b(?:Tool|Product|Platform|Vendor|Option|Solution|Software|Competitor|Brand) [A-D1-4]\b(?!\w)/

/** Puffery about the brand that nothing supplied supports. */
function brandPuffery(brandName: string): RegExp {
  const b = brandName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(
    `\\b${b}\\b[^.]{0,60}\\b(?:is|are|has been|remains|stands)\\s+(?:at the forefront|a leader|the leader|leading|industry-leading|the best|the most|trusted by|loved by|the go-to|unmatched|unrivalled|unrivaled|second to none)`,
    'i',
  )
}

/** A quotation of six or more words attributed to someone. */
const ATTRIBUTED_QUOTE = /["“][^"”]{25,}["”]\s*(?:,\s*)?(?:said|says|explains|notes|writes|told|according to)|(?:said|says|explains|notes|writes|according to)[^.]{0,60}["“][^"”]{25,}["”]/i

function normalise(s: string): string {
  return s.toLowerCase().replace(/[“”]/g, '"').replace(/[’]/g, "'").replace(/\s+/g, ' ')
}

/** Why a sentence needs evidence it does not have, or null when it may stand. */
export function unsupportedClaim(sentence: string, sources: EvidenceSource[], opts: GuardOptions = {}): string | null {
  const corpus = normalise(sources.map((s) => `${s.text} ${s.url ?? ''} ${s.label}`).join('\n'))
  const corpusFigures = new Set(figuresInText(corpus))

  if (VAGUE_AUTHORITY.test(sentence)) return 'cites an unnamed authority'
  if (ANONYMOUS_PRODUCT.test(sentence)) return 'describes a stand-in product ("Tool A") with attributes nobody supplied'
  if (opts.brandName && brandPuffery(opts.brandName).test(sentence) && !sourcesMention(sentence, corpus)) {
    return `makes an unsupported superlative claim about ${opts.brandName}`
  }
  if (opts.brandName && sentence.toLowerCase().includes(opts.brandName.toLowerCase()) && PRODUCT_FACT.test(sentence) && !sourcesMention(sentence, corpus)) {
    return `states a product fact about ${opts.brandName} that nobody supplied`
  }

  const figures = figuresInText(sentence).filter((f) => !corpusFigures.has(f))
  if (figures.length) return `states a figure with no supplied source (${figures.join(', ')})`

  const named = NAMED_SOURCE.exec(sentence)
  if (named) {
    const name = (named[1] ?? named[2] ?? named[3] ?? named[4] ?? '').trim()
    if (name && !corpus.includes(name.toLowerCase())) return `attributes a claim to ${name}, which is not among the supplied sources`
  }

  if (CASE_STUDY.test(sentence) && !sourcesMention(sentence, corpus)) return 'describes a case study or customer result with no supplied material'

  if (ATTRIBUTED_QUOTE.test(sentence)) {
    const quoted = /["“]([^"”]{25,})["”]/.exec(sentence)?.[1] ?? ''
    if (!corpus.includes(normalise(quoted))) return 'quotes someone without a supplied source'
  }
  return null
}

/** Loose check that a case study sentence is drawn from supplied material: most of its content words appear. */
function sourcesMention(sentence: string, corpus: string): boolean {
  if (!corpus.trim()) return false
  const words = normalise(sentence).match(/[a-z]{5,}/g) ?? []
  if (words.length < 3) return false
  const hits = words.filter((w) => corpus.includes(w)).length
  return hits / words.length >= 0.7
}

// ── Placeholder ──────────────────────────────────────────────────────────────

const LEAD_IN =
  /^(?:according to [^,]+,\s*|(?:a|an|the) (?:\d{4} )?[\w&.' -]+? (?:study|survey|report|analysis) (?:found|shows|showed|suggests) that\s*|(?:industry )?(?:benchmarks?|statistics|studies|surveys|research|data) (?:show|shows|suggest|suggests|indicate|indicates)(?: that)?\s*|[A-Z][\w&.' -]+? (?:has )?found that\s*|in (?:a|one) case study,?\s*)/i

/** The claim with figures and fake sourcing removed, as an instruction to the writer. */
export function placeholderFor(sentence: string): string {
  let claim = sentence.trim().replace(/[.!?]+$/, '')
  claim = claim.replace(LEAD_IN, '')
  claim = claim.replace(FIGURE, (m) => (YEAR.test(m.trim()) ? m : '…'))
  claim = claim.replace(/\s+/g, ' ').replace(/\(\s*…\s*\)/g, '(…)').trim()
  if (claim.length > 160) claim = `${claim.slice(0, 157).trimEnd()}…`
  if (claim) claim = claim[0].toLowerCase() + claim.slice(1)
  return `[ADD EVIDENCE: a real, citable source for the claim that ${claim}]`
}

// ── Guard ────────────────────────────────────────────────────────────────────

const SENTENCE_SPLIT = /(?<=[.!?])\s+(?=["“(\[]?[A-Z0-9$£€])/

function guardProse(text: string, sources: EvidenceSource[], replaced: Replacement[], opts: GuardOptions): string {
  return text
    .split(SENTENCE_SPLIT)
    .map((s) => {
      if (/^\[ADD EVIDENCE:/i.test(s.trim())) return s
      const reason = unsupportedClaim(s, sources, opts)
      if (!reason) return s
      const placeholder = placeholderFor(s)
      replaced.push({ original: s.trim(), placeholder, reason })
      return placeholder
    })
    .join(' ')
}

/**
 * Apply the provenance rule to a markdown draft. Prose is checked sentence by
 * sentence; list items and table cells the same way; headings keep their level
 * and become a placeholder when they assert something unsupported.
 */
export function guardEvidence(markdown: string, sources: EvidenceSource[], opts: GuardOptions = {}): GuardResult {
  const replaced: Replacement[] = []
  const lines = (markdown ?? '').split(/\r?\n/)
  let inCode = false
  // Table state: a column (or row) headed by a product nobody supplied makes
  // every value in it unsupported, not just the header. The sample run kept
  // "Advanced / Basic / Intermediate" under placeholder-headed columns.
  let taintedColumns = new Set<number>()
  let inTable = false
  const VALUE_PLACEHOLDER = ' [ADD EVIDENCE: a real, citable source for this value] '
  const out = lines.map((line) => {
    if (/^\s*```/.test(line)) {
      inCode = !inCode
      return line
    }
    if (!/^\s*\|/.test(line)) {
      inTable = false
      taintedColumns = new Set()
    }
    if (inCode || !line.trim()) return line

    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      const reason = unsupportedClaim(heading[2], sources, opts)
      if (!reason) return line
      const placeholder = placeholderFor(heading[2])
      replaced.push({ original: heading[2], placeholder, reason })
      return `${heading[1]} ${placeholder}`
    }

    if (/^\s*\|/.test(line)) {
      if (/^\s*\|?\s*:?-{2,}/.test(line)) return line
      const isHeader = !inTable
      inTable = true
      const cells = line.split('|')
      const firstValue = cells.findIndex((c) => c.trim())
      const rowTainted = !isHeader && firstValue !== -1 && ANONYMOUS_PRODUCT.test(cells[firstValue])
      return cells
        .map((cell, i) => {
          if (!cell.trim()) return cell
          const inherited = !isHeader && (taintedColumns.has(i) || (rowTainted && i !== firstValue))
          const reason = inherited ? 'is a value for a product nobody supplied' : unsupportedClaim(cell, sources, opts)
          if (!reason) return cell
          if (isHeader && ANONYMOUS_PRODUCT.test(cell)) taintedColumns.add(i)
          replaced.push({ original: cell.trim(), placeholder: '[ADD EVIDENCE]', reason })
          return VALUE_PLACEHOLDER
        })
        .join('|')
    }

    const item = /^(\s*(?:[-*+]|\d+[.)])\s+)(.*)$/.exec(line)
    if (item) return item[1] + guardProse(item[2], sources, replaced, opts)
    const quote = /^(\s*>\s?)(.*)$/.exec(line)
    if (quote) return quote[1] + guardProse(quote[2], sources, replaced, opts)
    return guardProse(line, sources, replaced, opts)
  })
  return { markdown: out.join('\n'), replaced }
}
