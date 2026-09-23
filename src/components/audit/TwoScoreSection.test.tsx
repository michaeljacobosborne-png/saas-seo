import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { TwoScoreSection, type TwoScoreData } from './TwoScoreSection'

/**
 * These cover the bug this component was extracted to fix: the two-score panel
 * was written inline in /report/[token] and never added to /audit/results/[id],
 * so the page the results email links to silently lacked the Gap.
 *
 * Both host pages now render this same component, so the paths that matter are
 * "Phase B report renders everything" and "pre-Phase-B report renders nothing
 * and lets the legacy layout stand".
 */

const PHASE_B: TwoScoreData = {
  retrievability: {
    score: 87,
    grade: 'A',
    scoreWithheld: false,
    groups: [
      { id: 'access', name: 'Access', score: 30, maxScore: 30, deduction: 0, scored: true, label: 'Good' },
      { id: 'parseability', name: 'Parseability', score: 25, maxScore: 25, deduction: 0, scored: true, label: 'Good' },
      { id: 'chunkability', name: 'Chunkability', score: 18, maxScore: 25, deduction: 7, scored: true, label: 'Needs work' },
      { id: 'extractability', name: 'Extractability', score: 14, maxScore: 20, deduction: 6, scored: true, label: 'Needs work' },
    ],
  },
  citability: {
    band: 'adequate',
    label: 'Adequate',
    signals: [
      { id: 'named-authorship', name: 'Named authorship', band: 'weak', detail: 'No named author is identified.' },
      { id: 'proprietary-terms', name: 'Proprietary terms', band: 'absent', detail: 'No coined term was found.' },
    ],
  },
  gap: {
    quadrant: 'high-retrievable-low-citable',
    headline: 'Easy to use, hard to credit',
    diagnosis: 'The passages carry no attribution anchors.',
    nextStep: 'Work on attribution, not structure.',
  },
}

const render = (d: TwoScoreData) => renderToStaticMarkup(<TwoScoreSection result={d} />)

describe('TwoScoreSection — Phase B report', () => {
  const html = render(PHASE_B)

  it('renders both scores without blending them', () => {
    expect(html).toContain('Retrievable')
    expect(html).toContain('87')
    expect(html).toContain('Citable')
    expect(html).toContain('Adequate')
    // No averaged or combined number anywhere.
    expect(html).not.toContain('Overall score')
  })

  it('renders the Gap diagnosis', () => {
    expect(html).toContain('The gap')
    expect(html).toContain('Easy to use, hard to credit')
    expect(html).toContain('Where to start')
  })

  it('uses the sanctioned wording and not the forbidden inference', () => {
    expect(html).toContain('attribution anchors')
    expect(html).not.toMatch(/being retrieved without/i)
    expect(html).not.toMatch(/guarantee/i)
  })

  it('shows points lost inline for groups that lost any', () => {
    expect(html).toContain('Chunkability')
    expect(html).toContain('18')
    expect(html).toContain('−7')
    // A group at full marks shows no deduction marker.
    expect(html).not.toContain('−0')
  })

  it('lists the attribution signals with their bands', () => {
    expect(html).toContain('Named authorship')
    expect(html).toContain('weak')
    expect(html).toContain('Proprietary terms')
    expect(html).toContain('absent')
  })
})

describe('TwoScoreSection — legacy fallback', () => {
  // The backwards-compatibility guarantee: rows stored before Phase B must
  // render exactly as they always did, which means this component contributes
  // nothing at all rather than half a panel.
  it('renders nothing when the report predates Phase B', () => {
    expect(render({})).toBe('')
  })

  it('renders nothing when only some Phase B fields are present', () => {
    expect(render({ retrievability: PHASE_B.retrievability })).toBe('')
    expect(render({ citability: PHASE_B.citability })).toBe('')
    expect(render({ retrievability: PHASE_B.retrievability, citability: PHASE_B.citability })).toBe('')
  })
})

describe('TwoScoreSection — withheld score', () => {
  const withheld: TwoScoreData = {
    ...PHASE_B,
    retrievability: { score: 0, scoreWithheld: true, withheldReason: 'Only 12 words could be read.', groups: [] },
  }
  const html = render(withheld)

  it('shows a dash rather than a zero', () => {
    expect(html).toContain('—')
    expect(html).toContain('Only 12 words could be read.')
  })

  it('does not draw a score bar for a score it withheld', () => {
    expect(html).not.toContain('width:0%')
  })
})
