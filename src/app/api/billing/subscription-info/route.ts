import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ status: null, plan_name: null, current_period_end: null })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('subscriptions')
    .select('status, plan_name, current_period_end')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({
    status: data?.status ?? null,
    plan_name: data?.plan_name ?? null,
    current_period_end: data?.current_period_end ?? null,
  })
}
