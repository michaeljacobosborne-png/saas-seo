export const maxDuration = 60

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a keyword research strategist. Your job is to have a short, focused conversation to build a research brief before running keyword research.

Ask these questions ONE AT A TIME — never ask multiple questions in one message:
1. What is the topic or product you want to rank for?
2. Who is your target audience (be specific — job title, industry, pain point)?
3. What is the search intent — are people looking to learn, compare, or buy?
4. Who are your top 2-3 competitors in this space?

Once you have all four answers, output ONLY a JSON block in this exact format (nothing before or after):
<research_brief>
{
  "topic": "...",
  "audience": "...",
  "intent": "informational|commercial|transactional",
  "competitors": ["...", "..."],
  "seed_keywords": ["...", "...", "...15-20 targeted seed terms..."]
}
</research_brief>

The seed_keywords array must contain 15-20 specific, targeted keyword phrases — include long-tail variations, question-based terms (how to, what is, best), comparison terms, pain-point phrasings, and audience-specific language. Never include generic single-word seeds.

Keep responses short and conversational. Never ask more than one question at a time. Never explain what you're doing — just do it.`

type Message = { role: 'user' | 'assistant'; content: string }

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messages } = await request.json() as { messages: Message[] }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      try {
        const anthropicStream = anthropic.messages.stream({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        })
        for await (const event of anthropicStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(event.delta.text))
          }
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
