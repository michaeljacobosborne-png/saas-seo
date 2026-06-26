import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchPerformance, isoDaysAgo } from '@/lib/google-search-console'
import { getConnection, getValidAccessToken } from '@/lib/search-console-connection'

export const runtime = 'nodejs'

// Returns Search Console performance for a brand's selected property: per-row
// metrics for the requested dimension plus aggregate totals over the window.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const brandProfileId = searchParams.get('brand_profile_id')
  const days = Math.min(Math.max(parseInt(searchParams.get('days') ?? '28', 10) || 28, 1), 365)
  const dimension = searchParams.get('dimensions') ?? 'query'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!brandProfileId) {
    return NextResponse.json({ error: 'brand_profile_id is required' }, { status: 400 })
  }

  const connection = await getConnection(supabase, user.id, brandProfileId)
  if (!connection) {
    return NextResponse.json({ error: 'No Search Console connection' }, { status: 404 })
  }
  if (!connection.property_url) {
    return NextResponse.json({ error: 'No property selected' }, { status: 409 })
  }

  // GSC data lags ~2-3 days, so end the window 2 days back to avoid empty tails.
  const endDate = isoDaysAgo(2)
  const startDate = isoDaysAgo(2 + days)

  try {
    const accessToken = await getValidAccessToken(supabase, connection)
    const rows = await fetchPerformance(
      accessToken,
      connection.property_url,
      startDate,
      endDate,
      [dimension]
    )

    // Totals: clicks/impressions sum; CTR derived from the totals; position is an
    // impression-weighted average (a plain mean over-weights low-traffic rows).
    let totalClicks = 0
    let totalImpressions = 0
    let weightedPosition = 0
    for (const r of rows) {
      totalClicks += r.clicks
      totalImpressions += r.impressions
      weightedPosition += r.position * r.impressions
    }
    const totals = {
      clicks: totalClicks,
      impressions: totalImpressions,
      ctr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
      position: totalImpressions > 0 ? weightedPosition / totalImpressions : 0,
    }

    return NextResponse.json({ rows, totals })
  } catch (err) {
    console.error('[Byline] GSC performance error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch performance' },
      { status: 502 }
    )
  }
}
