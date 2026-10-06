import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import * as perplexity from '@/lib/perplexity'
import * as googleAi from '@/lib/google-ai'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!perplexity.isConfigured() && !googleAi.isConfigured()) {
    return NextResponse.json(
      { error: 'service_unavailable', message: 'No AI citation API configured' },
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

  // Run Perplexity and Gemini checks in parallel
  const [perplexityResult, geminiResult] = await Promise.all([
    perplexity.isConfigured() ? perplexity.checkCitation(article.target_keyword, domain) : Promise.resolve(null),
    googleAi.isConfigured() ? googleAi.checkCitation(article.target_keyword, domain) : Promise.resolve(null),
  ])

  const checkedAt = new Date().toISOString()

  // Compute current week's Monday as week_start
  const now = new Date()
  const dayOfWeek = now.getUTCDay() // 0 = Sunday, 1 = Monday, …
  const daysSinceMonday = (dayOfWeek + 6) % 7 // shift so Monday = 0
  const weekStart = new Date(now)
  weekStart.setUTCDate(now.getUTCDate() - daysSinceMonday)
  const weekStartDate = weekStart.toISOString().slice(0, 10) // YYYY-MM-DD

  const serviceClient = createServiceClient()

  const engineResults: Array<{
    engine: string
    cited: boolean
    citationUrl: string | null
    sources: string[]
    checkedAt: string
  }> = []

  if (perplexityResult !== null) {
    // Write the raw citation check result to article_ai_citations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (serviceClient as any)
      .from('article_ai_citations')
      .insert({
        article_id: article.id,
        user_id: user.id,
        engine: 'perplexity',
        keyword: article.target_keyword,
        cited: perplexityResult.cited,
        citation_url: perplexityResult.citationUrl,
        sources: perplexityResult.sources,
        checked_at: checkedAt,
      })

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
          citations_found: perplexityResult.cited ? 1 : 0,
          updated_at: checkedAt,
        },
        {
          onConflict: 'article_id,engine,week_start',
          ignoreDuplicates: false,
        }
      )

    engineResults.push({
      engine: 'perplexity',
      cited: perplexityResult.cited,
      citationUrl: perplexityResult.citationUrl,
      sources: perplexityResult.sources,
      checkedAt,
    })
  }

  if (geminiResult !== null) {
    // Write the raw citation check result to article_ai_citations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (serviceClient as any)
      .from('article_ai_citations')
      .insert({
        article_id: article.id,
        user_id: user.id,
        engine: 'google_aio',
        keyword: article.target_keyword,
        cited: geminiResult.cited,
        citation_url: geminiResult.citationUrl,
        sources: geminiResult.sources,
        checked_at: checkedAt,
      })

    // Upsert the weekly summary row
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (serviceClient as any)
      .from('article_ai_visibility')
      .upsert(
        {
          article_id: article.id,
          user_id: user.id,
          engine: 'google_aio',
          week_start: weekStartDate,
          checks_run: 1,
          citations_found: geminiResult.cited ? 1 : 0,
          updated_at: checkedAt,
        },
        {
          onConflict: 'article_id,engine,week_start',
          ignoreDuplicates: false,
        }
      )

    engineResults.push({
      engine: 'google_aio',
      cited: geminiResult.cited,
      citationUrl: geminiResult.citationUrl,
      sources: geminiResult.sources,
      checkedAt,
    })
  }

  return NextResponse.json({ results: engineResults })
}
