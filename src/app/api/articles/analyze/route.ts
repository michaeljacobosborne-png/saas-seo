export const runtime = 'nodejs'
export const maxDuration = 30

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { checkArticleLimit } from '@/lib/usage'
import {
  computeSEO,
  computeReadability,
  computeGEO,
  computeAEO,
} from '@/lib/article-scoring'
import type { ArticleScores } from '@/lib/supabase/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface Suggestion {
  category: 'seo' | 'readability' | 'structure' | 'content'
  severity: 'high' | 'medium' | 'low'
  issue: string
  fix: string
}

interface ContentGap {
  topic: string
  rationale: string
  suggestedKeyword: string
}

interface AnalyzeBody {
  content: string
  targetKeyword?: string
  saveAsArticle?: boolean
}

// LLMs sometimes wrap JSON in prose or code fences.
function parseJSON(text: string): unknown | null {
  if (!text) return null
  const candidates: string[] = []
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) candidates.push(fenced[1])
  const brace = text.match(/\{[\s\S]*\}/)
  if (brace) candidates.push(brace[0])
  candidates.push(text)
  for (const c of candidates) {
    try { return JSON.parse(c.trim()) } catch { /* try next */ }
  }
  return null
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  let body: AnalyzeBody
  try {
    body = await request.json() as AnalyzeBody
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }

  const { content, targetKeyword, saveAsArticle } = body

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return new Response(JSON.stringify({ error: 'content is required' }), { status: 400 })
  }
  if (content.length > 50000) {
    return new Response(JSON.stringify({ error: 'content must be 50,000 characters or fewer' }), { status: 400 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))

      try {
        // Step 1 — run algorithmic scoring
        send({ type: 'progress', message: 'Scoring your article…', step: 1, total: 2 })

        const brief = {
          target_keyword: targetKeyword ?? '',
          meta_description: '',
          secondary_keywords: [] as string[],
          url_slug: '',
        }

        const seo = computeSEO(content, brief, targetKeyword ?? '')
        const readability = computeReadability(content)
        const geo = computeGEO(content)
        const aeo = computeAEO(content)

        const scores: Pick<ArticleScores, 'seo' | 'readability' | 'geo' | 'aeo'> = {
          seo,
          readability,
          geo,
          aeo,
        }

        // Step 2 — AI analysis
        send({ type: 'progress', message: 'Running AI analysis…', step: 2, total: 2 })

        // Load brand profile (non-fatal if missing)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: brandProfile } = await (supabase as any)
          .from('brand_profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle()

        const brandContext = brandProfile
          ? [
              brandProfile.brand_name ? `Brand: ${brandProfile.brand_name}` : '',
              brandProfile.industry ? `Industry: ${brandProfile.industry}` : '',
              brandProfile.target_audience ? `Target audience: ${brandProfile.target_audience}` : '',
              brandProfile.brand_voice ? `Brand voice: ${brandProfile.brand_voice}` : '',
            ].filter(Boolean).join('\n')
          : ''

        const systemPrompt = `You are an expert SEO and content strategist. Analyze the provided article and return ONLY valid JSON — no markdown, no code fences, no explanation. Use exactly this shape:
{
  "suggestions": [
    {
      "category": "seo" | "readability" | "structure" | "content",
      "severity": "high" | "medium" | "low",
      "issue": "string describing the problem",
      "fix": "string describing the specific action to take"
    }
  ],
  "contentGaps": [
    {
      "topic": "string",
      "rationale": "string",
      "suggestedKeyword": "string"
    }
  ]
}
Provide 3-8 suggestions ordered by severity, and 2-5 content gaps. Be specific and actionable.`

        const userMessage = [
          targetKeyword ? `Target keyword: ${targetKeyword}` : '',
          brandContext ? `\nBrand context:\n${brandContext}` : '',
          `\nArticle content:\n${content.slice(0, 15000)}`,
        ].filter(Boolean).join('\n')

        type ParsedResponse = { suggestions?: unknown; contentGaps?: unknown }
        let parsed: ParsedResponse | null = null
        for (let attempt = 0; attempt < 2 && parsed === null; attempt++) {
          const res = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 2048,
            system: systemPrompt,
            messages: [{ role: 'user', content: userMessage }],
          })
          const block = res.content.find((b) => b.type === 'text')
          const rawText = block && block.type === 'text' ? block.text : ''
          parsed = parseJSON(rawText) as ParsedResponse | null
        }

        const suggestions: Suggestion[] = []
        const contentGaps: ContentGap[] = []

        if (parsed) {
          const rawSuggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : []
          for (const s of rawSuggestions) {
            const obj = (s ?? {}) as Record<string, unknown>
            const cat = obj.category
            const sev = obj.severity
            suggestions.push({
              category: (cat === 'seo' || cat === 'readability' || cat === 'structure' || cat === 'content' ? cat : 'content') as Suggestion['category'],
              severity: (sev === 'high' || sev === 'medium' || sev === 'low' ? sev : 'medium') as Suggestion['severity'],
              issue: String(obj.issue ?? '').trim(),
              fix: String(obj.fix ?? '').trim(),
            })
          }
          const rawGaps = Array.isArray(parsed.contentGaps) ? parsed.contentGaps : []
          for (const g of rawGaps) {
            const obj = (g ?? {}) as Record<string, unknown>
            contentGaps.push({
              topic: String(obj.topic ?? '').trim(),
              rationale: String(obj.rationale ?? '').trim(),
              suggestedKeyword: String(obj.suggestedKeyword ?? '').trim(),
            })
          }
        }

        // Optionally save as article
        let articleId: string | undefined
        if (saveAsArticle) {
          const limitCheck = await checkArticleLimit(user.id, supabase)
          if (!limitCheck.allowed) {
            send({
              type: 'error',
              error: `Article limit reached (${limitCheck.used}/${limitCheck.limit} this month). Upgrade your plan to save more articles.`,
            })
            controller.close()
            return
          }

          const titleMatch = content.match(/^#\s+(.+)$/m)
          const title = titleMatch?.[1]?.trim() ?? targetKeyword ?? 'Imported article'
          const wordCount = content.split(/\s+/).filter(Boolean).length

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: newArticle, error: insertError } = await (supabase as any)
            .from('articles')
            .insert({
              user_id: user.id,
              title,
              content,
              word_count: wordCount,
              target_keyword: targetKeyword ?? null,
              status: 'complete',
              scores: scores as unknown as ArticleScores,
            } as any)
            .select('id')
            .single()

          if (!insertError && newArticle?.id) {
            articleId = newArticle.id as string
          }
        }

        send({ type: 'result', scores, suggestions, contentGaps, ...(articleId ? { articleId } : {}) })
        controller.close()
      } catch (err) {
        send({
          type: 'error',
          error: `Analysis failed: ${err instanceof Error ? err.message : String(err)}`,
        })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  })
}
