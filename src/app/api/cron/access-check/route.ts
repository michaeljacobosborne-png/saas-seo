import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { emailAccessChange, observeAccess, runAccessChecks, supabaseAccess } from '@/lib/access-tracking'

// Daily: probes every tracked page as the AI search crawlers and reads its
// robots.txt. A change is held until the next day's check sees it too, then
// recorded and emailed (lib/access-tracking.ts). Needs migration
// 20261101_access_alerts.sql.
export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (request.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const db = createServiceClient()
  try {
    const summary = await runAccessChecks(supabaseAccess(db), (url) => observeAccess(url), {
      budgetMs: 50_000,
      notify: emailAccessChange(db),
    })
    return NextResponse.json(summary)
  } catch (err) {
    // Most likely the migration has not run yet: say so rather than fail daily.
    return NextResponse.json({ skipped: err instanceof Error ? err.message : String(err) })
  }
}
