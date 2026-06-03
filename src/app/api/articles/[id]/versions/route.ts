import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('article_versions')
    .select('id, label, trigger, word_count, created_at')
    .eq('article_id', id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ versions: data ?? [] })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { label, trigger } = await request.json() as { label?: string; trigger?: string }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  // Get current article content
  const { data: article, error: articleError } = await sb
    .from('articles')
    .select('content, word_count')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (articleError || !article?.content) {
    return NextResponse.json({ error: 'Article not found or has no content' }, { status: 404 })
  }

  const { data: version, error } = await sb
    .from('article_versions')
    .insert({
      article_id: id,
      user_id: user.id,
      content: article.content,
      word_count: article.word_count ?? null,
      label: label ?? 'Manual save',
      trigger: trigger ?? 'manual',
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ versionId: version.id }, { status: 201 })
}
