import type Anthropic from '@anthropic-ai/sdk'
import { describe, expect, it } from 'vitest'
import { findCrawlerMisattributions } from './crawler-access'
import { fallbackNarration, narrate, sanitiseImpact } from './narrate'
import { STATUS_LABELS, type Factor } from './types'

function factor(overrides: Partial<Factor> = {}): Factor {
  return {
    id: 'schema',
    name: 'Schema markup',
    state: 'absent',
    score: 2,
    maxScore: 15,
    scored: true,
    status: 'missing',
    label: STATUS_LABELS.missing,
    detail: 'No structured data was found.',
    evidence: [],
    ...overrides,
  }
}

describe('sanitiseImpact', () => {
  // The old engine shipped impacts like "Could increase GEO citation likelihood
  // by 25-30%". Nothing in this tool can measure that, so it is stripped even if
  // the model produces it.
  it('strips predicted gains expressed as numbers', () => {
    expect(sanitiseImpact('Could increase GEO citation likelihood by 25-30%')).toBe('')
    expect(sanitiseImpact('Estimated 15-25% CTR improvement')).toBe('')
    expect(sanitiseImpact('Could add 12-15 points to overall score')).toBe('')
    expect(sanitiseImpact('Improves answer box qualification by 25%')).toBe('')
    expect(sanitiseImpact('Traffic will 3x')).toBe('')
  })

  it('strips guarantees and training claims', () => {
    expect(sanitiseImpact('Guaranteed to appear in AI answers')).toBe('')
    expect(sanitiseImpact('Will rank you first for the term')).toBe('')
    expect(sanitiseImpact('Trains the AI model on your brand')).toBe('')
  })

  it('keeps a factual statement of what the change addresses', () => {
    const kept = 'Addresses the author and entity gaps found on the About page.'
    expect(sanitiseImpact(kept)).toBe(kept)
  })

  it('handles empty input', () => {
    expect(sanitiseImpact('')).toBe('')
  })
})

describe('fallbackNarration', () => {
  const input = {
    type: 'geo' as const,
    url: 'https://example.com/',
    alreadyPresent: [],
    scoreWithheld: false,
  }

  it('produces usable recommendations without the model', () => {
    const out = fallbackNarration({
      ...input,
      factors: [
        factor({ id: 'schema', name: 'Schema markup', score: 2, maxScore: 15 }),
        factor({ id: 'brand', name: 'Brand/entity clarity', score: 10, maxScore: 10, status: 'good', label: 'Good', state: 'present' }),
      ],
    })

    expect(out.recommendations.length).toBeGreaterThan(0)
    // The full-marks factor must not be recommended for improvement.
    expect(out.recommendations.map((r) => r.title).join(' ')).not.toMatch(/brand\/entity clarity/i)
    expect(out.recommendations[0].title).toMatch(/schema markup/i)
  })

  it('never emits a numeric impact promise', () => {
    const out = fallbackNarration({
      ...input,
      factors: [factor(), factor({ id: 'author', name: 'Author/entity signals', score: 4, maxScore: 15 })],
    })
    for (const rec of out.recommendations) {
      expect(rec.impact).not.toMatch(/\d+\s*%|guarantee|will rank/i)
    }
  })

  it('calls out factors that could not be assessed', () => {
    const out = fallbackNarration({
      ...input,
      factors: [
        factor(),
        factor({
          id: 'freshness',
          name: 'Freshness signals',
          scored: false,
          state: 'unverified',
          score: 0,
          status: 'unverified',
          label: STATUS_LABELS.unverified,
          detail: 'The page could not be read.',
        }),
      ],
    })

    const text = out.recommendations.map((r) => `${r.title} ${r.description}`).join(' ')
    expect(text).toMatch(/could not be assessed/i)
    expect(text).toMatch(/Freshness signals/)
  })
})

