/**
 * Turn draft-report findings into patch-mode instructions for the editor's
 * "Fix" buttons and the top-3 suggestions.
 *
 * Only findings the writer can act on in the draft get an instruction:
 * Chunkability and Extractability checks, and the citability signals that live
 * in the body text. Anything judged at publication never gets a Fix button,
 * because there is nothing in the draft to fix (decision 15).
 *
 * No instruction may ask the agent to invent a figure, source or quote. The
 * original engine once recommended publishing fabricated traffic statistics
 * (decision 9); original-evidence fixes ask for real material or an explicit
 * placeholder the writer must fill.
 *
 * Types only from the engine, so this stays safe to import in client code.
 */
import type { DraftReport } from '@/lib/geo-audit/draft-report'

export interface DraftFix {
  id: string
  label: string
  instruction: string
  /** Higher first. Points still available for checks; fixed weights for signals. */
  priority: number
}

const CHECK_INSTRUCTIONS: Record<string, (kw: string) => string> = {
  'chunk-hierarchy': () =>
    'Restructure the article so it has one H1, at least six H2 sections that each cover a distinct question, and H3 subsections inside the longer ones. Keep heading levels in order and do not skip a level.',
  'chunk-sections': () =>
    'Make each section stand alone when quoted: under every heading, write at least two full sentences that answer the heading directly before adding detail.',
  'chunk-lengths': () =>
    'Rebalance section length so most sections run 40 to 180 words: split sections that run long at natural sub-points, and expand very short ones with a concrete example.',
  'extract-answers': (kw) =>
    `Open the article with a self-contained answer of under 300 characters, and include one plain definition sentence of the form "${kw || 'the subject'} is a …".`,
  'extract-questions': (kw) =>
    `Rephrase at least three H2 or H3 headings as the questions a reader would actually type about "${kw || 'this topic'}", each answered directly in the first sentence below it.`,
  'extract-density': () =>
    'Where the article compares options or lists steps, present them as a bulleted or numbered list, or a table. Do not add figures you cannot source.',
}

const SIGNAL_INSTRUCTIONS: Record<string, (brand: string) => string> = {
  'brand-proximity': (brand) =>
    `Put the brand name "${brand}" inside the sections that make claims, in the sentence that makes the claim, so a quoted passage carries the name with it. Do not add it to every paragraph.`,
  'original-evidence': () =>
    'Where the article makes a claim, support it with first-hand material you can stand behind: a real example, a named method you used, or a figure from a source you can cite. Do not invent numbers or sources. Where none exists yet, insert a clearly marked [ADD EVIDENCE: …] placeholder for the writer instead.',
  'proprietary-terms': () =>
    'If the article describes a method or framework of your own, give it a consistent name and use that name each time it appears. Do not coin terms for things that are generic.',
}

const SIGNAL_PRIORITY: Record<string, number> = { 'brand-proximity': 9, 'original-evidence': 8, 'proprietary-terms': 5 }

export function draftFixes(draft: DraftReport, keyword: string, brandName?: string | null): DraftFix[] {
  const fixes: DraftFix[] = []

  for (const g of draft.retrievability.groups) {
    if (!g.scored) continue
    for (const c of g.checks) {
      if (!c.scored || c.status === 'good') continue
      const make = CHECK_INSTRUCTIONS[c.id]
      if (make) fixes.push({ id: c.id, label: c.name, instruction: make(keyword), priority: c.maxScore - c.score })
    }
  }

  for (const s of draft.citability.signals) {
    if (s.band !== 'absent' && s.band !== 'weak') continue
    if (s.id === 'brand-proximity' && !brandName) continue
    const make = SIGNAL_INSTRUCTIONS[s.id]
    if (make) fixes.push({ id: s.id, label: s.name, instruction: make(brandName ?? ''), priority: SIGNAL_PRIORITY[s.id] ?? 1 })
  }

  return fixes.sort((a, b) => b.priority - a.priority)
}
