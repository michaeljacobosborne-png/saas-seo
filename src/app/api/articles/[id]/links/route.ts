export const runtime = 'nodejs'
export const maxDuration = 45

import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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

const SYSTEM_PROMPT = `You are an expert SEO strategist. Analyze the article for internal and external link opportunities. Return ONLY valid JSON with this exact shape — no markdown, no prose:
{
  "internal": [
    {
      "anchorText": "exact phrase from article (1-5 words)",
      "targetArticleId": "uuid from the article list",
      "targetArticleTitle": "title of the target article",
      "reason": "why this link adds value for SEO and readers",
      "context": "...~15 words of surrounding text from the article..."
    }
  ],
  "external": [
    {
      "anchorText": "exact phrase from article that needs a citation",
      "suggestedQuery": "google search query to find the right source",
      "reason": "why this claim needs an authoritative citation",
      "suggestedDomain": "e.g. academic journal, government site, industry publication",
      "context": "...~15 words of surrounding text from the article..."
    }
  ]
}

Rules:
- Suggest 3-6 internal links (only if the user has matching articles in the provided list).
- Suggest 3-5 external link citations.
- anchorText MUST appear EXACTLY in the article content (case may differ, but words must be present).
- Do NOT suggest anchorText that is already inside a markdown link pattern [text](url).`

type InternalLink = {
  anchorText: string
  targetArticleId: string
  targetArticleTitle: string
  reason: string
  context: string
}

type ExternalLink = {
  anchorText: string
  suggestedQuery: string
  reason: string
  suggestedDomain: string
  context: string
}

type LinksResponse = {
  internal?: unknown[]
  external?: unknown[]
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch the current article
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: article } = await (supabase as any)
    .from('articles')
    .select('id, title, content, target_keyword')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!article) return NextResponse.json({ error: 'Article not found' }, { status: 404 })
  if (!article.content) return NextResponse.json({ error: 'Article has no content yet' }, { status: 400 })

  // Fetch the user's other published/complete articles for internal linking
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: otherArticles } = await (supabase as any)
    .from('articles')
    .select('id, title, target_keyword, status')
    .eq('user_id', user.id)
    .in('status', ['complete', 'published'])
    .neq('id', id)
    .limit(30)

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))

      try {
        send({ type: 'progress', message: 'Analyzing link opportunities…' })

        const articleList = (otherArticles ?? []).map((a: { id: string; title: string; target_keyword: string }) => ({
          id: a.id,
          title: a.title,
          target_keyword: a.target_keyword,
        }))

        const userMessage = [
          `Target keyword: ${article.target_keyword ?? '(not set)'}`,
          `Article content (first 12000 chars):\n${(article.content as string).slice(0, 12000)}`,
          articleList.length > 0
            ? `Other articles available to link to:\n${JSON.stringify(articleList)}`
            : 'Other articles available to link to: none',
        ].join('\n\n')

        const response = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2048,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userMessage }],
        })

        const block = response.content.find((b) => b.type === 'text')
        const rawText = block && block.type === 'text' ? block.text : ''

        const parsed = parseJSON(rawText) as LinksResponse | null

        const rawInternal = Array.isArray(parsed?.internal) ? parsed!.internal : []
        const rawExternal = Array.isArray(parsed?.external) ? parsed!.external : []

        const contentLower = (article.content as string).toLowerCase()

        // Validate internal links: anchorText must exist in content, targetArticleId must be in list
        const validArticleIds = new Set((otherArticles ?? []).map((a: { id: string }) => a.id))
        const internal: InternalLink[] = (rawInternal as Record<string, unknown>[])
          .filter((link) => {
            if (!link || typeof link !== 'object') return false
            const anchor = String(link.anchorText ?? '').trim()
            const targetId = String(link.targetArticleId ?? '').trim()
            if (!anchor || !targetId) return false
            if (!contentLower.includes(anchor.toLowerCase())) return false
            if (!validArticleIds.has(targetId)) return false
            return true
          })
          .map((link) => ({
            anchorText: String(link.anchorText).trim(),
            targetArticleId: String(link.targetArticleId).trim(),
            targetArticleTitle: String(link.targetArticleTitle ?? '').trim(),
            reason: String(link.reason ?? '').trim(),
            context: String(link.context ?? '').trim(),
          }))

        // Validate external links: anchorText must exist in content
        const external: ExternalLink[] = (rawExternal as Record<string, unknown>[])
          .filter((link) => {
            if (!link || typeof link !== 'object') return false
            const anchor = String(link.anchorText ?? '').trim()
            if (!anchor) return false
            if (!contentLower.includes(anchor.toLowerCase())) return false
            return true
          })
          .map((link) => ({
            anchorText: String(link.anchorText).trim(),
            suggestedQuery: String(link.suggestedQuery ?? '').trim(),
            reason: String(link.reason ?? '').trim(),
            suggestedDomain: String(link.suggestedDomain ?? '').trim(),
            context: String(link.context ?? '').trim(),
          }))

        send({ type: 'result', internal, external })
        controller.close()
      } catch (err) {
        send({
          type: 'error',
          error: `Link analysis failed: ${err instanceof Error ? err.message : String(err)}`,
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
