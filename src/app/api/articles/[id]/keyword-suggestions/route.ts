import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface KeywordSuggestion {
  keyword: string
  volume: number | null
  difficulty: number | null
  cpc: number | null
  reason: string
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  // Get article context
  const { data: article } = await sb
    .from('articles')
    .select('title, target_keyword, scores')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!article) return NextResponse.json({ error: 'Article not found' }, { status: 404 })

  // Get saved keywords (top 50 by volume — already researched, have real data)
  const { data: savedKws } = await sb
    .from('saved_keywords')
    .select('keyword, volume, difficulty, cpc, intent')
    .eq('user_id', user.id)
    .order('volume', { ascending: false })
    .limit(50)

  const allKws: Array<{ keyword: string; volume: number | null; difficulty: number | null; cpc: number | null; intent: string | null }> = savedKws ?? []

  // Filter out the current keyword
  const candidates = allKws.filter(
    (k) => k.keyword.toLowerCase() !== (article.target_keyword ?? '').toLowerCase()
  )

  if (candidates.length === 0) {
    return NextResponse.json({ suggestions: [] })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scores = article.scores as any
  const seoScore = scores?.seo?.score ?? null
  const rankingTimeline = scores?.ranking_prediction?.timeline ?? ''

  const candidateList = candidates
    .slice(0, 30)
    .map((k) => `- "${k.keyword}" | vol: ${k.volume ?? '?'} | KD: ${k.difficulty ?? '?'} | intent: ${k.intent ?? '?'}`)
    .join('\n')

  const prompt = `You are an SEO strategist. An article is targeting the keyword "${article.target_keyword}" and got an SEO score of ${seoScore ?? 'unknown'}/100. Ranking prediction: "${rankingTimeline}".

Article title: ${article.title ?? article.target_keyword}

Here are saved keywords available to retarget this article:
${candidateList}

Pick the top 3 keywords from this list that would give this article the best chance of ranking well. Prefer keywords with:
- Lower difficulty (easier to rank)
- Decent volume (not too low)
- Intent that matches an informational/educational article
- Semantic relevance to the article's content

Return ONLY valid JSON in this exact format, nothing else:
[
  {"keyword": "...", "reason": "one short sentence why this is a better target"},
  {"keyword": "...", "reason": "..."},
  {"keyword": "...", "reason": "..."}
]`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [
        { role: 'user', content: prompt },
        { role: 'assistant', content: '[' },
      ],
    })

    const raw = '[' + (response.content[0] as { text: string }).text.trim()
    const parsed = JSON.parse(raw.endsWith(']') ? raw : raw + ']') as Array<{ keyword: string; reason: string }>

    // Enrich with saved stats
    const suggestions: KeywordSuggestion[] = parsed.slice(0, 3).map((s) => {
      const match = candidates.find((k) => k.keyword.toLowerCase() === s.keyword.toLowerCase())
      return {
        keyword: s.keyword,
        volume: match?.volume ?? null,
        difficulty: match?.difficulty ?? null,
        cpc: match?.cpc ?? null,
        reason: s.reason,
      }
    })

    return NextResponse.json({ suggestions })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Suggestion failed: ${msg}` }, { status: 500 })
  }
}
