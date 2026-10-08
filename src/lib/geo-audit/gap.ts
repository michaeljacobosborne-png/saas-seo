/**
 * The Gap — two scores and the distance between them.
 *
 * WORDING RULE, enforced by `gap.test.ts` and non-negotiable:
 *
 *   We may say a passage or page **carries no attribution anchors**.
 *   We may NOT say the site **is being retrieved without attribution**.
 *
 * The first describes a property of the HTML we fetched. The second is a claim
 * about what engines are doing, which no page fetch can observe. Every other
 * tool in this category blurs that line; not blurring it is the product.
 */

import { BAND_RANK, HIGH_RETRIEVABILITY, type Band, type Citability, type Gap, type Retrievability } from './types'

/**
 * Bands at or above this count as "high citability" for quadrant purposes.
 *
 * Set at `strong`, not `adequate`, deliberately. "Adequate" means some
 * attribution signals are present — an Organization entity here, a date there.
 * That is not the same as content an engine would struggle to use *without*
 * naming you, which is what the high-citability half of the diagnosis claims.
 * Treating "adequate" as high would push most sites into the high/high quadrant,
 * which is both the least actionable verdict and the least honest one.
 *
 * This is a product judgement, not a measurement. One constant to change.
 */
const HIGH_CITABILITY_RANK = BAND_RANK.strong

export function diagnoseGap(retrievability: Retrievability, citability: Citability): Gap {
  if (retrievability.scoreWithheld || citability.band === 'unverified') {
    return {
      quadrant: 'indeterminate',
      headline: 'Not enough could be read to compare the two',
      diagnosis:
        retrievability.withheldReason ??
        'Too little of the page could be assessed to place it against both measures.',
      nextStep: 'Re-run once the page can be fetched and read in full.',
    }
  }

  const highR = retrievability.score >= HIGH_RETRIEVABILITY
  const highC = BAND_RANK[citability.band] >= HIGH_CITABILITY_RANK

  if (highR && !highC) {
    return {
      quadrant: 'high-retrievable-low-citable',
      headline: 'Easy to use, hard to credit',
      diagnosis:
        `This page scores ${retrievability.score}/100 for retrievability — an engine can reach it, parse it and lift a clean answer out of it. ` +
        `Its attribution signals are ${citability.label.toLowerCase()}: the passages carry no attribution anchors, ` +
        `meaning nothing inside them names you, cites your data, or uses a term that could only have come from you. ` +
        `Content in this state is well prepared to be used and poorly prepared to be credited.`,
      nextStep:
        'Work on attribution, not structure. Put the brand name inside the sections that make claims, name the author, and add at least one figure or term that is yours alone.',
    }
  }

  // Name the group that actually scored lowest. The copy used to say "start with
  // access" even when Access was 30/30 (prospect-report readiness, 2026-10-04).
  const weakest = weakestGroup(retrievability)

  if (!highR && highC) {
    return {
      quadrant: 'low-retrievable-high-citable',
      headline: 'Credible, but hard to lift',
      diagnosis:
        `Attribution signals are ${citability.label.toLowerCase()}: there is enough here to credit you if the content is used. ` +
        `Retrievability is ${retrievability.score}/100, and the weakest part is ${weakest ? `${weakest.name.toLowerCase()} (${weakest.score}/${weakest.max})` : 'structure'}, not credibility.`,
      nextStep: weakest ? `Start with ${weakest.name.toLowerCase()}: ${GROUP_ADVICE[weakest.id]}` : 'Start with the lowest-scoring retrievability group.',
    }
  }

  if (!highR && !highC) {
    return {
      quadrant: 'low-both',
      headline: weakest ? `Start with ${weakest.name.toLowerCase()}` : 'Start with retrievability',
      diagnosis:
        `Retrievability is ${retrievability.score}/100 and attribution signals are ${citability.label.toLowerCase()}. ` +
        (weakest ? `The weakest retrievability group is ${weakest.name.toLowerCase()} at ${weakest.score}/${weakest.max}. ` : '') +
        'Attribution work pays off most once the content is easy to lift, so the order matters.',
      nextStep: weakest
        ? `Fix ${weakest.name.toLowerCase()} first: ${GROUP_ADVICE[weakest.id]} Then add attribution to the sections that make claims.`
        : 'Fix retrievability first, then add attribution to the sections that make claims.',
    }
  }

  return {
    quadrant: 'high-both',
    headline: 'Structurally ready, with attribution in place',
    diagnosis:
      `Retrievability is ${retrievability.score}/100 and attribution signals are ${citability.label.toLowerCase()}. ` +
      `On the evidence of this page there is no obvious structural or attribution obstacle left to fix.`,
    nextStep:
      'On-page work has taken this about as far as it goes. What an on-page tool cannot tell you is whether engines actually surface this content — that needs repeated live sampling, not another page audit.',
  }
}

const GROUP_ADVICE: Record<string, string> = {
  access: 'make sure AI search crawlers are permitted and the page is indexable.',
  parseability: 'serve the content in the HTML rather than only after JavaScript runs, and keep structured data valid.',
  chunkability: 'give each section a clear heading and enough self-contained prose to be quoted on its own.',
  extractability: 'open with a short direct answer, phrase some headings as questions, and use lists or tables where they fit.',
}

/** The scored retrievability group with the lowest share of its assessable points. */
function weakestGroup(r: Retrievability): { id: string; name: string; score: number; max: number } | null {
  let best: { id: string; name: string; score: number; max: number; ratio: number } | null = null
  for (const g of r.groups) {
    if (!g.scored) continue
    const max = g.checks.filter((c) => c.scored).reduce((s, c) => s + c.maxScore, 0)
    if (!max) continue
    const ratio = g.score / max
    if (!best || ratio < best.ratio) best = { id: g.id, name: g.name, score: g.score, max, ratio }
  }
  return best
}

/**
 * Phrases that assert engine behaviour rather than page properties.
 * Exported so the test suite can assert no generated copy contains them.
 */
export const FORBIDDEN_GAP_CLAIMS: RegExp[] = [
  /being retrieved without/i,
  /are being (?:cited|retrieved|used)/i,
  /engines are (?:lifting|taking|using)/i,
  /you are being/i,
  /is being (?:cited|retrieved|scraped)/i,
  /will be cited/i,
  /guarantee/i,
]

export function findForbiddenClaims(text: string): string[] {
  return FORBIDDEN_GAP_CLAIMS.filter((r) => r.test(text)).map((r) => r.source)
}

export { HIGH_RETRIEVABILITY }
export type { Band }
