import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { recordTrackedPage, runDuePages, supabaseTracking } from '@/lib/tracking'

// Daily: re-runs every tracked page whose interval has come round, recording
// what each run fetched (DECISIONS 39). Runs pages one at a time inside the
// function's time limit; anything left over is picked up the next day.
export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (request.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const summary = await runDuePages(supabaseTracking(createServiceClient()), recordTrackedPage, {
    budgetMs: 50_000,
    perRunMs: 20_000,
  })
  return NextResponse.json(summary)
}
