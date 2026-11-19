/**
 * Where a score-over-time line must break. Runs scored on different engine
 * versions are not comparable (compare.ts refuses to diff them), so a line is
 * only ever drawn between neighbours on the same engine. Presentation only: no
 * score is changed or hidden.
 */
export interface ChartPoint {
  date: string
  score: number | null
  engine: string
}

/** Contiguous runs of points on one engine, as inclusive index ranges. */
export function engineSegments(points: ChartPoint[]): { start: number; end: number; engine: string }[] {
  const out: { start: number; end: number; engine: string }[] = []
  points.forEach((p, i) => {
    const last = out[out.length - 1]
    if (last && last.engine === p.engine) last.end = i
    else out.push({ start: i, end: i, engine: p.engine })
  })
  return out
}

/** Each place the engine changes: `index` is the first point on the new engine. */
export function engineGaps(points: ChartPoint[]): { index: number; before: string; after: string }[] {
  const gaps: { index: number; before: string; after: string }[] = []
  for (let i = 1; i < points.length; i++) if (points[i - 1].engine !== points[i].engine) gaps.push({ index: i, before: points[i - 1].engine, after: points[i].engine })
  return gaps
}
