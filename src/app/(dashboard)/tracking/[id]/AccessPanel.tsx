import type { AccessState } from '@/lib/geo-audit/access-monitor'

export interface AlertRow {
  id: string
  detected_at: string
  good: boolean
  headline: string
  detail: string
  reproduce: string | null
}

const KIND: Record<string, string> = {
  'edge-block': 'refused at the edge',
  'origin-block': 'refused by the site',
  'bot-management': 'challenge page',
  'rate-limited': 'rate limited',
  'network-error': 'no response',
  'server-error': 'server error',
  'not-found': 'not found',
  'robots-disallow': 'disallowed by robots.txt',
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

/**
 * Crawler access as of the last daily check, and every confirmed change. The
 * wording stays on what the server sent to a request presenting each
 * user-agent; it says nothing about what any AI system reads.
 */
export default function AccessPanel({ state, checkedAt, alerts }: { state: AccessState | null; checkedAt: string | null; alerts: AlertRow[] }) {
  const card = { background: 'var(--ink-card)', border: '1px solid var(--border)' }
  return (
    <section className="mb-8 space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--cream-faint)' }}>Crawler access, checked daily</h2>
      {!state ? (
        <p className="text-sm" style={{ color: 'var(--cream-dim)' }}>The first daily access check has not run yet. After it does, you will see what the server sends each AI search crawler, and get an email the day after that changes.</p>
      ) : (
        <div className="rounded-2xl overflow-x-auto" style={card}>
          <table className="w-full text-sm whitespace-nowrap" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Crawler', 'Server', 'robots.txt'].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--cream-faint)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.crawlers.map((c) => (
                <tr key={c.token} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="px-4 py-3" style={{ color: 'var(--cream)' }}>{c.token}</td>
                  <td className="px-4 py-3" style={{ color: c.served ? 'var(--cream-dim)' : 'var(--copper-lt)' }}>
                    {c.served ? `served (HTTP ${c.status})` : `HTTP ${c.status ?? 'none'}, ${KIND[c.blockKind] ?? c.blockKind}`}
                  </td>
                  <td className="px-4 py-3" style={{ color: c.robots === 'disallowed' ? 'var(--copper-lt)' : 'var(--cream-faint)' }}>{c.robots}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-3 text-xs" style={{ color: 'var(--cream-faint)' }}>
            {checkedAt ? `Last checked ${fmt(checkedAt)}. ` : ''}
            Browser request: HTTP {state.baseline.status ?? 'none'}. This is what the server sent to a request presenting each crawler&apos;s published user-agent, from our network. It is not a record of what any AI system has read.
          </p>
        </div>
      )}
      {alerts.length > 0 && (
        <ul className="space-y-3">
          {alerts.map((a) => (
            <li key={a.id} className="rounded-2xl p-4 text-sm leading-relaxed" style={card}>
              <p className="text-xs mb-1" style={{ color: 'var(--cream-faint)' }}>{fmt(a.detected_at)}{a.good ? ' · restored' : ''}</p>
              <p className="font-semibold" style={{ color: a.good ? 'var(--cream)' : 'var(--copper-lt)' }}>{a.headline}</p>
              <p className="mt-1" style={{ color: 'var(--cream-dim)' }}>{a.detail}</p>
              {a.reproduce && <pre className="mt-2 overflow-x-auto rounded-lg p-2 text-xs" style={{ background: 'var(--ink)', color: 'var(--cream-dim)' }}>{a.reproduce}</pre>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
