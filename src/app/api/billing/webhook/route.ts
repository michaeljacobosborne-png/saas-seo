import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/service'
import { sendMetaCapiEvent } from '@/lib/meta-capi'
import { sendGa4Purchase } from '@/lib/analytics-server'
import { subscriptionEventId } from '@/lib/analytics-events'
import { sendTelegramMessage, escapeMarkdown } from '@/lib/telegram'
import Stripe from 'stripe'

export const runtime = 'nodejs'

type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'trialing'

// Reverse-map a Stripe price id back to our internal plan/interval keys. The
// checkout event carries plan/interval in metadata, but later plan changes
// (e.g. an upgrade from Starter→Growth) only arrive as subscription.updated with
// NO metadata — so without this the stored `subscriptions.plan` is stuck at the
// originally-purchased tier and the Settings page shows the wrong plan. Built
// from the same env vars the checkout route uses to create sessions.
const PRICE_TO_PLAN: Record<string, { plan: string; interval: string }> = {}
for (const [plan, intervals] of Object.entries({
  starter: { monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY, annual: process.env.STRIPE_PRICE_STARTER_ANNUAL },
  pro: { monthly: process.env.STRIPE_PRICE_PRO_MONTHLY, annual: process.env.STRIPE_PRICE_PRO_ANNUAL },
  agency: { monthly: process.env.STRIPE_PRICE_AGENCY_MONTHLY, annual: process.env.STRIPE_PRICE_AGENCY_ANNUAL },
})) {
  for (const [interval, priceId] of Object.entries(intervals)) {
    if (priceId) PRICE_TO_PLAN[priceId] = { plan, interval }
  }
}

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

