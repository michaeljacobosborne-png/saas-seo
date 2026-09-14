/**
 * Prose generation.
 *
 * The model's entire job here is wording. It receives the finished, already-
 * scored factors with their evidence — never raw HTML — and it cannot change a
 * score, a status or a grade. If it fails, times out or returns junk, the
 * deterministic fallback below still produces a usable report.
 *
 * The prompt forbids the two failure modes the old version shipped constantly:
 * inventing metrics for the site to publish, and promising specific visibility
 * or citation gains that nothing here can measure.
 */

import Anthropic from '@anthropic-ai/sdk'
import { truncate } from './extract'
import type { Factor, Recommendation } from './types'

export interface NarrateInput {
  type: 'geo' | 'ao'
  url: string
  factors: Factor[]
  /** Things confirmed present, so the model does not recommend adding them. */
  alreadyPresent: string[]
  scoreWithheld: boolean
}

export interface NarrateOutput {
  recommendations: Recommendation[]
  quickWins: string[]
  /** True when the model was unavailable and the fallback wording was used. */
  usedFallback: boolean
}

const SYSTEM_PROMPT = `You write the prose for a website content-readiness report. The analysis is already complete: factors have been scored in code from evidence extracted from the page. You are writing recommendations only.

Absolute rules:
- NEVER invent statistics, credentials, testimonials, client names, case-study numbers or awards, and NEVER advise the site owner to invent them. If you suggest adding evidence, say it must be evidence they actually have.
- When you show example wording, use an explicit placeholder — "[X] years of experience", "[your specialism]" — never a plausible-looking invented figure like "12+ years" or "SaaS and fintech". A reader must not be able to paste your example onto their site as though it were true.
- NEVER predict a specific gain. Do not write percentages, multipliers, ranking positions, traffic figures, or phrases like "could increase citations by 30%". The "impact" field says what the change addresses, not what it will achieve.
- NEVER claim that schema markup guarantees citation, that it trains or influences AI models, or that any change will definitely make the site appear in AI answers. This report measures how ready content is to be quoted — it does not measure actual AI visibility.
- NEVER recommend adding something the evidence shows is already present. Acknowledge what exists.
- Only recommend structured data where it genuinely describes content visible on the page.
- Base every recommendation on the supplied findings. Do not speculate about parts of the site that were not inspected.

Return ONLY valid JSON, no markdown fence, matching:
{ "recommendations": [{ "priority": "high"|"medium"|"low", "title": string, "description": string, "impact": string }], "quickWins": [string, string, string] }

Provide 4-5 recommendations, ordered most important first, targeting the weakest scored factors. Each description is 1-3 sentences of concrete, specific instruction referencing what was actually found. Each quickWin is one sentence describing a change achievable in under an hour.`

export async function narrate(
  input: NarrateInput,
  opts: { client?: Anthropic; model?: string; timeoutMs?: number } = {},
): Promise<NarrateOutput> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  const client = opts.client ?? (apiKey ? new Anthropic({ apiKey }) : null)

  if (!client) return { ...fallbackNarration(input), usedFallback: true }

  try {
    const res = await client.messages.create(
      {
        model: opts.model ?? 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserMessage(input) }],
      },
      { timeout: opts.timeoutMs ?? 20_000 },
    )

    const block = res.content.find((b) => b.type === 'text')
    const parsed = parseJson(block && block.type === 'text' ? block.text : '')
    const normalised = normaliseNarration(parsed)

    if (normalised.recommendations.length === 0) {
      return { ...fallbackNarration(input), usedFallback: true }
    }
    if (normalised.quickWins.length === 0) {
      normalised.quickWins = fallbackNarration(input).quickWins
    }
    return { ...normalised, usedFallback: false }
  } catch {
    return { ...fallbackNarration(input), usedFallback: true }
  }
}

