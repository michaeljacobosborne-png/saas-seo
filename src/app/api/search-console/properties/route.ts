import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchProperties } from '@/lib/google-search-console'
import { getConnection, getValidAccessToken } from '@/lib/search-console-connection'

export const runtime = 'nodejs'

// Returns the GSC properties the connected Google account can access, so the user
// can pick which one to attach to their brand.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const brandProfileId = searchParams.get('brand_profile_id')

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

  try {
    const accessToken = await getValidAccessToken(supabase, connection)
    const properties = await fetchProperties(accessToken)
    return NextResponse.json({ properties })
  } catch (err) {
    console.error('[Byline] GSC properties fetch error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch properties' },
      { status: 502 }
    )
  }
}
