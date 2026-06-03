import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe'
import Stripe from 'stripe'

function getPriceToPlan(): Record<string, string> {
  const map: Record<string, string> = {}
  const entries: [string | undefined, string][] = [
    [process.env.STRIPE_PRICE_STARTER_MONTHLY, 'starter'],
    [process.env.STRIPE_PRICE_STARTER_ANNUAL, 'starter'],
    [process.env.STRIPE_PRICE_PRO_MONTHLY, 'pro'],
    [process.env.STRIPE_PRICE_PRO_ANNUAL, 'pro'],
    [process.env.STRIPE_PRICE_AGENCY_MONTHLY, 'team'],
    [process.env.STRIPE_PRICE_AGENCY_ANNUAL, 'team'],
  ]
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

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any
    const stripe = getStripe()

    // Step 1: find Stripe customer ID — try DB first, then email lookup
    let customerId: string | null = null

    const { data: existingSub } = await supabaseAny
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    customerId = (existingSub?.stripe_customer_id as string | null) ?? null

    if (!customerId) {
      if (!user.email) {
        return NextResponse.json({ synced: false, reason: 'No email on account — cannot look up Stripe customer' })
      }
      let customers: Stripe.ApiList<Stripe.Customer>
      try {
        customers = await stripe.customers.list({ email: user.email, limit: 1 })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return NextResponse.json({ synced: false, reason: `Stripe customer lookup failed: ${msg}` }, { status: 500 })
      }
      if (customers.data.length === 0) {
        return NextResponse.json({ synced: false, reason: 'No Stripe customer found for this email address' })
      }
      customerId = customers.data[0].id
    }

    // Step 2: list their Stripe subscriptions
    let stripeSubscriptions: Stripe.ApiList<Stripe.Subscription>
    try {
      stripeSubscriptions = await stripe.subscriptions.list({
        customer: customerId,
        limit: 5,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return NextResponse.json({ synced: false, reason: `Stripe subscription lookup failed: ${msg}` }, { status: 500 })
    }

    if (stripeSubscriptions.data.length === 0) {
      return NextResponse.json({ synced: false, reason: 'No subscriptions found in Stripe for this customer' })
    }

    const priceToPlan = getPriceToPlan()
    let synced = 0

    for (const sub of stripeSubscriptions.data) {
      // Fetch price details separately to avoid expand issues
      let priceId: string | null = null
      let interval: 'monthly' | 'annual' = 'monthly'
      try {
        const firstItem = sub.items?.data?.[0]
        if (firstItem?.price?.id) {
          priceId = firstItem.price.id
          interval = firstItem.price.recurring?.interval === 'year' ? 'annual' : 'monthly'
        }
      } catch {
        // price details unavailable — continue without them
      }

      const plan = (priceId && priceToPlan[priceId]) ? priceToPlan[priceId] : null
      const status = mapStatus(sub.status)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawPeriodEnd = (sub as any).current_period_end
      const currentPeriodEnd = rawPeriodEnd ? new Date(rawPeriodEnd * 1000).toISOString() : null

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
      // Only write plan if we could map it — avoids overwriting with wrong value
      if (plan) payload.plan = plan

      const { error } = await supabaseAny
        .from('subscriptions')
        .upsert(payload, { onConflict: 'stripe_subscription_id' })

      if (error) {
        console.error('[billing/sync] upsert error:', JSON.stringify(error))
        return NextResponse.json({ synced: false, reason: `DB write failed: ${error.message}` }, { status: 500 })
      }

      synced++
    }

    // Clean up dangling preliminary rows that have no stripe_subscription_id
    await supabaseAny
      .from('subscriptions')
      .delete()
      .eq('user_id', user.id)
      .is('stripe_subscription_id', null)

    return NextResponse.json({ synced: true, count: synced })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[billing/sync] unhandled error:', msg)
    return NextResponse.json({ synced: false, reason: `Unexpected error: ${msg}` }, { status: 500 })
  }
}
