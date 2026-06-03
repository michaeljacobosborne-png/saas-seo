import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { target_keyword, title } = await request.json() as {
    target_keyword?: string
    title?: string
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const { data: source, error: sourceError } = await sb
    .from('articles')
    .select('title, target_keyword, content, word_count, brief, meta_description, scores')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (sourceError || !source) {
    return NextResponse.json({ error: 'Source article not found' }, { status: 404 })
  }

  const forkTitle = title
    ?? (source.title ? `Fork: ${source.title}` : null)
    ?? (source.target_keyword ? `Fork: ${source.target_keyword}` : 'Forked article')

  const { data: fork, error: forkError } = await sb
    .from('articles')
    .insert({
      user_id: user.id,
      title: forkTitle,
      target_keyword: target_keyword ?? source.target_keyword,
      content: source.content,
      word_count: source.word_count,
      brief: source.brief,
      meta_description: source.meta_description,
      // Don't copy scores — new keyword means new scores needed
      status: source.content ? 'complete' : 'draft',
    })
    .select('id')
    .single()

  if (forkError) return NextResponse.json({ error: forkError.message }, { status: 500 })

  return NextResponse.json({ articleId: fork.id }, { status: 201 })
}
