import { describe, expect, it } from 'vitest'
import { applyFixEdits, blockText, figuresIn, firstPartyAttributions, integrityProblem, numberBlocks, splitBlocks, stripAgentArtefacts } from './targeted-fix'

// Exact before/after strings from the signed-in pass (2026-10-04): the
// "Brand-claim proximity" fix turned unsourced figures into Byline research.
const BRAND = 'Byline SEO'
const PRODUCED = [
  {
    before: 'For content marketers, AI optimization means improved decision-making capabilities. AI tools can suggest optimal keywords, identify content gaps, and even predict future trends. According to industry benchmarks, companies using AI in their SEO strategies have seen a 20-30% increase in organic traffic. This impact is particularly significant for small teams that need efficient solutions to stay competitive.',
    after: "For content marketers, AI optimization means improved decision-making capabilities. AI tools can suggest optimal keywords, identify content gaps, and predict future trends. According to Byline SEO's analysis of industry benchmarks, companies using AI in their SEO strategies have seen a 20-30% increase in organic traffic. This impact is especially significant for small teams that need efficient solutions to stay competitive.",
  },
  {
    before: 'Group sequence policy optimization, on the other hand, uses AI to analyze sequences of user actions. By understanding these patterns, marketers can predict user behavior and tailor content strategies accordingly. According to industry statistics, businesses using these advanced methods have seen a 15% improvement in user engagement metrics.',
    after: 'Group sequence policy optimization uses AI to analyze sequences of user actions. By understanding these patterns, marketers can predict user behavior and tailor content strategies accordingly. Byline SEO has found that businesses using these advanced methods have seen a 15% improvement in user engagement metrics. These advanced techniques require a sophisticated understanding of AI and SEO, but for those willing to invest the time, the payoff can be substantial.',
  },
  {
    before: 'These examples illustrate that even small companies with limited resources can leverage AI optimization to achieve significant improvements in their SEO performance.',
    after: "Byline SEO's research into these implementations shows that even small companies with limited resources can use AI optimization to achieve significant improvements in SEO performance.",
  },
]

describe('integrity guard', () => {
  it.each(PRODUCED)('refuses the first-party attribution the fix produced: %#', ({ before, after }) => {
    expect(integrityProblem(before, after, BRAND)).toMatch(/first-party research/)
  })

  it('catches "we" and "our" research too', () => {
    expect(firstPartyAttributions('Our analysis shows a lift.', BRAND)).not.toHaveLength(0)
    expect(firstPartyAttributions('We found that teams publish faster.', BRAND)).not.toHaveLength(0)
    expect(firstPartyAttributions('According to our data, it works.', null)).not.toHaveLength(0)
  })

  it('allows naming the brand for what it does, not for research', () => {
    expect(integrityProblem('The editor scores drafts.', 'The Byline SEO editor scores drafts against 45 structural points.', BRAND)).toMatch(/figures/)
    expect(integrityProblem('The editor scores drafts.', 'The Byline SEO editor scores each draft before it is published.', BRAND)).toBeNull()
  })

  it('refuses new figures but accepts an ADD EVIDENCE placeholder', () => {
    expect(integrityProblem('Teams publish faster.', 'Teams publish 40% faster.', BRAND)).toMatch(/adds figures/)
    expect(integrityProblem('Teams publish faster.', 'Teams publish faster [ADD EVIDENCE: a sourced figure for 40% faster publishing].', BRAND)).toBeNull()
  })

  it('keeps a figure that was already there', () => {
    expect(figuresIn('a 20-30% increase')).toEqual(['20-30%'])
    expect(integrityProblem('Traffic rose 35% over six months.', 'Organic traffic rose 35% over six months.', BRAND)).toBeNull()
  })
})

describe('applying a targeted fix', () => {
  const article = [
    '<h1>Mastering AI Optimization</h1>',
    '<p>Opening paragraph about the topic.</p>',
    '<h2>What is AI Optimization?</h2>',
    '<p>AI optimization in SEO uses machine learning.</p>',
    '<p>Unrelated paragraph that must not change, with <strong>bold</strong> text.</p>',
    '<h2>Tools</h2>',
    '<p>Selecting tools matters.</p>',
  ].join('')

  it('changes only the named block; every other block stays byte-identical', () => {
    const before = splitBlocks(article)
    const r = applyFixEdits(article, [{ op: 'replace', block: 3, markdown: 'Byline SEO users apply AI optimization with machine learning.' }], { brandName: BRAND })
    const after = splitBlocks(r.html)
    expect(r.rejected).toEqual([])
    expect(r.touched).toEqual([3])
    expect(after).toHaveLength(before.length)
    before.forEach((b, i) => {
      if (i !== 3) expect(after[i]).toBe(b)
    })
    expect(blockText(after[3])).toContain('Byline SEO')
  })

  it('never lets the agent summary into the body', () => {
    const r = applyFixEdits(article, [{ op: 'insert_after', block: 1, markdown: 'SUMMARY: Added a definition.\n\nAI optimization is a way of using models to plan content.' }])
    expect(r.html).not.toMatch(/SUMMARY:/)
    expect(stripAgentArtefacts('PATCH:REPLACE\n\nSUMMARY: x\nbody')).toBe('body')
  })

  it('applies the safe edits and reports the fabricated ones', () => {
    const r = applyFixEdits(
      article,
      [
        { op: 'replace', block: 6, markdown: "According to Byline SEO's research, selecting tools matters." },
        { op: 'replace', block: 3, markdown: 'AI optimization in SEO uses machine learning to plan content.' },
      ],
      { brandName: BRAND },
    )
    expect(r.applied).toHaveLength(1)
    expect(r.rejected[0].reason).toMatch(/first-party/)
    expect(r.html).toContain('Selecting tools matters.')
  })

  it('rejects unknown blocks, duplicates and oversized fixes', () => {
    const edits = Array.from({ length: 8 }, (_, i) => ({ op: 'replace' as const, block: i % 7, markdown: `Text ${'x'.repeat(i)}` }))
    const r = applyFixEdits(article, [{ op: 'replace', block: 99, markdown: 'x' }, ...edits], { maxEdits: 3 })
    expect(r.rejected.some((x) => /does not exist/.test(x.reason))).toBe(true)
    expect(r.applied).toHaveLength(3)
  })

  it('numbers blocks for the model with their tag', () => {
    expect(numberBlocks(splitBlocks(article)).split('\n\n')[2]).toBe('[2] (h2) What is AI Optimization?')
  })
})
