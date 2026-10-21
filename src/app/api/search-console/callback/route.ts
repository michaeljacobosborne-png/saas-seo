import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exchangeCode } from '@/lib/google-search-console'

export const runtime = 'nodejs'

// Google redirects here after consent with `code` + `state` (`userId:brandProfileId`).
// We exchange the code for tokens and upsert the connection. Property selection
// happens afterward on the Settings page, so no property_url is stored yet.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const oauthError = searchParams.get('error')

  if (oauthError || !code || !state) {
    return NextResponse.redirect(`${origin}/settings?gsc=error`)
  }

  const [stateUserId, brandProfileId] = state.split(':')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // The session cookie travels with this same-browser redirect. Require it and
  // make sure it matches the state — `state` is attacker-controllable, so never
  // trust its userId on its own.
  if (!user || user.id !== stateUserId || !brandProfileId) {
    return NextResponse.redirect(`${origin}/settings?gsc=error`)
  }

  // Confirm the user still owns the target brand profile.
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

  try {
    const tokens = await exchangeCode(code)

    // Upsert on the unique brand_profile_id so reconnecting refreshes tokens in
    // place. Preserve the existing refresh_token if Google didn't send a new one.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase as any)
      .from('search_console_connections')
      .select('refresh_token')
      .eq('brand_profile_id', brandProfileId)
      .maybeSingle()

    const refreshToken = tokens.refresh_token ?? existing?.refresh_token ?? null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('search_console_connections')
      .upsert(
        {
          user_id: user.id,
          brand_profile_id: brandProfileId,
          access_token: tokens.access_token,
          refresh_token: refreshToken,
          token_expiry: new Date(tokens.expiry_date).toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'brand_profile_id' }
      )

    if (error) {
      console.error('[Byline] GSC connection upsert failed:', error.message)
      return NextResponse.redirect(`${origin}/settings?gsc=error`)
    }

    return NextResponse.redirect(`${origin}/settings?gsc=connected`)
  } catch (err) {
    console.error('[Byline] GSC callback error:', err)
    return NextResponse.redirect(`${origin}/settings?gsc=error`)
  }
}
