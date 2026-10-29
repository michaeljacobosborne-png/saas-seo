import type { AuditComparison } from '@/lib/geo-audit/compare'

export interface CompareResult {
  summary: string
  /** Set when the runs were first scored on different engines: how much of the change was the engine. */
  engineNote?: string | null
  comparison: AuditComparison
  engineVersion: string
  contentChanged: boolean
  recordedOn: { from: string; to: string }
}

const STATUS: Record<string, string> = { good: 'Good', 'needs-work': 'Needs work', missing: 'Missing', unverified: 'Not assessed', 'absent-from-report': 'Not in that run' }
const card = { background: 'var(--ink-card)', border: '1px solid var(--border)' }

function Delta({ d }: { d: number | null }) {
  if (d === null || d === 0) return <span style={{ color: 'var(--cream-faint)' }}>{d === 0 ? 'no change' : 'not compared'}</span>
  return <span style={{ color: d > 0 ? '#22c55e' : '#f87171', fontWeight: 600 }}>{d > 0 ? `+${d}` : d}</span>
}

/** What changed between two runs, both re-scored on one engine. */
export default function ComparisonView({ result }: { result: CompareResult }) {
  const c = result.comparison
  return (
    <section className="space-y-4">
      <div className="rounded-2xl p-5" style={card}>
        <p className="text-base leading-relaxed" style={{ color: 'var(--cream)' }}>{result.summary}</p>
        {result.engineNote && (
          // Not small print: whether a drop came from the page or from our engine is the point.
          <p className="mt-3 rounded-lg p-3 text-sm leading-relaxed" style={{ background: 'rgba(184,115,51,0.12)', border: '1px solid rgba(184,115,51,0.35)', color: 'var(--cream)' }}>
            <strong className="block mb-1">Engine version changed between these runs</strong>
            {result.engineNote}
          </p>
        )}
        <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--cream-faint)' }}>{c.scope}</p>
      </div>

      <div className="rounded-2xl p-5" style={card}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--cream)' }}>Retrievable, by group</h3>
        <ul className="space-y-2 text-sm">
          {c.groups.map((g) => (
            <li key={g.id} className="flex items-baseline justify-between gap-3">
              <span style={{ color: 'var(--cream-dim)' }}>{g.name}</span>
              <span className="tabular-nums" style={{ color: 'var(--cream)' }}>
                {g.from ?? '—'} → {g.to ?? '—'} <Delta d={g.delta} />
              </span>
            </li>
          ))}
        </ul>
      </div>

      {(c.checkChanges.length > 0 || c.signalChanges.length > 0) && (
        <div className="rounded-2xl p-5" style={card}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--cream)' }}>What moved</h3>
          <ul className="space-y-2 text-sm">
            {c.checkChanges.map((x) => (
              <li key={x.id} className="flex items-baseline justify-between gap-3">
                <span style={{ color: 'var(--cream-dim)' }}>{x.name}</span>
                <span style={{ color: 'var(--cream)' }}>{STATUS[x.from] ?? x.from} → {STATUS[x.to] ?? x.to}</span>
              </li>
            ))}
            {c.signalChanges.map((x) => (
              <li key={x.id} className="flex items-baseline justify-between gap-3">
                <span style={{ color: 'var(--cream-dim)' }}>{x.name} (Citable)</span>
                <span style={{ color: x.direction === 'up' ? '#22c55e' : '#f87171' }}>{x.from ?? '—'} → {x.to ?? '—'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
