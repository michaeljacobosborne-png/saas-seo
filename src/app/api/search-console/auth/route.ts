import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildAuthUrl } from '@/lib/google-search-console'

export const runtime = 'nodejs'

// Browser entry point: kicks off the Google OAuth consent flow for a given brand
// profile. Verifies the caller is signed in and owns the brand before redirecting.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const brandProfileId = searchParams.get('brand_profile_id')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${origin}/login`)

  if (!brandProfileId) {
    return NextResponse.redirect(`${origin}/settings?gsc=error`)
  }

  // Ownership check — never start a flow that would bind a connection to a brand
  // the caller doesn't own.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: brand } = await (supabase as any)
    .from('brand_profiles')
    .select('id')
    .eq('id', brandProfileId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!brand) {
    return NextResponse.redirect(`${origin}/settings?gsc=error`)
  }

  if (!process.env.GOOGLE_CLIENT_ID) {
    console.error('[Byline] GOOGLE_CLIENT_ID is not configured — cannot start Search Console OAuth.')
    return NextResponse.redirect(`${origin}/settings?gsc=error`)
  }

  return NextResponse.redirect(buildAuthUrl(brandProfileId, user.id))
}
