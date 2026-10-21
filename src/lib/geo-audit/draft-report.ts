/**
 * Phase 2 of the paid engine (docs/paid-engine-spec.md §3): an honest report on
 * something that is not yet a page.
 *
 * The live engine runs unchanged. What differs is what a draft can be judged on:
 *
 *   Access          30  domain property          → unverified, scored after publication
 *   Parseability    25  template property        → unverified, scored after publication
 *   Chunkability    25  in the draft             → scored
 *   Extractability  20  in the draft             → scored
 *
 * **Separate draft-time denominator.** Only 45 of the 100 points are assessable
 * before publication. Fed through the live totals, that is 45% assessed, under
 * `MIN_ASSESSED_SHARE` (0.6), so every draft would be withheld forever. The fix,
 * decided by Michael: score the draft over its own 45-point denominator,
 * normalised to 0–100 and labelled structure-only. `MIN_ASSESSED_SHARE` is NOT
 * changed and still applies inside that denominator, so a draft too thin to
 * assess still withholds.
 *
 * Parseability is marked unverified wholesale, not partly scored: its
 * text-to-markup check would award a spurious perfect mark to markdown, which is
 * nearly pure text (spec §3.2). A flattering check is worse than a missing one.
 *
 * Citability: the three signals in the body text are assessed, and named
 * authorship is assessed from the brand profile's byline (decision 5). Entity
 * resolution and freshness belong to the template and are unverified.
 *
 * No model call anywhere in this file. Scoring is deterministic and in code;
 * the model never sets a score.
 */

import { adaptMarkdown, locateLine, type DraftMeta } from './adapt-markdown'
import { assessCitability } from './assess-citability'
import { scoreRetrievability } from './score-retrievability'
import { FactorBuilder, bandCounts, computeTotals, deriveStatus, overallBand } from './scoring'
import {
  BAND_LABELS,
  BAND_RANK,
  ENGINE_VERSION,
  HIGH_RETRIEVABILITY,
  type Citability,
  type CitabilitySignal,
  type Confidence,
  type Evidence,
  type Factor,
  type Gap,
  type RetrievabilityGroup,
  type RetrievabilityGroupId,
} from './types'

/** The groups a draft can be scored on. Their max scores sum to the draft denominator. */
export const DRAFT_ASSESSABLE_GROUPS: readonly RetrievabilityGroupId[] = ['chunkability', 'extractability']

/** Citability signals decided by the published template, not the draft. */
export const TEMPLATE_SIGNALS = ['entity-resolution', 'freshness-provenance'] as const

const AFTER_PUBLICATION: Record<'access' | 'parseability', string> = {
  access:
    'Crawler access, indexing directives and the canonical URL are properties of the published site, not the draft. Scored once this is live.',
  parseability:
    'Server rendering, structured data and markup belong to the page template, not the draft. Scored once this is live.',
}

const TEMPLATE_SIGNAL_REASON: Record<(typeof TEMPLATE_SIGNALS)[number], string> = {
  'entity-resolution':
    'Organization markup and sameAs profiles are emitted by the page template. Assessed once this is live.',
  'freshness-provenance':
    'Published and updated dates are set at publication. Assessed once this is live.',
}

export interface DraftRetrievability {
  /** 0-100 over the draft denominator. 0 when withheld — check `scoreWithheld`. */
  score: number
  grade: string
  rawScore: number
  /** Points actually assessed, out of `draftMaxScore`. */
  assessedMaxScore: number
  /** The draft-time denominator: Chunkability + Extractability, 45. */
  draftMaxScore: number
  /** The live engine's full scale, for the "what we can't know yet" panel. */
  totalMaxScore: number
  scoreWithheld: boolean
  withheldReason?: string
  confidence: Confidence
  /** All four groups; Access and Parseability are unverified and unscored. */
  groups: RetrievabilityGroup[]
}

