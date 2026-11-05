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

  // Body is optional — allow callers to override the new title/keyword.
  const body = await request.json().catch(() => ({})) as {
    title?: string
    target_keyword?: string
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const { data: source, error: sourceError } = await sb
    .from('articles')
    .select('title, target_keyword, supporting_keywords, brief, content, meta_description, word_count, target_word_count, brand_profile_id, keyword_project_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (sourceError || !source) {
    return NextResponse.json({ error: 'Source article not found' }, { status: 404 })
  }

  const baseTitle = body.title
    ?? source.title
    ?? source.target_keyword
    ?? 'Untitled'
  const copyTitle = `Copy of ${baseTitle}`

  const { data: fork, error: forkError } = await sb
    .from('articles')
    .insert({
      user_id: user.id,
      title: copyTitle,
      target_keyword: body.target_keyword ?? source.target_keyword,
      supporting_keywords: source.supporting_keywords,
      brief: source.brief,
      content: source.content,
      meta_description: source.meta_description,
      word_count: source.word_count,
      target_word_count: source.target_word_count,
      brand_profile_id: source.brand_profile_id,
      keyword_project_id: source.keyword_project_id,
      status: 'draft',
    })
    .select('id')
    .single()

  if (forkError) return NextResponse.json({ error: forkError.message }, { status: 500 })

  return NextResponse.json({ id: fork.id }, { status: 201 })
}
