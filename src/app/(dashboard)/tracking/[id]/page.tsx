import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import RunHistory, { type Run } from './RunHistory'
import { ENGINE_VERSION } from '@/lib/geo-audit/types'

export const dynamic = 'force-dynamic'

export default async function TrackedPageDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: page } = await supabase.from('tracked_pages').select('id, url, active, interval_days, next_run_at').eq('id', id).maybeSingle()
  if (!page) notFound()
  const { data: runs } = await supabase
    .from('audit_snapshots')
    .select('id, recorded_at, engine_version, retrievable_score, score_withheld, citable_band, content_hash')
    .eq('tracked_page_id', id)
    .order('recorded_at', { ascending: false })

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <Link href="/tracking" className="text-xs" style={{ color: 'var(--cream-faint)' }}>← Tracked pages</Link>
      <h1 className="mt-2 text-xl font-bold break-all" style={{ color: 'var(--cream)' }}>{page.url}</h1>
      <p className="mt-1 mb-6 text-sm" style={{ color: 'var(--cream-dim)' }}>
        {page.active
          ? `Re-checked every ${page.interval_days} days. Next run ${new Date(page.next_run_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}.`
          : 'No longer tracked. Its history is kept.'}
      </p>
      <RunHistory pageId={page.id} runs={(runs ?? []) as Run[]} active={page.active} currentEngine={ENGINE_VERSION} />
      <p className="mt-6 text-xs leading-relaxed" style={{ color: 'var(--cream-faint)' }}>
        These scores measure how ready the page is for AI search to read and quote, as Byline checks it. A change here is a change in what the page carries, not evidence that any AI system retrieves or cites it more or less.
      </p>
    </div>
  )
}