export interface DraftReport {
  tool: 'draft'
  articleId: string
  analyzedAt: string
  /** What this number covers, stated on every report. */
  scope: string
  retrievability: DraftRetrievability
  citability: Citability
  gap: Gap
  /** Things the report assumed or could not read, disclosed rather than silent. */
  notes: string[]
  /** Checks that can only be made once the article is published. */
  afterPublication: { id: string; name: string; reason: string }[]
  wordCount: number
  /** The brand name proximity was measured against, from the brand profile. */
  brandName: string | null
  /**
   * Decision 29: scores will be plotted over time, annotated with what changed.
   * Every report says which engine scored it and which content it scored, so a
   * series can be drawn and diffed later without retrofitting. Absent on
   * reports built before 2026-10-04.
   */
  engineVersion?: string
  /** FNV-1a of the scored content. Equal hashes mean the same text was scored. */
  contentHash?: string
}

/**
 * The byline, from the brand profile. Decision 5 (docs/DECISIONS.md): the byline
 * is part of the draft, so named authorship is assessed at draft time.
 *
 * `undefined` means the profile carries no author fields at all (the
 * 20261001_brand_author migration is not applied), so authorship is unverified.
 * `null`, or a profile with no name, means no author is set: that is absent, and
 * the fix is to add one.
 */
export interface DraftAuthor {
  name?: string | null
  credentials?: string | null
  url?: string | null
}

export interface DraftInput extends DraftMeta {
  markdown: string
  /** From the brand profile. Needed to measure brand-claim proximity. */
  brandName?: string | null
  author?: DraftAuthor | null
  now: Date
}

/**
 * Decision 3: the draft scope is stated inline on every report, never hidden in
 * a tooltip. Saying what cannot be known before publication is the point.
 */
export const DRAFT_SCOPE =
  'A draft is assessed on 45 of the 100 points the live analyzer uses: how the article is structured and how cleanly ' +
  'answers can be lifted from it. The other 55 depend on the published page (crawler access, server rendering and ' +
  'structured data), so they are checked once it is live. This is an assessment of content readiness, ' +
  'not a measurement of whether any AI system retrieves or cites the article.'

export function buildDraftReport(input: DraftInput): DraftReport {
  const { page, rawHtmlBlocks, h1FromTitle, artefactsRemoved, preH1Removed } = adaptMarkdown(input.markdown, input)
  const md = input.markdown ?? ''

  const live = scoreRetrievability({
    home: page,
    access: null,
    now: input.now,
    contentReadable: page.hasMeaningfulContent,
  })

  const groups = live.groups.map((g) =>
    g.id === 'access' || g.id === 'parseability' ? unverifiedGroup(g, AFTER_PUBLICATION[g.id]) : withLines(g, md),
  )

  // The draft denominator: only the checks a draft can carry.
  const draftChecks = groups.filter((g) => DRAFT_ASSESSABLE_GROUPS.includes(g.id)).flatMap((g) => g.checks)
  const totals = computeTotals(draftChecks)
  const draftMaxScore = draftChecks.reduce((s, c) => s + c.maxScore, 0)

  const retrievability: DraftRetrievability = {
    score: totals.score,
    grade: totals.grade,
    rawScore: totals.rawScore,
    assessedMaxScore: totals.assessedMaxScore,
    draftMaxScore,
    totalMaxScore: live.totalMaxScore,
    scoreWithheld: totals.scoreWithheld,
    withheldReason: totals.scoreWithheld
      ? page.hasMeaningfulContent
        ? totals.withheldReason
        : 'The draft is too short to assess its structure yet.'
      : undefined,
    confidence: totals.confidence,
    groups,
  }

  const citability = draftCitability(page, input.brandName ?? null, input.author, input.now, md)
  const notes: string[] = []
  if (h1FromTitle) notes.push('The draft has no H1 of its own, so the article title was assessed as the H1, as the published template renders it.')
  if (rawHtmlBlocks) notes.push(`${rawHtmlBlocks} block(s) of raw HTML in the draft were not assessed.`)
  if (artefactsRemoved) notes.push(`${artefactsRemoved} line(s) of agent output (SUMMARY/PATCH headers) were found in the draft and not assessed. Remove them before publishing.`)
  if (preH1Removed) notes.push('Text above the H1 was not assessed: the published page opens at the H1.')
  if (!input.brandName) notes.push('No brand name is set on the brand profile, so brand-claim proximity could not be measured.')
  notes.push('FAQ structured data is added by the template, so question coverage here is checked on headings alone.')

  const afterPublication = [
    ...groups
      .filter((g) => g.id === 'access' || g.id === 'parseability')
      .flatMap((g) => g.checks.map((c) => ({ id: c.id, name: c.name, reason: AFTER_PUBLICATION[g.id as 'access' | 'parseability'] }))),
    ...citability.signals
      .filter((s) => (TEMPLATE_SIGNALS as readonly string[]).includes(s.id))
      .map((s) => ({ id: s.id, name: s.name, reason: s.detail })),
  ]

  return {
    tool: 'draft',
    articleId: input.articleId,
    analyzedAt: input.now.toISOString(),
    scope: DRAFT_SCOPE,
    retrievability,
    citability,
    gap: diagnoseDraftGap(retrievability, citability),
    notes,
    afterPublication,
    wordCount: page.wordCount,
    brandName: input.brandName ?? null,
    engineVersion: ENGINE_VERSION,
    contentHash: contentHash(md),
  }
}

