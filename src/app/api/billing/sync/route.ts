import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe'
import Stripe from 'stripe'

// Maps Stripe price IDs to plan names — populated from env at request time
function getPriceToPlan(): Record<string, string> {
  const map: Record<string, string> = {}
  const entries = [
    [process.env.STRIPE_PRICE_STARTER_MONTHLY, 'starter'],
    [process.env.STRIPE_PRICE_STARTER_ANNUAL, 'starter'],
    [process.env.STRIPE_PRICE_PRO_MONTHLY, 'pro'],
    [process.env.STRIPE_PRICE_PRO_ANNUAL, 'pro'],
    [process.env.STRIPE_PRICE_AGENCY_MONTHLY, 'team'],
    [process.env.STRIPE_PRICE_AGENCY_ANNUAL, 'team'],
  ] as const
  for (const [id, plan] of entries) {
    if (id) map[id] = plan
  }
  return map
}

function mapStatus(status: Stripe.Subscription.Status): string {
  switch (status) {
    case 'active': return 'active'
    case 'trialing': return 'trialing'
    case 'past_due': return 'past_due'
    case 'canceled': return 'canceled'
    default: return 'active'
  }
}

/**
 * POST /api/billing/sync
 * Fetches the user's Stripe subscriptions directly and upserts them into Supabase.
 * Called by the welcome page after checkout completes, and by the Settings "Refresh" button.
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const stripe = getStripe()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseAny = supabase as any

  // Find the Stripe customer — try DB first, then fall back to email lookup
  let customerId: string | null = null

  const { data: existingSub } = await supabaseAny
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .not('stripe_customer_id', 'is', null)
    .limit(1)
    .maybeSingle()

  customerId = (existingSub?.stripe_customer_id as string | null) ?? null

  if (!customerId && user.email) {
    const customers = await stripe.customers.list({ email: user.email, limit: 1 })
    if (customers.data.length > 0) {
      customerId = customers.data[0].id
    }
  }

  if (!customerId) {
    return NextResponse.json({ synced: false, reason: 'No Stripe customer found for this account' })
  }

  // Fetch all non-draft subscriptions for this customer
  const stripeSubscriptions = await stripe.subscriptions.list({
    customer: customerId,
    limit: 5,
    expand: ['data.items.data.price'],
  })

  if (stripeSubscriptions.data.length === 0) {
    return NextResponse.json({ synced: false, reason: 'No subscriptions found in Stripe' })
  }

  const priceToPlan = getPriceToPlan()
  let synced = 0

  for (const sub of stripeSubscriptions.data) {
    const priceId = sub.items.data[0]?.price?.id ?? null
    const plan = (priceId && priceToPlan[priceId]) ? priceToPlan[priceId] : null
    const interval = sub.items.data[0]?.price?.recurring?.interval === 'year' ? 'annual' : 'monthly'
    const status = mapStatus(sub.status)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const currentPeriodEnd = new Date((sub as any).current_period_end * 1000).toISOString()

    // Build the upsert payload — only include plan if we could map it
    // (avoids overwriting with wrong value if price ID isn't in env vars)
    const payload: Record<string, unknown> = {
      user_id: user.id,
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      billing_interval: interval,
      status,
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: sub.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    }
    if (plan) payload.plan = plan

    const { error } = await supabaseAny
      .from('subscriptions')
      .upsert(payload, { onConflict: 'stripe_subscription_id' })

    if (error) {
      console.error('[billing/sync] upsert error:', JSON.stringify(error))
      return NextResponse.json({ synced: false, reason: `DB error: ${error.message}` }, { status: 500 })
    }

    synced++
  }

  // Clean up any dangling preliminary rows (from checkout pre-write) that have no subscription ID
  await supabaseAny
    .from('subscriptions')
    .delete()
    .eq('user_id', user.id)
    .is('stripe_subscription_id', null)

  return NextResponse.json({ synced: true, count: synced })
}
