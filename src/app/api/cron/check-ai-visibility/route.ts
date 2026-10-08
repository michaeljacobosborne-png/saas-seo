import { NextResponse } from 'next/server'
import { isConfigured } from '@/lib/perplexity'

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization')
  const expected = `Bearer ${process.env.CRON_SECRET}`
  if (authHeader !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isConfigured()) {
    return NextResponse.json(
      { error: 'service_unavailable', message: 'Perplexity API not configured' },
      { status: 503 }
    )
  }

  // TODO: implement main citation-check loop once brand_profiles.domain column is available.
  // The loop should:
  //   1. Use the service client to fetch all complete articles with an associated brand_profile
  //      that has a non-null domain field
  //   2. For each article, call checkCitation(article.target_keyword, brand.domain)
  //   3. Insert into article_ai_citations with engine = 'perplexity'
  //   4. Upsert into article_ai_visibility keyed on (article_id, 'perplexity', week_start)
  //   5. Respect rate limits — add a short delay between Perplexity API calls

  return NextResponse.json({
    message: 'AI citation cron ready — awaiting domain field migration',
    checked: 0,
  })
}
