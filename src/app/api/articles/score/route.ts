import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ArticleScores } from '@/lib/supabase/types'
import {
  computeSEO,
  computeReadability,
  computeGEO,
  computeAEO,
  buildRankingPrediction,
  buildTrafficPrediction,
} from '@/lib/article-scoring'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { articleId } = await request.json() as { articleId: string }
  if (!articleId) return NextResponse.json({ error: 'articleId is required' }, { status: 400 })

  // Fetch article
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: article } = await (supabase as any)
    .from('articles')
    .select('id, content, brief, target_keyword, keyword_project_id')
    .eq('id', articleId)
    .eq('user_id', user.id)
    .single()

  if (!article) return NextResponse.json({ error: 'Article not found' }, { status: 404 })
  if (!article.content) return NextResponse.json({ error: 'No content to score — generate a draft first' }, { status: 400 })

  const targetKeyword = (article.target_keyword ?? (article.brief as Record<string, unknown>)?.target_keyword ?? '') as string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const brief = (article.brief ?? {}) as Record<string, any>

  // Fetch keyword difficulty + volume from DataForSEO data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: kwData } = article.keyword_project_id && targetKeyword ? await (supabase as any)
    .from('keywords')
    .select('keyword_difficulty, avg_monthly_searches')
    .eq('project_id', article.keyword_project_id)
    .ilike('keyword', targetKeyword)
    .maybeSingle() : { data: null }

  const seo = computeSEO(article.content, brief, targetKeyword)
  const readability = computeReadability(article.content)
  const geo = computeGEO(article.content)
  const aeo = computeAEO(article.content)
  const ranking_prediction = buildRankingPrediction(
    kwData?.keyword_difficulty ?? null,
    seo.score,
  )
  const traffic_prediction = buildTrafficPrediction(kwData?.avg_monthly_searches ?? null)

  const scores: ArticleScores = { seo, readability, geo, aeo, ranking_prediction, traffic_prediction }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase as any)
    .from('articles')
    .update({ scores })
    .eq('id', articleId)
    .eq('user_id', user.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json(scores)
}
