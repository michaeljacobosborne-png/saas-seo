import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { articleId: string; target_word_count?: number }
  const { articleId } = body
  const targetWordCount = body.target_word_count ?? 1200
  if (!articleId) return NextResponse.json({ error: 'articleId is required' }, { status: 400 })

  // Fetch article with brief
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: article } = await (supabase as any)
    .from('articles')
    .select('id, brief, brand_profile_id, keyword_project_id, target_keyword')
    .eq('id', articleId)
    .eq('user_id', user.id)
    .single()

  if (!article) return NextResponse.json({ error: 'Article not found' }, { status: 404 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const brief = article.brief as Record<string, any>
  if (!brief) return NextResponse.json({ error: 'No brief found — generate a brief first' }, { status: 400 })

  // Fetch brand profile (graceful fallback if missing)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: brand } = article.brand_profile_id ? await (supabase as any)
    .from('brand_profiles')
    .select('brand_name, brand_voice, tone_notes, target_audience, industry')
    .eq('id', article.brand_profile_id)
    .eq('user_id', user.id)
    .single() : { data: null }

  const brandName = brand?.brand_name ?? 'the company'
  const brandVoice = brand?.brand_voice ?? 'professional'
  const toneNotes = brand?.tone_notes ?? 'Clear, direct, evidence-backed.'
  const audience = brand?.target_audience ?? 'readers looking to learn'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const outlineText = (brief.outline as any[] ?? []).map((s: any) => {
    const hLevel = s.heading_level === 'H3' ? '###' : '##'
    return `${hLevel} ${s.heading}\n  → ${s.notes} (~${s.word_count_target} words)`
  }).join('\n\n')

  const systemPrompt = `You are an expert SEO content writer for ${brandName}.

BRAND VOICE: ${brandVoice}
TONE: ${toneNotes}
AUDIENCE: ${audience}

═══ HUMANIZATION RULES (apply strictly) ═══
• Vary sentence length deliberately — short punchy sentences alongside longer explanatory ones
• Never open with "In today's..." / "In the world of..." / "In this article..." — start with a problem, observation, or tension
• Use contractions naturally (it's, you'll, that's, don't, you're)
• Write the intro as a problem statement or provocative observation, not a definition
• Include specific numbers, examples, and named tools/concepts wherever relevant
• Use editorial transitions: "Here's the thing." / "That matters because..." / "Most people skip this part." / "The catch:"
• No bullet-point dumps — always introduce a list with context and follow it with a sentence

═══ SEO RULES (apply strictly) ═══
• Target keyword must appear: in the H1, within the first 100 words, in at least one H2, and in the meta (meta goes in brief, not body)
• Secondary keywords distributed naturally — never stuffed, never repeated within the same paragraph
• Include a FAQ section with 3-5 questions (each as H3, answer immediately follows as a paragraph)
• Include a "Key Takeaways" section

═══ AEO RULES (Answer Engine Optimization) ═══
• At least one paragraph (40-60 words) that directly answers "What is [topic]?" — natural prose, not a heading
• Every FAQ H3 question gets an immediate paragraph answer (40-80 words) before any next heading

═══ GEO RULES (Generative Engine Optimization) ═══
• Include at least one definitional statement per major H2 section (AI engines pull these)
• Include one stat/data sentence per H2 section — citing a general category is fine: "According to DataForSEO research..." or "Industry benchmarks show..."
• Clear H2 hierarchy — each H2 section is self-contained and scannable

Write in Markdown. Use # for H1, ## for H2, ### for H3. Do not include the meta description in the body. Start directly with the # H1.`

  const userPrompt = `Write a complete SEO article using the brief below.

TARGET KEYWORD: ${brief.target_keyword}
SECONDARY KEYWORDS: ${(brief.secondary_keywords as string[] ?? []).join(', ')}
H1: ${(brief.h1_options as string[])?.[0] ?? brief.target_keyword}
SERP INTENT: ${brief.serp_intent ?? 'informational'}
TONE NOTES: ${brief.tone_notes ?? toneNotes}
COMPETITOR GAPS TO ADDRESS: ${(brief.competitor_gaps as string[] ?? []).join('; ')}
TARGET WORD COUNT: ${targetWordCount}

WORD COUNT REQUIREMENT: The article must be exactly ${targetWordCount} words. Do not go under. If content runs short, add a relevant FAQ section, case study, or deeper analysis section — never add filler.

OUTLINE:
${outlineText}

Write the full article now.`

  // Mark as generating
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('articles')
    .update({ status: 'generating' })
    .eq('id', articleId)
    .eq('user_id', user.id)

  let content: string
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 3800,
    })
    content = completion.choices[0].message.content ?? ''
  } catch (err) {
    // Reset status so user can retry
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('articles')
      .update({ status: 'brief_ready' })
      .eq('id', articleId)
      .eq('user_id', user.id)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `AI generation failed: ${msg}` }, { status: 500 })
  }

  const wordCount = content.split(/\s+/).filter(Boolean).length

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase as any)
    .from('articles')
    .update({ content, word_count: wordCount, status: 'complete', target_word_count: targetWordCount })
    .eq('id', articleId)
    .eq('user_id', user.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ content, word_count: wordCount })
}
