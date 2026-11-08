import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import PricingCards from './pricing-cards'
import { PRICING_FAQS } from './pricing-faqs'
import { SITE_URL, graph, jsonLdString, organizationNode, websiteNode } from '@/lib/structured-data'

const jsonLd = graph(organizationNode(), websiteNode(), {
  '@type': 'FAQPage',
  '@id': `${SITE_URL}/pricing#faq`,
  mainEntity: PRICING_FAQS.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
})

function JsonLd() {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} />
}

export const metadata: Metadata = {
  title: 'Pricing | Byline AI SEO Platform',
  description:
    'Byline plans are sized by pages monitored: daily crawler access checks, change alerts and scored history. Start free with 10 audits a month.',
  alternates: {
    canonical: 'https://app.bylineseo.com/pricing',
  },
  openGraph: {
    title: 'Byline Pricing: Plans by Pages Monitored',
    description: 'Daily crawler access checks, change alerts and scored history for the pages you choose. Start free.',
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
      <>
        <JsonLd />
        <PricingCards
          currentPlan={sub?.plan ?? null}
          currentInterval={sub?.billing_interval ?? null}
          hasActiveSubscription={!!sub}
        />
      </>
    )
  } catch {
    return (
      <>
        <JsonLd />
        <PricingCards
          currentPlan={null}
          currentInterval={null}
          hasActiveSubscription={false}
        />
      </>
    )
  }
}
