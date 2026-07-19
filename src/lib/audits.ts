// Reusable, NON-streaming audit runners.
//
// The public marketing routes (`/api/audit`, `/api/free-tools/analyze`) stream
// their results to the browser and stay as-is. The outreach agent needs the same
// analyses as plain awaitable functions, so those live here. Prompts are the
// single source of truth for server-side callers going forward.

import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const AUDIT_MODEL = 'claude-haiku-4-5-20251001'

// A real browser UA — many sites 403 obvious bot agents.
const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://www.google.com/',
}

// ── Shared types (mirror the shapes the report pages already render) ──────────

export interface GeoFactor {
  name: string
  score: number
  maxScore: number
  status: 'good' | 'needs-work' | 'missing'
  detail: string
}
export interface GeoRecommendation {
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  impact: string
}
export interface ScoreAuditResult {
  score: number
  grade: string
  breakdown: GeoFactor[]
  recommendations: GeoRecommendation[]
  quickWins: string[]
}
export interface ContentAuditResult {
  gaps: Array<{ title: string; description: string; priority: 'high' | 'medium' | 'low'; suggestedKeyword: string }>
  topicClusters: Array<{ cluster: string; covered: string[]; missing: string[] }>
  quickWins: string[]
  pageCount: number
}

export type AuditKind = 'content' | 'geo' | 'ao'

// ── Prompts (canonical copies for server-side callers) ────────────────────────

const GEO_SYSTEM_PROMPT =
  'You are a GEO (Generative Engine Optimization) expert. Analyze this website HTML and score how likely AI tools like ChatGPT, Gemini, and Perplexity would cite or recommend this site. Score these 7 factors and return ONLY valid JSON with no markdown or explanation:\n\n1. Schema markup (maxScore: 15): Organization, Article, FAQ, HowTo schemas present\n2. Author/entity signals (maxScore: 15): Author bios, About page, expertise signals, E-E-A-T\n3. Direct answer content (maxScore: 20): FAQ sections, definition blocks, direct answers at content start\n4. Factual citable claims (maxScore: 15): Statistics with sources, specific data points, research citations\n5. Content structure (maxScore: 15): Clear H2/H3 hierarchy, numbered lists, comparison tables\n6. Brand/entity clarity (maxScore: 10): Clear brand name, description, what they do visible on page\n7. Freshness signals (maxScore: 10): Published/updated dates visible\n\nReturn JSON matching exactly: { score: number (0-100 overall), grade: string (A/B/C/D/F), breakdown: [{ name, score, maxScore, status, detail }], recommendations: [{ priority, title, description, impact }] (top 5), quickWins: string[] (exactly 3 items) }'

const AO_SYSTEM_PROMPT =
  'You are an Answer Optimization (AO) expert. Analyze this website HTML and score how well the content is structured to win featured snippets and appear in AI-generated answers. Score these 6 factors and return ONLY valid JSON with no markdown or explanation:\n\n1. Question-based headings (maxScore: 20): H2/H3s phrased as questions people actually search\n2. Featured snippet format (maxScore: 20): Content starts with direct concise answer under 300 chars\n3. FAQ/Q&A sections (maxScore: 15): Explicit FAQ markup or question-answer pairs\n4. Scannable structure (maxScore: 20): Bullets, numbered lists, short paragraphs, bold key terms\n5. Conversational language (maxScore: 15): Natural phrasing matching how people ask questions\n6. Related question coverage (maxScore: 10): Content addresses follow-up questions, covers topic depth\n\nReturn JSON matching exactly: { score: number (0-100 overall), grade: string (A/B/C/D/F), breakdown: [{ name, score, maxScore, status, detail }], recommendations: [{ priority, title, description, impact }] (top 5), quickWins: string[] (exactly 3 items) }'

const CONTENT_SYSTEM_PROMPT = `You are a content strategist auditing a website's content gaps. Analyze the provided page list and identify specific, actionable gaps: topics missing from the site, questions the audience likely has that aren't answered, and content pillars that are incomplete or absent.

Respond with ONLY a JSON object — no markdown, no code fences, no preamble or explanation. Use exactly this shape:
{
  "gaps": [{ "title": string, "description": string, "priority": "high" | "medium" | "low", "suggestedKeyword": string }],
  "topicClusters": [{ "cluster": string, "covered": string[], "missing": string[] }],
  "quickWins": string[]
}

Provide 6-12 gaps ordered by priority, 3-6 topic clusters, and 3-5 quick wins. "suggestedKeyword" must be a concrete search query a reader would type. Keep descriptions to one or two sentences.`

