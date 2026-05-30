import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type Message = { role: 'user' | 'assistant'; content: string }

const SYSTEM_PROMPT = `You are a brand strategist onboarding a new user to Byline. Your job is to build their brand profile through a natural conversation — not a form. Ask one question at a time. Be warm, specific, and curious.

Ask about these areas in a natural order (don't number them, don't make it feel like a checklist):
1. What their business or product does and who it's for
2. Their target audience — job title, industry, pain points, what keeps them up at night
3. Their brand voice — formal or casual? Technical or plain language? Ask them to describe it or share an example sentence that sounds like them
4. Topics or language they want to avoid (competitors they don't want to mention, claims they can't make, tone they hate)
5. Their top 2-3 competitors and how they're different
6. Their primary content goal — drive traffic, generate leads, build authority, educate customers?

After collecting all six areas (you can combine naturally if the conversation flows that way), output ONLY this JSON block — nothing before or after:

<brand_profile>
{
  "company_name": "...",
  "industry": "...",
  "target_audience": "...",
  "brand_voice": "...",
  "content_goals": "...",
  "competitors": ["...", "..."],
  "avoid_topics": "...",
  "tone_examples": "..."
}
</brand_profile>

Rules:
- Ask ONE question at a time. Never list multiple questions.
- Keep responses under 3 sentences. This is a conversation, not a consultation.
- When the user gives a short answer, ask a follow-up to get more depth before moving on.
- Sound like a smart colleague, not a chatbot.
- Never say "Great!" or "Absolutely!" or other filler affirmations.
- Start immediately with: "Let's get your brand set up. What does [company/product] do, and who are you trying to reach with your content?"`

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messages } = await request.json() as { messages: Message[] }

  // Anthropic requires the first message to have role 'user'
  let apiMessages: Message[]
  if (messages.length === 0 || messages[0].role === 'assistant') {
    apiMessages = [{ role: 'user', content: 'begin' }, ...messages]
  } else {
    apiMessages = messages
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      try {
        const anthropicStream = anthropic.messages.stream({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: apiMessages,
        })
        for await (const event of anthropicStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stream error'
        controller.enqueue(encoder.encode(`[Error: ${msg}]`))
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
