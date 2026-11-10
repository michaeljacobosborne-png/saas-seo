import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// Persists which GSC property the user picked for a brand connection.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { brand_profile_id?: string; property_url?: string }
  const { brand_profile_id, property_url } = body

  if (!brand_profile_id || !property_url) {
    return NextResponse.json(
      { error: 'brand_profile_id and property_url are required' },
      { status: 400 }
    )
  }

  // RLS scopes the update to the caller's own connection; user_id eq is belt-and-braces.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('search_console_connections')
    .update({ property_url, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('brand_profile_id', brand_profile_id)
    .select('id')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'No Search Console connection' }, { status: 404 })

  return NextResponse.json({ success: true, property_url })
}
