// Crawl phase is hard-capped at 45s (see CRAWL_TIMEOUT_MS); allow headroom for
// the analysis call on top of that.
export const maxDuration = 60

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// A real browser UA — many sites (Cloudflare, etc.) 403 obvious bot agents, which
// would make the crawl silently return nothing. We're only reading public HTML.
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

// Skip non-content URLs when scraping homepage links so the AI only sees real pages.
const ASSET_RE =
  /\.(css|js|mjs|json|xml|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|eot|pdf|zip|mp4|webm|mp3|avi)(\?|#|$)/i
const SKIP_PATH_RE = /\/(wp-json|wp-admin|wp-content|wp-includes|feed|cdn-cgi|xmlrpc)\b/i

// Cap the crawl so we never walk an enormous site indefinitely.
const MAX_PAGES = 30
// Hard ceiling on the whole crawl phase. If we hit it, we analyze whatever
// pages we managed to collect — partial results beat no results.
const CRAWL_TIMEOUT_MS = 45_000
// Below this we don't have enough signal to produce a useful audit.
const MIN_PAGES = 3

interface PageEntry {
  url: string
  title: string
}

interface Analysis {
  gaps: Array<{ title: string; description: string; priority: 'high' | 'medium' | 'low'; suggestedKeyword: string }>
  topicClusters: Array<{ cluster: string; covered: string[]; missing: string[] }>
  quickWins: string[]
}

async function fetchWithTimeout(url: string, ms = 9000): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })
  } finally {
    clearTimeout(id)
  }
}

function extractLocs(xml: string): string[] {
  const locs: string[] = []
  const re = /<loc>\s*(https?:\/\/[^\s<]+)\s*<\/loc>/gi
  let m
  while ((m = re.exec(xml)) !== null) locs.push(m[1].trim())
  return locs
}

function urlToTitle(url: string): string {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean)
    const last = parts[parts.length - 1] ?? ''
    return (
      last
        .replace(/[-_]/g, ' ')
        .replace(/\.(html?|php|aspx?)$/i, '')
        .replace(/\b\w/g, (c) => c.toUpperCase()) ||
      parts.join(' › ') ||
      '(home)'
    )
  } catch {
    return url
  }
}

function isContentUrl(url: string): boolean {
  return !ASSET_RE.test(url) && !SKIP_PATH_RE.test(url)
}

// Mutable crawl accumulator. We push pages into this as we discover them so that
// if the crawl phase times out mid-flight (CRAWL_TIMEOUT_MS) we still have
// whatever was collected so far to hand off to analysis.
type CrawlState = { pages: PageEntry[]; blocked: boolean }

// Absorb a batch of raw URLs into the state, de-duping and honoring MAX_PAGES.
function absorb(state: CrawlState, urls: string[]): void {
  const seen = new Set(state.pages.map((p) => p.url))
  for (const u of urls) {
    if (state.pages.length >= MAX_PAGES) break
    if (!isContentUrl(u) || seen.has(u)) continue
    seen.add(u)
    state.pages.push({ url: u, title: urlToTitle(u) })
  }
}

// A <sitemapindex> points at child sitemaps; pull URLs from the first few,
// absorbing incrementally so a timeout still leaves us partial results.
async function collectFromSitemapIndex(state: CrawlState, xml: string): Promise<void> {
  const subs = extractLocs(xml).slice(0, 5)
  for (const sub of subs) {
    if (state.pages.length >= MAX_PAGES) break
    try {
      const r = await fetchWithTimeout(sub)
      if (r.ok) absorb(state, extractLocs(await r.text()))
    } catch {
      /* skip this child sitemap */
    }
  }
}

