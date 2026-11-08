'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import Link from 'next/link'
import { analytics } from '@/lib/analytics'
import { PRICING_FAQS } from './pricing-faqs'
import { FREE_FEATURES, MONITORING_POINTS, PLANS } from './pricing-plans'

type Plan = 'starter' | 'pro' | 'agency'
type Interval = 'monthly' | 'annual'

interface PricingCardsProps {
  currentPlan: Plan | null
  currentInterval: Interval | null
  hasActiveSubscription: boolean
}

// The first two answers lead the page as sections; the rest are the FAQ list.
const [CHOOSE, HOW_SCORED, ...FAQS] = PRICING_FAQS

export default function PricingCards({ currentPlan, currentInterval, hasActiveSubscription }: PricingCardsProps) {
  const [interval, setInterval] = useState<Interval>(currentInterval ?? 'monthly')
  const [loading, setLoading] = useState<string | null>(null)
  const [error] = useState<string | null>(null)

  async function handleCheckout(plan: Plan) {
    setLoading(plan)

    const planConfig = PLANS.find((p) => p.id === plan)
    const value = planConfig
      ? interval === 'monthly'
        ? planConfig.monthlyPrice
        : planConfig.annualPrice
      : 0
    analytics.beginCheckout(plan, value)

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
      alert(err instanceof Error ? err.message : 'Network error. Please try again.')
      setLoading(null)
    }
  }

  async function handleManageBilling() {
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
      alert(err instanceof Error ? err.message : 'Network error. Please try again.')
      setLoading(null)
    }
  }

  return (
    <div className="min-h-full bg-[#1C1917] text-[#F7F3EC]">

      {/* Hero */}
      <div className="px-6 pt-16 pb-10 text-center">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 max-w-3xl mx-auto leading-tight">
          Know the day an AI crawler stops reaching your pages.
        </h1>
        <p className="text-[#A89070] text-lg max-w-2xl mx-auto leading-relaxed">
          Byline watches the pages you choose. Every day it checks whether each AI crawler is served, emails you when
          that changes, and keeps a scored history so you can see what moved. Plans are sized by how many pages you
          need watched.
        </p>
      </div>

      {/* What monitoring does */}
      <div className="px-6 pb-14">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-center text-sm font-semibold uppercase tracking-wider text-[#D4954A] mb-6">What monitoring does</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {MONITORING_POINTS.map((point) => (
              <div key={point.title} className="rounded-2xl border border-[rgba(184,115,51,0.2)] bg-[#231F1B] p-6">
                <h3 className="text-base font-bold text-[#F7F3EC] mb-2">{point.title}</h3>
                <p className="text-sm text-[#A89070] leading-relaxed">{point.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

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
                        ${plan.annualPrice.toLocaleString('en-US')}/yr billed annually
                      </p>
                    )}
                  </div>

                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((feature) => (
                      <li key={feature.text} className="flex items-start gap-2.5 text-sm">
                        <Check className="w-4 h-4 flex-shrink-0 text-[#D4954A] mt-0.5" />
                        <span className="text-[#A89070] leading-snug">
                          {feature.text}
                          {feature.soon && (
                            <span className="ml-2 inline-block rounded-full border border-[rgba(184,115,51,0.4)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#D4954A] align-middle">
                              Coming soon
                            </span>
                          )}
                        </span>
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
            30-day money-back guarantee on all paid plans. No questions asked: email us and we&apos;ll refund in full.
          </p>

          {/* Free */}
          <div className="mt-6 rounded-2xl border border-[rgba(184,115,51,0.2)] px-8 py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 bg-[#231F1B]">
            <div>
              <p className="text-sm font-semibold text-[#F7F3EC] mb-2">Free</p>
              <ul className="space-y-1.5">
                {FREE_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-[#A89070]">
                    <Check className="w-4 h-4 flex-shrink-0 text-[#D4954A] mt-0.5" />
                    <span className="leading-snug">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <Link
              href="/signup"
              className="shrink-0 px-6 py-2.5 rounded-lg text-sm font-semibold border border-[rgba(184,115,51,0.4)] text-[#D4954A] hover:border-[#B87333] hover:text-[#B87333] transition-colors whitespace-nowrap"
            >
              Start free
            </Link>
          </div>

          {/* Enterprise strip */}
          <div className="mt-6 rounded-2xl border border-[rgba(184,115,51,0.2)] px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4" style={{ background: '#231F1B' }}>
            <div>
              <p className="text-sm font-semibold text-[#F7F3EC] mb-0.5">Need more capacity?</p>
              <p className="text-sm text-[#A89070]">More than 500 pages or 20 domains, team seats, and white-glove onboarding for larger operations.</p>
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

      {/* Two questions every buyer asks before choosing */}
      <div className="bg-[#231F1B] px-6 py-16">
        <div className="max-w-3xl mx-auto space-y-12 text-[#A89070] leading-relaxed text-[15px]">
          <div>
            <h2 className="text-2xl font-bold mb-4 text-[#F7F3EC]">{CHOOSE.q}</h2>
            <p>{CHOOSE.a}</p>
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-4 text-[#F7F3EC]">{HOW_SCORED.q}</h2>
            <p>{HOW_SCORED.a}</p>
            <p className="mt-4">
              The two halves are explained on the{' '}
              <Link href="/" className="underline hover:text-[#F7F3EC]">homepage under Retrievable vs citable</Link>.
            </p>
          </div>
        </div>
      </div>

      {/* FAQ. Native details elements keep every answer in the server HTML,
          where crawlers and people without JavaScript can read it. */}
      <div className="px-6 py-16">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold mb-8">Frequently asked questions</h2>
          <div className="space-y-3">
            {FAQS.map((faq) => (
              <details key={faq.q} className="group border border-[rgba(184,115,51,0.2)] rounded-xl overflow-hidden">
                <summary className="flex items-center justify-between px-5 py-4 text-left text-sm font-medium text-[#F7F3EC] hover:bg-[rgba(184,115,51,0.05)] transition-colors cursor-pointer list-none">
                  <h3 className="font-medium">{faq.q}</h3>
                  <span className="ml-4 text-[#A89070] flex-shrink-0 text-base leading-none group-open:hidden">+</span>
                  <span className="ml-4 text-[#A89070] flex-shrink-0 text-base leading-none hidden group-open:inline">−</span>
                </summary>
                <p className="px-5 pb-5 text-sm text-[#A89070] leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="px-6 py-16 text-center border-t border-[rgba(184,115,51,0.15)]">
        <h2 className="text-3xl font-bold mb-6 max-w-lg mx-auto leading-tight">
          Watch the pages that matter. Check every number yourself.
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
