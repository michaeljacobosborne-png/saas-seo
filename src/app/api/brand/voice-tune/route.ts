import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 30

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type VoiceFingerprint = {
  style_summary: string
  phrases: string[]
  sample: string
  avoid: string
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Paid plan gate
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: acctProfile } = await (supabase as any)
    .from('profiles')
    .select('account_type')
    .eq('user_id', user.id)
    .maybeSingle()
  if (acctProfile?.account_type !== 'paid') {
    return NextResponse.json({ error: 'Paid plan required', code: 'UPGRADE_REQUIRED' }, { status: 403 })
  }

  // Load voice fingerprint
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: brandProfile } = await (supabase as any)
    .from('brand_profiles')
    .select('voice_fingerprint')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!brandProfile?.voice_fingerprint) {
    return NextResponse.json({
      error: 'No voice profile found. Set up your Voice Personality on the Brand page first.',
      code: 'NO_VOICE_PROFILE',
    }, { status: 400 })
  }

  const fp = brandProfile.voice_fingerprint as VoiceFingerprint
  const { instruction, selectedText, articleContent } = await request.json() as {
    instruction: string
    selectedText?: string
    articleContent?: string
  }

  if (!instruction) return NextResponse.json({ error: 'Missing instruction' }, { status: 400 })

  const systemPrompt = `You are rewriting content to precisely match a specific writer's voice.

Voice profile:
Style: ${fp.style_summary}
Writing patterns: ${fp.phrases.join('; ')}
Avoids: ${fp.avoid}

Rules:
- Rewrite ONLY the content provided — do not add new information or change the meaning
- Preserve all factual content, headings, and structure
- Match the voice profile exactly — every sentence should sound like this writer
- Return ONLY the rewritten content — no preamble, no commentary, no explanation`

  const content = selectedText
    ? `${instruction}\n\nText to rewrite:\n${selectedText}`
    : `${instruction}\n\nArticle to retune:\n${articleContent ?? ''}`

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      try {
        const s = anthropic.messages.stream({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{ role: 'user', content }],
        })
        for await (const ev of s) {
          if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') {
            controller.enqueue(enc.encode(ev.delta.text))
          }
        }
      } catch (err) {
        controller.enqueue(enc.encode(`[Error: ${err instanceof Error ? err.message : 'Unknown error'}]`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' },
  })
}
