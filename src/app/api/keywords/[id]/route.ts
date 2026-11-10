import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/keywords/[id] — add a single keyword manually
// body: { keyword: string, folder?: string }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const { keyword } = body as { keyword?: string; folder?: string }

  const trimmed = keyword?.trim()
  if (!trimmed) {
    return NextResponse.json({ error: 'keyword is required' }, { status: 400 })
  }

  // Verify ownership and grab the project's brand for the new keyword.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: project } = await (supabase as any)
    .from('keyword_projects')
    .select('id, brand_profile_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('keywords')
    .insert({
      project_id: id,
      keyword: trimmed,
      source: 'manual',
      brand_id: project.brand_profile_id ?? null,
      cluster: 'Manual',
      selected: false,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ keyword: data }, { status: 201 })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Verify ownership
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: project } = await (supabase as any)
    .from('keyword_projects')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // Delete associated keywords first
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('keywords')
    .delete()
    .eq('project_id', id)

  // Delete the project
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('keyword_projects')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
