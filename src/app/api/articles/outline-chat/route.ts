export const maxDuration = 30

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface OutlineSection {
  heading: string
  heading_level: string | number
  notes: string
  word_count_target: number
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { outline, message, articleTitle } = await request.json() as {
    outline?: OutlineSection[]
    message?: string
    articleTitle?: string
  }

  const cleanMessage = (message ?? '').trim()
  if (!Array.isArray(outline) || outline.length === 0) {
    return NextResponse.json({ error: 'Missing outline' }, { status: 400 })
  }
  if (!cleanMessage) {
    return NextResponse.json({ error: 'Missing message' }, { status: 400 })
  }

  const systemPrompt = `You are an editorial assistant helping refine a content outline. The article is titled "${articleTitle ?? 'Untitled'}".

The current outline is:
${JSON.stringify(outline, null, 2)}

Return the COMPLETE updated outline as JSON in this exact format (no markdown, no prose before or after):
{ "outline": [{ "heading": "...", "heading_level": "H2", "notes": "...", "word_count_target": 250 }] }

Rules:
- Apply the user's request thoughtfully to the whole outline.
- Do NOT add new sections unless the user explicitly asks for them.
- Preserve the heading_level format already used in the current outline (e.g. "H2"/"H3" or 2/3).
- Keep every section that the user did not ask to change exactly as-is.
- Always return the full outline, not just the changed sections.`

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      try {
        const completion = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2048,
          system: systemPrompt,
          messages: [{ role: 'user', content: cleanMessage }],
        })

        const text = completion.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('')

        const match = text.match(/\{[\s\S]*\}/)
        if (!match) throw new Error('Could not parse updated outline')

        const parsed = JSON.parse(match[0]) as { outline?: OutlineSection[] }
        if (!Array.isArray(parsed.outline) || parsed.outline.length === 0) {
          throw new Error('Updated outline was empty')
        }

        const payload = JSON.stringify({ type: 'outline', outline: parsed.outline })
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`))
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Outline update failed'
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: msg })}\n\n`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
