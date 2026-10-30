import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { emailChange, recordTrackedPage, runDuePages, supabaseTracking } from '@/lib/tracking'

// Daily: re-runs every tracked page whose interval has come round, recording
// what each run fetched (DECISIONS 39). Runs pages one at a time inside the
// function's time limit; anything left over is picked up the next day.
export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (request.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const db = createServiceClient()
  const summary = await runDuePages(supabaseTracking(db), recordTrackedPage, {
    budgetMs: 50_000,
    perRunMs: 20_000,
    // Each owner hears what changed since the previous run (decision 8).
    notify: emailChange(db),
  })
  return NextResponse.json(summary)
}
