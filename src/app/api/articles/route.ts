import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: articles, error } = await (supabase as any)
    .from('articles')
    .select('id, title, target_keyword, status, word_count, scores, brief, created_at, updated_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ articles: articles ?? [] })
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseAny = supabase as any

  const { data: profile } = await supabaseAny
    .from('profiles')
    .select('account_type')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profile?.account_type === 'free') {
    const { count } = await supabaseAny
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if ((count ?? 0) >= 1) {
      return NextResponse.json({
        error: "You've used your free article. Upgrade to write unlimited articles.",
        code: 'FREE_TIER_LIMIT',
      }, { status: 403 })
    }
  }

  const { data: article, error } = await supabaseAny
    .from('articles')
    .insert({ user_id: user.id })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ articleId: article.id }, { status: 201 })
}