function buildUserMessage(input: NarrateInput): string {
  const label = input.type === 'geo' ? 'GEO (generative engine readiness)' : 'AO (answer readiness)'

  const findings = input.factors
    .map((f) => {
      const scoreLine = f.scored ? `${f.score}/${f.maxScore} — ${f.label}` : 'not assessed'
      const evidence = f.evidence
        .slice(0, 3)
        .map((e) => `      · [${e.kind}] ${e.snippet} (source: ${e.url})`)
        .join('\n')
      return [
        `  ${f.name} (${scoreLine}), state: ${f.state}`,
        `    finding: ${f.detail || 'none recorded'}`,
        evidence ? `    evidence:\n${evidence}` : '    evidence: none',
      ].join('\n')
    })
    .join('\n\n')

  const present = input.alreadyPresent.length
    ? input.alreadyPresent.map((p) => `  - ${p}`).join('\n')
    : '  - (nothing recorded)'

  return [
    `Report type: ${label}`,
    `Page analysed: ${input.url}`,
    input.scoreWithheld
      ? 'NOTE: the overall score was withheld because too little of the page could be read. Keep recommendations cautious and mention that the analysis was partial.'
      : '',
    '',
    'Scored findings:',
    findings,
    '',
    'Confirmed already present on the site — do NOT recommend adding these:',
    present,
    '',
    'Write the recommendations now.',
  ]
    .filter(Boolean)
    .join('\n')
}

function parseJson(text: string): unknown {
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
      /* try the next candidate */
    }
  }
  return null
}

/**
 * Strips the claims the prompt forbids, in case the model produces them anyway.
 * Belt and braces: a wrong number in a lead-gen report is worse than blander copy.
 */
/**
 * An impact line states what a change addresses — it never needs a number, so
 * any digit is treated as a predicted gain and the line is dropped. That is
 * blunt on purpose: the previous version shipped impacts like "Could add 12-15
 * points to overall score" and "Could increase citation likelihood by 25-30%",
 * none of which this tool can measure. Narrow patterns kept missing new phrasings.
 */
const BANNED_IMPACT = /\d|guarantee|guaranteed|will rank|trains? (?:the )?(?:ai|model)/i

export function sanitiseImpact(impact: string): string {
  const t = (impact ?? '').trim()
  if (!t) return ''
  return BANNED_IMPACT.test(t) ? '' : truncate(t, 200)
}

function normaliseNarration(raw: unknown): { recommendations: Recommendation[]; quickWins: string[] } {
  const obj = (raw ?? {}) as Record<string, unknown>
  const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
  const priorities = new Set(['high', 'medium', 'low'])

  const recommendations: Recommendation[] = arr(obj.recommendations)
    .map((r) => {
      const o = (r ?? {}) as Record<string, unknown>
      const priority = String(o.priority ?? '').toLowerCase()
      return {
        priority: (priorities.has(priority) ? priority : 'medium') as Recommendation['priority'],
        title: truncate(String(o.title ?? ''), 120),
        description: truncate(String(o.description ?? ''), 600),
        impact: sanitiseImpact(String(o.impact ?? '')),
      }
    })
    .filter((r) => r.title && r.description)
    .slice(0, 5)

  const quickWins = arr(obj.quickWins)
    .map((w) => truncate(String(w ?? ''), 240))
    .filter(Boolean)
    .slice(0, 3)

  return { recommendations, quickWins }
}

// ── Deterministic fallback ─────────────────────────────────────────────────────

/**
 * Builds recommendations straight from the scored factors. Plain wording, but
 * every statement is backed by the same evidence the scores are.
 */
export function fallbackNarration(input: NarrateInput): { recommendations: Recommendation[]; quickWins: string[] } {
  const weakest = input.factors
    .filter((f) => f.scored && f.score < f.maxScore)
    .sort((a, b) => b.maxScore - a.maxScore - (b.score - a.score))
    .sort((a, b) => a.score / a.maxScore - b.score / b.maxScore)

  const recommendations: Recommendation[] = weakest.slice(0, 5).map((f, i) => ({
    priority: i === 0 ? 'high' : i < 3 ? 'medium' : 'low',
    title: `Strengthen ${f.name.toLowerCase()}`,
    description: f.detail || `This factor scored ${f.score} of ${f.maxScore} on the page inspected.`,
    impact: `Addresses the ${f.name.toLowerCase()} gaps found on ${input.url}.`,
  }))

  const unverified = input.factors.filter((f) => !f.scored)
  if (unverified.length) {
    recommendations.push({
      priority: 'low',
      title: 'Make the remaining factors checkable',
      description: `These factors could not be assessed from the pages inspected: ${unverified
        .map((f) => f.name)
        .join(', ')}. ${unverified[0].detail}`,
      impact: 'Lets a future audit assess the whole page.',
    })
  }

  const quickWins = weakest
    .slice(0, 3)
    .map((f) => `Review ${f.name.toLowerCase()} — scored ${f.score}/${f.maxScore}. ${truncate(f.detail, 160)}`)

  return { recommendations: recommendations.slice(0, 5), quickWins }
}
