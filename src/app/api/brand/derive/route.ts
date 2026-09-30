export const runtime = 'nodejs'
export const maxDuration = 45

import Anthropic from '@anthropic-ai/sdk'
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchPage, normaliseUrl } from '@/lib/geo-audit/fetch'
import { extractPage } from '@/lib/geo-audit/extract'
import { fetchRobotsTxt } from '@/lib/geo-audit/robots'
import { crossReferenceRobots, probeCrawlerAccess } from '@/lib/geo-audit/crawler-access'
import { SUGGEST_PROMPT, onboardingAccess, pageDigest, parseSuggestions, readIdentity } from '@/lib/brand-derive'
import { logUsageEvent } from '@/lib/usage'

const MODEL = 'claude-haiku-4-5-20251001'

/**
 * Onboarding: one URL in, a draft brand profile out.
 *
 * Streams NDJSON so the crawler access result — facts the user can act on —
 * reaches the screen first, while the profile is still being read:
 *   { type: 'access',  access }   crawler access test, AI search crawlers only
 *   { type: 'profile', profile }  fields read from markup (sent first) and then
 *                                 again with model suggestions merged in
 *   { type: 'error',   error }    the site could not be fetched
 *   { type: 'done' }
 * Nothing is saved here; the user reviews and saves via /api/brand/save.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { url?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const url = normaliseUrl(body.url ?? '')
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error()
    if (!u.hostname.includes('.')) throw new Error()
  } catch {
    return Response.json({ error: 'Enter your website address, like yourcompany.com.' }, { status: 400 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))

      const accessTask = Promise.all([
        fetchRobotsTxt(url).catch(() => null),
        probeCrawlerAccess(url, { robots: null }).catch(() => null),
      ]).then(([robots, probe]) => {
        if (probe) send({ type: 'access', access: onboardingAccess(crossReferenceRobots(probe, robots?.parsed ?? null)) })
      })

      const profileTask = (async () => {
        const fetched = await fetchPage(url)
        if (!fetched.ok) {
          send({ type: 'error', error: fetched.note ?? 'We could not load that site. Check the address, or fill in the details yourself.' })
          return
        }
        const page = extractPage(fetched.html, fetched.finalUrl)
        const identity = readIdentity(page, fetched.html, fetched.finalUrl)
        send({ type: 'profile', profile: { ...identity, industry: null, target_audience: null, tone_notes: null, content_goals: null, primary_keywords: null }, final: false })

        if (!page.hasMeaningfulContent || !process.env.ANTHROPIC_API_KEY) {
          send({ type: 'profile', profile: { ...identity, industry: null, target_audience: null, tone_notes: null, content_goals: null, primary_keywords: null }, final: true })
          return
        }

        let suggestions = parseSuggestions('', page)
        try {
          const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
          const res = await anthropic.messages.create({
            model: MODEL,
            max_tokens: 700,
            system: SUGGEST_PROMPT,
            messages: [{ role: 'user', content: pageDigest(page) }],
          })
          const raw = res.content
            .filter((b): b is Anthropic.TextBlock => b.type === 'text')
            .map((b) => b.text)
            .join('')
          suggestions = parseSuggestions(raw, page)
          after(() =>
            logUsageEvent({
              userId: user.id,
              feature: 'brand_derive',
              model: MODEL,
              inputTokens: res.usage.input_tokens,
              outputTokens: res.usage.output_tokens,
            }),
          )
        } catch {
          // Suggestions are a convenience; the user can type the fields.
        }
        send({ type: 'profile', profile: { ...identity, ...suggestions }, final: true })
      })()

      try {
        await Promise.all([accessTask, profileTask])
      } catch (err) {
        send({ type: 'error', error: err instanceof Error ? err.message : String(err) })
      } finally {
        send({ type: 'done' })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  })
}
