'use client'

import { useState, useEffect } from 'react'
import { Check } from 'lucide-react'
import Link from 'next/link'
import { analytics } from '@/lib/analytics'
import TestimonialsSection from '@/app/_components/TestimonialsSection'

interface FounderSpots {
  available: boolean
  used: number
  total: number
  remaining: number
}

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
      '10 keyword sessions per month',
      'SEO, Readability, GEO + AEO scoring',
      'Agent review mode',
      'Global keyword cache',
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
      '30 articles per month',
      '60 keyword sessions per month',
      'Agent Assist mode — select text, agent rewrites it in-place',
      'Score-based one-click fixes',
      'Persistent agent memory across sessions',
      'Priority support',
    ],
  },
  {
    id: 'agency' as Plan,
    name: 'Multi-Brand',
    tagline: 'Full agent operations for multiple brands.',
    cta: 'Start with Multi-Brand',
    monthlyPrice: 249,
    annualPrice: 2390,
    popular: false,
    features: [
      'Everything in Growth',
      '100 articles per month',
      '200 keyword sessions per month',
      'Up to 3 brand profiles',
      'Switch brands in one click',
      'Dedicated onboarding call',
      'Priority email + chat support',
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
  const [founderSpots, setFounderSpots] = useState<FounderSpots | null>(null)

  useEffect(() => {
    fetch('/api/billing/founder-spots')
      .then((r) => r.ok ? r.json() : null)
      .then((data: FounderSpots | null) => {
        if (data?.available) setFounderSpots(data)
      })
      .catch(() => {/* ignore — founder banner is non-critical */})
  }, [])

  async function handleCheckout(plan: Plan, founderPlanId?: string) {
    setError(null)
    setLoading(founderPlanId ?? plan)

    const planConfig = PLANS.find((p) => p.id === plan)
    const value = planConfig
      ? interval === 'monthly'
        ? planConfig.monthlyPrice
        : planConfig.annualPrice
      : 0
    analytics.beginCheckout(founderPlanId ?? plan, value)

    const checkoutPlan = founderPlanId ?? plan
    // Founder plans are monthly-only
    const checkoutInterval = founderPlanId ? 'monthly' : interval

    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: checkoutPlan, interval: checkoutInterval }),
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
    <div className="min-h-full bg-[#1C1917] text-[#F7F3EC]">

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
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10 text-sm text-[#7A6555]">
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#B87333] flex-shrink-0" />
            No ChatGPT wrapper — a real SEO workflow
          </span>
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#B87333] flex-shrink-0" />
            Agent applies fixes directly to your article
          </span>
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#B87333] flex-shrink-0" />
            The editorial agent runs on Claude Sonnet
          </span>
        </div>
      </div>

      {/* Founder pricing banner */}
      {founderSpots && (
        <div className="px-6 pb-10">
          <div className="max-w-3xl mx-auto rounded-2xl border border-[rgba(184,115,51,0.4)] bg-[#231F1B] p-8">
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 bg-[rgba(184,115,51,0.12)] border border-[rgba(184,115,51,0.3)] rounded-full px-4 py-1.5 text-xs font-semibold text-[#D4954A] tracking-wide uppercase mb-3">
                Founder Pricing — Limited Spots
              </div>
              <h2 className="text-2xl font-bold text-[#F7F3EC] mb-2">
                Lock in your rate. Forever.
              </h2>
              <p className="text-[#A89070] text-sm max-w-md mx-auto">
                The first 100 subscribers get permanently reduced pricing — your rate never increases.
              </p>
              <div className="mt-4 flex items-center justify-center gap-3">
                <div className="h-2 w-40 rounded-full bg-[#2A2420] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#B87333] transition-all"
                    style={{ width: `${(founderSpots.used / founderSpots.total) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-[#D4954A]">
                  {founderSpots.remaining} of {founderSpots.total} spots left
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Starter founder */}
              <div className="rounded-xl border border-[rgba(184,115,51,0.25)] bg-[#1C1917] p-5 flex flex-col">
                <div className="text-xs font-semibold text-[#B87333] uppercase tracking-wider mb-1">Starter — Founder</div>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-3xl font-bold text-[#F7F3EC]">$39</span>
                  <span className="text-sm text-[#7A6555]">/mo</span>
                  <span className="text-sm line-through text-[#7A6555]">$49</span>
                </div>
                <p className="text-xs text-[#D4954A] font-semibold mb-4">Monthly, locked forever</p>
                <button
                  onClick={() => handleCheckout('starter', 'starter_founder')}
                  disabled={loading === 'starter_founder'}
                  className="mt-auto w-full py-2 rounded-lg border border-[#B87333] text-[#B87333] text-sm font-semibold hover:bg-[rgba(184,115,51,0.08)] transition-colors disabled:opacity-60"
                >
                  {loading === 'starter_founder' ? 'Loading…' : 'Claim Starter Founder'}
                </button>
              </div>
              {/* Growth founder */}
              <div className="rounded-xl border-2 border-[#B87333] bg-[#1C1917] p-5 flex flex-col">
                <div className="text-xs font-semibold text-[#B87333] uppercase tracking-wider mb-1">Growth — Founder</div>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-3xl font-bold text-[#F7F3EC]">$79</span>
                  <span className="text-sm text-[#7A6555]">/mo</span>
                  <span className="text-sm line-through text-[#7A6555]">$99</span>
                </div>
                <p className="text-xs text-[#D4954A] font-semibold mb-4">Monthly, locked forever</p>
                <button
                  onClick={() => handleCheckout('pro', 'pro_founder')}
                  disabled={loading === 'pro_founder'}
                  className="mt-auto w-full py-2 rounded-lg bg-[#B87333] text-[#F7F3EC] text-sm font-semibold hover:bg-[#A0622A] transition-colors disabled:opacity-60"
                >
                  {loading === 'pro_founder' ? 'Loading…' : 'Claim Growth Founder'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Social proof — trust signals right before the price */}
      <TestimonialsSection />

      {/* Pricing section */}
      <div className="px-6 pb-20">
        <div className="max-w-5xl mx-auto">

          {/* Interval toggle */}
          <div className="flex justify-center mb-10">
            <div className="inline-flex items-center bg-[#231F1B] rounded-lg p-1">
              <button
                onClick={() => setInterval('monthly')}
                className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${
                  interval === 'monthly'
                    ? 'bg-[#1C1917] text-[#F7F3EC]'
                    : 'text-[#7A6555] hover:text-[#F7F3EC]'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setInterval('annual')}
                className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${
                  interval === 'annual'
                    ? 'bg-[#1C1917] text-[#F7F3EC]'
                    : 'text-[#7A6555] hover:text-[#F7F3EC]'
                }`}
              >
                Annual
                <span className="ml-1.5 text-xs text-[#D4954A] font-semibold">Save 20%</span>
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
                      ? 'bg-[#231F1B] border-2 border-[#B87333]'
                      : 'bg-[#231F1B] border border-[rgba(184,115,51,0.2)]'
                  }`}
                >
                  {isFeatured && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <span className="bg-[#B87333] text-[#1C1917] text-xs font-bold px-3 py-1 rounded-full tracking-wide whitespace-nowrap">
                        MOST POPULAR
                      </span>
                    </div>
                  )}

                  {isCurrentPlan && (
                    <div className="absolute -top-3.5 right-4">
                      <span className="bg-[#B87333] text-[#1C1917] text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                        CURRENT PLAN
                      </span>
                    </div>
                  )}

                  <h2 className="text-lg font-bold text-[#F7F3EC] mb-1">{plan.name}</h2>
                  <p className="text-[#A89070] text-sm mb-5 leading-relaxed">{plan.tagline}</p>

                  <div className="mb-6">
                    <span className="text-4xl font-bold text-[#F7F3EC]">${price}</span>
                    <span className="text-sm ml-1 text-[#7A6555]">/mo</span>
                    {interval === 'annual' && (
                      <p className="text-xs mt-1 text-[#A89070]">
                        ${plan.annualPrice}/yr billed annually
                      </p>
                    )}
                  </div>

                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5 text-sm">
                        <Check className="w-4 h-4 flex-shrink-0 text-[#D4954A] mt-0.5" />
                        <span className="text-[#A89070] leading-snug">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {hasActiveSubscription && isCurrentPlan ? (
                    <button
                      onClick={handleManageBilling}
                      disabled={loading === 'portal'}
                      className="w-full py-2.5 rounded-lg text-sm font-semibold transition-colors bg-[#B87333] text-[#F7F3EC] hover:bg-[#A0622A] disabled:opacity-60"
                    >
                      {loading === 'portal' ? 'Loading…' : 'Manage Billing'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleCheckout(plan.id)}
                      disabled={loading === plan.id}
                      className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 ${
                        isFeatured
                          ? 'bg-[#B87333] text-[#1C1917] hover:bg-[#A0622A]'
                          : 'border border-[#B87333] text-[#B87333] hover:bg-[rgba(184,115,51,0.08)]'
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

          {/* Enterprise strip */}
          <div className="mt-10 rounded-2xl border border-[rgba(184,115,51,0.2)] px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4" style={{ background: '#231F1B' }}>
            <div>
              <p className="text-sm font-semibold text-[#F7F3EC] mb-0.5">Need more capacity?</p>
              <p className="text-sm text-[#A89070]">Custom brand profiles, higher article and keyword limits, team seats, and white-glove onboarding for larger operations.</p>
            </div>
            <a
              href="mailto:hi@bylineseo.com?subject=Enterprise%20Inquiry"
              className="shrink-0 px-6 py-2.5 rounded-lg text-sm font-semibold border border-[rgba(184,115,51,0.4)] text-[#D4954A] hover:border-[#B87333] hover:text-[#B87333] transition-colors whitespace-nowrap"
            >
              Contact for enterprise
            </a>
          </div>
        </div>
      </div>

      {/* Comparison section */}
      <div className="bg-[#231F1B] px-6 py-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-8">Why not just use Surfer or Frase?</h2>
          <div className="space-y-5 text-[#A89070] leading-relaxed text-[15px]">
            <p>
              Surfer SEO gives you a score and a list of keywords to add. Frase gives you a content brief. Both tell you what&apos;s wrong. Neither one fixes it. Byline&apos;s editorial agent reads your full article, identifies specific sentences and sections that are underperforming, and rewrites them — directly inside your editor, with one click.
            </p>
            <p>
              The editorial agent runs on claude-sonnet — the model SEO professionals use when they need real editorial judgment, not generic writing tips. It&apos;s been trained on Byline&apos;s SEO framework — E-E-A-T signals, topical authority, AEO and GEO optimization — so its suggestions are grounded in what actually moves rankings.
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
              <div key={i} className="border border-[rgba(184,115,51,0.2)] rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-medium text-[#F7F3EC] hover:bg-[rgba(184,115,51,0.05)] transition-colors"
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
      <div className="px-6 py-16 text-center border-t border-[rgba(184,115,51,0.15)]">
        <h2 className="text-3xl font-bold mb-6 max-w-lg mx-auto leading-tight">
          Start with a keyword. Leave with an article that ranks.
        </h2>
        <Link
          href="/signup"
          className="inline-flex items-center px-7 py-3 rounded-lg bg-[rgba(184,115,51,0.08)] text-[#F7F3EC] font-semibold hover:bg-[#B87333] transition-colors text-sm"
        >
          Get started
        </Link>
      </div>

      {/* Footer */}
      <div className="border-t border-[rgba(184,115,51,0.15)] px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-4 text-sm text-[#F7F3EC]/40">
          <span>&copy; {new Date().getFullYear()} Peacock Creative Services LLC</span>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-[#F7F3EC]/70 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-[#F7F3EC]/70 transition-colors">Terms</Link>
            <a href="mailto:policies@bylineseo.com" className="hover:text-[#F7F3EC]/70 transition-colors">Contact</a>
          </div>
        </div>
      </div>

    </div>
  )
}
