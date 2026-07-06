import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { FileText, ExternalLink } from 'lucide-react'
import CopyLinkButton from './CopyLinkButton'

type AuditRow = {
  id: string
  domain: string | null
  created_at: string
  share_token: string
  result: {
    gaps?: Array<unknown>
    pageCount?: number
    quickWins?: string[]
  } | null
}

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: audits } = await (supabase as any)
    .from('audit_results')
    .select('id, domain, created_at, share_token, result')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false }) as { data: AuditRow[] | null }

  const list = audits ?? []

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--cream)' }}>
          Audit Reports
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--cream-dim)' }}>
          Saved content gap audit reports for your sites.
        </p>
      </div>

      {list.length === 0 ? (
        <div
          className="rounded-2xl border p-12 text-center"
          style={{ borderColor: 'var(--border)', background: 'var(--ink-card)' }}
        >
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(184,115,51,0.10)' }}
          >
            <FileText className="w-6 h-6" style={{ color: 'var(--copper)' }} />
          </div>
          <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--cream)' }}>
            No reports yet
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--cream-dim)' }}>
            Run an audit to save your first report.
          </p>
          <Link
            href="/audit"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-colors"
            style={{ background: 'var(--copper)', color: '#fff' }}
          >
            Run a free audit →
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--ink-card)' }}>
                <th
                  className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--cream-faint)' }}
                >
                  Domain
                </th>
                <th
                  className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--cream-faint)' }}
                >
                  Date
                </th>
                <th
                  className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--cream-faint)' }}
                >
                  Gaps Found
                </th>
                <th
                  className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--cream-faint)' }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((row, i) => {
                const gapCount = Array.isArray(row.result?.gaps) ? row.result.gaps.length : 0
                const date = new Date(row.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })
                const reportUrl = `https://app.bylineseo.com/report/${row.share_token}`
                return (
                  <tr
                    key={row.id}
                    style={{
                      borderBottom: i < list.length - 1 ? '1px solid var(--border)' : 'none',
                      background: 'var(--ink-card)',
                    }}
                  >
                    <td className="px-5 py-4">
                      <span className="text-sm font-medium" style={{ color: 'var(--cream)' }}>
                        {row.domain ?? '—'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm" style={{ color: 'var(--cream-dim)' }}>
                        {date}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(184,115,51,0.12)', color: 'var(--copper)' }}
                      >
                        {gapCount} gaps
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/report/${row.share_token}`}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                          style={{ color: 'var(--copper)', border: '1px solid rgba(184,115,51,0.25)' }}
                        >
                          <ExternalLink className="w-3 h-3" />
                          View report
                        </Link>
                        <CopyLinkButton url={reportUrl} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
