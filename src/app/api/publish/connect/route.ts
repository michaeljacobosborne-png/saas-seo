import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/encrypt'
import { normalizeSiteUrl, testWordPress, type WpCredentials } from '@/lib/publishing'

export const runtime = 'nodejs'

// Connect (or re-connect) a WordPress site. Tests the credentials before
// storing them, then upserts an encrypted connection row for the user.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    platform?: string
    siteUrl?: string
    username?: string
    appPassword?: string
    displayName?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const platform = body.platform ?? 'wordpress'
  if (platform !== 'wordpress') {
    return NextResponse.json({ error: 'Unsupported platform' }, { status: 400 })
  }

  const siteUrl = normalizeSiteUrl(body.siteUrl ?? '')
  const username = (body.username ?? '').trim()
  const appPassword = (body.appPassword ?? '').trim()

  if (!siteUrl || !username || !appPassword) {
    return NextResponse.json({ error: 'Site URL, username, and application password are all required.' }, { status: 400 })
  }

  // Verify the credentials against the live site before storing anything.
  const test = await testWordPress(siteUrl, username, appPassword)
  if (!test.ok) {
    return NextResponse.json({ error: test.error ?? 'Could not connect to the site.' }, { status: 400 })
  }

  const displayName = (body.displayName ?? '').trim() || test.displayName || siteUrl
  const credentials: WpCredentials = { username, appPassword }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('publishing_connections')
    .upsert(
      {
        user_id: user.id,
        platform,
        site_url: siteUrl,
        display_name: displayName,
        credentials: encrypt(JSON.stringify(credentials)),
        status: 'active',
        last_tested: new Date().toISOString(),
      },
      { onConflict: 'user_id,platform,site_url' },
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, displayName })
}
