/**
 * The GEO/AEO part of the agent's "weak areas" prompt section, from the real
 * engine's draft report (paid engine phase 3, spec §4.1 #7).
 *
 * This replaced reading `scores.geo/aeo.breakdown`, the regex checks the editor
 * no longer shows. The spec flagged this as the silent-failure path: it is an AI
 * prompt, so a wrong input produces plausible-sounding wrong guidance rather
 * than an error. Hence the tests, and hence the explicit line when there is no
 * draft report, so the agent is never told "no gaps" when the truth is
 * "not computed".
 *
 * Only what the writer can change in the draft goes in. Checks judged at
 * publication never appear: there is nothing in the draft to fix (decision 15).
 */
import type { ArticleScores } from '@/lib/supabase/types'
import { SCORE_LABELS } from '@/lib/score-labels'

export function draftWeakAreas(scores: Pick<ArticleScores, 'draft'>): string {
  const draft = scores.draft
  if (!draft) {
    return `${SCORE_LABELS.retrievable} / ${SCORE_LABELS.citable}: not computed for this article yet (it needs re-scoring). Do not assume these are fine.`
  }

  const structure = draft.retrievability.groups
    .filter((g) => g.scored)
    .flatMap((g) => g.checks)
    .filter((c) => c.scored && c.status !== 'good')
    .sort((a, b) => b.maxScore - b.score - (a.maxScore - a.score))
    .map((c) => `- ${c.name} (${c.score}/${c.maxScore}): ${c.detail}`)

  const attribution = draft.citability.signals
    .filter((s) => s.band === 'absent' || s.band === 'weak')
    .map((s) => `- ${s.name} (${s.band}): ${s.detail}`)

  const lines = [
    `${SCORE_LABELS.retrievable} gaps (structure; draft score ${draft.retrievability.scoreWithheld ? 'withheld' : `${draft.retrievability.score}/100`}):`,
    structure.length ? structure.join('\n') : '(none)',
    `${SCORE_LABELS.citable} gaps (attribution; band ${draft.citability.label}):`,
    attribution.length ? attribution.join('\n') : '(none)',
    'Never invent statistics, studies, quotes or sources to close a gap. Where evidence is missing, insert a clearly marked [ADD EVIDENCE: …] placeholder.',
  ]
  return lines.join('\n')
}
