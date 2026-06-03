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
  team: {
    monthly: process.env.STRIPE_PRICE_AGENCY_MONTHLY!,
    annual: process.env.STRIPE_PRICE_AGENCY_ANNUAL!,
  },
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json() as { plan: string; interval: string }
    const { plan, interval } = body

    if (!PRICE_IDS[plan]?.[interval]) {
      return NextResponse.json({ error: 'Invalid plan or interval' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any

    // Look for any existing subscription row (with or without customer ID)
    const { data: existingSub } = await supabaseAny
      .from('subscriptions')
      .select('stripe_customer_id, id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    const stripe = getStripe()
    let customerId: string = existingSub?.stripe_customer_id ?? ''

    if (!customerId) {
      // Try email lookup in Stripe before creating a new customer
      if (user.email) {
        const existing = await stripe.customers.list({ email: user.email, limit: 1 })
        if (existing.data.length > 0) {
          customerId = existing.data[0].id
        }
      }
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: { userId: user.id },
        })
        customerId = customer.id
      }
    }

    // Immediately persist stripe_customer_id so the portal/sync always has it.
    // The webhook will fill in stripe_subscription_id and set status='active' later.
    if (existingSub?.id) {
      // Update existing row with the customer ID if it was missing
      if (!existingSub.stripe_customer_id) {
        await supabaseAny
          .from('subscriptions')
          .update({ stripe_customer_id: customerId, plan, billing_interval: interval })
          .eq('id', existingSub.id)
      }
    } else {
      // Insert a preliminary row — webhook will upsert on stripe_subscription_id later
      await supabaseAny
        .from('subscriptions')
        .insert({
          user_id: user.id,
          stripe_customer_id: customerId,
          plan,
          billing_interval: interval,
          status: 'trialing',
        })
    }

    const origin = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: PRICE_IDS[plan][interval], quantity: 1 }],
      success_url: `${origin}/welcome`,
      cancel_url: `${origin}/pricing`,
      allow_promotion_codes: true,
      metadata: { userId: user.id, plan, interval },
      subscription_data: {
        metadata: { userId: user.id },
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
