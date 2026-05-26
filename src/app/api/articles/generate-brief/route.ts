import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    articleId: string
    keywordProjectId: string
    selectedKeywords: string[]
    brandProfileId: string
  }
  const { articleId, keywordProjectId, selectedKeywords, brandProfileId } = body

  if (!articleId || !keywordProjectId || !selectedKeywords?.length || !brandProfileId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
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
    .select('brand_name, industry, target_audience, brand_voice, tone_notes, competitors, primary_keywords')
    .eq('id', brandProfileId)
    .eq('user_id', user.id)
    .single()

  if (!brand) return NextResponse.json({ error: 'Brand profile not found' }, { status: 404 })

  // Fetch keyword data from DataForSEO pipeline
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: kwRows } = await (supabase as any)
    .from('keywords')
    .select('keyword, avg_monthly_searches, keyword_difficulty, cpc, competition, cluster')
    .eq('project_id', keywordProjectId)
    .in('keyword', selectedKeywords)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kwLines = (kwRows as any[] ?? []).map((k: any) =>
    `- "${k.keyword}" | volume: ${k.avg_monthly_searches ?? '?'} | difficulty: ${k.keyword_difficulty ?? '?'} | cluster: ${k.cluster ?? 'unknown'}`
  ).join('\n')

  const prompt = `You are an SEO content strategist for ${brand.brand_name}${brand.industry ? `, a ${brand.industry} company` : ''}, targeting ${brand.target_audience ?? 'their ideal audience'}.

Brand voice: ${brand.brand_voice ?? 'professional'}
Tone notes: ${brand.tone_notes ?? 'none'}
Competitors: ${(brand.competitors as string[])?.join(', ') || 'none'}
Brand keywords: ${(brand.primary_keywords as string[])?.join(', ') || 'none'}

Selected keywords (from DataForSEO research):
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
