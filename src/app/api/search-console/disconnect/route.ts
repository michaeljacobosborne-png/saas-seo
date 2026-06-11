import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// Removes a brand's Search Console connection (tokens + selected property).
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { brand_profile_id?: string }
  const { brand_profile_id } = body

  if (!brand_profile_id) {
    return NextResponse.json({ error: 'brand_profile_id is required' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('search_console_connections')
    .delete()
    .eq('user_id', user.id)
    .eq('brand_profile_id', brand_profile_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
