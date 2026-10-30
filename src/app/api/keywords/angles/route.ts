import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface Angle {
  id: string
  headline: string
  description: string
  audience: string
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { topic } = await request.json() as { topic?: string }
  const cleanTopic = (topic ?? '').trim()
  if (!cleanTopic) {
    return NextResponse.json({ error: 'Missing topic' }, { status: 400 })
  }

  const prompt = `Given the SEO topic "${cleanTopic}", generate 4 distinct content angles a writer could take. Each angle should represent a meaningfully different direction, audience, or framing.

Return ONLY valid JSON in this exact format (no markdown, no prose before or after):
{
  "angles": [
    { "id": "a1", "headline": "short punchy angle title (max 6 words)", "description": "one sentence describing the direction", "audience": "who this angle speaks to (2-4 words)" }
  ]
}

Make the four angles genuinely different from one another — vary the audience, the funnel stage, the framing, or the depth. Never return duplicates.`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')

    // The model is instructed to return raw JSON, but guard against stray prose
    // or a markdown fence by extracting the first balanced object.
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) {
      return NextResponse.json({ error: 'Could not parse angles' }, { status: 502 })
    }

    const parsed = JSON.parse(match[0]) as { angles?: Angle[] }
    const angles = Array.isArray(parsed.angles) ? parsed.angles.slice(0, 4) : []

    if (angles.length === 0) {
      return NextResponse.json({ error: 'No angles generated' }, { status: 502 })
    }

    return NextResponse.json({ angles })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Angle generation failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
