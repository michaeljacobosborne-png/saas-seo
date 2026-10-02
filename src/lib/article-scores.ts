/**
 * The one place an article's scores are assembled.
 *
 * `/api/articles/score` and `/api/articles/analyze` used to compute the same
 * scores independently (docs/paid-engine-spec.md §4.1 #2 and #3). Both call this
 * now, so they cannot drift.
 *
 * The legacy regex scores (`seo`, `readability`, `geo`, `aeo`) are unchanged and
 * still drive every current surface. `draft` is the real engine's draft-time
 * report, stored alongside so it accumulates on real articles before phase 3
 * decides how the editor shows it. Old rows simply lack `draft`.
 */

import type { ArticleScores } from '@/lib/supabase/types'
import {
  computeSEO,
  computeReadability,
  computeGEO,
  computeAEO,
  buildRankingPrediction,
  buildTrafficPrediction,
} from '@/lib/article-scoring'
import { buildDraftReport, type DraftAuthor } from '@/lib/geo-audit/draft-report'

/**
 * The byline from a brand_profiles row. Returns undefined when the row has no
 * author columns (migration 20261001_brand_author not applied), which the draft
 * report treats as unverified rather than absent.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function authorFromProfile(row: Record<string, any> | null | undefined): DraftAuthor | null | undefined {
  if (!row) return null
  if (!('author_name' in row)) return undefined
  return { name: row.author_name ?? null, credentials: row.author_credentials ?? null, url: row.author_url ?? null }
}

export interface ArticleScoreInput {
  content: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  brief: Record<string, any>
  targetKeyword: string
  keywordDifficulty?: number | null
  monthlySearches?: number | null
  /** For the draft report. `articleId` null for content not yet saved. */
  articleId: string | null
  title?: string | null
  brandName?: string | null
  siteUrl?: string | null
  author?: DraftAuthor | null
  now: Date
}

export function buildArticleScores(input: ArticleScoreInput): ArticleScores {
  const seo = computeSEO(input.content, input.brief, input.targetKeyword)
  const readability = computeReadability(input.content)
  const geo = computeGEO(input.content)
  const aeo = computeAEO(input.content)

  let draft: ArticleScores['draft']
  try {
    draft = buildDraftReport({
      markdown: input.content,
      articleId: input.articleId ?? 'unsaved',
      title: input.title,
      brandName: input.brandName,
      siteUrl: input.siteUrl,
      author: input.author,
      now: input.now,
    })
  } catch (err) {
    // The draft report must never take the legacy scores down with it while
    // it is not yet the source of truth. Logged so a failure is visible.
    console.error('[article-scores] draft report failed', err)
  }

  return {
    seo,
    readability,
    geo,
    aeo,
    ranking_prediction: buildRankingPrediction(input.keywordDifficulty ?? null, seo.score),
    traffic_prediction: buildTrafficPrediction(input.monthlySearches ?? null),
    ...(draft ? { draft } : {}),
  }
}
