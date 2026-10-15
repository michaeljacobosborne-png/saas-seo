/**
 * The names of the two scores, in one place.
 *
 * DECISION 2 IS PENDING (docs/DECISIONS.md, spec §7). The recommendation to
 * Michael is Retrievable / Citable in the editor, matching the free tool,
 * while "GEO" and "AEO" stay the names of the tools and pages people search
 * for. Until he confirms, nothing in the paid editor ships with these labels.
 * Change them here and every surface follows.
 */
export const SCORE_LABELS = {
  retrievable: 'Retrievable',
  citable: 'Citable',
} as const

export const SCORE_DESCRIPTIONS = {
  /** Live report pages: describes a published page. */
  page: {
    retrievable: 'Can an engine reach, parse and lift a clean answer from this page.',
    citable: 'If an engine lifts this content, does anything in it force attribution back to you.',
  },
  /** Editor: describes a draft, and must not imply page-level checks ran. */
  draft: {
    retrievable: 'How cleanly an answer can be lifted from this draft. Structure only: 45 of 100 points.',
    citable: 'If this draft is quoted, does anything in it carry attribution back to you.',
  },
} as const
