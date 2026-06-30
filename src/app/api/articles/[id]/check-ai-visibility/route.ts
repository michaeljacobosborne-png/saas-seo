import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isConfigured } from '@/lib/perplexity'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isConfigured()) {
    return NextResponse.json(
      { error: 'service_unavailable', message: 'Perplexity API not configured' },
      { status: 503 }
    )
  }

  const { id } = await params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: article } = await (supabase as any)
    .from('articles')
    .select('id, target_keyword, status, brand_profile_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!article) return NextResponse.json({ error: 'Article not found' }, { status: 404 })

  if (article.status !== 'complete') {
    return NextResponse.json(
      { error: 'article_not_complete', message: 'AI visibility tracking requires a completed article' },
      { status: 400 }
    )
  }

  // TODO: fetch brand_profiles.domain once the domain column is added via migration.
  // For now, return a clear message guiding the user to add their domain.
  // When domain is available, the flow should be:
  //   1. Fetch brand_profiles where id = article.brand_profile_id and user_id = user.id
  //   2. Extract the domain field
  //   3. Call checkCitation(article.target_keyword, domain)
  //   4. Insert into article_ai_citations with engine = 'perplexity'
  //   5. Upsert into article_ai_visibility with the current week_start
  //   6. Return { cited, citationUrl, sources }

  return NextResponse.json(
    {
      error: 'no_domain',
      message: 'Add your website domain in Brand Profile settings to enable AI visibility tracking',
    },
    { status: 400 }
  )
}
