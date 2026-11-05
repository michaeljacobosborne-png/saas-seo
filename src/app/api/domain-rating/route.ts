import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchDomainRatings } from '@/lib/ahrefs'

export const runtime = 'nodejs'

// Returns Ahrefs Domain Rating for a comma-separated list of domains.
//   GET /api/domain-rating?domains=example.com,competitor.com
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const domains = (searchParams.get('domains') ?? '')
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean)
    .slice(0, 10)

  if (domains.length === 0) {
    return NextResponse.json({ ratings: {} })
  }

  const ratings = await fetchDomainRatings(domains)
  return NextResponse.json({ ratings })
}
