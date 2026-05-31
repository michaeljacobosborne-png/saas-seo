'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import Link from 'next/link'

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
    tagline: 'Everything you need to start ranking.',
    cta: 'Start with Starter',
    monthlyPrice: 49,
    annualPrice: 470,
    popular: false,
    features: [
      'AI keyword discovery agent',
      '8 articles per month',
      'SEO, Readability, GEO + AEO scoring',
      '5 agent review sessions/month',
      'Global keyword cache',
      'Save for later keyword library',
      'Email support',
    ],
  },
  {
    id: 'pro' as Plan,
    name: 'Growth',
    tagline: 'The full editorial workflow, end to end.',
    cta: 'Start with Growth',
    monthlyPrice: 99,
    annualPrice: 950,
    popular: true,
    features: [
      'Everything in Starter',
      'Unlimited articles',
      'Unlimited agent sessions',
      'Agent Assist mode — select text, agent rewrites it in-place',
      'Score-based one-click fixes',
      'Persistent agent memory across sessions',
      'Priority support',
    ],
  },
  {
    id: 'agency' as Plan,
    name: 'Agency',
    tagline: 'For teams managing multiple clients or content operations.',
    cta: 'Talk to us',
    monthlyPrice: 249,
    annualPrice: 2390,
    popular: false,
    features: [
      'Everything in Growth',
      'Multiple brand profiles',
      'Team seat (2 users included)',
      'Custom keyword research volume',
      'Dedicated onboarding',
      'SLA support',
    ],
  },
]

const FAQS = [
  {
    q: 'Can I cancel anytime?',
    a: 'Yes — no contracts, cancel from your account settings at any time. Your access continues until the end of the billing period.',
  },
  {
    q: 'What happens if I hit my article limit on Starter?',
    a: "You'll be prompted to upgrade to Growth. We don't cut off access mid-article.",
  },
  {
    q: 'Is the agent really different from just using ChatGPT?',
    a: "Yes. ChatGPT has no access to your article, your scores, your keyword data, or your brand profile. Byline's agent has all of that in context — it knows what's actually wrong and where, and can apply the fix without you leaving the editor.",
  },
  {
    q: 'Do you offer a free trial?',
    a: "We offer a 30-day money-back guarantee on all plans. If it's not working for you in the first 30 days, email us and we'll refund in full.",
  },
]

