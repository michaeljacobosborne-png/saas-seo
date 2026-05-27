'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'

type Plan = 'starter' | 'pro' | 'agency'
type Interval = 'monthly' | 'annual'

interface PricingCardsProps {
  currentPlan: Plan | null
  currentInterval: Interval | null
  hasActiveSubscription: boolean
}

const PLANS = [
  {
    id: 'starter' as Plan,
    name: 'Starter',
    monthlyPrice: 29,
    annualPrice: 276,
    articles: '8 articles / mo',
    keywordSessions: '10 keyword sessions',
    brandProfiles: '1 brand profile',
    features: [
      'AI article generation',
      'SEO brief builder',
      'Keyword research',
      'SEO + readability scoring',
      'Email support',
    ],
  },
  {
    id: 'pro' as Plan,
    name: 'Pro',
    monthlyPrice: 79,
    annualPrice: 756,
    articles: '25 articles / mo',
    keywordSessions: '40 keyword sessions',
    brandProfiles: '3 brand profiles',
    popular: true,
    features: [
      'Everything in Starter',
      'Priority AI generation',
      'GEO + AEO scoring',
      'Traffic predictions',
      'Priority support',
    ],
  },
  {
    id: 'agency' as Plan,
    name: 'Agency',
    monthlyPrice: 199,
    annualPrice: 1908,
    articles: '80 articles / mo',
    keywordSessions: 'Unlimited keyword sessions',
    brandProfiles: '10 brand profiles',
    features: [
      'Everything in Pro',
      'Bulk article generation',
      'White-label exports',
      'API access',
      'Dedicated support',
    ],
  },
]

export default function PricingCards({ currentPlan, currentInterval, hasActiveSubscription }: PricingCardsProps) {
  const [interval, setInterval] = useState<Interval>(currentInterval ?? 'monthly')
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleCheckout(plan: Plan) {
    setError(null)
    setLoading(plan)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, interval }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) {
        console.error('Checkout error:', data.error)
        alert(data.error ?? 'Something went wrong starting checkout. Check the console.')
        setLoading(null)
        return
      }
      window.location.href = data.url
    } catch (err) {
      console.error('Checkout error:', err)
      alert(err instanceof Error ? err.message : 'Network error — please try again')
      setLoading(null)
    }
  }

  async function handleManageBilling() {
    setError(null)
    setLoading('portal')
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.url) {
        console.error('Portal error:', data.error)
        alert(data.error ?? 'Something went wrong opening billing portal. Check the console.')
        setLoading(null)
        return
      }
      window.location.href = data.url
    } catch (err) {
      console.error('Portal error:', err)
      alert(err instanceof Error ? err.message : 'Network error — please try again')
      setLoading(null)
    }
  }

  return (
    <div className="min-h-full bg-[#0f1117] px-6 py-12">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-white mb-3">Simple, Transparent Pricing</h1>
          <p className="text-gray-400 text-sm">
            No free trial — 30-day money-back guarantee on all plans.
          </p>

          {/* Interval toggle */}
          <div className="inline-flex items-center mt-6 bg-[#1a1d27] rounded-lg p-1">
            <button
              onClick={() => setInterval('monthly')}
              className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${
                interval === 'monthly'
                  ? 'bg-white text-gray-900'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setInterval('annual')}
              className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${
                interval === 'annual'
                  ? 'bg-white text-gray-900'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Annual
              <span className="ml-1.5 text-xs text-emerald-400 font-semibold">Save 20%</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="max-w-md mx-auto mb-6 px-4 py-3 rounded-lg bg-red-900/40 border border-red-500/40 text-red-300 text-sm text-center">
            {error}
          </div>
        )}

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const price = interval === 'monthly' ? plan.monthlyPrice : Math.round(plan.annualPrice / 12)
            const isCurrentPlan = hasActiveSubscription && currentPlan === plan.id
            const isFeatured = plan.popular

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl p-6 flex flex-col ${
                  isFeatured
                    ? 'bg-[#6366f1] ring-2 ring-[#6366f1]'
                    : 'bg-[#1a1d27] ring-1 ring-white/10'
                }`}
              >
                {isFeatured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-white text-[#6366f1] text-xs font-bold px-3 py-1 rounded-full">
                      MOST POPULAR
                    </span>
                  </div>
                )}

                {isCurrentPlan && (
                  <div className="absolute -top-3 right-4">
                    <span className="bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                      CURRENT PLAN
                    </span>
                  </div>
                )}

                <h2 className="text-lg font-bold mb-1 text-white">
                  {plan.name}
                </h2>

                <div className="mb-4">
                  <span className="text-4xl font-bold text-white">
                    ${price}
                  </span>
                  <span className={`text-sm ml-1 ${isFeatured ? 'text-indigo-200' : 'text-gray-400'}`}>
                    /mo
                  </span>
                  {interval === 'annual' && (
                    <p className={`text-xs mt-0.5 ${isFeatured ? 'text-indigo-200' : 'text-gray-500'}`}>
                      ${plan.annualPrice}/yr billed annually
                    </p>
                  )}
                </div>

                {/* Limits */}
                <div className={`text-sm space-y-1 mb-5 pb-5 border-b ${isFeatured ? 'border-indigo-400' : 'border-white/10'}`}>
                  <p className={isFeatured ? 'text-indigo-100' : 'text-gray-300'}>{plan.articles}</p>
                  <p className={isFeatured ? 'text-indigo-100' : 'text-gray-300'}>{plan.keywordSessions}</p>
                  <p className={isFeatured ? 'text-indigo-100' : 'text-gray-300'}>{plan.brandProfiles}</p>
                </div>

                {/* Features */}
                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <Check className={`w-4 h-4 flex-shrink-0 ${isFeatured ? 'text-white' : 'text-indigo-400'}`} />
                      <span className={isFeatured ? 'text-indigo-100' : 'text-gray-300'}>{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {hasActiveSubscription && isCurrentPlan ? (
                  <button
                    onClick={handleManageBilling}
                    disabled={loading === 'portal'}
                    className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                      isFeatured
                        ? 'bg-white text-[#6366f1] hover:bg-indigo-50 disabled:opacity-60'
                        : 'bg-[#6366f1] text-white hover:bg-indigo-500 disabled:opacity-60'
                    }`}
                  >
                    {loading === 'portal' ? 'Loading…' : 'Manage Billing'}
                  </button>
                ) : (
                  <button
                    onClick={() => handleCheckout(plan.id)}
                    disabled={loading === plan.id}
                    className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                      isFeatured
                        ? 'bg-white text-[#6366f1] hover:bg-indigo-50 disabled:opacity-60'
                        : 'bg-[#6366f1] text-white hover:bg-indigo-500 disabled:opacity-60'
                    }`}
                  >
                    {loading === plan.id ? 'Loading…' : hasActiveSubscription ? 'Switch Plan' : 'Get Started'}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Money-back note */}
        <p className="text-center text-gray-500 text-xs mt-8">
          30-day money-back guarantee. No questions asked — contact support to request a refund.
        </p>
      </div>
    </div>
  )
}
