import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ArticleScores } from '@/lib/supabase/types'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

type Message = { role: 'user' | 'assistant'; content: string }

function buildFailedList(breakdown: Record<string, { label: string; passed?: boolean }>): string {
  const failed = Object.values(breakdown)
    .filter((c) => c.passed === false)
    .map((c) => `  - ${c.label}`)
  return failed.length ? failed.join('\n') : '  (all criteria passed)'
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { messages } = await request.json() as { messages: Message[] }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: article } = await (supabase as any)
    .from('articles')
    .select('title, target_keyword, word_count, content, scores, brand_profile_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!article) return NextResponse.json({ error: 'Article not found' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: brand } = article.brand_profile_id ? await (supabase as any)
    .from('brand_profiles')
    .select('brand_name, brand_voice, tone_notes')
    .eq('id', article.brand_profile_id)
    .eq('user_id', user.id)
    .single() : { data: null }

  const scores = article.scores as ArticleScores | null
  const contentPreview = (article.content ?? '').slice(0, 3000)

  const scoresSection = scores ? `
SCORES:
- SEO: ${scores.seo.score}/100
- Readability: ${scores.readability.score}/100
- GEO: ${scores.geo.score}/100
- AEO: ${scores.aeo.score}/100

SEO failed criteria:
${buildFailedList(scores.seo.breakdown)}

AEO failed criteria:
${buildFailedList(scores.aeo.breakdown as Record<string, { label: string; passed?: boolean }>)}

GEO failed criteria:
${buildFailedList(scores.geo.breakdown as Record<string, { label: string; passed?: boolean }>)}

Ranking prediction: ${scores.ranking_prediction.timeline} (${scores.ranking_prediction.confidence} confidence)` : `
SCORES: Not yet scored. Encourage the user to score the article first for full analysis.`

  const systemPrompt = `You are Byline's editorial agent — an expert SEO editor and content strategist.

You are reviewing this article:
- Title: ${article.title ?? '(untitled)'}
- Target keyword: ${article.target_keyword ?? '(none set)'}
- Word count: ${article.word_count ?? 'unknown'}
- Brand: ${brand?.brand_name ?? '(no brand set)'}, Voice: ${brand?.brand_voice ?? 'professional'}
${brand?.tone_notes ? `- Tone notes: ${brand.tone_notes}` : ''}
${scoresSection}

ARTICLE CONTENT (first 3000 chars):
${contentPreview}${(article.content ?? '').length > 3000 ? '\n[... content truncated ...]' : ''}

You are in REVIEW mode. Your job is to:
- Give honest, specific feedback — not generic praise
- Explain exactly why scores are what they are, referencing the failed criteria above
- Suggest concrete fixes with examples drawn from the actual content
- If asked, help brainstorm angles, headers, FAQs, or sections to add
- Never rewrite large chunks unprompted — suggest, don't replace
- Be direct and concise. The user is a professional.
- When listing fixes, prioritize by impact on score`

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          stream: true,
          temperature: 0.7,
          max_tokens: 1200,
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages.map((m) => ({ role: m.role, content: m.content })),
          ],
        })
        for await (const chunk of completion) {
          const text = chunk.choices[0]?.delta?.content ?? ''
          if (text) controller.enqueue(encoder.encode(text))
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stream error'
        controller.enqueue(encoder.encode(`\n\n[Error: ${msg}]`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