// ── Helpers ───────────────────────────────────────────────────────────────────

export function normalizeUrl(raw: string): string {
  return raw.trim().replace(/^(?!https?:\/\/)/, 'https://')
}

async function fetchHtml(url: string, ms = 12000): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(ms), headers: BROWSER_HEADERS, redirect: 'follow' })
  if (!res.ok) throw new Error(`fetch ${url} → HTTP ${res.status}`)
  const full = await res.text()
  return full.length > 15000 ? full.slice(0, 15000) : full
}

// LLMs sometimes wrap JSON in prose or code fences. Try fenced block, outermost
// braces, then the raw string.
function parseJson(text: string): unknown | null {
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
      /* next */
    }
  }
  return null
}

async function askJson(system: string, user: string): Promise<unknown | null> {
  let parsed: unknown | null = null
  for (let attempt = 0; attempt < 2 && parsed === null; attempt++) {
    const res = await anthropic.messages.create({
      model: AUDIT_MODEL,
      max_tokens: 2048,
      system,
      messages: [{ role: 'user', content: user }],
    })
    const block = res.content.find((b) => b.type === 'text')
    parsed = parseJson(block && block.type === 'text' ? block.text : '')
  }
  return parsed
}

function normalizeScore(raw: unknown): ScoreAuditResult {
  const obj = (raw ?? {}) as Record<string, unknown>
  const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
  const asStrings = (v: unknown): string[] =>
    asArray(v).map((s) => String(s ?? '').trim()).filter(Boolean)
  const validStatuses = new Set(['good', 'needs-work', 'missing'])
  const validPriorities = new Set(['high', 'medium', 'low'])

  const breakdown: GeoFactor[] = asArray(obj.breakdown)
    .map((f) => {
      const o = (f ?? {}) as Record<string, unknown>
      return {
        name: String(o.name ?? '').trim(),
        score: typeof o.score === 'number' ? o.score : 0,
        maxScore: typeof o.maxScore === 'number' ? o.maxScore : 10,
        status: validStatuses.has(String(o.status)) ? (o.status as GeoFactor['status']) : 'needs-work',
        detail: String(o.detail ?? '').trim(),
      }
    })
    .filter((f) => f.name)

  const recommendations: GeoRecommendation[] = asArray(obj.recommendations)
    .map((r) => {
      const o = (r ?? {}) as Record<string, unknown>
      return {
        priority: validPriorities.has(String(o.priority)) ? (o.priority as GeoRecommendation['priority']) : 'medium',
        title: String(o.title ?? '').trim(),
        description: String(o.description ?? '').trim(),
        impact: String(o.impact ?? '').trim(),
      }
    })
    .filter((r) => r.title)

  const rawScore = typeof obj.score === 'number' ? obj.score : 0
  return {
    score: Math.max(0, Math.min(100, rawScore)),
    grade: (typeof obj.grade === 'string' && obj.grade.trim()) || 'F',
    breakdown,
    recommendations,
    quickWins: asStrings(obj.quickWins).slice(0, 3),
  }
}

// ── GEO / AO ──────────────────────────────────────────────────────────────────

export async function runScoreAudit(rawUrl: string, kind: 'geo' | 'ao'): Promise<ScoreAuditResult> {
  const url = normalizeUrl(rawUrl)
  const html = await fetchHtml(url)
  const system = kind === 'geo' ? GEO_SYSTEM_PROMPT : AO_SYSTEM_PROMPT
  const parsed = await askJson(system, `Website URL: ${url}\n\nHTML:\n${html}`)
  if (parsed === null) throw new Error('audit model returned unparseable JSON')
  return normalizeScore(parsed)
}

// ── Content gap ────────────────────────────────────────────────────────────────

