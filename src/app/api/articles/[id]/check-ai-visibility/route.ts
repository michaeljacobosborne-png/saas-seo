import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isConfigured, checkCitation } from '@/lib/perplexity'

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

  // Fetch the user's website_url from brand_profiles
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: brandProfile } = await (supabase as any)
    .from('brand_profiles')
    .select('website_url')
    .eq('user_id', user.id)
    .maybeSingle()

  const websiteUrl: string | null = brandProfile?.website_url ?? null

  if (!websiteUrl) {
    return NextResponse.json(
      {
        error: 'no_domain',
        message: 'Add your website domain in Brand Profile settings to enable AI visibility tracking',
      },
      { status: 400 }
    )
  }

  // Extract hostname from the URL
  let domain: string
  try {
    domain = new URL(websiteUrl).hostname
  } catch {
    return NextResponse.json(
      {
        error: 'invalid_domain',
        message: 'Your website URL in Brand Profile settings is invalid. Please update it and try again.',
      },
      { status: 400 }
    )
  }

  // Call Perplexity to check if this article's keyword cites our domain
  const result = await checkCitation(article.target_keyword, domain)
  const checkedAt = new Date().toISOString()

  const serviceClient = createServiceClient()

  // Write the raw citation check result to article_ai_citations
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (serviceClient as any)
    .from('article_ai_citations')
    .insert({
      article_id: article.id,
      user_id: user.id,
      engine: 'perplexity',
      keyword: article.target_keyword,
      cited: result.cited,
      citation_url: result.citationUrl,
      sources: result.sources,
      checked_at: checkedAt,
    })

  // Compute current week's Monday as week_start
  const now = new Date()
  const dayOfWeek = now.getUTCDay() // 0 = Sunday, 1 = Monday, …
  const daysSinceMonday = (dayOfWeek + 6) % 7 // shift so Monday = 0
  const weekStart = new Date(now)
  weekStart.setUTCDate(now.getUTCDate() - daysSinceMonday)
  const weekStartDate = weekStart.toISOString().slice(0, 10) // YYYY-MM-DD

  // Upsert the weekly summary row
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (serviceClient as any)
    .from('article_ai_visibility')
    .upsert(
      {
        article_id: article.id,
        user_id: user.id,
        engine: 'perplexity',
        week_start: weekStartDate,
        checks_run: 1,
        citations_found: result.cited ? 1 : 0,
        updated_at: checkedAt,
      },
      {
        onConflict: 'article_id,engine,week_start',
        ignoreDuplicates: false,
      }
    )

  return NextResponse.json({
    cited: result.cited,
    citationUrl: result.citationUrl,
    sources: result.sources,
    engine: 'perplexity',
    checkedAt,
  })
}
