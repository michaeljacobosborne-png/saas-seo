import { NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { createClient } from '@/lib/supabase/server'
import { sendTelegramMessage, escapeMarkdown, signupSourceLabel } from '@/lib/telegram'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 30

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type Message = { role: 'user' | 'assistant'; content: string }

// ─── Fix 2: web browsing for the onboarding agent ──────────────────────────────

// Pull http(s) URLs and bare domains (e.g. "givesuite.com") out of a message.
function extractUrls(text: string): string[] {
  const re = /\b(?:https?:\/\/)?(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?:\/[^\s)]*)?/gi
  const found = new Set<string>()
  for (const raw of text.match(re) ?? []) {
    // Skip email addresses (preceded by @ is handled by \b, but guard anyway).
    if (raw.includes('@')) continue
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    found.add(url)
    if (found.size >= 2) break // cap to bound latency
  }
  return [...found]
}

// Fetch a page and return a compact text snapshot (title + description + body text).
async function fetchPageSnapshot(url: string): Promise<string | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Byline-BrandOnboard/1.0' },
    })
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) return null

    const html = await res.text()
    const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim()
    const description = (
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] ??
      html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i)?.[1] ??
      ''
    ).trim()
    const body = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 2000)

    return `Content fetched from ${url}:\nTitle: ${title || '(none)'}\nDescription: ${description || '(none)'}\n\n${body}`
  } catch {
    return null // network error / timeout / abort — continue without page content
  } finally {
    clearTimeout(timeout)
  }
}

// ─── Fix 3: auto-extract brand facts from the conversation and upsert ───────────

async function extractAndSaveBrandFacts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  conversation: Message[],
  userEmail: string | undefined,
  signupSource: string | undefined,
): Promise<void> {
  const transcript = conversation.map((m) => `${m.role}: ${m.content}`).join('\n\n')

  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system:
      'You extract structured brand facts from an onboarding conversation. Return ONLY a JSON object — no prose, no markdown fences. Include only the fields you have real, confident information about; omit any field you are unsure of. Fields: brand_name (string), industry (string), target_audience (string), brand_voice (string), tone_notes (string), competitors (string[]), primary_keywords (string[]).',
    messages: [{ role: 'user', content: `Conversation:\n\n${transcript}\n\nExtract the brand facts as JSON.` }],
  })

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')

  const jsonStart = text.indexOf('{')
  const jsonEnd = text.lastIndexOf('}')
  if (jsonStart === -1 || jsonEnd <= jsonStart) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let facts: Record<string, any>
  try {
    facts = JSON.parse(text.slice(jsonStart, jsonEnd + 1))
  } catch {
    return
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: Record<string, any> = { user_id: userId }
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

  if (str(facts.brand_name)) payload.brand_name = str(facts.brand_name)
  if (str(facts.industry)) payload.industry = str(facts.industry)
  if (str(facts.target_audience)) payload.target_audience = str(facts.target_audience)
  // The descriptive brand voice maps to the tone_notes column (brand_voice is enum-style).
  const tone = str(facts.tone_notes) ?? str(facts.brand_voice)
  if (tone) payload.tone_notes = tone
  if (Array.isArray(facts.competitors) && facts.competitors.length) {
    payload.competitors = facts.competitors.filter((c: unknown) => typeof c === 'string' && c.trim())
  }
  if (Array.isArray(facts.primary_keywords) && facts.primary_keywords.length) {
    payload.primary_keywords = facts.primary_keywords.filter((k: unknown) => typeof k === 'string' && k.trim())
  }

  // Nothing confident beyond user_id — skip the write.
  if (Object.keys(payload).length <= 1) return

  // Detect first-ever profile creation so we ping Telegram once per free signup.
  // Checking existence before the upsert is the only reliable signal — upsert
  // reports success identically for an insert vs. an update.
  const { data: existing } = await supabase
    .from('brand_profiles')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()

  await supabase.from('brand_profiles').upsert(payload, { onConflict: 'user_id' })

  // Only the first-ever profile creation is a candidate for a signup ping.
  if (!existing) {
    // Don't notify immediately. For paid signups, Stripe's
    // checkout.session.completed webhook flips profiles.account_type to 'paid'
    // shortly after the brand profile is created — and that webhook fires its
    // own richer "New Byline subscriber" Telegram message. Pinging here right
    // away would race the webhook and mislabel paying customers as "Free tier".
    // So wait a few seconds, re-read account_type, and only send the free-tier
    // ping when the user is still free/null (no paid webhook is coming). This
    // whole function already runs under waitUntil, so the delay doesn't block
    // the client response and the invocation stays alive until it resolves.
    await new Promise((r) => setTimeout(r, 4000))

    const { data: profile } = await supabase
      .from('profiles')
      .select('account_type')
      .eq('user_id', userId)
      .maybeSingle()

    const accountType = profile?.account_type as string | null | undefined
    if (!accountType || accountType === 'free') {
      await sendTelegramMessage(
        [
          '🆕 *New free signup*',
          `👤 ${escapeMarkdown(userEmail ?? 'unknown')}`,
          '📋 Free tier',
          `📣 Source: ${escapeMarkdown(signupSourceLabel(signupSource))}`,
        ].join('\n'),
        process.env.TELEGRAM_SIGNUP_CHAT_ID,
      )
    }
    // Paid tier → skip; the Stripe webhook sends the paid notification.
  }
}

