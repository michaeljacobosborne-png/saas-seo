import { describe, expect, it } from 'vitest'
import { fallbackNarration, sanitiseImpact } from './narrate'
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
