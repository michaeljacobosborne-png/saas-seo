import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildDraftReport } from '@/lib/geo-audit/draft-report'
import { authorFromProfile } from '@/lib/article-scores'

/**
 * Draft-time report for an article (paid engine, phases 1–2 of
 * docs/paid-engine-spec.md). Deterministic, no model call, no fetch, nothing
 * persisted — safe to call on every save. Not yet shown in the editor: that is
 * phase 3, which waits on the product decisions in the spec's §7.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const { data: article } = await sb
    .from('articles')
    .select('id, title, content, brand_profile_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!article) return NextResponse.json({ error: 'Article not found' }, { status: 404 })

  const brandQuery = sb.from('brand_profiles').select('*').eq('user_id', user.id)
  const { data: brand } = await (article.brand_profile_id ? brandQuery.eq('id', article.brand_profile_id) : brandQuery.limit(1)).maybeSingle()

  const report = buildDraftReport({
    markdown: article.content ?? '',
    articleId: article.id,
    title: article.title,
    siteUrl: brand?.website_url ?? null,
    brandName: brand?.brand_name ?? null,
    author: authorFromProfile(brand),
    now: new Date(),
  })

  return NextResponse.json(report)
}
