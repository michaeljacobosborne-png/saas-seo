/**
 * One honest sentence about what changed between two runs, from a comparison
 * made on a single engine (compareOverTime). It separates three cases a reader
 * would otherwise blur: the words changed; only markup or crawler responses
 * changed; nothing changed. It never says why an engine did or did not cite
 * the page.
 */
import type { OverTime } from './history'

const DAY = 86_400_000

export function describeChange(o: OverTime): string {
  const c = o.comparison
  const r = c.retrievability
  const days = c.from.analyzedAt && c.to.analyzedAt ? Math.round((Date.parse(c.to.analyzedAt) - Date.parse(c.from.analyzedAt)) / DAY) : null
  const span = days === null ? '' : days === 0 ? ' on the same day' : ` over ${days} day${days === 1 ? '' : 's'}`
  const scored = r.from !== null && r.to !== null
  const moved = scored && r.delta !== 0
  const band = c.citability.direction === 'up' || c.citability.direction === 'down' ? ` Citable went ${c.citability.direction} (${c.citability.from} to ${c.citability.to}).` : ''
  const score = scored ? `Retrievable ${moved ? `went from ${r.from} to ${r.to}` : `stayed at ${r.to}`}` : 'Retrievable could not be scored on one of the runs'

  if (o.contentChanged) {
    return `The page's text changed${span}. ${score}, both runs scored on engine ${o.engineVersion}.${band}`
  }
  if (moved || band) {
    return `The page's text did not change${span}, but ${score} on engine ${o.engineVersion}.${band} The difference is in the markup, a linked page, or how the server answered the crawlers.`
  }
  return `Nothing changed${span}: same text, and ${score} on engine ${o.engineVersion}.`
}
