import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ArticleScores } from '@/lib/supabase/types'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

type Message = { role: 'user' | 'assistant'; content: string }

function buildFailedList(breakdown: Record<string, { label: string; passed?: boolean }>): string {
  const failed = Object.values(breakdown)
    .filter((c) => c.passed === false)
    .map((c) => `- ${c.label}`)
  return failed.length ? failed.join('\n') : '(none)'
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

  const weakAreasSection = scores ? `
WEAK AREAS TO PRIORITIZE (translate these into specific editorial actions — do NOT recite them verbatim):
SEO gaps: ${buildFailedList(scores.seo.breakdown)}
AEO gaps: ${buildFailedList(scores.aeo.breakdown as Record<string, { label: string; passed?: boolean }>)}
GEO gaps: ${buildFailedList(scores.geo.breakdown as Record<string, { label: string; passed?: boolean }>)}` : `
SCORING CONTEXT: Article not yet scored. Focus purely on the content you can read above.`

  const systemPrompt = `You are a senior SEO editor. Your job is to give specific, editorial feedback on the actual article content — not restate scores or metrics. When reviewing, cite specific lines or sections. When asked how to fix something, provide an example rewrite or concrete edit. Never repeat advice already given in this conversation.

ARTICLE UNDER REVIEW:
Title: ${article.title ?? '(untitled)'}
Target keyword: "${article.target_keyword ?? '(none set)'}"
Word count: ${article.word_count ?? 'unknown'}
${brand?.brand_name ? `Brand: ${brand.brand_name} | Voice: ${brand?.brand_voice ?? 'professional'}` : ''}
${brand?.tone_notes ? `Tone notes: ${brand.tone_notes}` : ''}
${weakAreasSection}

ARTICLE CONTENT:
${contentPreview}${(article.content ?? '').length > 3000 ? '\n[... content truncated ...]' : ''}

HOW TO BEHAVE:
- Read the article above and give paragraph-level, line-level observations. Quote the actual text when making a point. Example: "Your intro buries the keyword — it doesn't appear until the third sentence. Rewrite the opener as: '${article.target_keyword ?? 'your keyword'} is…'"
- Use the weak areas list to know what to look for — but turn each failure into a specific fix in the article. Never say "the keyword is missing from the H1." Instead say "Your H1 reads 'Getting Started with X' — add '${article.target_keyword ?? 'keyword'}' so it becomes 'How to [keyword] in 5 Steps'."
- On follow-up questions: go DEEPER. Give the actual rewrite, the exact FAQ question to add, the specific H2 to rename. Do not restate what you already said.
- Prioritize fixes by editorial impact: structure and keyword placement first, then content depth, then polish.
- Never write more than 3 bullet points without pausing to ask if they want to go deeper on one.
- Be direct. The user is a professional.`

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
