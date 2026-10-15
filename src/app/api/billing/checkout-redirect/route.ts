import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isValidPlanInterval, resolveCheckoutUrl } from '@/lib/checkout'

export const runtime = 'nodejs'

// Browser-facing GET entry point used by /auth/callback after email/OAuth
// confirmation: it creates the Stripe checkout session for the now-authenticated
// user and 302-redirects straight to Stripe, so a new subscriber lands in
// checkout the moment they confirm — no second click on /pricing.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const plan = searchParams.get('plan')
  const interval = searchParams.get('interval')

  // Bad/missing params → just show pricing rather than erroring at the browser.
  if (!isValidPlanInterval(plan, interval)) {
    return NextResponse.redirect(`${origin}/pricing`)
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Session not established yet (e.g. confirmation link opened in a different
  // browser). Send them to sign in, preserving the plan so they resume after.
  if (!user) {
    return NextResponse.redirect(`${origin}/login?plan=${plan}&interval=${interval}`)
  }

  try {
    const url = await resolveCheckoutUrl(supabase, user, plan as string, interval as string, origin)
    return NextResponse.redirect(url)
  } catch (err) {
    console.error('checkout-redirect error:', err)
    return NextResponse.redirect(`${origin}/pricing?error=checkout_failed`)
  }
}
