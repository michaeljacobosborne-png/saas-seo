import type { TopAccount } from '../_lib/admin-data'

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtMrr(cents: number | null): string {
  if (cents === null) return '—'
  if (cents === 0) return '$0'
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}/mo`
}

/** Top accounts by articles generated, with plan + MRR contribution. */
export default function TopAccountsTable({ accounts }: { accounts: TopAccount[] }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--ink-card)', border: '1px solid rgba(184,115,51,0.18)' }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(184,115,51,0.15)' }}>
            {['Email', 'Plan', 'Articles', 'Agent Sessions', 'Member Since', 'MRR'].map((h, i) => (
              <th
                key={h}
                className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--cream-faint)] ${i >= 2 && i <= 3 ? 'text-right' : i === 5 ? 'text-right' : 'text-left'}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {accounts.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-sm text-[var(--cream-dim)]">No accounts yet.</td>
            </tr>
          ) : (
            accounts.map((a, i) => {
              const isPaid = a.accountType !== 'free'
              return (
                <tr key={a.userId} className="transition-colors hover:bg-[var(--ink-deep)]" style={{ borderTop: i === 0 ? 'none' : '1px solid rgba(184,115,51,0.08)' }}>
                  <td className="px-4 py-3 text-[var(--cream)] max-w-[18rem] truncate" title={a.email}>{a.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${isPaid ? 'bg-green-500/15 text-green-400' : 'bg-[var(--ink-deep)] text-[var(--cream-dim)]'}`}
                    >
                      {isPaid ? 'Paid' : 'Free'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-[var(--cream)]">{a.articleCount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-[var(--cream)]">{a.agentSessions.toLocaleString()}</td>
                  <td className="px-4 py-3 text-[var(--cream-dim)]">{fmtDate(a.createdAt)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-[var(--cream)]">{fmtMrr(a.mrrCents)}</td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
