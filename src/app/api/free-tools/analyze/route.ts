export const runtime = 'nodejs'
export const maxDuration = 45

import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface Factor {
  name: string
  score: number
  maxScore: number
  status: 'good' | 'needs-work' | 'missing'
  detail: string
}

interface Recommendation {
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  impact: string
}

interface AnalysisResult {
  score: number
  grade: string
  breakdown: Factor[]
  recommendations: Recommendation[]
  quickWins: string[]
}

const GEO_SYSTEM_PROMPT =
  'You are a GEO (Generative Engine Optimization) expert. Analyze this website HTML and score how likely AI tools like ChatGPT, Gemini, and Perplexity would cite or recommend this site. Score these 7 factors and return ONLY valid JSON with no markdown or explanation:\n\n1. Schema markup (maxScore: 15): Organization, Article, FAQ, HowTo schemas present\n2. Author/entity signals (maxScore: 15): Author bios, About page, expertise signals, E-E-A-T\n3. Direct answer content (maxScore: 20): FAQ sections, definition blocks, direct answers at content start\n4. Factual citable claims (maxScore: 15): Statistics with sources, specific data points, research citations\n5. Content structure (maxScore: 15): Clear H2/H3 hierarchy, numbered lists, comparison tables\n6. Brand/entity clarity (maxScore: 10): Clear brand name, description, what they do visible on page\n7. Freshness signals (maxScore: 10): Published/updated dates visible\n\nReturn JSON matching exactly: { score: number (0-100 overall), grade: string (A/B/C/D/F), breakdown: [{ name, score, maxScore, status, detail }], recommendations: [{ priority, title, description, impact }] (top 5), quickWins: string[] (exactly 3 items) }'

const AO_SYSTEM_PROMPT =
  'You are an Answer Optimization (AO) expert. Analyze this website HTML and score how well the content is structured to win featured snippets and appear in AI-generated answers. Score these 6 factors and return ONLY valid JSON with no markdown or explanation:\n\n1. Question-based headings (maxScore: 20): H2/H3s phrased as questions people actually search\n2. Featured snippet format (maxScore: 20): Content starts with direct concise answer under 300 chars\n3. FAQ/Q&A sections (maxScore: 15): Explicit FAQ markup or question-answer pairs\n4. Scannable structure (maxScore: 20): Bullets, numbered lists, short paragraphs, bold key terms\n5. Conversational language (maxScore: 15): Natural phrasing matching how people ask questions\n6. Related question coverage (maxScore: 10): Content addresses follow-up questions, covers topic depth\n\nReturn JSON matching exactly: { score: number (0-100 overall), grade: string (A/B/C/D/F), breakdown: [{ name, score, maxScore, status, detail }], recommendations: [{ priority, title, description, impact }] (top 5), quickWins: string[] (exactly 3 items) }'

// LLMs sometimes wrap JSON in prose or code fences.
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

function normalizeResult(raw: unknown): AnalysisResult {
  const obj = (raw ?? {}) as Record<string, unknown>
  const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
  const asStrings = (v: unknown): string[] =>
    asArray(v)
      .map((s) => String(s ?? '').trim())
      .filter(Boolean)

  const validStatuses = new Set(['good', 'needs-work', 'missing'])
  const validPriorities = new Set(['high', 'medium', 'low'])

  const breakdown: Factor[] = asArray(obj.breakdown)
    .map((f) => {
      const o = (f ?? {}) as Record<string, unknown>
      const status = o.status
      return {
        name: String(o.name ?? '').trim(),
        score: typeof o.score === 'number' ? o.score : 0,
        maxScore: typeof o.maxScore === 'number' ? o.maxScore : 10,
        status: validStatuses.has(String(status)) ? (status as Factor['status']) : 'needs-work',
        detail: String(o.detail ?? '').trim(),
      }
    })
    .filter((f) => f.name)

  const recommendations: Recommendation[] = asArray(obj.recommendations)
    .map((r) => {
      const o = (r ?? {}) as Record<string, unknown>
      const priority = o.priority
      return {
        priority: validPriorities.has(String(priority))
          ? (priority as Recommendation['priority'])
          : 'medium',
        title: String(o.title ?? '').trim(),
        description: String(o.description ?? '').trim(),
        impact: String(o.impact ?? '').trim(),
      }
    })
    .filter((r) => r.title)

  const rawScore = typeof obj.score === 'number' ? obj.score : 0
  const rawGrade = typeof obj.grade === 'string' ? obj.grade.trim() : 'F'

  return {
    score: Math.max(0, Math.min(100, rawScore)),
    grade: rawGrade || 'F',
    breakdown,
    recommendations,
    quickWins: asStrings(obj.quickWins).slice(0, 3),
  }
}

export async function POST(request: Request) {
  let body: { url?: string; type?: string }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { url, type } = body
  if (!url || !url.trim()) {
    return new Response(JSON.stringify({ error: 'url is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  if (type !== 'geo' && type !== 'ao') {
    return new Response(JSON.stringify({ error: 'type must be "geo" or "ao"' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const target = url.trim().replace(/^(?!https?:\/\/)/, 'https://')
  const systemPrompt = type === 'geo' ? GEO_SYSTEM_PROMPT : AO_SYSTEM_PROMPT

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))

      try {
        // Step 1 — fetch the page HTML
        send({ type: 'progress', message: 'Fetching your site...', step: 1, total: 3 })

        let html: string
        try {
          const res = await fetch(target, {
            signal: AbortSignal.timeout(10000),
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
              Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
          })
          if (!res.ok) {
            send({
              type: 'error',
              error: `Could not fetch that URL (HTTP ${res.status}). Check the address and try again.`,
            })
            controller.close()
            return
          }
          const full = await res.text()
          html = full.length > 15000 ? full.slice(0, 15000) : full
        } catch (err) {
          send({
            type: 'error',
            error: `Could not reach that URL. Check the address and try again. (${err instanceof Error ? err.message : String(err)})`,
          })
          controller.close()
          return
        }

        // Step 2 — call Claude
        send({ type: 'progress', message: 'Analyzing...', step: 2, total: 3 })

        let analysis: unknown | null = null
        for (let attempt = 0; attempt < 2 && analysis === null; attempt++) {
          const res = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 2048,
            system: systemPrompt,
            messages: [{ role: 'user', content: `Website URL: ${target}\n\nHTML:\n${html}` }],
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

        // Step 3 — done
        send({ type: 'progress', message: 'Building your report...', step: 3, total: 3 })
        send({ type: 'result', ...normalizeResult(analysis) })
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
