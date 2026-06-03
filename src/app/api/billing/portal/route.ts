import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const stripe = getStripe()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseAny = supabase as any

  // Try to find a subscription row with a stripe_customer_id
  const { data: sub } = await supabaseAny
    .from('subscriptions')
    .select('stripe_customer_id, stripe_subscription_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  let customerId = (sub?.stripe_customer_id as string | null) ?? null

  // Fallback: look up customer by email in Stripe
  if (!customerId && user.email) {
    const customers = await stripe.customers.list({ email: user.email, limit: 1 })
    if (customers.data.length > 0) {
      customerId = customers.data[0].id

      // If we found a customer, also try to sync their active subscription into the DB
      if (sub) {
        // Just update customer_id on the existing row
        await supabaseAny
          .from('subscriptions')
          .update({ stripe_customer_id: customerId })
          .eq('user_id', user.id)
      } else {
        // Try to find their active subscription in Stripe and insert
        const subscriptions = await stripe.subscriptions.list({
          customer: customerId,
          status: 'active',
          limit: 1,
        })
        if (subscriptions.data.length > 0) {
          const stripeSub = subscriptions.data[0]
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const priceId = (stripeSub as any).items?.data?.[0]?.price?.id as string | undefined
          await supabaseAny.from('subscriptions').upsert({
            user_id: user.id,
            stripe_customer_id: customerId,
            stripe_subscription_id: stripeSub.id,
            stripe_price_id: priceId ?? null,
            status: 'active',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            current_period_end: new Date((stripeSub as any).current_period_end * 1000).toISOString(),
          }, { onConflict: 'user_id' })
        }
      }
    }
  }

  if (!customerId) {
    return NextResponse.json({ error: 'No billing account found. Please contact support.' }, { status: 404 })
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.bylineseo.com'}/settings`,
  })

  return NextResponse.json({ url: session.url })
}
