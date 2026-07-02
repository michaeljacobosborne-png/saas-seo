import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Featured In — Byline',
  description:
    'Byline is recognized and featured across leading AI tool directories, SEO communities, and product discovery platforms.',
}

const playfair = { fontFamily: 'var(--font-playfair, "Playfair Display", serif)' }

const comingSoonSlots = [
  { label: 'Product Hunt' },
  { label: 'There\'s An AI For That' },
  { label: 'Futurepedia' },
]

export default function FeaturedPage() {
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
      <section className="px-6 pt-20 pb-16 text-center">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#B87333] mb-5">
            Press &amp; Recognition
          </p>
          <h1
            style={playfair}
            className="text-[40px] sm:text-[52px] font-bold leading-[1.08] tracking-tight text-[#1C1917] mb-6"
          >
            As Seen In
          </h1>
          <p className="text-lg text-[#57534E] leading-relaxed max-w-2xl mx-auto">
            Byline is recognized by leading AI tool directories, SEO communities, and product discovery
            platforms used by thousands of marketers and content teams.
          </p>
        </div>
      </section>

      {/* Badges grid */}
      <section className="bg-[#F7F3EC] px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <h2 style={playfair} className="text-2xl sm:text-3xl font-bold text-center text-[#1C1917] mb-12">
            Featured &amp; Verified
          </h2>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {/* Dang.ai — live badge */}
            <div className="flex flex-col items-center justify-center rounded-2xl border border-[#E7E0D6] bg-white p-8 text-center gap-4">
              {/* eslint-disable-next-line react/jsx-no-target-blank */}
              <a
                href="https://dang.ai"
                target="_blank"
                rel="dofollow noopener"
                style={{ display: 'inline-block', textDecoration: 'none' }}
                aria-label="Verified on DANG! — AI tools directory"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://assets.dang.ai/badges/dang-verified-dark.png"
                  alt="Verified on DANG!"
                  width={260}
                  height={94}
                  style={{ display: 'block', width: '200px', maxWidth: '100%', height: 'auto', border: 0, outline: 'none', textDecoration: 'none' }}
                />
              </a>
              <p className="text-xs text-[#998876]">
                Listed on <a href="https://dang.ai" rel="dofollow noopener" target="_blank" className="underline hover:text-[#1C1917]">dang.ai</a> — the curated AI tools directory trusted by builders and marketers.
              </p>
            </div>

            {/* Coming soon placeholders */}
            {comingSoonSlots.map(({ label }) => (
              <div
                key={label}
                className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#D1C9BC] bg-white/60 p-8 text-center gap-3"
              >
                <div className="w-12 h-12 rounded-full border border-dashed border-[#D1C9BC] flex items-center justify-center">
                  <span className="text-[#C4B8A7] text-lg font-light">+</span>
                </div>
                <p className="text-sm font-medium text-[#998876]">{label}</p>
                <span className="text-[10px] uppercase tracking-widest text-[#C4B8A7] font-semibold">
                  Coming soon
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why it matters */}
      <section className="px-6 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <h2 style={playfair} className="text-2xl sm:text-3xl font-bold text-[#1C1917] mb-6">
            Trusted by SEO teams worldwide
          </h2>
          <p className="text-[#57534E] leading-relaxed max-w-2xl mx-auto mb-10">
            From indie creators to agency teams, Byline helps content professionals write SEO-optimized
            articles that rank — and the tools community has taken notice.
          </p>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#B87333] text-white text-sm font-semibold rounded-xl hover:bg-[#9A6228] transition-colors"
          >
            Try Byline free
          </Link>
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
