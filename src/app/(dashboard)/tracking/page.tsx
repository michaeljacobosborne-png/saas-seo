import Link from 'next/link'
import { LineChart } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { trackedPageLimit } from '@/lib/usage'
import AddTrackedPage from './AddTrackedPage'

export const dynamic = 'force-dynamic'

type PageRow = { id: string; url: string; active: boolean; interval_days: number; last_run_at: string | null; next_run_at: string; last_error: string | null }
type RunRow = { tracked_page_id: string; recorded_at: string; retrievable_score: number | null; score_withheld: boolean; citable_band: string | null }

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'not yet')

export default async function TrackingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: pages, error } = await supabase
    .from('tracked_pages')
    .select('id, url, active, interval_days, last_run_at, next_run_at, last_error')
    .order('created_at', { ascending: false })
  const { data: runs } = await supabase
    .from('audit_snapshots')
    .select('tracked_page_id, recorded_at, retrievable_score, score_withheld, citable_band')
    .order('recorded_at', { ascending: false })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any).from('profiles').select('account_type').eq('user_id', user!.id).maybeSingle()
  const limit = await trackedPageLimit(user!.id, supabase, profile?.account_type)

  const list = (pages ?? []) as PageRow[]
  const runsByPage = new Map<string, RunRow[]>()
  for (const r of (runs ?? []) as RunRow[]) runsByPage.set(r.tracked_page_id, [...(runsByPage.get(r.tracked_page_id) ?? []), r])
  const active = list.filter((p) => p.active).length

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--cream)' }}>Tracked pages</h1>
        <p className="mt-1 text-sm max-w-2xl" style={{ color: 'var(--cream-dim)' }}>
          Each page is re-checked every month, and every run is kept. When you compare two runs, both are scored again on today&apos;s engine, so a change in the score is a change in your page, not in our rules.
        </p>
      </div>

      <div className="mb-8 rounded-2xl p-5" style={{ background: 'var(--ink-card)', border: '1px solid var(--border)' }}>
        <AddTrackedPage atLimit={active >= limit} limit={limit} />
      </div>

      {error ? (
        <p className="text-sm" style={{ color: 'var(--cream-dim)' }}>Tracked pages are not available yet.</p>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border p-10 text-center" style={{ borderColor: 'var(--border)', background: 'var(--ink-card)' }}>
          <LineChart className="w-6 h-6 mx-auto mb-3" style={{ color: 'var(--copper)' }} />
          <p className="text-sm" style={{ color: 'var(--cream-dim)' }}>No pages tracked yet. Add one above and the first run is recorded now.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {list.map((p) => {
            const pageRuns = runsByPage.get(p.id) ?? []
            const latest = pageRuns[0]
            return (
              <li key={p.id}>
                <Link
                  href={`/tracking/${p.id}`}
                  className="block rounded-2xl p-5 transition-colors hover:bg-[var(--ink-deep)]"
                  style={{ background: 'var(--ink-card)', border: '1px solid var(--border)' }}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium break-all" style={{ color: 'var(--cream)' }}>{p.url}</span>
                    <span className="text-sm font-semibold" style={{ color: 'var(--copper-lt)' }}>
                      {latest ? (latest.score_withheld ? 'Score withheld' : `Retrievable ${latest.retrievable_score}`) : 'No run yet'}
                      {latest?.citable_band ? ` · Citable ${latest.citable_band}` : ''}
                    </span>
                  </div>
                  <p className="mt-1 text-xs" style={{ color: 'var(--cream-faint)' }}>
                    {pageRuns.length} run{pageRuns.length === 1 ? '' : 's'} · last {fmt(p.last_run_at)} ·{' '}
                    {p.active ? `next ${fmt(p.next_run_at)}` : 'no longer tracked, history kept'}
                    {p.last_error ? ` · last run failed, retrying: ${p.last_error}` : ''}
                  </p>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
