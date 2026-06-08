export const maxDuration = 60

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function buildSystemPrompt(competitors: string[]): string {
  const hasStored = competitors.length > 0

  // Q4 adapts based on whether the user already tracks competitors in their brand profile.
  const q4 = hasStored
    ? `4. I see you're tracking ${competitors.join(', ')} as competitors. Are there any other specific companies you'd like to include in this research, or should I proceed with those?`
    : `4. Who are your top 2-3 competitors in this space?`

  // When competitors are already stored, fall back to them if the user doesn't name new ones.
  const competitorRule = hasStored
    ? `\nFor the "competitors" field: if the user names additional or different companies, use those. If the user says nothing new (e.g. "proceed", "those are fine", "no others"), use the stored list ${JSON.stringify(competitors)} as the competitors value.`
    : ''

  return `You are a keyword research strategist. Your job is to have a short, focused conversation to build a research brief before running keyword research.

Ask these questions ONE AT A TIME — never ask multiple questions in one message:
1. What is the topic or product you want to rank for?
2. Who is your target audience (be specific — job title, industry, pain point)?
3. What is the search intent — are people looking to learn, compare, or buy?
${q4}

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
${competitorRule}

The seed_keywords array must contain 15-20 specific, targeted keyword phrases — include long-tail variations, question-based terms (how to, what is, best), comparison terms, pain-point phrasings, and audience-specific language. Never include generic single-word seeds.

Keep responses short and conversational. Never ask more than one question at a time. Never explain what you're doing — just do it.`
}

type Message = { role: 'user' | 'assistant'; content: string }

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messages } = await request.json() as { messages: Message[] }

  // Pull stored competitors from the brand profile so Q4 can reference them.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: brandProfile } = await (supabase as any)
    .from('brand_profiles')
    .select('competitors')
    .eq('user_id', user.id)
    .single()

  const storedCompetitors: string[] = Array.isArray(brandProfile?.competitors)
    ? brandProfile.competitors.filter((c: unknown): c is string => typeof c === 'string' && c.trim().length > 0)
    : []

  const systemPrompt = buildSystemPrompt(storedCompetitors)

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      try {
        const anthropicStream = anthropic.messages.stream({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          system: systemPrompt,
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
