import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import PricingCards from './pricing-cards'

export const metadata: Metadata = {
  title: 'Pricing — Byline AI SEO Platform',
  description:
    'Simple, transparent pricing for Byline. Start free and upgrade when you\'re ready. Plans for solo creators, agencies, and enterprise teams.',
  alternates: {
    canonical: 'https://app.bylineseo.com/pricing',
  },
  openGraph: {
    title: 'Byline Pricing — AI SEO Plans for Every Team',
    description: 'Start free. Upgrade when you\'re ready. AI keyword research, content generation, and editorial rewrites — all in one platform.',
    url: 'https://app.bylineseo.com/pricing',
    type: 'website',
  },
}

export default async function PricingPage() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sub } = user ? await (supabase as any)
      .from('subscriptions')
      .select('plan, billing_interval, status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle() : { data: null }

    return (
      <PricingCards
        currentPlan={sub?.plan ?? null}
        currentInterval={sub?.billing_interval ?? null}
        hasActiveSubscription={!!sub}
      />
    )
  } catch {
    return (
      <PricingCards
        currentPlan={null}
        currentInterval={null}
        hasActiveSubscription={false}
      />
    )
  }
}
