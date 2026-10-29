/**
 * Start tracking pages for the owner's account and record each first run now,
 * so the history starts today rather than at the next daily job.
 *
 *   npx tsx --env-file=.env.local scripts/track-pages.ts <url> [<url> ...]
 *
 * Needs migration 20261029_score_over_time.sql. Uses the service client; the
 * pages belong to michaeljacobosborne@gmail.com.
 */
import { createServiceClient } from '../src/lib/supabase/service'
import { normaliseUrl } from '../src/lib/geo-audit/fetch'
import { recordTrackedPage, supabaseTracking, type TrackedPage } from '../src/lib/tracking'

const OWNER = 'michaeljacobosborne@gmail.com'

async function main() {
  const urls = process.argv.slice(2).map(normaliseUrl).filter(Boolean)
  if (!urls.length) throw new Error('Usage: track-pages.ts <url> [<url> ...]')
  const db = createServiceClient()
  const { data: users, error: ue } = await db.auth.admin.listUsers({ perPage: 1000 })
  if (ue) throw new Error(ue.message)
  const owner = users.users.find((u) => u.email?.toLowerCase() === OWNER)
  if (!owner) throw new Error('Owner account not found')
  const store = supabaseTracking(db)

  for (const url of urls) {
    const { data: page, error } = await db
      .from('tracked_pages')
      .upsert({ user_id: owner.id, url, tool: 'geo', active: true }, { onConflict: 'user_id,url,tool' })
      .select('id, user_id, url, tool, interval_days')
      .single()
    if (error || !page) throw new Error(`${url}: ${error?.message ?? 'not saved'}`)
    const now = new Date()
    try {
      const run = await recordTrackedPage(page as TrackedPage, now)
      await store.saveRun(page as TrackedPage, run)
      await store.markRan(page as TrackedPage, new Date(now.getTime() + (page.interval_days as number) * 86_400_000), now)
      console.log(`${url} | Retrievable ${run.report.scoreWithheld ? 'withheld' : run.report.retrievability?.score} | Citable ${run.report.citability?.band} | content ${run.contentHash}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await store.markFailed(page as TrackedPage, message, new Date(now.getTime() + 86_400_000))
      console.log(`${url} | first run failed, retries tomorrow: ${message}`)
    }
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
