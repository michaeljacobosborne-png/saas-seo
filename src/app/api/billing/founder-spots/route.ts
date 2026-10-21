import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

const FOUNDER_CAP = 100

export async function GET() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count, error } = await (createServiceClient() as any)
    .from('subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('is_founder', true)
    .in('status', ['active', 'trialing'])

  if (error) return NextResponse.json({ available: false, used: 0, total: FOUNDER_CAP, remaining: 0 })

  const used = count ?? 0
  return NextResponse.json({
    available: used < FOUNDER_CAP,
    used,
    total: FOUNDER_CAP,
    remaining: Math.max(0, FOUNDER_CAP - used),
  })
}
