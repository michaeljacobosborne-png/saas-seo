import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/encrypt'
import { testWordPress, type WpCredentials } from '@/lib/publishing'

export const runtime = 'nodejs'

// Re-test a stored WordPress connection and persist the latest status.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ connectionId: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { connectionId } = await params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: conn } = await (supabase as any)
    .from('publishing_connections')
    .select('id, site_url, credentials')
    .eq('id', connectionId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!conn) return NextResponse.json({ error: 'Connection not found' }, { status: 404 })

  let creds: WpCredentials
  try {
    creds = JSON.parse(decrypt(conn.credentials))
  } catch {
    return NextResponse.json({ error: 'Stored credentials are corrupt. Please reconnect.' }, { status: 500 })
  }

  const test = await testWordPress(conn.site_url, creds.username, creds.appPassword)
  const status = test.ok ? 'active' : 'error'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('publishing_connections')
    .update({ status, last_tested: new Date().toISOString() })
    .eq('id', connectionId)
    .eq('user_id', user.id)

  if (!test.ok) {
    return NextResponse.json({ ok: false, status, error: test.error }, { status: 400 })
  }

  return NextResponse.json({ ok: true, status, displayName: test.displayName })
}
