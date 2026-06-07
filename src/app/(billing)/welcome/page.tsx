'use client'

import { useEffect, useState } from 'react'
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

export default function WelcomePage() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let attempts = 0
    const max = 15
    let tracked = false

    async function poll() {
      attempts++
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setReady(true); return }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: sub } = await (supabase as any)
        .from('subscriptions')
        .select('id, plan, stripe_subscription_id')
        .eq('user_id', user.id)
        .in('status', ['active', 'trialing'])
        .limit(1)
        .maybeSingle()

      if (sub) {
        // Fire client-side purchase/Subscribe once. The event_id is derived
        // from the subscription id so it deduplicates against the server-side
        // CAPI event sent by the Stripe webhook.
        if (!tracked && sub.stripe_subscription_id) {
          tracked = true
          analytics.purchase(sub.plan ?? 'unknown', PLAN_VALUE[sub.plan] ?? 0, sub.stripe_subscription_id)
        }
        setReady(true)
      } else if (attempts >= max) {
        setReady(true)
      } else {
        setTimeout(poll, 1000)
      }
    }

    poll()
  }, [])

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

        {ready ? (
          <>
            <Link
              href="/brand"
              className="inline-block px-8 py-3 rounded-lg text-sm font-semibold transition-colors"
              style={{ background: '#B87333', color: '#1C1917' }}
            >
              Set up your brand &#8594;
            </Link>
            <p className="mt-4 text-xs" style={{ color: '#7A6555' }}>
              Or{' '}
              <Link href="/dashboard" style={{ color: '#A89070' }} className="underline underline-offset-2">
                go to your dashboard
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
