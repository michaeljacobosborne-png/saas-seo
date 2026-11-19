import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ScoreChart from './ScoreChart'

/**
 * Two runs scored on different engine versions are not comparable: the compare
 * feature refuses to diff them. The score-over-time chart used to draw one line
 * straight through the change, marked only by a dashed rule, which told the eye
 * that the score had moved. It must not join them, must say so without hovering,
 * and must keep the older points, which are real measurements (2026-11-19).
 * Presentation only: no scoring changed and the engine version did not move.
 */
const FIXTURE = [
  { date: '2026-11-12T10:00:00Z', score: 70, engine: '2026.15' },
  { date: '2026-11-14T10:00:00Z', score: 72, engine: '2026.15' },
  { date: '2026-11-19T13:19:00Z', score: 75, engine: '2026.16' },
  { date: '2026-11-26T13:19:00Z', score: 76, engine: '2026.16' },
]
const render = (points = FIXTURE, label = 'Retrievable, as each run was first scored') => renderToStaticMarkup(<ScoreChart points={points} label={label} />)
const polylines = (html: string) => [...html.matchAll(/<polyline[^>]*points="([^"]+)"/g)].map((m) => m[1].trim().split(/\s+/).map((p) => p.split(',').map(Number)))

describe('the line breaks at an engine version boundary', () => {
  it('draws one line per engine, not one line across both', () => {
    const lines = polylines(render())
    expect(lines).toHaveLength(2)
    expect(lines[0]).toHaveLength(2)
    expect(lines[1]).toHaveLength(2)
  })

  it('never joins a point before the change to a point after it', () => {
    const [first, second] = polylines(render())
    const lastOfFirst = Math.max(...first.map((p) => p[0]))
    const firstOfSecond = Math.min(...second.map((p) => p[0]))
    expect(firstOfSecond).toBeGreaterThan(lastOfFirst)
  })

  it('states the gap in plain language, visible without hovering', () => {
    const html = render()
    expect(html).toMatch(/engine changed/i)
    expect(html).toMatch(/not comparable/i)
  })

  it('names the versions either side of the gap', () => {
    const html = render()
    expect(html).toContain('2026.15')
    expect(html).toContain('2026.16')
  })

  it('keeps every older point: they are real measurements', () => {
    const html = render()
    for (const s of ['12 Nov 70', '14 Nov 72', '19 Nov 75', '26 Nov 76']) expect(html).toContain(s)
    expect([...html.matchAll(/data-point=/g)]).toHaveLength(4)
  })

  it('shows a lone point on either side as a point, with no line to nowhere', () => {
    const html = render([FIXTURE[1], FIXTURE[2]])
    expect(polylines(html)).toHaveLength(0)
    expect([...html.matchAll(/data-point=/g)]).toHaveLength(2)
    expect(html).toMatch(/not comparable/i)
  })

  it('marks every change when the engine changes more than once', () => {
    const html = render([
      { date: '2026-11-01T10:00:00Z', score: 60, engine: '2026.14' },
      { date: '2026-11-05T10:00:00Z', score: 62, engine: '2026.14' },
      ...FIXTURE,
    ])
    expect(polylines(html)).toHaveLength(3)
    expect([...html.matchAll(/data-gap=/g)]).toHaveLength(2)
  })
})

describe('and does not break where nothing changed', () => {
  it('joins runs on one engine into one line with no warning', () => {
    const html = render(FIXTURE.slice(0, 2))
    expect(polylines(html)).toHaveLength(1)
    expect(html).not.toMatch(/not comparable/i)
    expect(html).not.toMatch(/data-gap=/)
  })

  it('draws one line when every run has been re-scored on the current engine', () => {
    const rescored = FIXTURE.map((p) => ({ ...p, engine: '2026.16' }))
    const html = render(rescored, 'Retrievable, every run scored on engine 2026.16')
    expect(polylines(html)).toHaveLength(1)
    expect(html).not.toMatch(/not comparable/i)
  })
})
