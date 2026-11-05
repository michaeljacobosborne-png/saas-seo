import { getStripe } from '@/lib/stripe'

// Internal plan key → billing interval → Stripe price id. Shared by the POST
// checkout API (client fetch) and the GET /api/billing/checkout-redirect route
// (browser 302 after email/OAuth confirmation), so both validate and price the
// same way.
export const CHECKOUT_PRICE_IDS: Record<string, Record<string, string>> = {
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
  starter_founder: {
    monthly: process.env.STRIPE_PRICE_STARTER_FOUNDER ?? '',
  },
  pro_founder: {
    monthly: process.env.STRIPE_PRICE_PRO_FOUNDER ?? '',
  },
}

export function isValidPlanInterval(plan: string | null | undefined, interval: string | null | undefined): boolean {
  return !!(plan && interval && CHECKOUT_PRICE_IDS[plan]?.[interval] && CHECKOUT_PRICE_IDS[plan][interval] !== '')
}

type CheckoutUser = { id: string; email?: string | null }

// Resolve the destination URL for an authenticated user's checkout request.
// Returns a Stripe Checkout session URL, OR an in-app URL when the user is
// already provisioned (the duplicate-subscription guards below). Throws on
// Stripe failure / a missing session URL so callers can surface an error.
//
// Caller MUST validate plan/interval with isValidPlanInterval first.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function resolveCheckoutUrl(
  supabase: any,
  user: CheckoutUser,
  plan: string,
  interval: string,
  origin: string,
): Promise<string> {
  // --- Duplicate-subscription guards ------------------------------------
  // A user whose first checkout *looked* like it failed (hung welcome page)
  // will click "subscribe" again and create a SECOND subscription on the same
  // email. Stop that here: if they're already provisioned, send them into the
  // app instead of opening another checkout.

  // 1) Already paid per our own profile → straight to the dashboard.
  const { data: profile } = await supabase
    .from('profiles')
    .select('account_type')
    .eq('user_id', user.id)
    .maybeSingle()
  if (profile?.account_type === 'paid') {
    return `${origin}/dashboard`
  }

  // 2) Active/trialing subscription row already exists → into the app.
  const { data: activeSub } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('user_id', user.id)
    .in('status', ['active', 'trialing'])
    .limit(1)
    .maybeSingle()
  if (activeSub) {
    return `${origin}/dashboard`
  }

  const stripe = getStripe()

  // --- Resolve / reuse the Stripe customer ------------------------------
  // Prefer the id we've stored; otherwise look one up by email so we don't
  // create ghost duplicate customers; only create as a last resort.
  const { data: existingSub } = await supabase
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
      email: user.email ?? undefined,
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
    await supabase
      .from('profiles')
      .update({ account_type: 'paid' })
      .eq('user_id', user.id)
    return `${origin}/dashboard`
  }

  const isFounder = plan.endsWith('_founder')
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: CHECKOUT_PRICE_IDS[plan][interval], quantity: 1 }],
    success_url: `${origin}/welcome`,
    cancel_url: `${origin}/pricing`,
    allow_promotion_codes: true,
    metadata: { userId: user.id, plan, interval, ...(isFounder ? { founder: 'true' } : {}) },
    subscription_data: {
      metadata: { userId: user.id, plan, interval, ...(isFounder ? { founder: 'true' } : {}) },
    },
  })

  if (!session.url) throw new Error('Stripe returned no checkout session URL')
  return session.url
}