const ASSET_RE =
  /\.(css|js|mjs|json|xml|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|eot|pdf|zip|mp4|webm|mp3|avi)(\?|#|$)/i
const SKIP_PATH_RE = /\/(wp-json|wp-admin|wp-content|wp-includes|feed|cdn-cgi|xmlrpc)\b/i
const MAX_PAGES = 30

function extractLocs(xml: string): string[] {
  const locs: string[] = []
  const re = /<loc>\s*(https?:\/\/[^\s<]+)\s*<\/loc>/gi
  let m
  while ((m = re.exec(xml)) !== null) locs.push(m[1].trim())
  return locs
}
function urlTitle(url: string): string {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean)
    const last = parts[parts.length - 1] ?? ''
    return (
      last.replace(/[-_]/g, ' ').replace(/\.(html?|php|aspx?)$/i, '').replace(/\b\w/g, (c) => c.toUpperCase()) ||
      parts.join(' › ') ||
      '(home)'
    )
  } catch {
    return url
  }
}
const isContentUrl = (u: string) => !ASSET_RE.test(u) && !SKIP_PATH_RE.test(u)

// Compact crawler: sitemap first, then homepage links. Returns up to MAX_PAGES
// {url,title} entries.
async function crawlPages(rawUrl: string): Promise<Array<{ url: string; title: string }>> {
  const base = normalizeUrl(rawUrl).replace(/\/+$/, '')
  const seen = new Set<string>()
  const pages: Array<{ url: string; title: string }> = []
  const absorb = (urls: string[]) => {
    for (const u of urls) {
      if (pages.length >= MAX_PAGES) break
      if (!isContentUrl(u) || seen.has(u)) continue
      seen.add(u)
      pages.push({ url: u, title: urlTitle(u) })
    }
  }

  for (const path of ['/sitemap.xml', '/sitemap_index.xml']) {
    try {
      const res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(9000), headers: BROWSER_HEADERS })
      if (!res.ok) continue
      const xml = await res.text()
      if (!xml.includes('<loc>')) continue
      if (xml.includes('<sitemapindex')) {
        for (const sub of extractLocs(xml).slice(0, 5)) {
          if (pages.length >= MAX_PAGES) break
          try {
            const r = await fetch(sub, { signal: AbortSignal.timeout(9000), headers: BROWSER_HEADERS })
            if (r.ok) absorb(extractLocs(await r.text()))
          } catch {
            /* skip child */
          }
        }
      } else {
        absorb(extractLocs(xml))
      }
      if (pages.length > 0) return pages
    } catch {
      /* next strategy */
    }
  }

  try {
    const res = await fetch(base, { signal: AbortSignal.timeout(9000), headers: BROWSER_HEADERS })
    if (res.ok) {
      const html = await res.text()
      const urls: string[] = []
      const re = /href=["']([^"'#?]+)["']/gi
      let m
      while ((m = re.exec(html)) !== null && urls.length < MAX_PAGES * 2) {
        const href = m[1]
        if (href.startsWith('/') && !href.startsWith('//')) urls.push(`${base}${href}`)
        else if (href.startsWith(base)) urls.push(href)
      }
      absorb(urls)
    }
  } catch {
    /* give up */
  }
  return pages
}

export async function runContentAudit(rawUrl: string): Promise<ContentAuditResult> {
  const url = normalizeUrl(rawUrl)
  const pages = await crawlPages(url)
  if (pages.length < 3) throw new Error(`only crawled ${pages.length} page(s) — not enough signal`)

  const pageList = pages.map((p) => `- ${p.title}: ${p.url}`).join('\n')
  const parsed = await askJson(CONTENT_SYSTEM_PROMPT, `Website: ${url}\n\nExisting pages:\n${pageList}`)
  if (parsed === null) throw new Error('audit model returned unparseable JSON')

  const obj = (parsed ?? {}) as Record<string, unknown>
  const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
  const asStrings = (v: unknown): string[] =>
    asArray(v).map((s) => String(s ?? '').trim()).filter(Boolean)

  const gaps = asArray(obj.gaps)
    .map((g) => {
      const o = (g ?? {}) as Record<string, unknown>
      const p = o.priority
      return {
        title: String(o.title ?? '').trim(),
        description: String(o.description ?? '').trim(),
        priority: (p === 'high' || p === 'medium' || p === 'low' ? p : 'medium') as 'high' | 'medium' | 'low',
        suggestedKeyword: String(o.suggestedKeyword ?? '').trim(),
      }
    })
    .filter((g) => g.title)

  const topicClusters = asArray(obj.topicClusters)
    .map((tc) => {
      const o = (tc ?? {}) as Record<string, unknown>
      return { cluster: String(o.cluster ?? '').trim(), covered: asStrings(o.covered), missing: asStrings(o.missing) }
    })
    .filter((tc) => tc.cluster)

  return { gaps, topicClusters, quickWins: asStrings(obj.quickWins), pageCount: pages.length }
}
