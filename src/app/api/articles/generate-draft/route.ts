export const maxDuration = 120

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getKeywordIdeas, KeywordIdea } from '@/lib/dataforseo'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

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

═══ HUMANIZATION RULES (non-negotiable) ═══
• Vary sentence length deliberately — a 6-word sentence after a 30-word one creates rhythm. Never three sentences of matching length in a row.
• Use contractions (it's, you'll, that's, don't, you're, there's) — their absence is an AI tell.
• Write the intro as a problem, consequence, or tension — never a definition, never "In this article we'll cover..."
• Use editorial transitions sparingly and purposefully: "Here's the thing." / "That matters because..." / "Most people skip this part." / "The catch:" — max one per section.
• Include specific numbers, named tools, concrete examples. Vague generalities are a sign you don't know the subject.
• Intro a list with a sentence, follow it with a sentence. Never dump raw bullets without context.

═══ ANTI-SLOP RULES (non-negotiable) ═══
• Active voice only. Find the human doing the action. Make them the subject. "Researchers found" not "The data suggests."
• Kill every adverb. If the verb needs an adverb, find a stronger verb.
• No Wh- sentence starters: no "What makes this...", "Which means...", "Why this matters..."
• No binary contrasts: not "Not X — it's Y." Just say Y.
• No vague declaratives: not "The implications are significant." Name the specific implication.
• No throat-clearing openers: never start a sentence with It's worth noting / Importantly / Interestingly / Notably / Ultimately / Essentially.
• No quotable one-liners dangling at the end of paragraphs. That's AI finishing a thought cinematically.
• No inanimate subjects doing human verbs: "This approach enables..." → "You can now..."
• No false urgency or hype: game-changer, revolutionary, transformative, unprecedented, powerful — cut them all.
• Banned words: delve, leverage, robust, seamlessly, crucial, cutting-edge, dive into, it's worth noting, in today's landscape, moreover, furthermore, utilize (use "use"), facilitate (use "help"), implement (use "build" or "run").
• No em dashes used dramatically. If you need an em dash for a parenthetical, use parentheses or a comma.
• Every paragraph must earn its place. If removing it loses nothing, cut it.

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

  // ─── Pass 1 ───
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

  let wordCount = countWords(content)
  const threshold = Math.floor(targetWordCount * 0.85)
  let passCount = 1

  // ─── Pass 2: research + expansion (only when Pass 1 is under 85% of target) ───
  if (wordCount < threshold) {
    const targetKeyword = (article.target_keyword ?? brief.target_keyword ?? '') as string

    // Signal the UI that expansion is running
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('articles')
      .update({ status: 'expanding' })
      .eq('id', articleId)
      .eq('user_id', user.id)

    // Step A: identify expansion angles (GPT-4o-mini — cheap)
    let expansionAngles: string[] = []
    try {
      const anglesCompletion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an SEO content strategist. Given this article and its target keyword, identify 3-4 specific subtopics, questions, or angles that are underexplored and would add genuine value if expanded. Do not suggest padding or filler. Focus on what a reader would actually want to know. Return a JSON object with key "angles" containing an array of strings.',
          },
          {
            role: 'user',
            content: `Article: ${content}\nKeyword: ${targetKeyword}\nTarget word count: ${targetWordCount}\nCurrent word count: ${wordCount}`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 300,
      })
      const parsed = JSON.parse(anglesCompletion.choices[0].message.content ?? '{}')
      expansionAngles = Array.isArray(parsed.angles) ? parsed.angles : []
    } catch {
      expansionAngles = []
    }

    // Step B: targeted research via DataForSEO (uses global keyword cache)
    let researchData = expansionAngles.map((a) => `Expansion angle: ${a}`).join('\n')
    try {
      const serviceClient = createServiceClient()
      const seedsForResearch = [targetKeyword, ...expansionAngles.slice(0, 2)].filter(Boolean)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: cachedRows } = await (serviceClient as any)
        .from('keyword_cache')
        .select('*')
        .in('keyword', seedsForResearch)
        .gt('expires_at', new Date().toISOString())

      const cachedSet = new Set<string>(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (cachedRows ?? []).map((r: any) => r.keyword as string)
      )
      const cacheMisses = seedsForResearch.filter((s) => !cachedSet.has(s))

      const cachedIdeas: KeywordIdea[] = (cachedRows ?? []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (r: any) => ({
          keyword: r.keyword,
          search_volume: r.volume,
          competition: null,
          competition_index: null,
          cpc: r.cpc,
          keyword_difficulty: r.difficulty,
        })
      )

      let freshIdeas: KeywordIdea[] = []
      if (cacheMisses.length > 0) {
        try {
          freshIdeas = await getKeywordIdeas(cacheMisses, 'United States', 'English', 10)
          if (freshIdeas.length > 0) {
            const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
            const nowIso = new Date().toISOString()
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (serviceClient as any)
              .from('keyword_cache')
              .upsert(
                freshIdeas.map((k) => ({
                  keyword: k.keyword,
                  volume: k.search_volume,
                  difficulty: k.keyword_difficulty,
                  cpc: k.cpc,
                  fetched_at: nowIso,
                  expires_at: expiresAt,
                })),
                { onConflict: 'keyword' }
              )
          }
        } catch {
          // DataForSEO failure is non-fatal — proceed with cached data only
        }
      }

      const allIdeas = [...cachedIdeas, ...freshIdeas].slice(0, 10)
      researchData = [
        ...expansionAngles.map((a) => `Expansion angle: ${a}`),
        ...allIdeas.map((k) => `Related search: "${k.keyword}" (volume: ${k.search_volume ?? 'unknown'}, difficulty: ${k.keyword_difficulty ?? 'unknown'})`),
      ].join('\n')
    } catch {
      // Research failed — proceed with angles only
    }

    // Step C: expansion pass (GPT-4o — quality)
    try {
      const expansionCompletion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a senior SEO editor. Your job is to expand the provided article to reach the target word count. Use ONLY the research data provided — add real examples, statistics, explanations, and answers to the questions listed. Never add filler, vague transitions, or repetitive content. Add new sections or expand existing ones. Return the complete expanded article in markdown.',
          },
          {
            role: 'user',
            content: `ORIGINAL ARTICLE:\n${content}\n\nTARGET WORD COUNT: ${targetWordCount}\nCURRENT WORD COUNT: ${wordCount}\nWORDS NEEDED: ${targetWordCount - wordCount}\n\nRESEARCH DATA TO INCORPORATE:\n${researchData}\n\nExpand the article to hit the target word count using this research. Add a new section for each expansion angle if needed.`,
          },
        ],
        temperature: 0.7,
        max_tokens: 5000,
      })
      content = expansionCompletion.choices[0].message.content ?? content
    } catch {
      // Expansion failed — save Pass 1 content
    }

    wordCount = countWords(content)
    passCount = 2

    if (wordCount < threshold) {
      console.warn(`Article under target after two passes — topic may be inherently narrow. articleId: ${articleId}, target: ${targetWordCount}, actual: ${wordCount}`)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase as any)
    .from('articles')
    .update({ content, word_count: wordCount, status: 'complete', target_word_count: targetWordCount, pass_count: passCount })
    .eq('id', articleId)
    .eq('user_id', user.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ content, word_count: wordCount, pass_count: passCount })
}
