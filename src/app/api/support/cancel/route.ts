import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getStripe } from '@/lib/stripe'
import { getAvailability } from '@/lib/availability'
import { sendEmail } from '@/lib/email'
import { getAccountInfo, escalateToMichael, logTicket } from '@/lib/support'

export const runtime = 'nodejs'

/**
 * Cancel a subscription at the end of the current billing period.
 *
 * Refund policy (per product owner + KB): refunds are NEVER auto-promised or auto-issued
 * here. If the user explicitly requests a refund, we cancel + escalate the request to
 * Michael (with 30-day-window eligibility noted), and he processes it manually. The user is
 * told their request was passed on — not that a refund "will" happen.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { reason?: string; refundRequested?: boolean }
  try {
    body = (await request.json().catch(() => ({}))) as { reason?: string; refundRequested?: boolean }
  } catch {
    body = {}
  }
  const reason = (body.reason ?? '').toString().slice(0, 1000)
  const refundRequested = body.refundRequested === true

  const account = await getAccountInfo(supabase, user)
  if (!account.stripeSubscriptionId) {
    return NextResponse.json({ error: 'No active subscription found to cancel.' }, { status: 404 })
  }

  // 1) Cancel at period end in Stripe.
  let periodEnd: string | null = account.currentPeriodEnd
  try {
    const updated = await getStripe().subscriptions.update(account.stripeSubscriptionId, {
      cancel_at_period_end: true,
      // Capture the reason in Stripe's native cancellation_details for the dashboard.
      cancellation_details: reason ? { comment: reason } : undefined,
    })
    // current_period_end isn't on the SDK's Subscription type for this API version but
    // exists at runtime (matches how src/app/api/billing/webhook handles it).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cpe = (updated as any).current_period_end
    if (cpe) {
      periodEnd = new Date(cpe * 1000).toISOString()
    }
  } catch (err) {
    console.error('[support/cancel] Stripe update failed:', err)
    return NextResponse.json(
      { error: 'We could not reach the billing system to cancel. Please try again shortly.' },
      { status: 502 }
    )
  }

  // 2) Reflect cancel_at_period_end in our DB (service client — RLS has no user UPDATE policy).
  if (account.subscriptionId) {
    try {
      const svc = createServiceClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc as any)
        .from('subscriptions')
        .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
        .eq('id', account.subscriptionId)
    } catch (err) {
      console.error('[support/cancel] DB sync failed (Stripe already updated):', err)
    }
  }

  const availability = getAvailability()
  const periodEndText = periodEnd ? new Date(periodEnd).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'the end of your current billing period'

  // 3) Refund branch — escalate, never auto-promise.
  let refundInfo: { requested: boolean; withinWindow: boolean; escalated: boolean } | undefined
  let message: string

  if (refundRequested) {
    const within = account.withinRefundWindow
    const { result } = await escalateToMichael({
      account,
      category: 'billing',
      priority: 'p1',
      summary: `Cancellation + REFUND request${reason ? ` — reason: ${reason}` : ''}`,
      conversationSnippet: `User requested cancellation and a refund.\nReason: ${reason || '(none given)'}\n30-day window: ${within ? 'OPEN — eligible' : 'CLOSED — not eligible per policy'}`,
      reason: within ? 'Refund request (within 30-day MBG)' : 'Refund request (outside 30-day MBG)',
    })
    refundInfo = { requested: true, withinWindow: within, escalated: result.ok }

    message = within
      ? `Done — your subscription is set to cancel on ${periodEndText}, and you keep full access until then. You're within the 30-day money-back window, so I've passed your refund request straight to Michael, who reviews and processes refunds personally. ${availability.statusMessage}`
      : `Done — your subscription is set to cancel on ${periodEndText}, and you keep full access until then. Your 30-day money-back window has passed${account.subscriptionAgeDays != null ? ` (your plan started ${account.subscriptionAgeDays} days ago)` : ''}, so I can't guarantee a refund — but I've flagged your note to Michael, who reviews these personally. ${availability.statusMessage}`
  } else {
    message = `Done — your subscription is set to cancel on ${periodEndText}. You keep full access until then, and your articles and brand profile are preserved. If you change your mind before then, you can resume anytime from Settings > Manage Subscription.`
  }

  // 4) Log the cancellation ticket.
  await logTicket({
    userId: account.userId,
    email: account.email,
    issueSummary: refundRequested ? 'Cancellation + refund request' : 'Subscription cancellation',
    category: 'billing',
    priority: refundRequested ? 'p1' : 'p2',
    status: refundRequested ? 'escalated' : 'open',
    conversation: { action: 'cancel', reason, refundRequested, withinRefundWindow: account.withinRefundWindow, periodEnd },
  })

  // 5) Best-effort cancellation confirmation email (no-op if Resend unconfigured).
  if (account.email) {
    await sendEmail({
      to: account.email,
      subject: 'Your Byline subscription cancellation',
      text: `Hi,\n\nYour Byline subscription is set to cancel on ${periodEndText}. You'll keep full access until then, and your articles and brand profile stay safe.${refundRequested ? '\n\nWe\'ve received your refund request and passed it to Michael, who reviews refunds personally and will be in touch.' : ''}\n\nChanged your mind? You can resume anytime from Settings > Manage Subscription before that date.\n\n— Byline Support`,
    })
  }

  return NextResponse.json({
    ok: true,
    cancelAtPeriodEnd: true,
    periodEnd,
    refund: refundInfo,
    message,
    availability: availability.statusMessage,
  })
}
