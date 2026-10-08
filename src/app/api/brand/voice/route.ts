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
  posts_analyzed: number
  crawled_at: string
}

type Message = { role: 'user' | 'assistant'; content: string }

// ── Crawl helpers ─────────────────────────────────────────────────────────────

async function fetchPageText(url: string): Promise<{ text: string; title: string } | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 6000)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Byline-VoiceCrawler/1.0 (+https://bylineseo.com)' },
    })
    if (!res.ok) return null
    const ct = res.headers.get('content-type') ?? ''
    if (!ct.includes('text/html')) return null
    const html = await res.text()
    const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim()
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
      .replace(/<header[\s\S]*?<\/header>/gi, ' ')
      .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&[a-z#0-9]+;/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 4000)
    return { text, title }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function findPostLinks(url: string, baseHostname: string): Promise<string[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 6000)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Byline-VoiceCrawler/1.0' },
    })
    if (!res.ok) return []
    const html = await res.text()
    const base = new URL(url)
    const links: string[] = []
    const hrefRe = /href=["']([^"'#?]{8,})["']/gi
    let m: RegExpExecArray | null
    while ((m = hrefRe.exec(html)) !== null) {
      try {
        const href = m[1]
        if (/^(mailto:|tel:|javascript:)/i.test(href)) continue
        const full = /^https?:\/\//i.test(href) ? href : new URL(href, base).toString()
        const parsed = new URL(full)
        if (parsed.hostname !== baseHostname) continue
        const depth = parsed.pathname.replace(/\/$/, '').split('/').filter(Boolean).length
        if (depth >= 2) links.push(full)
      } catch { /* skip */ }
    }
    return [...new Set(links)].slice(0, 10)
  } catch {
    return []
  } finally {
    clearTimeout(timer)
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────

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

  const body = await request.json() as { action: string } & Record<string, unknown>
  const { action } = body

  // ── CRAWL ───────────────────────────────────────────────────────────────────
  if (action === 'crawl') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: brandProfile } = await (supabase as any)
      .from('brand_profiles')
      .select('website_url, brand_name')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!brandProfile?.website_url) {
      return NextResponse.json({ error: 'No website URL in your brand profile.' }, { status: 400 })
    }

    const siteUrl = (brandProfile.website_url as string).replace(/\/$/, '')
    const baseHostname = new URL(siteUrl).hostname
    const blogPaths = ['/blog', '/articles', '/posts', '/writing', '/news', '']

    // Find post links across common blog paths
    const postLinks: string[] = []
    for (const path of blogPaths) {
      if (postLinks.length >= 6) break
      try {
        const found = await findPostLinks(`${siteUrl}${path}`, baseHostname)
        for (const l of found) {
          if (!postLinks.includes(l)) postLinks.push(l)
        }
      } catch { /* continue */ }
    }

    // Fetch up to 4 posts in parallel
    const toFetch = postLinks.slice(0, 4)
    const texts: string[] = []
    await Promise.allSettled(
      toFetch.map(async (url) => {
        const r = await fetchPageText(url)
        if (r?.text && r.text.length > 300) {
          texts.push(`--- From ${url} ---\n${r.text}`)
        }
      }),
    )

    // Fallback to homepage if nothing found
    if (texts.length === 0) {
      const hp = await fetchPageText(siteUrl)
      if (hp?.text) texts.push(`--- Homepage: ${siteUrl} ---\n${hp.text}`)
    }

    if (texts.length === 0) {
      return NextResponse.json({
        error: 'Could not fetch content from your website. Make sure your website URL is correct and the site is publicly accessible.',
      }, { status: 400 })
    }

    const combined = texts.join('\n\n').slice(0, 10000)

    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: 'You analyze blog posts to extract a writer\'s unique voice and style. Return ONLY valid JSON — no prose, no markdown fences, no explanation.',
      messages: [{
        role: 'user',
        content: `Analyze this blog content and extract the writer's voice. Return JSON with exactly these fields:
- style_summary: 2-3 sentences describing how this person writes (terse, concrete, usable as a system-prompt instruction)
- phrases: array of 6-8 specific writing patterns or habits (e.g. "starts sections with a rhetorical question", "uses em dashes for asides", "very short paragraphs", "avoids passive voice")
- sample: a 120-150 word paragraph in this writer's exact voice about "why most content strategies fail" — must sound unmistakably like them
- avoid: one sentence on what they clearly avoid (jargon, corporate-speak, listicles, etc.)

Content to analyze:
${combined}`,
      }],
    })

    const raw = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text).join('')

    const j0 = raw.indexOf('{')
    const j1 = raw.lastIndexOf('}')
    if (j0 === -1) return NextResponse.json({ error: 'Failed to analyze voice' }, { status: 500 })

    let extracted: Record<string, unknown>
    try { extracted = JSON.parse(raw.slice(j0, j1 + 1)) }
    catch { return NextResponse.json({ error: 'Failed to parse voice analysis' }, { status: 500 }) }

    const fingerprint: VoiceFingerprint = {
      style_summary: String(extracted.style_summary ?? ''),
      phrases: Array.isArray(extracted.phrases)
        ? extracted.phrases.filter((p): p is string => typeof p === 'string')
        : [],
      sample: String(extracted.sample ?? ''),
      avoid: String(extracted.avoid ?? ''),
      posts_analyzed: texts.length,
      crawled_at: new Date().toISOString(),
    }

    return NextResponse.json({ fingerprint })
  }

  // ── CHAT ────────────────────────────────────────────────────────────────────
  if (action === 'chat') {
    const { messages, fingerprint } = body as unknown as { messages: Message[]; fingerprint: VoiceFingerprint }
    if (!messages || !fingerprint) {
      return NextResponse.json({ error: 'Missing messages or fingerprint' }, { status: 400 })
    }

    const systemPrompt = `You are a writing voice coach helping a content creator refine their brand voice profile.

Extracted voice analysis:
Style: ${fingerprint.style_summary}
Writing patterns: ${fingerprint.phrases.join('; ')}
Avoids: ${fingerprint.avoid}

Your job: generate sample text in this writer's voice and iterate based on their feedback.

Rules:
- Generate a 120-150 word sample paragraph about "why most content strategies fail" — match the voice above
- After the sample, ask ONE question: "What would you like to change, or does this sound like you?"
- Keep your response to: sample paragraph + one short follow-up question. Nothing else.
- If the user says they're happy / accept / looks good / save / this is it → respond ONLY with the exact text: <voice_accepted/>
- Never say "Great!" or "Absolutely!" or other filler affirmations.`

    let apiMessages = [...messages]
    if (apiMessages.length === 0 || apiMessages[0].role !== 'user') {
      apiMessages = [{ role: 'user', content: 'Show me a sample paragraph in my voice.' }, ...apiMessages]
    }

    const stream = new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder()
        try {
          const s = anthropic.messages.stream({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 512,
            system: systemPrompt,
            messages: apiMessages,
          })
          for await (const ev of s) {
            if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') {
              controller.enqueue(enc.encode(ev.delta.text))
            }
          }
        } catch (err) {
          controller.enqueue(enc.encode(`[Error: ${err instanceof Error ? err.message : 'Stream error'}]`))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' },
    })
  }

  // ── SAVE ────────────────────────────────────────────────────────────────────
  if (action === 'save') {
    const { voiceFingerprint } = body as unknown as { voiceFingerprint: VoiceFingerprint }
    if (!voiceFingerprint) return NextResponse.json({ error: 'Missing voiceFingerprint' }, { status: 400 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('brand_profiles')
      .update({ voice_fingerprint: voiceFingerprint, voice_status: 'ready' })
      .eq('user_id', user.id)

    if (error) return NextResponse.json({ error: 'Failed to save voice profile' }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
