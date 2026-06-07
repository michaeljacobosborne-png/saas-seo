import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/service'
import { sendMetaCapiEvent } from '@/lib/meta-capi'
import { sendGa4Purchase } from '@/lib/analytics-server'
import { subscriptionEventId } from '@/lib/analytics-events'
import Stripe from 'stripe'

export const runtime = 'nodejs'

type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'trialing'

function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus | null {
  switch (status) {
    case 'active': return 'active'
    case 'past_due': return 'past_due'
    case 'canceled': return 'cancelled'
    case 'trialing': return 'trialing'
    default: return null
  }
}

export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  const stripe = getStripe()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Webhook error: ${msg}` }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode !== 'subscription' || !session.subscription) break

      const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
      const userId = session.metadata?.userId
      const plan = session.metadata?.plan
      const interval = session.metadata?.interval

      if (!userId || !plan || !interval) {
        console.error('Webhook checkout.session.completed: missing metadata', { userId, plan, interval, sessionId: session.id })
        break
      }

      const { error: upsertError } = await supabase.from('subscriptions').upsert({
        user_id: userId,
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: subscription.id,
        plan,
        billing_interval: interval,
        status: 'active',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end,
      }, { onConflict: 'stripe_subscription_id' })

      if (upsertError) {
        console.error('Webhook checkout.session.completed: failed to upsert subscription', upsertError, { userId, sessionId: session.id })
      }

      // Server-side conversion tracking. Wrapped so analytics failures never
      // prevent us returning 200 to Stripe (which would trigger retries).
      try {
        const value = (session.amount_total ?? 0) / 100
        const currency = (session.currency ?? 'usd').toUpperCase()
        const email = session.customer_details?.email ?? session.customer_email ?? undefined

        await Promise.allSettled([
          // GA4 `purchase` via Measurement Protocol. No browser client_id is
          // available here, so we key on the user id.
          sendGa4Purchase({
            clientId: userId,
            userId,
            value,
            currency,
            transactionId: subscription.id,
            plan,
          }),
          // Meta `Subscribe` via the Conversions API. Same event_id as the
          // browser Pixel event fired on /welcome, so Meta deduplicates.
          sendMetaCapiEvent({
            eventName: 'Subscribe',
            eventId: subscriptionEventId(subscription.id),
            email,
            value,
            currency,
          }),
        ])
      } catch (analyticsErr) {
        console.error('Webhook checkout.session.completed: analytics error', analyticsErr)
      }
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const status = mapStripeStatus(subscription.status)
      if (!status) break

      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          status,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end,
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', subscription.id)

      if (updateError) {
        console.error('Webhook customer.subscription.updated: failed to update subscription', updateError, { subscriptionId: subscription.id })
      }
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      await supabase
        .from('subscriptions')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('stripe_subscription_id', subscription.id)
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subId = (invoice as any).subscription
      if (!subId) break
      await supabase
        .from('subscriptions')
        .update({ status: 'past_due', updated_at: new Date().toISOString() })
        .eq('stripe_subscription_id', subId)
      break
    }
  }

  return NextResponse.json({ received: true })
}
