'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import ComparisonView, { type CompareResult } from './ComparisonView'
import ScoreChart from './ScoreChart'

export interface Run {
  id: string
  recorded_at: string
  engine_version: string
  retrievable_score: number | null
  score_withheld: boolean
  citable_band: string | null
  content_hash: string | null
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })

export default function RunHistory({ pageId, runs, active, currentEngine }: { pageId: string; runs: Run[]; active: boolean; currentEngine: string }) {
  const router = useRouter()
  // Scores of every run on today's engine, once asked for: the like-for-like history.
  const [rescored, setRescored] = useState<Map<string, number | null> | null>(null)
  const [rescoring, setRescoring] = useState(false)
  const olderEngine = runs.some((r) => r.engine_version !== currentEngine)

  async function rescoreAll() {
    setRescoring(true)
    setError(null)
    try {
      const res = await fetch(`/api/tracked-pages/${pageId}?rescore=all`)
      const json = await res.json()
      if (!res.ok) setError(json.error ?? 'Could not re-score the runs.')
      else setRescored(new Map((json.runs as { id: string; score: number | null }[]).map((r) => [r.id, r.score])))
    } catch {
      setError('Could not reach the server. Try again.')
    } finally {
      setRescoring(false)
    }
  }

  // Oldest first for the chart.
  const chronological = [...runs].reverse()
  const points = chronological.map((r) => ({
    date: r.recorded_at,
    score: rescored ? (rescored.get(r.id) ?? null) : r.score_withheld ? null : r.retrievable_score,
    engine: rescored ? currentEngine : r.engine_version,
  }))
  // Runs arrive newest first; compare the oldest with the newest by default.
  const [from, setFrom] = useState(runs[runs.length - 1]?.id ?? '')
  const [to, setTo] = useState(runs[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<CompareResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function compare() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/tracked-pages/${pageId}?from=${from}&to=${to}`)
      const json = await res.json()
      if (!res.ok) setError(json.error ?? 'Could not compare those runs.')
      else setResult(json as CompareResult)
    } catch {
      setError('Could not reach the server. Try again.')
    } finally {
      setBusy(false)
    }
  }

  async function stop() {
    await fetch(`/api/tracked-pages/${pageId}`, { method: 'DELETE' })
    router.refresh()
  }

  const select = 'rounded-xl px-3 py-2 text-sm'
  const style = { background: 'var(--ink)', border: '1px solid var(--border)', color: 'var(--cream)' }

  return (
    <div className="space-y-6">
      {runs.length > 0 && (
        <ScoreChart
          points={points}
          label={rescored ? `Retrievable, every run scored on engine ${currentEngine}` : 'Retrievable, as each run was first scored'}
        />
      )}

      {olderEngine && (
        // The point of keeping every run's recording: an older run can be scored
        // again on today's engine, so the history compares like with like.
        <div className="rounded-2xl p-4 text-sm leading-relaxed" style={{ background: 'rgba(184,115,51,0.12)', border: '1px solid rgba(184,115,51,0.35)', color: 'var(--cream)' }}>
          <strong className="block mb-1">Some runs were scored on an older engine</strong>
          {rescored
            ? `Showing every run scored on engine ${currentEngine}. A change in this line is a change in the page, not in how Byline scores.`
            : `Byline's engine changed since some of these runs. Their scores were right for the engine of the day, but they do not compare directly with today's. Each run kept what it fetched, so it can be scored again on engine ${currentEngine}.`}
          {!rescored && (
            <button
              type="button"
              onClick={rescoreAll}
              disabled={rescoring}
              className="mt-3 flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
              style={{ background: 'var(--copper)', color: '#fff' }}
            >
              {rescoring && <Loader2 className="h-4 w-4 animate-spin" />}
              {rescoring ? 'Scoring every run again…' : `Re-score every run on engine ${currentEngine}`}
            </button>
          )}
        </div>
      )}

      {/* Scrolls within its card on a phone so the Engine column is never clipped. */}
      <div className="rounded-2xl overflow-x-auto" style={{ border: '1px solid var(--border)' }}>
        <table className="w-full text-sm whitespace-nowrap" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--ink-card)', borderBottom: '1px solid var(--border)' }}>
              {['Run', 'Retrievable', ...(rescored ? [`On ${currentEngine}`] : []), 'Citable', 'Page text', 'Engine'].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--cream-faint)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {runs.map((r, i) => {
              const prev = runs[i + 1]
              const text = !prev ? 'first run' : prev.content_hash && r.content_hash && prev.content_hash !== r.content_hash ? 'changed' : 'same'
              return (
                <tr key={r.id} style={{ background: 'var(--ink-card)', borderBottom: i < runs.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <td className="px-4 py-3" style={{ color: 'var(--cream)' }}>{fmt(r.recorded_at)}</td>
                  <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--cream)' }}>{r.score_withheld ? 'withheld' : r.retrievable_score}</td>
                  {rescored && (
                    <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--copper-lt)' }}>{rescored.get(r.id) ?? 'withheld'}</td>
                  )}
                  <td className="px-4 py-3" style={{ color: 'var(--cream-dim)' }}>{r.citable_band ?? '—'}</td>
                  <td className="px-4 py-3" style={{ color: text === 'changed' ? 'var(--copper-lt)' : 'var(--cream-faint)' }}>{text}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: prev && prev.engine_version !== r.engine_version ? 'var(--copper-lt)' : 'var(--cream-faint)' }}>
                    {r.engine_version}
                    {prev && prev.engine_version !== r.engine_version && ' (engine changed)'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs" style={{ color: 'var(--cream-faint)' }}>
        The scores in this table are as each run was first scored. Where the engine changed between runs, part of the difference can be ours rather than your page&apos;s. Compare two runs to see both scored on the same engine, with the difference split between the page and the engine.
      </p>

      {runs.length >= 2 ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <select className={select} style={style} value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Earlier run">
              {runs.map((r) => <option key={r.id} value={r.id}>{fmt(r.recorded_at)}</option>)}
            </select>
            <span className="text-sm" style={{ color: 'var(--cream-faint)' }}>compared with</span>
            <select className={select} style={style} value={to} onChange={(e) => setTo(e.target.value)} aria-label="Later run">
              {runs.map((r) => <option key={r.id} value={r.id}>{fmt(r.recorded_at)}</option>)}
            </select>
            <button
              type="button"
              onClick={compare}
              disabled={busy || from === to}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
              style={{ background: 'var(--copper)', color: '#fff' }}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? 'Scoring both runs…' : 'Compare'}
            </button>
          </div>
          {error && <p className="text-sm" style={{ color: 'var(--cream-dim)' }}>{error}</p>}
          {result && <ComparisonView result={result} />}
        </div>
      ) : (
        <p className="text-sm" style={{ color: 'var(--cream-dim)' }}>The next run will be the first one you can compare against.</p>
      )}

      {active && (
        <button type="button" onClick={stop} className="text-xs underline" style={{ color: 'var(--cream-faint)' }}>
          Stop tracking this page (its history is kept)
        </button>
      )}
    </div>
  )
}
