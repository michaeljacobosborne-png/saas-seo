export const maxDuration = 30

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface PageEntry {
  url: string
  title: string
}

async function fetchWithTimeout(url: string, ms = 7000): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Byline-ContentAudit/1.0' },
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

async function fetchPages(rawUrl: string): Promise<PageEntry[]> {
  const base = rawUrl.replace(/\/+$/, '').replace(/^(?!https?:\/\/)/, 'https://')

  // Try /sitemap.xml
  try {
    const r = await fetchWithTimeout(`${base}/sitemap.xml`)
    if (r.ok) {
      const xml = await r.text()
      if (xml.includes('<loc>')) {
        if (xml.includes('<sitemapindex')) {
          const subs = extractLocs(xml)
          if (subs.length > 0) {
            const sub = await fetchWithTimeout(subs[0])
            if (sub.ok) {
              return extractLocs(await sub.text())
                .slice(0, 50)
                .map((u) => ({ url: u, title: urlToTitle(u) }))
            }
          }
        } else {
          return extractLocs(xml)
            .slice(0, 50)
            .map((u) => ({ url: u, title: urlToTitle(u) }))
        }
      }
    }
  } catch { /* fall through */ }

  // Try /sitemap_index.xml
  try {
    const r = await fetchWithTimeout(`${base}/sitemap_index.xml`)
    if (r.ok) {
      const xml = await r.text()
      const subs = extractLocs(xml)
      if (subs.length > 0) {
        const sub = await fetchWithTimeout(subs[0])
        if (sub.ok) {
          return extractLocs(await sub.text())
            .slice(0, 50)
            .map((u) => ({ url: u, title: urlToTitle(u) }))
        }
      }
    }
  } catch { /* fall through */ }

  // Fallback: scrape homepage links
  try {
    const r = await fetchWithTimeout(base)
    if (r.ok) {
      const html = await r.text()
      const pages: PageEntry[] = []
      const seen = new Set<string>()
      const re = /href=["']([^"'#?]+)["']/gi
      let m
      while ((m = re.exec(html)) !== null && pages.length < 50) {
        const href = m[1]
        let full = ''
        if (href.startsWith('/') && !href.startsWith('//')) full = `${base}${href}`
        else if (href.startsWith(base)) full = href
        if (full && !seen.has(full)) {
          seen.add(full)
          pages.push({ url: full, title: urlToTitle(full) })
        }
      }
      return pages
    }
  } catch { /* fall through */ }

  return []
}

export async function POST(request: Request) {
  let body: { url?: string; userId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { url, userId } = body
  if (!url) return NextResponse.json({ error: 'url is required' }, { status: 400 })

  const pages = await fetchPages(url)
  if (pages.length === 0) {
    return NextResponse.json(
      { error: 'Could not fetch any pages from that URL. Check that the site is publicly accessible.' },
      { status: 422 }
    )
  }

  let savedKeywords: string[] = []
  let writtenArticles: string[] = []

  if (userId) {
    try {
      const supabase = await createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any
      const [kwRes, artRes] = await Promise.all([
        sb.from('saved_keywords').select('keyword').eq('user_id', userId).limit(100),
        sb.from('articles').select('title, target_keyword').eq('user_id', userId).limit(100),
      ])
      savedKeywords = (kwRes.data ?? []).map((k: { keyword: string }) => k.keyword).filter(Boolean)
      writtenArticles = (artRes.data ?? [])
        .map((a: { title: string | null; target_keyword: string | null }) => a.title ?? a.target_keyword)
        .filter(Boolean)
    } catch { /* non-fatal — continue without enrichment */ }
  }

  const pageList = pages.map((p) => `- ${p.title}: ${p.url}`).join('\n')
  const userParts = [
    `Website: ${url}`,
    `\nExisting pages:\n${pageList}`,
    writtenArticles.length ? `\nAlready written articles: ${writtenArticles.join(', ')}` : '',
    savedKeywords.length ? `\nSaved keywords: ${savedKeywords.join(', ')}` : '',
  ].filter(Boolean)

  let rawText: string
  try {
    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: `You are a content strategist auditing a website's content gaps. Analyze the provided page list and identify specific gaps — topics missing from the site, questions the audience likely has that aren't answered, content pillars that are incomplete or absent. Be specific and actionable. Return a JSON object with: { gaps: [{title, description, priority: 'high'|'medium'|'low', suggestedKeyword}], topicClusters: [{cluster, covered: string[], missing: string[]}], quickWins: string[] }`,
      messages: [{ role: 'user', content: userParts.join('\n') }],
    })
    rawText = res.content[0].type === 'text' ? res.content[0].text : ''
  } catch (err) {
    return NextResponse.json(
      { error: `Analysis failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }

  try {
    // Extract JSON object — handles preamble text and code fences
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON object in response')
    const analysis = JSON.parse(jsonMatch[0])
    return NextResponse.json({ ...analysis, pageCount: pages.length })
  } catch (err) {
    console.error('Audit parse error:', err, '\nRaw:', rawText?.slice(0, 500))
    return NextResponse.json({ error: 'Failed to parse analysis response' }, { status: 500 })
  }
}