// Grant paid access. This is the single most important side effect of the whole
// webhook — if profiles.account_type stays 'free', the dashboard layout bounces
// the (paying) user to /pricing. Returns false on failure so the caller can
// respond non-200 and let Stripe retry the event. Idempotent: safe to re-run.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function grantPaidAccess(supabase: any, userId: string, ctx: Record<string, unknown>): Promise<boolean> {
  const { error } = await supabase
    .from('profiles')
    .upsert({ user_id: userId, account_type: 'paid' }, { onConflict: 'user_id' })
  if (error) {
    console.error('Webhook: failed to set account_type=paid', error, ctx)
    return false
  }
  return true
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

  // Set true if a *critical* DB write (granting access / persisting the
  // subscription) fails. We then return 500 so Stripe retries the event rather
  // than silently dropping it. Non-critical side effects (analytics, GHL) never
  // flip this — they swallow their own errors.
  let criticalFailure = false

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode !== 'subscription' || !session.subscription) break

      const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
      // Resolve the owning user. Prefer the checkout session metadata, fall back
      // to the subscription metadata (set via subscription_data.metadata at
      // checkout) so a missing session metadata field can't strand the user.
      const userId = session.metadata?.userId ?? (subscription.metadata?.userId as string | undefined)
      const plan = session.metadata?.plan
      const interval = session.metadata?.interval

      if (!userId) {
        console.error('Webhook checkout.session.completed: no userId in metadata', { sessionId: session.id })
        criticalFailure = true
        break
      }

      // Grant access FIRST, before anything that could fail or short-circuit.
      // NOTE: there is deliberately NO amount_total guard. A $0 first invoice
      // (free trial, 100% coupon) on a subscription is still a real signup and
      // must unlock the account.
      if (!(await grantPaidAccess(supabase, userId, { sessionId: session.id, source: 'checkout.session.completed' }))) {
        criticalFailure = true
      }

      // Persist the subscription row. Requires plan/interval (column NOT NULL),
      // so if that metadata is missing we log and skip the row — the user still
      // has access via account_type='paid' above, which the dashboard gate
      // accepts on its own.
      if (plan && interval) {
        const { error: upsertError } = await supabase.from('subscriptions').upsert({
          user_id: userId,
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: subscription.id,
          plan,
          billing_interval: interval,
          // Use the real status — a trial checkout lands as 'trialing', not 'active'.
          status: mapStripeStatus(subscription.status) ?? 'active',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end,
        }, { onConflict: 'stripe_subscription_id' })

        if (upsertError) {
          console.error('Webhook checkout.session.completed: failed to upsert subscription', upsertError, { userId, sessionId: session.id })
          criticalFailure = true
        }
      } else {
        console.error('Webhook checkout.session.completed: missing plan/interval metadata; subscription row not written', { userId, plan, interval, sessionId: session.id })
      }

      // Telegram ping so we see paid signups in real time. Best-effort: wrapped
      // so a Stripe API hiccup (line-item/coupon lookup) can't stop us returning
      // 200, and sendTelegramMessage already swallows its own errors.
      try {
        const customerEmail = session.customer_details?.email ?? session.customer_email ?? 'unknown'
        const customerName = session.customer_details?.name ?? ''

        // Re-fetch the session with line items + the applied coupon expanded; the
        // raw webhook payload carries neither, so the plan name and any coupon
        // would otherwise be invisible.
        const full = await stripe.checkout.sessions.retrieve(session.id, {
          expand: ['line_items', 'discounts.coupon'],
        })
        const planName = full.line_items?.data[0]?.description ?? plan ?? 'Unknown plan'
        const couponNames = (full.discounts ?? [])
          .map((d) => {
            const coupon = d.coupon
            if (!coupon) return null
            return typeof coupon === 'string' ? coupon : (coupon.name ?? coupon.id)
          })
          .filter((name): name is string => Boolean(name))
        const couponUsed = couponNames.length ? couponNames.join(', ') : null

        await sendTelegramMessage(
          [
            '🎉 *New Byline subscriber*',
            `👤 ${escapeMarkdown(customerName || customerEmail)}`,
            `📧 ${escapeMarkdown(customerEmail)}`,
            `💳 ${escapeMarkdown(planName)}`,
            couponUsed ? `🏷️ Coupon: ${escapeMarkdown(couponUsed)}` : null,
          ]
            .filter(Boolean)
            .join('\n'),
        )
      } catch (telegramErr) {
        console.error('Webhook checkout.session.completed: telegram notify failed', telegramErr)
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
            plan: plan ?? 'unknown',
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

    // Safety net for the case the user just hit: checkout.session.completed was
    // missed or its DB writes failed. These events fire for every new/changed
    // subscription and carry subscription_data.metadata.userId, so they let us
    // grant access (and keep status in sync) independently of the checkout event.
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const status = mapStripeStatus(subscription.status)
      if (!status) break

      // Resolve the current plan from the subscription's active price so an
      // upgrade/downgrade keeps `subscriptions.plan` accurate (these events carry
      // no plan metadata). If the price isn't recognised we leave plan untouched.
      const priceId = subscription.items?.data?.[0]?.price?.id
      const planInfo = priceId ? PRICE_TO_PLAN[priceId] : undefined

      // Update our row if we already have it (no-op / 0 rows on subscription.created,
      // which is fine — the checkout event writes the row).
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          status,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end,
          ...(planInfo ? { plan: planInfo.plan, billing_interval: planInfo.interval } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', subscription.id)

      if (updateError) {
        console.error('Webhook customer.subscription.*: failed to update subscription', updateError, { subscriptionId: subscription.id })
        criticalFailure = true
      }

      // Ensure account_type tracks a live subscription. Resolve the user from
      // the subscription metadata, falling back to our own table.
      if (status === 'active' || status === 'trialing') {
        let userId = subscription.metadata?.userId as string | undefined
        if (!userId) {
          const { data: row } = await supabase
            .from('subscriptions')
            .select('user_id')
            .eq('stripe_subscription_id', subscription.id)
            .maybeSingle()
          userId = row?.user_id
        }
        if (userId) {
          if (!(await grantPaidAccess(supabase, userId, { subscriptionId: subscription.id, source: event.type }))) {
            criticalFailure = true
          }
        } else {
          console.error('Webhook customer.subscription.*: could not resolve userId to grant access', { subscriptionId: subscription.id })
        }
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

      const { error: cancelError } = await supabase
        .from('subscriptions')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('stripe_subscription_id', subscription.id)
      if (cancelError) {
        console.error('Webhook customer.subscription.deleted: failed to mark cancelled', cancelError, { subscriptionId: subscription.id })
        criticalFailure = true
      }

      // Sync account_type back to 'free' on cancellation so Assist mode is
      // re-gated for the lapsed subscriber. Resolve the user id from metadata if
      // our row lookup came up empty.
      const userId = (subRow?.user_id as string | undefined) ?? (subscription.metadata?.userId as string | undefined)
      if (userId) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ account_type: 'free' })
          .eq('user_id', userId)

        if (profileError) {
          console.error('Webhook customer.subscription.deleted: failed to downgrade account_type', profileError, { userId, subscriptionId: subscription.id })
          criticalFailure = true
        }

        // Tag the contact as cancelled in GoHighLevel. Email isn't stored on
        // profiles (it lives in auth.users), so resolve it via the admin API
        // using the user id we just looked up. Non-blocking.
        const { data: authUser, error: authErr } = await supabase.auth.admin.getUserById(userId)
        if (authErr) {
          console.error('Webhook customer.subscription.deleted: failed to look up email', authErr, { userId })
        }
        await sendGhlWebhook({
          email: authUser?.user?.email ?? '',
          tags: ['byline-cancelled'],
          customField: {
            plan: 'cancelled',
            byline_user_id: userId,
          },
          source: 'byline-stripe',
        })
      } else {
        console.error('Webhook customer.subscription.deleted: no user to downgrade', { subscriptionId: subscription.id })
      }
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subId = (invoice as any).subscription
      if (!subId) break
      const { error: pastDueError } = await supabase
        .from('subscriptions')
        .update({ status: 'past_due', updated_at: new Date().toISOString() })
        .eq('stripe_subscription_id', subId)
      if (pastDueError) {
        console.error('Webhook invoice.payment_failed: failed to mark past_due', pastDueError, { subscriptionId: subId })
        criticalFailure = true
      }
      break
    }
  }

  if (criticalFailure) {
    // Non-200 tells Stripe to retry the event (it backs off over ~3 days). Our
    // handlers are idempotent, so a retry safely re-attempts the failed write.
    return NextResponse.json({ error: 'Webhook processing failed; will retry' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
