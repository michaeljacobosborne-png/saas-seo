/**
 * GET    /api/tracked-pages/:id                     the page and every recorded run (scores only)
 * GET    /api/tracked-pages/:id?from=<run>&to=<run> both runs re-scored on today's engine, then compared
 * DELETE /api/tracked-pages/:id                     stop tracking; the history is kept
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { compareOverTime } from '@/lib/geo-audit/history'
import { describeChange, engineSplit } from '@/lib/geo-audit/change-summary'
import { decodeSnapshot } from '@/lib/geo-audit/snapshot'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: page } = await supabase.from('tracked_pages').select('id, url, tool, active, interval_days, last_run_at, next_run_at, last_error').eq('id', id).maybeSingle()
  if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const search = new URL(request.url).searchParams
  const from = search.get('from')
  const to = search.get('to')
  if (from && to) {
    const { data: rows } = await supabase
      .from('audit_snapshots')
      .select('id, snapshot, recorded_at, retrievable_score, score_withheld')
      .eq('tracked_page_id', id)
      .in('id', [from, to])
    const found = [rows?.find((r) => r.id === from), rows?.find((r) => r.id === to)]
    if (!found[0] || !found[1]) return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    // Earlier first, whichever way round they were asked for.
    const [a, b] = (found[0].recorded_at as string) <= (found[1].recorded_at as string) ? found : [found[1], found[0]]
    const result = await compareOverTime(decodeSnapshot(a!.snapshot as string), decodeSnapshot(b!.snapshot as string))
    const recorded = (r: typeof a) => (r!.score_withheld ? null : ((r!.retrievable_score as number | null) ?? null))
    return NextResponse.json({
      page,
      ...result,
      summary: describeChange(result),
      engineNote: engineSplit(result, { from: recorded(a), to: recorded(b) }),
    })
  }

  const { data: runs } = await supabase
    .from('audit_snapshots')
    .select('id, recorded_at, engine_version, retrievable_score, score_withheld, citable_band, content_hash')
    .eq('tracked_page_id', id)
    .order('recorded_at', { ascending: false })
  return NextResponse.json({ page, runs: runs ?? [] })
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // Stop the schedule but keep every recorded run: the history is the asset.
  const { error } = await supabase.from('tracked_pages').update({ active: false }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
