import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: article, error } = await (supabase as any)
    .from('articles')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !article) return NextResponse.json({ error: 'Article not found' }, { status: 404 })

  return NextResponse.json({ article })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Only a whitelist of fields may be patched via this route.
  const updates: Record<string, unknown> = {}

  if ('brand_profile_id' in body) {
    const brandProfileId = body.brand_profile_id
    if (brandProfileId !== null && typeof brandProfileId !== 'string') {
      return NextResponse.json({ error: 'Invalid brand_profile_id' }, { status: 400 })
    }
    // Verify the target brand profile belongs to this user before associating it.
    if (brandProfileId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: brand } = await (supabase as any)
        .from('brand_profiles')
        .select('id')
        .eq('id', brandProfileId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (!brand) return NextResponse.json({ error: 'Brand profile not found' }, { status: 404 })
    }
    updates.brand_profile_id = brandProfileId
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: article, error } = await (supabase as any)
    .from('articles')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*')
    .single()

  if (error || !article) return NextResponse.json({ error: 'Article not found' }, { status: 404 })

  return NextResponse.json({ article })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Confirm ownership first so we can return 404 (not a silent no-op) when the
  // article doesn't exist or belongs to someone else.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from('articles')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: 'Article not found' }, { status: 404 })

  // Hard delete (scoped to the owner — belt-and-suspenders with RLS).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('articles')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
