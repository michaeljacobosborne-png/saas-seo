import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// Lightweight connection state for a brand profile — drives the Settings/Dashboard
// UI without touching the Google API.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const brandProfileId = searchParams.get('brand_profile_id')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!brandProfileId) {
    return NextResponse.json({ error: 'brand_profile_id is required' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('search_console_connections')
    .select('property_url')
    .eq('user_id', user.id)
    .eq('brand_profile_id', brandProfileId)
    .maybeSingle()

  return NextResponse.json({
    connected: !!data,
    property_url: data?.property_url ?? null,
    has_property: !!data?.property_url,
  })
}
