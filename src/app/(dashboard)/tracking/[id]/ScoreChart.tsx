/**
 * Retrievable across runs, oldest on the left. A dashed line marks each run
 * where the engine changed, because a step at that line may be ours rather
 * than the page's. Plain SVG, no chart library.
 */
export interface ChartPoint {
  date: string
  score: number | null
  engine: string
}

// Drawn small so the text stays legible when the SVG is scaled to a phone's width.
const W = 360
const H = 170
const PAD = { left: 30, right: 14, top: 20, bottom: 26 }

export default function ScoreChart({ points, label }: { points: ChartPoint[]; label: string }) {
  const scored = points.filter((p) => p.score !== null)
  if (points.length === 0) return null
  const scores = scored.map((p) => p.score as number)
  const lo = Math.max(0, Math.min(...scores, 100) - 10)
  const hi = Math.min(100, Math.max(...scores, 0) + 10)
  const x = (i: number) => PAD.left + (points.length === 1 ? (W - PAD.left - PAD.right) / 2 : (i * (W - PAD.left - PAD.right)) / (points.length - 1))
  const y = (s: number) => PAD.top + ((hi - s) * (H - PAD.top - PAD.bottom)) / Math.max(1, hi - lo)
  const line = points
    .map((p, i) => (p.score === null ? null : `${x(i)},${y(p.score)}`))
    .filter(Boolean)
    .join(' ')
  const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

  return (
    <figure className="rounded-2xl p-4" style={{ background: 'var(--ink-card)', border: '1px solid var(--border)' }}>
      <figcaption className="mb-2 text-xs" style={{ color: 'var(--cream-faint)' }}>{label}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`${label}: ${scored.map((p) => `${fmt(p.date)} ${p.score}`).join(', ')}`}>
        {[lo, Math.round((lo + hi) / 2), hi].map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="rgba(184,115,51,0.12)" />
            <text x={PAD.left - 6} y={y(v) + 4} textAnchor="end" fontSize="12" fill="#998876">{v}</text>
          </g>
        ))}
        {points.map((p, i) =>
          i > 0 && points[i - 1].engine !== p.engine ? (
            <g key={`e${i}`}>
              <line x1={x(i)} x2={x(i)} y1={PAD.top} y2={H - PAD.bottom} stroke="#D4954A" strokeDasharray="4 4" />
              <text x={x(i) + 4} y={PAD.top + 10} fontSize="11" fill="#D4954A">engine {p.engine}</text>
            </g>
          ) : null,
        )}
        {line && <polyline points={line} fill="none" stroke="#B87333" strokeWidth="2.5" />}
        {points.map((p, i) =>
          p.score === null ? null : <circle key={i} cx={x(i)} cy={y(p.score)} r="4" fill="#D4954A" />,
        )}
        {points.map((p, i) => (
          // First and last labels anchor inward so neither is cut off at the edge.
          <text
            key={`d${i}`}
            x={x(i)}
            y={H - 8}
            textAnchor={points.length > 1 && i === 0 ? 'start' : points.length > 1 && i === points.length - 1 ? 'end' : 'middle'}
            fontSize="12"
            fill="#998876"
          >
            {fmt(p.date)}
          </text>
        ))}
      </svg>
    </figure>
  )
}
