import { createClient } from '@/lib/supabase/server'
import PricingCards from './pricing-cards'

export default async function PricingPage() {
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
}