export default function PricingCards({ currentPlan, currentInterval, hasActiveSubscription }: PricingCardsProps) {
  const [interval, setInterval] = useState<Interval>(currentInterval ?? 'monthly')
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

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
    <div className="min-h-full bg-[#0f1117] text-[#1C1917]">

      {/* Hero */}
      <div className="px-6 pt-16 pb-10 text-center">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 max-w-2xl mx-auto leading-tight">
          Content that ranks. An agent that fixes it.
        </h1>
        <p className="text-[#A89070] text-lg max-w-xl mx-auto leading-relaxed">
          Byline combines AI keyword research, SEO-optimized article generation, and a real editorial agent that rewrites your content — not just scores it.
        </p>
      </div>

      {/* Objection bar */}
      <div className="px-6 pb-12">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10 text-sm text-[#A89070]">
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
            No ChatGPT wrapper — a real SEO workflow
          </span>
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
            Agent applies fixes directly to your article
          </span>
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
            Built on Claude Sonnet, the model editors trust
          </span>
        </div>
      </div>

      {/* Pricing section */}
      <div className="px-6 pb-20">
        <div className="max-w-5xl mx-auto">

          {/* Interval toggle */}
          <div className="flex justify-center mb-10">
            <div className="inline-flex items-center bg-[#1a1d27] rounded-lg p-1">
              <button
                onClick={() => setInterval('monthly')}
                className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${
                  interval === 'monthly'
                    ? 'bg-[#231F1B] text-[#F7F3EC]'
                    : 'text-[#A89070] hover:text-[#1C1917]'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setInterval('annual')}
                className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${
                  interval === 'annual'
                    ? 'bg-[#231F1B] text-[#F7F3EC]'
                    : 'text-[#A89070] hover:text-[#1C1917]'
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {PLANS.map((plan) => {
              const price = interval === 'monthly' ? plan.monthlyPrice : Math.round(plan.annualPrice / 12)
              const isCurrentPlan = hasActiveSubscription && currentPlan === plan.id
              const isFeatured = plan.popular

              return (
                <div
                  key={plan.id}
                  className={`relative rounded-2xl p-6 flex flex-col ${
                    isFeatured
                      ? 'bg-[#1a1d27] border-2 border-indigo-500'
                      : 'bg-[#1a1d27] border border-white/10'
                  }`}
                >
                  {isFeatured && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <span className="bg-[rgba(184,115,51,0.1)]0 text-[#1C1917] text-xs font-bold px-3 py-1 rounded-full tracking-wide whitespace-nowrap">
                        MOST POPULAR
                      </span>
                    </div>
                  )}

                  {isCurrentPlan && (
                    <div className="absolute -top-3.5 right-4">
                      <span className="bg-emerald-500 text-[#1C1917] text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                        CURRENT PLAN
                      </span>
                    </div>
                  )}

                  <h2 className="text-lg font-bold text-[#1C1917] mb-1">{plan.name}</h2>
                  <p className="text-[#A89070] text-sm mb-5 leading-relaxed">{plan.tagline}</p>

                  <div className="mb-6">
                    <span className="text-4xl font-bold text-[#1C1917]">${price}</span>
                    <span className="text-sm ml-1 text-[#A89070]">/mo</span>
                    {interval === 'annual' && (
                      <p className="text-xs mt-1 text-[#A89070]">
                        ${plan.annualPrice}/yr billed annually
                      </p>
                    )}
                  </div>

                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5 text-sm">
                        <Check className="w-4 h-4 flex-shrink-0 text-indigo-400 mt-0.5" />
                        <span className="text-gray-300 leading-snug">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {hasActiveSubscription && isCurrentPlan ? (
                    <button
                      onClick={handleManageBilling}
                      disabled={loading === 'portal'}
                      className="w-full py-2.5 rounded-lg text-sm font-semibold transition-colors bg-[#B87333] text-[#1C1917] hover:bg-[rgba(184,115,51,0.1)]0 disabled:opacity-60"
                    >
                      {loading === 'portal' ? 'Loading…' : 'Manage Billing'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleCheckout(plan.id)}
                      disabled={loading === plan.id}
                      className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 ${
                        isFeatured
                          ? 'bg-[rgba(184,115,51,0.1)]0 text-[#1C1917] hover:bg-indigo-400'
                          : 'bg-[#B87333] text-[#1C1917] hover:bg-[rgba(184,115,51,0.1)]0'
                      }`}
                    >
                      {loading === plan.id
                        ? 'Loading…'
                        : hasActiveSubscription
                        ? 'Switch Plan'
                        : plan.cta}
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          <p className="text-center text-[#A89070] text-xs mt-6">
            30-day money-back guarantee on all plans. No questions asked — email us and we'll refund in full.
          </p>
        </div>
      </div>

      {/* Comparison section */}
      <div className="bg-[#13151f] px-6 py-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-8">Why not just use Surfer or Frase?</h2>
          <div className="space-y-5 text-[#A89070] leading-relaxed text-[15px]">
            <p>
              Surfer SEO gives you a score and a list of keywords to add. Frase gives you a content brief. Both tell you what&apos;s wrong. Neither one fixes it. Byline&apos;s editorial agent reads your full article, identifies specific sentences and sections that are underperforming, and rewrites them — directly inside your editor, with one click.
            </p>
            <p>
              The agent is built on Claude Sonnet, the same model SEO professionals use when they actually need nuanced editorial feedback. It&apos;s been trained on Byline&apos;s SEO framework — E-E-A-T signals, topical authority, AEO and GEO optimization — so its suggestions are grounded in what actually moves rankings, not generic writing tips.
            </p>
            <p>
              And because Byline&apos;s keyword database is shared across all accounts, your research loads from cache on repeat queries — which means your results get faster the more you use the platform, and your API costs stay flat as the user base grows.
            </p>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="px-6 py-16">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold mb-8">Frequently asked questions</h2>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i} className="border border-white/10 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-medium text-[#1C1917] hover:bg-[#231F1B]/5 transition-colors"
                >
                  <span>{faq.q}</span>
                  <span className="ml-4 text-[#A89070] flex-shrink-0 text-base leading-none">
                    {openFaq === i ? '−' : '+'}
                  </span>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5 text-sm text-[#A89070] leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="px-6 py-16 text-center border-t border-white/10">
        <h2 className="text-3xl font-bold mb-6 max-w-lg mx-auto leading-tight">
          Start with a keyword. Leave with an article that ranks.
        </h2>
        <Link
          href="/signup"
          className="inline-flex items-center px-7 py-3 rounded-lg bg-[rgba(184,115,51,0.1)]0 text-[#1C1917] font-semibold hover:bg-indigo-400 transition-colors text-sm"
        >
          Get started
        </Link>
      </div>

      {/* Footer */}
      <div className="border-t border-white/10 px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center ju