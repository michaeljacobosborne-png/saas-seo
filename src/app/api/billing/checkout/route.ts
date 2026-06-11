import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe'

const PRICE_IDS: Record<string, Record<string, string>> = {
  starter: {
    monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY!,
    annual: process.env.STRIPE_PRICE_STARTER_ANNUAL!,
  },
  pro: {
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY!,
    annual: process.env.STRIPE_PRICE_PRO_ANNUAL!,
  },
  agency: {
    monthly: process.env.STRIPE_PRICE_AGENCY_MONTHLY!,
    annual: process.env.STRIPE_PRICE_AGENCY_ANNUAL!,
  },
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const body = await request.json() as { plan: string; interval: string }
    const { plan, interval } = body

    if (!PRICE_IDS[plan]?.[interval]) {
      return NextResponse.json({ error: 'Invalid plan or interval' }, { status: 400 })
    }

    const origin = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL

    // Anonymous visitors click "subscribe" on /pricing before they have an
    // account. Don't dead-end them with a 401 — return a signup URL (the client
    // just follows `url`) with the plan pre-selected. After they confirm their
    // email / finish OAuth, the auth callback routes new users back to /pricing
    // where they complete checkout, now authenticated. plan/interval are already
    // validated against PRICE_IDS above, so they're safe to put in the URL.
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ url: `${origin}/signup?plan=${plan}&interval=${interval}` })
    }

    // --- Duplicate-subscription guards ------------------------------------
    // A user whose first checkout *looked* like it failed (hung welcome page)
    // will click "subscribe" again and create a SECOND subscription on the same
    // email. Stop that here: if they're already provisioned, send them into the
    // app instead of opening another checkout.

    // 1) Already paid per our own profile → straight to the dashboard.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('account_type')
      .eq('user_id', user.id)
      .maybeSingle()
    if (profile?.account_type === 'paid') {
      return NextResponse.json({ url: `${origin}/dashboard` })
    }

    // 2) Active/trialing subscription row already exists → into the app.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: activeSub } = await (supabase as any)
      .from('subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing'])
      .limit(1)
      .maybeSingle()
    if (activeSub) {
      return NextResponse.json({ url: `${origin}/dashboard` })
    }

    const stripe = getStripe()

    // --- Resolve / reuse the Stripe customer ------------------------------
    // Prefer the id we've stored; otherwise look one up by email so we don't
    // create ghost duplicate customers; only create as a last resort.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingSub } = await (supabase as any)
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .not('stripe_customer_id', 'is', null)
      .limit(1)
      .maybeSingle()

    let customerId: string | undefined = existingSub?.stripe_customer_id

    if (!customerId && user.email) {
      const found = await stripe.customers.list({ email: user.email, limit: 1 })
      if (found.data.length) customerId = found.data[0].id
    }

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id },
      })
      customerId = customer.id
    }

    // 3) Stripe-side guard: if this customer already has a live subscription,
    // don't open another checkout. Self-heal our DB (the webhook may have failed
    // to flip account_type — exactly the bug that produced the duplicate) and
    // route the user into the app.
    const stripeSubs = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 10 })
    const hasLiveSub = stripeSubs.data.some(
      (s) => s.status === 'active' || s.status === 'trialing' || s.status === 'past_due',
    )
    if (hasLiveSub) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('profiles')
        .update({ account_type: 'paid' })
        .eq('user_id', user.id)
      return NextResponse.json({ url: `${origin}/dashboard` })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: PRICE_IDS[plan][interval], quantity: 1 }],
      success_url: `${origin}/welcome`,
      cancel_url: `${origin}/pricing`,
      allow_promotion_codes: true,
      metadata: { userId: user.id, plan, interval },
      subscription_data: {
        metadata: { userId: user.id, plan, interval },
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Checkout error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Checkout failed' },
      { status: 500 }
    )
  }
}
