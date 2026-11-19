'use client'

/**
 * Retrievable across runs, oldest on the left. The line breaks wherever the
 * engine version changes: two runs scored on different engines are not
 * comparable, and the compare feature refuses to diff them, so the chart must not
 * invite the eye to. The gap is labelled in the chart and in a sentence below it,
 * both visible without hovering; hovering or tapping a point or the gap shows the
 * versions either side. Older points are kept: they are real measurements. Plain
 * SVG, no chart library.
 */
import { useState } from 'react'
import { engineGaps, engineSegments, type ChartPoint } from './chart-segments'

export type { ChartPoint } from './chart-segments'

// Drawn small so the text stays legible when the SVG is scaled to a phone's width.
const W = 360
const H = 170
const PAD = { left: 30, right: 14, top: 20, bottom: 26 }

type Active = { kind: 'point'; i: number } | { kind: 'gap'; i: number } | null

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

export default function ScoreChart({ points, label }: { points: ChartPoint[]; label: string }) {
  const [active, setActive] = useState<Active>(null)
  if (points.length === 0) return null

  const scored = points.filter((p) => p.score !== null)
  const scores = scored.map((p) => p.score as number)
  const lo = Math.max(0, Math.min(...scores, 100) - 10)
  const hi = Math.min(100, Math.max(...scores, 0) + 10)
  const x = (i: number) => PAD.left + (points.length === 1 ? (W - PAD.left - PAD.right) / 2 : (i * (W - PAD.left - PAD.right)) / (points.length - 1))
  const y = (s: number) => PAD.top + ((hi - s) * (H - PAD.top - PAD.bottom)) / Math.max(1, hi - lo)

  const segments = engineSegments(points)
  const gaps = engineGaps(points)
  // One line per engine, joining only that engine's own scored points.
  const lines = segments
    .map((s) => points.slice(s.start, s.end + 1).map((p, k) => (p.score === null ? null : `${x(s.start + k)},${y(p.score)}`)).filter(Boolean))
    .filter((pts) => pts.length >= 2)
    .map((pts) => pts.join(' '))

  const lastScoredBefore = (idx: number) => [...points.slice(0, idx)].reverse().find((p) => p.score !== null)
  const firstScoredFrom = (idx: number) => points.slice(idx).find((p) => p.score !== null)
  const gapNote = (g: { index: number; before: string; after: string }) =>
    `Engine changed between ${fmt(points[g.index - 1].date)} and ${fmt(points[g.index].date)} (${g.before} to ${g.after}): scores before and after are not comparable.`

  const readout = (() => {
    if (!active) return null
    if (active.kind === 'point') {
      const p = points[active.i]
      return `${fmt(p.date)}: ${p.score === null ? 'score withheld' : `Retrievable ${p.score}`}, scored on engine ${p.engine}.`
    }
    const g = gaps.find((q) => q.index === active.i)
    if (!g) return null
    const a = lastScoredBefore(g.index)
    const b = firstScoredFrom(g.index)
    return `Before: engine ${g.before}${a ? `, ${a.score} on ${fmt(a.date)}` : ''}. After: engine ${g.after}${b ? `, ${b.score} on ${fmt(b.date)}` : ''}. Scores on different engines are not comparable.`
  })()

  return (
    <figure className="rounded-2xl p-4" style={{ background: 'var(--ink-card)', border: '1px solid var(--border)' }}>
      <figcaption className="mb-2 text-xs" style={{ color: 'var(--cream-faint)' }}>{label}</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label={`${label}: ${scored.map((p) => `${fmt(p.date)} ${p.score}`).join(', ')}${gaps.length ? `. The engine changed ${gaps.length} time${gaps.length === 1 ? '' : 's'}; scores either side of a change are not comparable.` : ''}`}
      >
        {[lo, Math.round((lo + hi) / 2), hi].map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="rgba(184,115,51,0.12)" />
            <text x={PAD.left - 6} y={y(v) + 4} textAnchor="end" fontSize="12" fill="#998876">{v}</text>
          </g>
        ))}
        {gaps.map((g) => {
          const mid = (x(g.index - 1) + x(g.index)) / 2
          const anchor = mid < W * 0.3 ? 'start' : mid > W * 0.7 ? 'end' : 'middle'
          const tx = anchor === 'start' ? mid + 4 : anchor === 'end' ? mid - 4 : mid
          return (
            <g key={`gap${g.index}`} data-gap={g.index}>
              <line x1={mid} x2={mid} y1={PAD.top} y2={H - PAD.bottom} stroke="#D4954A" strokeDasharray="4 4" />
              <text x={tx} y={PAD.top - 8} textAnchor={anchor} fontSize="10" fill="#D4954A">engine changed</text>
              <text x={tx} y={PAD.top + 4} textAnchor={anchor} fontSize="10" fill="#D4954A">not comparable</text>
              <rect
                x={x(g.index - 1) + 6}
                y={PAD.top}
                width={Math.max(8, x(g.index) - x(g.index - 1) - 12)}
                height={H - PAD.top - PAD.bottom}
                fill="transparent"
                tabIndex={0}
                role="button"
                aria-label={`Engine changed from ${g.before} to ${g.after}`}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setActive({ kind: 'gap', i: g.index })}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive({ kind: 'gap', i: g.index })}
                onBlur={() => setActive(null)}
                onClick={() => setActive({ kind: 'gap', i: g.index })}
              />
            </g>
          )
        })}
        {lines.map((pts) => (
          <polyline key={pts} points={pts} fill="none" stroke="#B87333" strokeWidth="2.5" />
        ))}
        {points.map((p, i) =>
          p.score === null ? null : (
            <g key={i}>
              <circle data-point={i} cx={x(i)} cy={y(p.score)} r="4" fill="#D4954A" />
              <circle
                cx={x(i)}
                cy={y(p.score)}
                r="12"
                fill="transparent"
                tabIndex={0}
                role="button"
                aria-label={`${fmt(p.date)}, Retrievable ${p.score}, engine ${p.engine}`}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setActive({ kind: 'point', i })}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive({ kind: 'point', i })}
                onBlur={() => setActive(null)}
                onClick={() => setActive({ kind: 'point', i })}
              />
            </g>
          ),
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
      {gaps.map((g) => (
        <p key={`note${g.index}`} data-note={g.index} className="mt-2 text-xs leading-relaxed" style={{ color: '#D4954A' }}>
          {gapNote(g)}
        </p>
      ))}
      <p className="mt-2 min-h-[1.25rem] text-xs" style={{ color: 'var(--cream-dim)' }} aria-live="polite">
        {readout ?? (gaps.length ? 'Hover or tap a point, or the gap, to see its engine version.' : '')}
      </p>
    </figure>
  )
}
