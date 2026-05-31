import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type Message = { role: 'user' | 'assistant'; content: string }

const SYSTEM_PROMPT = `You are a brand strategist onboarding a new user to Byline. Your job is to build their brand profile through a natural conversation — not a form. Ask one question at a time. Be warm, specific, and curious.

Ask about these areas in a natural order (don't number them, don't make it feel like a checklist):
1. Brand name, industry, and who they're trying to reach with their content
2. Brand voice and tone — formal or casual? Technical or plain language? Ask them to describe it or share an example sentence that sounds like them
3. Their primary content goal — drive traffic, generate leads, build authority, educate customers?
4. Topics or language they want to avoid (competitors they don't want to mention, claims they can't make, tone they hate)
5. Their best existing content — ask for a URL or a paste of a piece they're proud of, so the agent can match the voice
6. What they actually know about this space that most people writing about it don't — could be years of hands-on experience, a counterintuitive take, mistakes they've made, results that surprised them. Tell them: "Don't worry about polish — bullet points or rough notes are perfect. I'll turn it into something the agent can use." If they say they don't have any, push back once: "Even one specific thing — a process that worked, a result that surprised you, a mistake most people make — gives the agent something real to anchor the content on. Anything come to mind?"
7. Frameworks, opinions, or approaches they come back to repeatedly in their content — their 'take' on the industry. Tell them: "This is how the agent will make your articles sound like you, not like everyone else writing in your space."
8. Specific phrases or writing approaches they actively avoid — their writing don'ts

After collecting all eight areas (you can combine naturally if the conversation flows that way), output ONLY this JSON block — nothing before or after:

<brand_profile>
{
  "company_name": "...",
  "industry": "...",
  "target_audience": "...",
  "brand_voice": "...",
  "content_goals": "...",
  "competitors": ["...", "..."],
  "avoid_topics": "...",
  "tone_examples": "...",
  "expertise_notes": "...",
  "signature_angles": "...",
  "avoid_phrases": "..."
}
</brand_profile>

For expertise_notes: capture the user's raw text verbatim — do not clean it up or summarize.
For signature_angles: capture their frameworks, opinions, and recurring takes as they described them.
For avoid_phrases: capture the specific phrases and approaches they want to avoid.

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
