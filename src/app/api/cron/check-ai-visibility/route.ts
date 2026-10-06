import { NextResponse } from 'next/server'
import * as perplexity from '@/lib/perplexity'
import * as googleAi from '@/lib/google-ai'

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization')
  const expected = `Bearer ${process.env.CRON_SECRET}`
  if (authHeader !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!perplexity.isConfigured() && !googleAi.isConfigured()) {
    return NextResponse.json(
      { error: 'service_unavailable', message: 'No AI citation API configured' },
      { status: 503 }
    )
  }

  // TODO: implement main citation-check loop once brand_profiles.domain column is available.
  // The loop should:
  //   1. Use the service client to fetch all complete articles with an associated brand_profile
  //      that has a non-null domain field
  //   2. For each article, run both engines in parallel:
  //      const [perplexityResult, geminiResult] = await Promise.all([
  //        perplexity.isConfigured() ? perplexity.checkCitation(article.target_keyword, domain) : Promise.resolve(null),
  //        googleAi.isConfigured() ? googleAi.checkCitation(article.target_keyword, domain) : Promise.resolve(null),
  //      ])
  //   3. For each non-null result, insert into article_ai_citations with the appropriate engine
  //      ('perplexity' or 'google_aio')
  //   4. Upsert into article_ai_visibility keyed on (article_id, engine, week_start)
  //   5. Respect rate limits — add a short delay between API call batches

  return NextResponse.json({
    message: 'AI citation cron ready — awaiting domain field migration',
    checked: 0,
  })
}
