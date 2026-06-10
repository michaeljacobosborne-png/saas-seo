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

// Split a full name from Stripe customer_details into first/last. Stripe gives
// a single free-text name field, so we treat the first token as the first name
// and the remainder as the last name.
function splitName(name: string | null | undefined): { firstName: string; lastName: string } {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: '', lastName: '' }
  const [firstName, ...rest] = parts
  return { firstName, lastName: rest.join(' ') }
}

// Fire-and-await a contact webhook to GoHighLevel. Non-blocking by contract:
// it never throws, so a GHL outage can't stop us returning 200 to Stripe
// (which would otherwise trigger Stripe webhook retries). Skips silently when
// GHL_WEBHOOK_URL is unset so local dev without the var keeps working.
async function sendGhlWebhook(payload: Record<string, unknown>): Promise<void> {
  const url = process.env.GHL_WEBHOOK_URL
  if (!url) return

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      console.error('GHL webhook returned non-OK status', { status: res.status, email: payload.email })
    }
  } catch (err) {
    console.error('GHL webhook error', err, { email: payload.email })
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

      // Sync account_type to 'paid' on successful subscribe. Without this,
      // profiles.account_type stays 'free' and paying users are blocked from
      // Assist mode (which gates on account_type !== 'free'). The user id comes
      // from session.metadata.userId — that's how checkout passes it (see
      // /api/billing/checkout) — and is guaranteed non-null after the guard above.
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({ user_id: userId, account_type: 'paid' }, { onConflict: 'user_id' })

      if (profileError) {
        console.error('Webhook checkout.session.completed: failed to sync account_type', profileError, { userId, sessionId: session.id })
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

      // Create/refresh the contact in GoHighLevel so the onboarding sequence
      // fires there. Non-blocking — sendGhlWebhook swallows its own errors.
      const ghlEmail = session.customer_details?.email ?? session.customer_email ?? ''
      const { firstName, lastName } = splitName(session.customer_details?.name)
      await sendGhlWebhook({
        email: ghlEmail,
        firstName,
        lastName,
        phone: '',
        tags: ['byline-subscriber', `plan-${plan}`],
        customField: {
          plan,
          byline_user_id: userId,
        },
        source: 'byline-stripe',
      })
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

      // Look up the owning user before updating, so we can also downgrade their
      // account_type back to 'free'.
      const { data: subRow } = await supabase
        .from('subscriptions')
        .select('user_id')
        .eq('stripe_subscription_id', subscription.id)
        .maybeSingle()

      await supabase
        .from('subscriptions')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('stripe_subscription_id', subscription.id)

      // Sync account_type back to 'free' on cancellation so Assist mode is
      // re-gated for the lapsed subscriber.
      if (subRow?.user_id) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ account_type: 'free' })
          .eq('user_id', subRow.user_id)

        if (profileError) {
          console.error('Webhook customer.subscription.deleted: failed to downgrade account_type', profileError, { userId: subRow.user_id, subscriptionId: subscription.id })
        }

        // Tag the contact as cancelled in GoHighLevel. Email isn't stored on
        // profiles (it lives in auth.users), so resolve it via the admin API
        // using the user id we just looked up. Non-blocking.
        const { data: authUser, error: authErr } = await supabase.auth.admin.getUserById(subRow.user_id)
        if (authErr) {
          console.error('Webhook customer.subscription.deleted: failed to look up email', authErr, { userId: subRow.user_id })
        }
        await sendGhlWebhook({
          email: authUser?.user?.email ?? '',
          tags: ['byline-cancelled'],
          customField: {
            plan: 'cancelled',
            byline_user_id: subRow.user_id,
          },
          source: 'byline-stripe',
        })
      } else {
        console.error('Webhook customer.subscription.deleted: no subscription row found to downgrade', { subscriptionId: subscription.id })
      }
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
