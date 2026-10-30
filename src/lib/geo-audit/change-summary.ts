/**
 * One honest sentence about what changed between two runs, from a comparison
 * made on a single engine (compareOverTime). It separates three cases a reader
 * would otherwise blur: the words changed; only markup or crawler responses
 * changed; nothing changed. It never says why an engine did or did not cite
 * the page.
 */
import type { OverTime } from './history'

const DAY = 86_400_000

/** The scores each run showed when it was recorded, on the engine of the day. */
export interface RecordedScores {
  from: number | null
  to: number | null
}

/**
 * When the two runs were first scored on different engines, splits the change
 * a customer saw at the time into what the page did and what Byline's engine
 * updates did. Engine 2026.11 and 2026.14 both moved scores with no site
 * change, so a drop needs this sentence. Null when the engines match or a
 * score is missing.
 */
export function engineSplit(o: OverTime, recorded: RecordedScores): string | null {
  const { from: va, to: vb } = o.recordedOn
  if (va === vb) return null
  const r = o.comparison.retrievability
  if (recorded.from === null || recorded.to === null || r.from === null || r.to === null) {
    return `These runs were first scored on different engines (${va} and ${vb}), so their recorded scores are not comparable with each other. The scores above are both from engine ${o.engineVersion}.`
  }
  const seen = recorded.to - recorded.from
  const page = r.to - r.from
  const engine = seen - page
  const seenText = seen === 0 ? 'no change' : `${seen > 0 ? '+' : ''}${seen}`
  const pageText = page === 0 ? 'none of it' : `${page > 0 ? '+' : ''}${page}`
  const engineText = engine === 0 ? 'none' : `${engine > 0 ? '+' : ''}${engine}`
  return `At the time, the recorded score went from ${recorded.from} (engine ${va}) to ${recorded.to} (engine ${vb}), ${seenText}. Of that, the page accounts for ${pageText} and changes to Byline's engine for ${engineText}.`
}

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
