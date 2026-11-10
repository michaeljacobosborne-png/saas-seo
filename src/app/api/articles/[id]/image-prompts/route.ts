import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a creative director generating featured image concepts for a content article. You understand what makes compelling, on-brand visuals for SEO content.

Generate exactly 3 distinct featured image concepts for this article. Each concept should feel meaningfully different in style, subject, or framing — not just minor variations.

For each concept return:
- headline: short concept name (3-5 words)
- prompt: a detailed, ready-to-use AI image generation prompt optimized for Midjourney or DALL-E. Include: subject description, composition, lighting, color palette, style, mood. 50-80 words.
- style: one of "photorealistic", "illustration", "abstract", "3d-render", "flat-design"
- alt_text: SEO-optimized alt text for the image. It MUST: (1) accurately describe what the image actually depicts, (2) naturally include the article's target keyword, (3) stay under 125 characters, (4) NOT start with "image of", "picture of", "photo of" or similar filler. Write it as a concise descriptive phrase, not a sentence.
- rationale: one sentence explaining why this visual angle works for the article

Return valid JSON only: { "concepts": [ { "headline", "prompt", "style", "alt_text", "rationale" } ] }`

type Concept = {
  headline: string
  prompt: string
  style: string
  alt_text: string
  rationale: string
}

function parseConcepts(raw: string): Concept[] | null {
  // Strip code fences and any prose around the JSON object.
  const cleaned = raw
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1))
    if (Array.isArray(parsed?.concepts) && parsed.concepts.length > 0) {
      return parsed.concepts as Concept[]
    }
    return null
  } catch {
    return null
  }
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: article } = await (supabase as any)
    .from('articles')
    .select('title, target_keyword, meta_description, content')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!article) return NextResponse.json({ error: 'Article not found' }, { status: 404 })
  if (!article.content) return NextResponse.json({ error: 'Article has no content yet' }, { status: 400 })

  // One brand profile per user (unique index on brand_profiles.user_id).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: brand } = await (supabase as any)
    .from('brand_profiles')
    .select('brand_name, brand_voice, tone_notes')
    .eq('user_id', user.id)
    .maybeSingle()

  const brandName = brand?.brand_name ?? 'Unbranded'
  const tone = [brand?.brand_voice, brand?.tone_notes].filter(Boolean).join(' — ') || 'Not specified'

  // Strip markdown, take first ~600 chars as context for tone + topic.
  const contentPreview: string = article.content
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .slice(0, 600)
    .trim()

  const userMessage = `Article title: ${article.title ?? article.target_keyword}
Target keyword: ${article.target_keyword}
Meta description: ${article.meta_description ?? 'Not set'}
Brand: ${brandName}
Tone: ${tone}
Opening content: ${contentPreview}`

  async function generate(): Promise<Concept[] | null> {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
    return parseConcepts(text)
  }

  try {
    let concepts = await generate()
    // Retry once on a malformed/empty parse before giving up.
    if (!concepts) concepts = await generate()
    if (!concepts) {
      return NextResponse.json(
        { error: 'Could not generate image concepts. Please try again.' },
        { status: 500 },
      )
    }
    return NextResponse.json({ concepts: concepts.slice(0, 3) })
  } catch (err) {
    console.error('[image-prompts] Generate failed:', err)
    return NextResponse.json(
      { error: 'Could not generate image concepts. Please try again.' },
      { status: 500 },
    )
  }
}