/** FNV-1a, 32-bit, hex. Not cryptographic: it only tells two scored texts apart. */
export function contentHash(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

/**
 * Label for checks that belong to the published page (decision 15). They are
 * not "unable to assess" in the sense of something going wrong: they are not
 * yet assessable, and the label says when they will be.
 */
export const AT_PUBLICATION_LABEL = 'Checked at publication'

function unverifiedGroup(g: RetrievabilityGroup, reason: string): RetrievabilityGroup {
  const checks = g.checks
    .filter((c) => c.maxScore > 0)
    .map((c) => ({ ...new FactorBuilder(c.id, c.name, c.maxScore).unverified(reason).build(), label: AT_PUBLICATION_LABEL }))
  return { ...g, score: 0, deduction: 0, scored: false, status: 'unverified', label: AT_PUBLICATION_LABEL, checks }
}

function withLines(g: RetrievabilityGroup, md: string): RetrievabilityGroup {
  return {
    ...g,
    checks: g.checks.map((c) => ({ ...c, detail: draftWording(c.detail), evidence: c.evidence.map((e) => lineEvidence(e, md)) })),
  }
}

/**
 * The live engine describes a page. The checks a draft carries are the same
 * checks, but the reader is looking at an unpublished draft, so the finding
 * says so. Only judged-now details are reworded; publication-layer reasons are
 * written for drafts already.
 */
export function draftWording(s: string): string {
  return s
    .replace(/ — it is present only in the page chrome\./g, ' of the draft.')
    .replace(/\bThe page\b/g, 'The draft')
    .replace(/\bthe page\b/g, 'the draft')
    .replace(/\bthis page\b/g, 'this draft')
    .replace(/\bThis page\b/g, 'This draft')
}

/** `L12 · snippet`, so the editor can scroll to the finding (spec §2.4). */
function lineEvidence(e: Evidence, md: string): Evidence {
  const line = locateLine(md, e.snippet)
  return line ? { ...e, snippet: `L${line} · ${e.snippet}` } : e
}

/** Named authorship from the brand profile's byline (decision 5). */
function authorSignal(author: DraftAuthor | null | undefined): CitabilitySignal {
  const base = { id: 'named-authorship', name: 'Named authorship' }
  if (author === undefined) {
    return {
      ...base,
      band: 'unverified',
      state: 'unverified',
      detail: 'Author details are not available on the brand profile yet, so named authorship could not be assessed.',
      evidence: [],
    }
  }
  const name = author?.name?.trim()
  const credentials = author?.credentials?.trim()
  if (!name) {
    return {
      ...base,
      band: 'absent',
      state: 'absent',
      detail: 'No author is set on the brand profile, so the article carries no named person to attribute it to. Add the author and one line of their experience.',
      evidence: [],
    }
  }
  const evidence = [{ url: 'brand-profile', kind: 'text' as const, snippet: credentials ? `Author: ${name} — ${credentials}` : `Author: ${name}` }]
  return credentials
    ? { ...base, band: 'strong', state: 'present', detail: `The byline names ${name}, with stated experience alongside the name.`, evidence }
    : { ...base, band: 'adequate', state: 'present', detail: `The byline names ${name}, but no experience or specialism is stated alongside the name.`, evidence }
}

function draftCitability(
  page: ReturnType<typeof adaptMarkdown>['page'],
  brandName: string | null,
  author: DraftAuthor | null | undefined,
  now: Date,
  md: string,
): Citability {
  // Brand-claim proximity reads the brand from structured data, which a draft
  // never carries. Supply the brand profile's name the same way, for this
  // assessment only; the entity-resolution signal it would also feed is
  // replaced below, so it cannot award anything for markup that does not exist.
  const home = brandName
    ? { ...page, structuredData: [{ types: ['Organization'], raw: { name: brandName }, source: 'json-ld' as const }] }
    : page

  const live = assessCitability({ home, keyPages: [], now })

  const signals: CitabilitySignal[] = live.signals.map((s) => {
    if (s.id === 'named-authorship') return authorSignal(author)
    if ((TEMPLATE_SIGNALS as readonly string[]).includes(s.id)) {
      return { id: s.id, name: s.name, band: 'unverified', state: 'unverified', detail: TEMPLATE_SIGNAL_REASON[s.id as (typeof TEMPLATE_SIGNALS)[number]], evidence: [] }
    }
    if (s.id === 'brand-proximity' && !brandName) {
      return { ...s, band: 'unverified', state: 'unverified', detail: 'No brand name is set on the brand profile, so brand-claim proximity could not be measured.', evidence: [] }
    }
    return { ...s, detail: draftWording(s.detail), evidence: s.evidence.map((e) => lineEvidence(e, md)) }
  })

  const band = overallBand(signals)
  return { band, label: BAND_LABELS[band], signals, counts: bandCounts(signals) }
}

/**
 * The Gap, worded for a draft. Same quadrants and thresholds as the live
 * `diagnoseGap`; the copy points at what a writer can change in the draft, and
 * never at crawler access, which a draft cannot affect.
 */
export function diagnoseDraftGap(r: DraftRetrievability, c: Citability): Gap {
  if (r.scoreWithheld || c.band === 'unverified') {
    return {
      quadrant: 'indeterminate',
      headline: 'Not enough to compare yet',
      diagnosis: r.withheldReason ?? 'Too little of the draft could be assessed to place it against both measures.',
      nextStep: 'Keep writing; the draft is assessed on every save.',
    }
  }
  const highR = r.score >= HIGH_RETRIEVABILITY
  const highC = BAND_RANK[c.band] >= BAND_RANK.strong
  const label = c.label.toLowerCase()

  if (highR && !highC) {
    return {
      quadrant: 'high-retrievable-low-citable',
      headline: 'Easy to lift, hard to credit',
      diagnosis: `The draft scores ${r.score}/100 on structure: its sections and answers can be lifted cleanly. Its attribution signals are ${label}, so the passages carry few anchors that name you.`,
      nextStep: 'Put the brand name inside the sections that make claims, and add a figure or term that is yours alone.',
    }
  }
  if (!highR && highC) {
    return {
      quadrant: 'low-retrievable-high-citable',
      headline: 'Credible, but hard to lift',
      diagnosis: `Attribution signals are ${label}, but the draft scores ${r.score}/100 on structure, so its best passages are hard to lift out cleanly.`,
      nextStep: 'Start with the lowest-scoring structure check: headings, section length, or a direct answer near the top.',
    }
  }
  if (!highR && !highC) {
    return {
      quadrant: 'low-both',
      headline: 'Start with structure',
      diagnosis: `The draft scores ${r.score}/100 on structure and its attribution signals are ${label}.`,
      nextStep: 'Fix structure first — clear headings, self-contained sections, a direct answer — then add attribution to the sections that make claims.',
    }
  }
  return {
    quadrant: 'high-both',
    headline: 'Structurally ready, with attribution in place',
    diagnosis: `The draft scores ${r.score}/100 on structure and its attribution signals are ${label}.`,
    nextStep: 'The draft is ready on the measures a draft can carry. Crawler access and markup are checked once it is published.',
  }
}

// Re-exported for callers that render factor status next to the draft score.
export { deriveStatus, type Factor }
