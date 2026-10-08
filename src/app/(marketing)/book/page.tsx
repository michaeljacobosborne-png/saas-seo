import type { Metadata } from 'next'
import Link from 'next/link'
import Script from 'next/script'

export const metadata: Metadata = {
  title: 'Book a Call — Byline',
  description: 'Schedule a free 30-minute call to see how Byline can help you scale your content strategy with AI.',
}

const playfair = { fontFamily: 'var(--font-playfair, "Playfair Display", serif)' }

export default function BookPage() {
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
      <section className="max-w-3xl mx-auto px-6 pt-16 pb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#B87333] mb-4">
          Free Strategy Call
        </p>
        <h1
          style={{ ...playfair, fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 900, lineHeight: 1.15, letterSpacing: '-0.02em' }}
          className="text-[#1C1917] mb-4"
        >
          Let&rsquo;s talk about your content
        </h1>
        <p className="text-[#57534E] text-lg leading-relaxed max-w-xl mx-auto">
          Book a free 30-minute call. We&rsquo;ll look at your current content strategy, run a live audit, and show you exactly how Byline can help.
        </p>
      </section>

      {/* Calendar embed */}
      <section className="max-w-3xl mx-auto px-4 pb-20">
        <div className="rounded-2xl border border-[#E7E0D6] bg-white overflow-hidden shadow-sm">
          <iframe
            src="https://api.leadconnectorhq.com/widget/booking/TQkg0SYsalTch7b28pLk"
            style={{ width: '100%', border: 'none', overflow: 'hidden', minHeight: '700px' }}
            scrolling="no"
            id="TQkg0SYsalTch7b28pLk_1783262787745"
          />
        </div>
      </section>

      {/* Footer note */}
      <div className="text-center pb-12 text-sm text-[#998876]">
        Prefer to start on your own?{' '}
        <Link href="/audit" className="text-[#B87333] hover:underline">
          Run a free audit
        </Link>{' '}
        or{' '}
        <Link href="/pricing" className="text-[#B87333] hover:underline">
          view pricing
        </Link>
        .
      </div>

      <Script
        src="https://link.msgsndr.com/js/form_embed.js"
        strategy="afterInteractive"
      />
    </div>
  )
}