const SYSTEM_PROMPT = `You are a brand strategist onboarding a new user to Byline. Your job is to build their brand profile through a natural conversation — not a form. Ask one question at a time. Be warm, specific, and curious.

Ask about these areas in a natural order (don't number them, don't make it feel like a checklist):
1. Brand name, industry, and who they're trying to reach with their content
2. Brand voice and tone — formal or casual? Technical or plain language? Ask them to describe it or share an example sentence that sounds like them
3. Their primary content goal — drive traffic, generate leads, build authority, educate customers?
4. Topics or language they want to avoid (competitors they don't want to mention, claims they can't make, tone they hate)
5. Their best existing content — ask for a URL or a paste of a piece they're proud of, so the agent can match the voice
6. Before asking about their expertise, say exactly this framing line first: "This next part is optional but it's the single biggest factor in whether your content sounds like everyone else or like you. The more specific you are, the better every article Byline writes for you will be." Then ask: what do they actually know about this space that most people writing about it don't — could be years of hands-on experience, a counterintuitive take, mistakes they've made, results that surprised them. Tell them: "Don't worry about polish — bullet points or rough notes are perfect. I'll turn it into something the agent can use." If they skip or give a thin answer, push back once: "Even one specific thing — a process that worked, a result that surprised you, a mistake most people make — gives the agent something real to anchor the content on. Anything come to mind?" If after the push-back they still skip or give nothing substantive, set expertise_skipped: true in the final JSON and move on.
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
  "avoid_phrases": "...",
  "expertise_skipped": false
}
</brand_profile>

For expertise_notes: capture the user's raw text verbatim — do not clean it up or summarize.
For signature_angles: capture their frameworks, opinions, and recurring takes as they described them.
For avoid_phrases: capture the specific phrases and approaches they want to avoid.
For expertise_skipped: set to true if the user declined or gave a thin/empty answer after the push-back; otherwise false.

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

  // Fix 2: if the latest user message references any URLs, fetch them server-side
  // and inject the page content so the agent can reason about the real site.
  let systemPrompt = SYSTEM_PROMPT
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')
  if (lastUser) {
    const urls = extractUrls(lastUser.content)
    if (urls.length) {
      const snapshots = (await Promise.all(urls.map(fetchPageSnapshot))).filter(
        (s): s is string => Boolean(s),
      )
      if (snapshots.length) {
        systemPrompt += `\n\n---\nThe user referenced one or more URLs. Below is live content fetched from those pages. Use it to understand their brand and to inform your questions and the final profile. You CAN access this content — never tell the user you can't browse the web.\n\n${snapshots.join('\n\n---\n\n')}`
      }
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      let assistantText = ''
      try {
        const anthropicStream = anthropic.messages.stream({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          system: systemPrompt,
          messages: apiMessages,
        })
        for await (const event of anthropicStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            assistantText += event.delta.text
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stream error'
        controller.enqueue(encoder.encode(`[Error: ${msg}]`))
      } finally {
        // Fix 3: after the response is delivered, extract brand facts from the full
        // conversation and upsert them. Registered with waitUntil BEFORE close() so
        // Vercel's runtime keeps the invocation alive until the upsert resolves —
        // otherwise the serverless function can suspend the moment the stream closes,
        // killing the background work before the write completes. The client is never
        // blocked: waitUntil does not delay the response.
        // Skipped on the final-profile turn (the user reviews + saves that explicitly).
        if (assistantText && !assistantText.includes('<brand_profile>') && messages.some((m) => m.role === 'user')) {
          waitUntil(
            extractAndSaveBrandFacts(supabase, user.id, [
              ...messages,
              { role: 'assistant', content: assistantText },
            ], user.email, user.user_metadata?.source as string | undefined).catch((err) => {
              console.error('brand fact auto-extraction failed:', err)
            }),
          )
        }
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
