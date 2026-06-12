import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkArticleLimit } from '@/lib/usage'
import { interpretSeedQuery, BrandContext } from '@/lib/keyword-intent'
import { getKeywordIdeas } from '@/lib/dataforseo'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { allowed, used, limit } = await checkArticleLimit(user.id, supabase)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Article limit reached', used, limit, upgradeUrl: '/pricing' },
      { status: 403 }
    )
  }

  const body = await request.json() as {
    articleId: string
    // Standard path: keywords from a completed research project
    keywordProjectId?: string
    selectedKeywords?: string[]
    // Quick-write path: skip keyword research, derive seeds from topic directly
    directTopic?: string
    brandProfileId: string
  }
  const { articleId, keywordProjectId, selectedKeywords, directTopic, brandProfileId } = body

  if (!articleId || !brandProfileId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const isDirectMode = !!directTopic
  const isProjectMode = !!keywordProjectId && selectedKeywords?.length

  if (!isDirectMode && !isProjectMode) {
    return NextResponse.json(
      { error: 'Provide either directTopic or keywordProjectId + selectedKeywords' },
      { status: 400 }
    )
  }

  // Verify article ownership
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: article } = await (supabase as any)
    .from('articles')
    .select('id')
    .eq('id', articleId)
    .eq('user_id', user.id)
    .single()

  if (!article) return NextResponse.json({ error: 'Article not found' }, { status: 404 })

  // Fetch brand profile
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: brand } = await (supabase as any)
    .from('brand_profiles')
    .select('brand_name, industry, target_audience, brand_voice, tone_notes, competitors, primary_keywords, content_goals, expertise_notes, signature_angles')
    .eq('id', brandProfileId)
    .eq('user_id', user.id)
    .single()

  if (!brand) return NextResponse.json({ error: 'Brand profile not found' }, { status: 404 })

  // Build keyword lines for the brief prompt
  let kwLines = ''

  if (isDirectMode) {
    // Quick-write path: interpret the topic → clean seeds → DataForSEO keyword ideas
    const brandCtx: BrandContext = {
      brand_name: brand.brand_name,
      industry: brand.industry,
      target_audience: brand.target_audience,
      tone_notes: brand.tone_notes,
      content_goals: brand.content_goals,
      expertise_notes: brand.expertise_notes,
      signature_angles: brand.signature_angles,
      competitors: brand.competitors,
      primary_keywords: brand.primary_keywords,
    }

    const seeds = await interpretSeedQuery(directTopic!, brandCtx)

    let ideas: { keyword: string; search_volume: number | null; keyword_difficulty: number | null }[] = []
    try {
      const rawIdeas = await getKeywordIdeas(seeds, 'United States', 'English', 30)
      // Keep the seed keywords first if DataForSEO didn't return them
      const seedSet = new Set(seeds.map(s => s.toLowerCase()))
      const topIdeas = rawIdeas
        .sort((a, b) => {
          // Sort: seed keywords first, then by relevance (volume * 1 - difficulty * 0.5)
          const aIsSeed = seedSet.has(a.keyword.toLowerCase()) ? 1 : 0
          const bIsSeed = seedSet.has(b.keyword.toLowerCase()) ? 1 : 0
          if (aIsSeed !== bIsSeed) return bIsSeed - aIsSeed
          const aScore = (a.search_volume ?? 0) - (a.keyword_difficulty ?? 50) * 0.5
          const bScore = (b.search_volume ?? 0) - (b.keyword_difficulty ?? 50) * 0.5
          return bScore - aScore
        })
        .slice(0, 20)
      ideas = topIdeas
    } catch {
      // DataForSEO unavailable — use the interpreted seeds as bare keywords
      ideas = seeds.map(s => ({ keyword: s, search_volume: null, keyword_difficulty: null }))
    }

    kwLines = ideas.map(k =>
      `- "${k.keyword}" | volume: ${k.search_volume ?? '?'} | difficulty: ${k.keyword_difficulty ?? '?'}`
    ).join('\n')
  } else {
    // Standard path: fetch from the project's keyword rows
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: kwRows } = await (supabase as any)
      .from('keywords')
      .select('keyword, avg_monthly_searches, keyword_difficulty, cpc, competition, cluster')
      .eq('project_id', keywordProjectId)
      .in('keyword', selectedKeywords!)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    kwLines = (kwRows as any[] ?? []).map((k: any) =>
      `- "${k.keyword}" | volume: ${k.avg_monthly_searches ?? '?'} | difficulty: ${k.keyword_difficulty ?? '?'} | cluster: ${k.cluster ?? 'unknown'}`
    ).join('\n')
  }

  const prompt = `You are an SEO content strategist for ${brand.brand_name}${brand.industry ? `, a ${brand.industry} company` : ''}, targeting ${brand.target_audience ?? 'their ideal audience'}.

Brand voice: ${brand.brand_voice ?? 'professional'}
Tone notes: ${brand.tone_notes ?? 'none'}
Competitors: ${(brand.competitors as string[])?.join(', ') || 'none'}
Brand keywords: ${(brand.primary_keywords as string[])?.join(', ') || 'none'}
${brand.expertise_notes ? `\nExpertise: ${brand.expertise_notes}` : ''}
${brand.signature_angles ? `Content angles: ${brand.signature_angles}` : ''}

${isDirectMode ? `Article topic: "${directTopic}"\n` : ''}Keywords for this article:
${kwLines}

Generate a comprehensive SEO content brief. Return JSON only, no markdown:
{
  "target_keyword": "single best keyword to rank for from the list",
  "secondary_keywords": ["8-12 related terms to include naturally — mix from the list and related concepts"],
  "h1_options": ["Option 1 — compelling, specific, keyword-forward", "Option 2", "Option 3"],
  "meta_description": "155 chars max, includes target keyword, strong hook",
  "url_slug": "clean-keyword-rich-slug",
  "outline": [
    {"heading": "Section heading", "heading_level": "H2", "notes": "what to cover, specific angle, data to include", "word_count_target": 250}
  ],
  "word_count_target": 2100,
  "tone_notes": "specific writing guidance combining brand voice and keyword intent",
  "competitor_gaps": ["angle competitors likely miss", "angle 2", "angle 3"],
  "serp_intent": "informational"
}

Rules: outline must include an FAQ section (H2) with 3-5 H3 questions and a Key Takeaways H2. Total outline word_count_targets should sum to word_count_target.`

  let brief: Record<string, unknown>
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 1400,
    })
    brief = JSON.parse(completion.choices[0].message.content ?? '{}')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `AI generation failed: ${msg}` }, { status: 500 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase as any)
    .from('articles')
    .update({
      brief,
      status: 'brief_ready',
      target_keyword: brief.target_keyword as string ?? null,
      title: (brief.h1_options as string[])?.[0] ?? null,
      supporting_keywords: brief.secondary_keywords ?? [],
    })
    .eq('id', articleId)
    .eq('user_id', user.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ brief })
}