// Crawl into the provided state. Pages are accumulated incrementally; callers
// race this against CRAWL_TIMEOUT_MS and read state.pages regardless of outcome.
async function crawl(rawUrl: string, state: CrawlState): Promise<void> {
  const base = rawUrl.replace(/\/+$/, '').replace(/^(?!https?:\/\/)/, 'https://')
  const noteBlock = (status: number) => {
    if (status === 403 || status === 429) state.blocked = true
  }

  // Try /sitemap.xml and /sitemap_index.xml
  for (const path of ['/sitemap.xml', '/sitemap_index.xml']) {
    try {
      const r = await fetchWithTimeout(`${base}${path}`)
      noteBlock(r.status)
      if (r.ok) {
        const xml = await r.text()
        if (xml.includes('<loc>')) {
          if (xml.includes('<sitemapindex')) {
            await collectFromSitemapIndex(state, xml)
          } else {
            absorb(state, extractLocs(xml))
          }
          if (state.pages.length > 0) return
        }
      }
    } catch {
      /* fall through to next strategy */
    }
  }

  // Fallback: scrape internal links off the homepage.
  try {
    const r = await fetchWithTimeout(base)
    noteBlock(r.status)
    if (r.ok) {
      const html = await r.text()
      const urls: string[] = []
      const re = /href=["']([^"'#?]+)["']/gi
      let m
      while ((m = re.exec(html)) !== null && urls.length < MAX_PAGES * 2) {
        const href = m[1]
        if (href.startsWith('/') && !href.startsWith('//')) urls.push(`${base}${href}`)
        else if (href.startsWith(base)) urls.push(href)
      }
      absorb(state, urls)
    }
  } catch {
    /* fall through */
  }
}

// LLMs sometimes wrap JSON in prose or code fences. Try fenced block, then the
// outermost braces, then the raw string.
function parseAnalysis(text: string): unknown | null {
  if (!text) return null
  const candidates: string[] = []
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) candidates.push(fenced[1])
  const brace = text.match(/\{[\s\S]*\}/)
  if (brace) candidates.push(brace[0])
  candidates.push(text)
  for (const c of candidates) {
    try {
      return JSON.parse(c.trim())
    } catch {
      /* try next candidate */
    }
  }
  return null
}

// Coerce whatever the model returned into the exact shape the UI renders, so a
// missing or malformed field can never crash the client (which does `gaps.map`).
function normalizeAnalysis(raw: unknown): Analysis {
  const obj = (raw ?? {}) as Record<string, unknown>
  const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
  const asStrings = (v: unknown): string[] =>
    asArray(v).map((s) => String(s ?? '').trim()).filter(Boolean)

  const gaps = asArray(obj.gaps)
    .map((g) => {
      const o = (g ?? {}) as Record<string, unknown>
      const priority = o.priority
      return {
        title: String(o.title ?? '').trim(),
        description: String(o.description ?? '').trim(),
        priority: (priority === 'high' || priority === 'medium' || priority === 'low'
          ? priority
          : 'medium') as 'high' | 'medium' | 'low',
        suggestedKeyword: String(o.suggestedKeyword ?? '').trim(),
      }
    })
    .filter((g) => g.title)

  const topicClusters = asArray(obj.topicClusters)
    .map((tc) => {
      const o = (tc ?? {}) as Record<string, unknown>
      return {
        cluster: String(o.cluster ?? '').trim(),
        covered: asStrings(o.covered),
        missing: asStrings(o.missing),
      }
    })
    .filter((tc) => tc.cluster)

  return { gaps, topicClusters, quickWins: asStrings(obj.quickWins) }
}

const SYSTEM_PROMPT = `You are a content strategist auditing a website's content gaps. Analyze the provided page list and identify specific, actionable gaps: topics missing from the site, questions the audience likely has that aren't answered, and content pillars that are incomplete or absent.

Respond with ONLY a JSON object — no markdown, no code fences, no preamble or explanation. Use exactly this shape:
{
  "gaps": [{ "title": string, "description": string, "priority": "high" | "medium" | "low", "suggestedKeyword": string }],
  "topicClusters": [{ "cluster": string, "covered": string[], "missing": string[] }],
  "quickWins": string[]
}

Provide 6-12 gaps ordered by priority, 3-6 topic clusters, and 3-5 quick wins. "suggestedKeyword" must be a concrete search query a reader would type. Keep descriptions to one or two sentences.`

