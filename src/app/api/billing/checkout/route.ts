import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isValidPlanInterval, resolveCheckoutUrl } from '@/lib/checkout'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const body = await request.json() as { plan: string; interval: string }
    const { plan, interval } = body

    if (!isValidPlanInterval(plan, interval)) {
      return NextResponse.json({ error: 'Invalid plan or interval' }, { status: 400 })
    }

    const origin = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? ''

    // Anonymous visitors click "subscribe" on /pricing before they have an
    // account. Don't dead-end them with a 401 — return a signup URL (the client
    // just follows `url`) with the plan pre-selected. The signup form carries
    // plan/interval through email confirmation / OAuth so the auth callback can
    // drop them straight into Stripe checkout. plan/interval are validated above.
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ url: `${origin}/signup?plan=${plan}&interval=${interval}` })
    }

    const url = await resolveCheckoutUrl(supabase, user, plan, interval, origin)
    return NextResponse.json({ url })
  } catch (err) {
    console.error('Checkout error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Checkout failed' },
      { status: 500 }
    )
  }
}