// clickslice.co.uk, 20 Oct 2026: the probe found Claude-SearchBot (Anthropic,
// AI search) and ClaudeBot (Anthropic, training) both refused with HTTP 403, and
// the model wrote this, getting the owner and the role wrong.
const CLICKSLICE_BAD = {
  priority: 'medium',
  title: 'Verify and document ClaudeBot access',
  description:
    "Claude-SearchBot (OpenAI's training crawler) was refused by your server (HTTP 403), while GPTBot and CCBot were served. This is a deliberate choice and does not prevent your page from appearing in AI search results, but you should decide if it aligns with your strategy.",
  impact: 'Clarifies your crawler policy.',
}

const CLICKSLICE_GOOD = {
  priority: 'high',
  title: 'Let Claude-SearchBot fetch the page',
  description:
    "Claude-SearchBot (Anthropic's AI search crawler) was refused with HTTP 403 although robots.txt allows it. Update the server rule that returns the 403.",
  impact: 'Addresses the refused AI search crawler.',
}

function fakeClient(payload: unknown, calls: { system?: string }[] = []): Anthropic {
  return {
    messages: {
      create: async (params: { system?: string }) => {
        calls.push(params)
        return { content: [{ type: 'text', text: JSON.stringify(payload) }] }
      },
    },
  } as unknown as Anthropic
}

describe('crawler facts in narration', () => {
  const input = {
    type: 'geo' as const,
    url: 'https://www.clickslice.co.uk/',
    factors: [factor()],
    alreadyPresent: [],
    scoreWithheld: false,
  }

  it('flags a crawler paired with the wrong vendor and role', () => {
    const found = findCrawlerMisattributions(CLICKSLICE_BAD.description)
    expect(found).toContainEqual({ token: 'Claude-SearchBot', claimed: 'OpenAI', actual: 'Anthropic' })
    expect(found.some((f) => f.token === 'Claude-SearchBot' && f.claimed === 'training crawler')).toBe(true)
  })

  it('accepts correct pairings and does not bleed across crawler names', () => {
    expect(findCrawlerMisattributions(CLICKSLICE_GOOD.description)).toEqual([])
    expect(findCrawlerMisattributions("ClaudeBot (Anthropic's training crawler) and GPTBot (OpenAI's training crawler) were refused.")).toEqual([])
    expect(findCrawlerMisattributions('OpenAI runs GPTBot, a training crawler; CCBot belongs to Common Crawl.')).toEqual([])
    expect(findCrawlerMisattributions("ClaudeBot (OpenAI's training crawler) was refused.")).toEqual([
      { token: 'ClaudeBot', claimed: 'OpenAI', actual: 'Anthropic' },
    ])
    expect(findCrawlerMisattributions('PerplexityBot, a training crawler, was refused.')).toHaveLength(1)
  })

  it('drops the misattributed recommendation and keeps the correct one', async () => {
    const calls: { system?: string }[] = []
    const out = await narrate(input, {
      client: fakeClient({ recommendations: [CLICKSLICE_BAD, CLICKSLICE_GOOD], quickWins: ['Remove the 403 rule.'] }, calls),
    })
    expect(out.usedFallback).toBe(false)
    expect(out.recommendations.map((r) => r.title)).toEqual([CLICKSLICE_GOOD.title])
    expect(out.recommendations.map((r) => r.description).join(' ')).not.toMatch(/OpenAI's training crawler/)
  })

  it('sends the crawler table to the model as fixed facts', async () => {
    const calls: { system?: string }[] = []
    await narrate(input, { client: fakeClient({ recommendations: [CLICKSLICE_GOOD], quickWins: [] }, calls) })
    const system = calls[0].system ?? ''
    expect(system).toContain('Claude-SearchBot: run by Anthropic; AI search (retrieval) crawler; scored.')
    expect(system).toContain('ClaudeBot: run by Anthropic; training crawler; not scored.')
    expect(system).toContain('GPTBot: run by OpenAI; training crawler; not scored.')
    expect(system).toContain('PerplexityBot: run by Perplexity; AI search (retrieval) crawler; scored.')
    expect(system).toContain('CCBot: run by Common Crawl; training crawler; not scored.')
  })

  it('falls back when every recommendation misattributes a crawler', async () => {
    const out = await narrate(input, { client: fakeClient({ recommendations: [CLICKSLICE_BAD], quickWins: [] }) })
    expect(out.usedFallback).toBe(true)
  })
})
