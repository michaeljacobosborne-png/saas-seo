import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET a single version's full content (for preview)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; vid: string }> }
) {
  const { id, vid } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('article_versions')
    .select('id, content, word_count, label, trigger, created_at')
    .eq('id', vid)
    .eq('article_id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Version not found' }, { status: 404 })
  return NextResponse.json({ version: data })
}

// POST to restore this version (copies content back to article)
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; vid: string }> }
) {
  const { id, vid } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  // Fetch the version content
  const { data: version, error: vErr } = await sb
    .from('article_versions')
    .select('content, word_count')
    .eq('id', vid)
    .eq('article_id', id)
    .eq('user_id', user.id)
    .single()

  if (vErr || !version) return NextResponse.json({ error: 'Version not found' }, { status: 404 })

  // Save current state as a new version before overwriting
  const { data: current } = await sb
    .from('articles')
    .select('content, word_count')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (current?.content) {
    await sb.from('article_versions').insert({
      article_id: id,
      user_id: user.id,
      content: current.content,
      word_count: current.word_count ?? null,
      label: 'Before restore',
      trigger: 'manual',
    })
  }

  // Restore
  const { error: updateError } = await sb
    .from('articles')
    .update({ content: version.content, word_count: version.word_count })
    .eq('id', id)
    .eq('user_id', user.id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ content: version.content, word_count: version.word_count })
}
