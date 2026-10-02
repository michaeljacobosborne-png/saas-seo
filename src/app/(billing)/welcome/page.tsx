'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { analytics } from '@/lib/analytics'

// Monthly list price per plan — best-effort `value` for the client-side
// purchase event. The authoritative amount is recorded server-side from the
// Stripe webhook; this event is primarily for Meta Pixel/CAPI dedup.
const PLAN_VALUE: Record<string, number> = {
  starter: 49,
  pro: 99,
  agency: 249,
}

// The post-checkout redirect races the Stripe webhook that provisions the
// account, so we poll rather than assume the subscription row exists yet.
// MAX_WAIT_MS is how long we block with a spinner before surfacing a manual
// "continue" button — we keep polling slowly after that so we still auto-advance
// the moment the webhook lands, and never strand a customer who has paid.
const MAX_WAIT_MS = 20_000
const POLL_INTERVAL_MS = 1500
const SLOW_POLL_INTERVAL_MS = 3000

export default function WelcomePage() {
  const router = useRouter()
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    let tracked = false
    const startedAt = Date.now()

    // Returns true once the account is provisioned. The webhook writes both a
    // subscription row and profiles.account_type='paid'; the dashboard layout
    // gate accepts either, so we do too — whichever lands first lets us in.
    async function isProvisioned(): Promise<boolean> {
      const { data: { user } } = await supabase.auth.getUser()
      // No session — nothing to wait for. Let the dashboard layout route them
      // to /login if the session is genuinely gone.
      if (!user) return true

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: sub } = await (supabase as any)
        .from('subscriptions')
        .select('plan, stripe_subscription_id')
        .eq('user_id', user.id)
        .in('status', ['active', 'trialing'])
        .limit(1)
        .maybeSingle()

      if (sub) {
        // Fire the client-side purchase/Subscribe once. The event_id is derived
        // from the subscription id so it deduplicates against the server-side
        // CAPI event sent by the Stripe webhook.
        if (!tracked && sub.stripe_subscription_id) {
          tracked = true
          analytics.purchase(sub.plan ?? 'unknown', PLAN_VALUE[sub.plan] ?? 0, sub.stripe_subscription_id)
        }
        return true
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile } = await (supabase as any)
        .from('profiles')
        .select('account_type')
        .eq('user_id', user.id)
        .maybeSingle()
      return profile?.account_type === 'paid'
    }

    async function poll() {
      if (cancelled) return

      let provisioned = false
      try {
        provisioned = await isProvisioned()
      } catch {
        provisioned = false
      }
      if (cancelled) return

      if (provisioned) {
        // Actually land them in the app — don't leave them on a success card.
        router.replace('/dashboard')
        return
      }

      const elapsed = Date.now() - startedAt
      if (elapsed >= MAX_WAIT_MS) {
        // Surface a manual escape hatch, but keep polling slowly so a late
        // webhook still auto-advances without the user having to do anything.
        setTimedOut(true)
        setTimeout(poll, SLOW_POLL_INTERVAL_MS)
      } else {
        setTimeout(poll, POLL_INTERVAL_MS)
      }
    }

    poll()
    return () => { cancelled = true }
  }, [router])

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-6">
          <CheckCircle className="w-16 h-16" style={{ color: '#B87333' }} />
        </div>
        <h1
          className="text-3xl font-bold mb-3"
          style={{
            fontFamily: 'var(--font-playfair, "Playfair Display", serif)',
            color: '#F7F3EC',
          }}
        >
          You&apos;re in.
        </h1>
        <p className="text-base mb-8" style={{ color: '#A89070' }}>
          Your Byline subscription is active. Time to start ranking.
        </p>

        {timedOut ? (
          <>
            <p className="text-sm mb-6" style={{ color: '#A89070' }}>
              This is taking a little longer than usual to finish setting up — but
              your payment went through. You can head straight in.
            </p>
            <Link
              href="/dashboard"
              className="inline-block px-8 py-3 rounded-lg text-sm font-semibold transition-colors"
              style={{ background: '#B87333', color: '#1C1917' }}
            >
              Continue to your dashboard &#8594;
            </Link>
            <p className="mt-4 text-xs" style={{ color: '#7A6555' }}>
              Or{' '}
              <Link href="/brand" style={{ color: '#A89070' }} className="underline underline-offset-2">
                set up your brand first
              </Link>
            </p>
          </>
        ) : (
          <div className="flex items-center justify-center gap-2" style={{ color: '#7A6555' }}>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Activating your account...</span>
          </div>
        )}
      </div>
    </div>
  )
}