async function loadEnrichment(
  userId: string
): Promise<{ savedKeywords: string[]; writtenArticles: string[] }> {
  try {
    const supabase = await createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any
    const [kwRes, artRes] = await Promise.all([
      sb.from('saved_keywords').select('keyword').eq('user_id', userId).limit(100),
      sb.from('articles').select('title, target_keyword').eq('user_id', userId).limit(100),
    ])
    return {
      savedKeywords: (kwRes.data ?? []).map((k: { keyword: string }) => k.keyword).filter(Boolean),
      writtenArticles: (artRes.data ?? [])
        .map((a: { title: string | null; target_keyword: string | null }) => a.title ?? a.target_keyword)
        .filter(Boolean),
    }
  } catch {
    /* non-fatal — continue without enrichment */
    return { savedKeywords: [], writtenArticles: [] }
  }
}

export async function POST(request: Request) {
  let body: { url?: string; userId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { url, userId } = body
  if (!url || !url.trim()) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }
  const target = url.trim()

  // Stream newline-delimited JSON: progress events as we work, then a final
  // `result` (or `error`) event. The client renders progress as it arrives.
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))

      try {
        // Step 1 — crawl, hard-capped at CRAWL_TIMEOUT_MS.
        send({ type: 'progress', message: 'Crawling site...', step: 1, total: 3 })
        const state: CrawlState = { pages: [], blocked: false }
        await Promise.race([
          crawl(target, state),
          new Promise<void>((resolve) => setTimeout(resolve, CRAWL_TIMEOUT_MS)),
        ])
        const { pages, blocked } = state
        console.log(
          `[audit] crawled ${pages.length} page(s) for ${target} (blocked=${blocked})`
        )

        if (pages.length < MIN_PAGES) {
          send({
            type: 'error',
            error: blocked
              ? "This site is blocking automated requests (bot protection), so we couldn't read its pages to run the audit."
              : "Couldn't crawl enough pages — try a specific section URL (e.g. /blog) instead of the homepage.",
          })
          controller.close()
          return
        }

        const { savedKeywords, writtenArticles } = userId
          ? await loadEnrichment(userId)
          : { savedKeywords: [], writtenArticles: [] }

        // Step 2 — analysis.
        send({ type: 'progress', message: 'Analyzing content gaps...', step: 2, total: 3 })

        const pageList = pages.map((p) => `- ${p.title}: ${p.url}`).join('\n')
        const userContent = [
          `Website: ${target}`,
          `\nExisting pages:\n${pageList}`,
          writtenArticles.length ? `\nAlready written articles: ${writtenArticles.join(', ')}` : '',
          savedKeywords.length ? `\nSaved keywords: ${savedKeywords.join(', ')}` : '',
        ]
          .filter(Boolean)
          .join('\n')

        // Call the model, retrying once if the response isn't parseable JSON.
        let analysis: unknown | null = null
        for (let attempt = 0; attempt < 2 && analysis === null; attempt++) {
          const res = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 2048,
            system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: userContent }],
          })
          const block = res.content.find((b) => b.type === 'text')
          const rawText = block && block.type === 'text' ? block.text : ''
          analysis = parseAnalysis(rawText)
        }

        if (analysis === null) {
          send({
            type: 'error',
            error: 'The analysis service returned an unexpected response. Please try again.',
          })
          controller.close()
          return
        }

        // Step 3 — done.
        send({ type: 'result', ...normalizeAnalysis(analysis), pageCount: pages.length })
        controller.close()
      } catch (err) {
        send({
          type: 'error',
          error: `Analysis failed: ${err instanceof Error ? err.message : String(err)}`,
        })
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
