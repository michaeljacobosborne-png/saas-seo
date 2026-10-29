/**
 * GET  /api/tracked-pages  the user's tracked pages, each with its latest run
 * POST /api/tracked-pages  { url, tool? } start tracking a page and record the first run now
 *
 * Score over time (DECISIONS 39). Reads go through the user's own session (RLS);
 * snapshots are written with the service client.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { normaliseUrl } from '@/lib/geo-audit/fetch'
import { trackedPageLimit } from '@/lib/usage'
import { recordTrackedPage, supabaseTracking, type TrackedPage } from '@/lib/tracking'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: pages, error } = await supabase
    .from('tracked_pages')
    .select('id, url, tool, active, interval_days, created_at, last_run_at, next_run_at, last_error')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: runs } = await supabase
    .from('audit_snapshots')
    .select('tracked_page_id, recorded_at, engine_version, retrievable_score, score_withheld, citable_band, content_hash')
    .order('recorded_at', { ascending: false })
  const byPage = new Map<string, unknown[]>()
  for (const r of runs ?? []) byPage.set(r.tracked_page_id as string, [...(byPage.get(r.tracked_page_id as string) ?? []), r])

  return NextResponse.json({
    pages: (pages ?? []).map((p) => ({ ...p, runs: (byPage.get(p.id) ?? []).length, latest: (byPage.get(p.id) ?? [])[0] ?? null })),
  })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { url?: string; tool?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const url = normaliseUrl(body.url ?? '')
  const tool = body.tool === 'ao' ? 'ao' : 'geo'
  if (!url) return NextResponse.json({ error: 'A page URL is required.' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any).from('profiles').select('account_type').eq('user_id', user.id).maybeSingle()
  const limit = await trackedPageLimit(user.id, supabase, profile?.account_type)
  const { count } = await supabase.from('tracked_pages').select('id', { count: 'exact', head: true }).eq('active', true)
  if ((count ?? 0) >= limit) {
    return NextResponse.json({ error: `Your plan tracks up to ${limit} page${limit === 1 ? '' : 's'}.`, code: 'LIMIT_REACHED' }, { status: 403 })
  }

  const { data: page, error } = await supabase
    .from('tracked_pages')
    .upsert({ user_id: user.id, url, tool, active: true }, { onConflict: 'user_id,url,tool' })
    .select('id, user_id, url, tool, interval_days')
    .single()
  if (error || !page) return NextResponse.json({ error: error?.message ?? 'Could not save the page.' }, { status: 500 })

  // The first run now, so the history starts today rather than at the next cron.
  const store = supabaseTracking(createServiceClient())
  const now = new Date()
  try {
    const run = await recordTrackedPage(page as TrackedPage, now)
    await store.saveRun(page as TrackedPage, run)
    await store.markRan(page as TrackedPage, new Date(now.getTime() + (page.interval_days as number) * 86_400_000), now)
    return NextResponse.json({ page: page.id, firstRun: { score: run.report.scoreWithheld ? null : run.report.retrievability?.score, band: run.report.citability?.band } })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await store.markFailed(page as TrackedPage, message, new Date(now.getTime() + 86_400_000))
    return NextResponse.json({ page: page.id, firstRun: null, error: `Tracking started, but the first run failed: ${message} It will retry tomorrow.` })
  }
}
