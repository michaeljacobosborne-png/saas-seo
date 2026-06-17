import { type EmailOtpType } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null

  // A paid signup carries the chosen plan/interval through confirmation. When
  // present, drop the user straight into Stripe checkout instead of /pricing or
  // /dashboard. The checkout-redirect route validates the params and creates the
  // session for the now-authenticated user.
  const plan = searchParams.get('plan')
  const interval = searchParams.get('interval')
  const checkoutRedirect = plan && interval
    ? `${origin}/api/billing/checkout-redirect?plan=${encodeURIComponent(plan)}&interval=${encodeURIComponent(interval)}`
    : null

  if (token_hash && type) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (!error && data.user) {
      // Paid signup: carry the chosen plan straight into Stripe checkout.
      if (checkoutRedirect) {
        return NextResponse.redirect(checkoutRedirect)
      }

      // Otherwise route by account type, mirroring the OAuth (code) branch below:
      // free-tier users land in the app; paid users with no sub yet go to pricing.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: sub } = await (supabase as any)
        .from('subscriptions')
        .select('id')
        .eq('user_id', data.user.id)
        .in('status', ['active', 'trialing'])
        .limit(1)
        .maybeSingle()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile } = await (supabase as any)
        .from('profiles')
        .select('account_type')
        .eq('user_id', data.user.id)
        .maybeSingle()

      const isFree = profile?.account_type === 'free'
      const hasSub = !!sub

      if (!hasSub && !isFree) {
        return NextResponse.redirect(`${origin}/pricing`)
      }

      return NextResponse.redirect(`${origin}/dashboard`)
    }
    return NextResponse.redirect(`${origin}/login?error=confirmation_failed`)
  }

  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {
      // Paid signup (OAuth): go straight to checkout with the carried plan.
      if (checkoutRedirect) {
        return NextResponse.redirect(checkoutRedirect)
      }

      // Check if this user has an active subscription
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: sub } = await (supabase as any)
        .from('subscriptions')
        .select('id')
        .eq('user_id', data.user.id)
        .in('status', ['active', 'trialing'])
        .limit(1)
        .maybeSingle()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile } = await (supabase as any)
        .from('profiles')
        .select('account_type')
        .eq('user_id', data.user.id)
        .maybeSingle()

      const isFree = profile?.account_type === 'free'
      const hasSub = !!sub

      // New users (no sub, not free) go to pricing; existing users go to next
      if (!hasSub && !isFree) {
        return NextResponse.redirect(`${origin}/pricing`)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
