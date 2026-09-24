import type { Metadata } from 'next'
import Link from 'next/link'
import { AffiliateForm } from './_components/AffiliateForm'

export const metadata: Metadata = {
  title: 'Affiliate Program — Byline',
  description:
    'Earn 30% recurring commission for every customer you refer to Byline. Perfect for SEO bloggers, content creators, agencies, and marketers.',
}

const playfair = { fontFamily: 'var(--font-playfair, "Playfair Display", serif)' }

export default function AffiliatePage() {
  return (
    <div className="min-h-screen bg-[#FDFAF6] text-[#1C1917]">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-[#FDFAF6]/95 backdrop-blur border-b border-[#E7E0D6]">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/">
            <span
              style={{ ...playfair, fontSize: '22px', fontWeight: 900, color: '#B87333', letterSpacing: '-0.01em' }}
            >
              byline<span style={{ color: '#1C1917' }}>.</span>
            </span>
          </Link>
          <div className="flex items-center gap-6 text-sm">
            <Link href="/pricing" className="text-[#57534E] hover:text-[#1C1917] transition-colors">
              Pricing
            </Link>
            <Link
              href="/login"
              className="rounded-lg bg-[#1C1917] px-4 py-1.5 text-sm font-medium text-[#F7F3EC] hover:bg-[#2D2926] transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 pt-20 pb-20 text-center">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#B87333] mb-5">
            Byline Affiliate Program
          </p>
          <h1
            style={playfair}
            className="text-[40px] sm:text-[52px] font-bold leading-[1.08] tracking-tight text-[#1C1917] mb-6"
          >
            Earn 30% Recurring Commission
          </h1>
          <p className="text-lg text-[#57534E] leading-relaxed max-w-2xl mx-auto mb-10">
            Refer marketers, agencies, and content teams to Byline and earn every month they stay.
          </p>
          <a
            href="#apply"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#B87333] text-white text-sm font-semibold rounded-xl hover:bg-[#9A6228] transition-colors"
          >
            Apply Now
          </a>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-[#F7F3EC] px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <h2 style={playfair} className="text-3xl sm:text-4xl font-bold text-center text-[#1C1917] mb-14">
            How it works
          </h2>
          <div className="grid gap-8 sm:grid-cols-3">
            {[
              {
                step: '01',
                title: 'Apply',
                desc: 'Fill out the form below and get approved. We\'ll send you a unique referral link within 48 hours.',
              },
              {
                step: '02',
                title: 'Share',
                desc: 'Promote Byline to your audience — blog posts, reviews, newsletters, or social media.',
              },
              {
                step: '03',
                title: 'Earn',
                desc: '30% recurring commission on every active subscription you refer. Month after month.',
              },
            ].map(({ step, title, desc }) => (
              <div key={step}>
                <div style={playfair} className="text-3xl font-bold text-[#B87333] mb-3">
                  {step}
                </div>
                <h3 className="text-lg font-semibold text-[#1C1917] mb-2">{title}</h3>
                <p className="text-[15px] text-[#57534E] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <h2 style={playfair} className="text-3xl sm:text-4xl font-bold text-center text-[#1C1917] mb-14">
            Who it&apos;s for
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              {
                icon: '✍️',
                title: 'SEO Bloggers & Content Marketers',
                desc: 'Already writing about content strategy and SEO? Your audience is the perfect fit for Byline.',
              },
              {
                icon: '🏢',
                title: 'Agency Owners & Consultants',
                desc: 'Recommend tools to your clients and earn a commission every time they subscribe.',
              },
              {
                icon: '📧',
                title: 'Newsletter Writers & YouTubers',
                desc: 'Promote Byline to your subscribers and viewers and earn recurring revenue.',
              },
              {
                icon: '🤖',
                title: 'AI & Automation Creators',
                desc: 'Your audience is obsessed with AI productivity tools — Byline is a natural fit.',
              },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="flex gap-4 rounded-2xl border border-[#E7E0D6] bg-white p-5">
                <div className="text-2xl shrink-0">{icon}</div>
                <div>
                  <h3 className="mb-1 font-semibold text-[#1C1917]">{title}</h3>
                  <p className="text-sm text-[#57534E]">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Earnings table */}
      <section className="bg-[#F7F3EC] px-6 py-20">
        <div className="max-w-3xl mx-auto">
          <h2 style={playfair} className="mb-4 text-center text-3xl sm:text-4xl font-bold text-[#1C1917]">
            What you can earn
          </h2>
          <p className="mb-10 text-center text-[#57534E]">
            30% of every subscription, every month, for as long as they stay.
          </p>
          <div className="overflow-hidden rounded-2xl border border-[#E7E0D6] bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E7E0D6] bg-[#F7F3EC]">
                  <th className="px-6 py-3 text-left font-medium text-[#998876]">Referrals</th>
                  <th className="px-6 py-3 text-left font-medium text-[#998876]">Plan</th>
                  <th className="px-6 py-3 text-left font-medium text-[#998876]">Monthly Earnings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E0D6]">
                <tr>
                  <td className="px-6 py-4 text-[#1C1917]">5</td>
                  <td className="px-6 py-4 text-[#57534E]">Starter ($49/mo)</td>
                  <td className="px-6 py-4 font-semibold text-[#16a34a]">$73.50/mo</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-[#1C1917]">10</td>
                  <td className="px-6 py-4 text-[#57534E]">Growth ($99/mo)</td>
                  <td className="px-6 py-4 font-semibold text-[#16a34a]">$297/mo</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-[#1C1917]">20</td>
                  <td className="px-6 py-4 text-[#57534E]">Multi-Brand ($249/mo)</td>
                  <td className="px-6 py-4 font-semibold text-[#16a34a]">$1,494/mo</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Application form */}
      <section id="apply" className="px-6 py-20 scroll-mt-16">
        <div className="max-w-2xl mx-auto">
          <h2 style={playfair} className="mb-3 text-center text-3xl sm:text-4xl font-bold text-[#1C1917]">
            Apply to the program
          </h2>
          <p className="mb-10 text-center text-[#57534E]">
            Fill out the form below and we&apos;ll review your application within 48 hours.
          </p>
          <div className="rounded-2xl border border-[#E7E0D6] bg-white p-8">
            <AffiliateForm />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#1C1917] border-t border-white/10 px-6 py-10">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[#A89070]">
          <span>© 2025 Byline</span>
          <div className="flex flex-wrap items-center justify-center gap-6">
            <Link href="/privacy" className="hover:text-[#F7F3EC] transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-[#F7F3EC] transition-colors">Terms</Link>
            <Link href="/pricing" className="hover:text-[#F7F3EC] transition-colors">Pricing</Link>
            <Link href="/login" className="hover:text-[#F7F3EC] transition-colors">Login</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
