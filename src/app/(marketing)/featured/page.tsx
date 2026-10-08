import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Listed on — Byline',
  description: 'Byline is listed on dang.ai and Fazier.',
}

const playfair = { fontFamily: 'var(--font-playfair, "Playfair Display", serif)' }

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
          <h1
            style={playfair}
            className="text-[40px] sm:text-[52px] font-bold leading-[1.08] tracking-tight text-[#1C1917] mb-6"
          >
            Listed on
          </h1>
          <p className="text-lg text-[#57534E] leading-relaxed max-w-2xl mx-auto">
            Byline is listed on dang.ai and Fazier.
          </p>
        </div>
      </section>

      {/* Badges */}
      <section className="bg-[#F7F3EC] px-6 py-20">
        <div className="max-w-2xl mx-auto">
          <div className="grid gap-6 sm:grid-cols-2">
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
                Listed on <a href="https://dang.ai" rel="dofollow noopener" target="_blank" className="underline hover:text-[#1C1917]">dang.ai</a>.
              </p>
            </div>

            {/* Fazier — live badge */}
            <div className="flex flex-col items-center justify-center rounded-2xl border border-[#E7E0D6] bg-white p-8 text-center gap-4">
              {/* eslint-disable-next-line react/jsx-no-target-blank */}
              <a
                href="https://fazier.com/launches/bylineseo.com"
                target="_blank"
                rel="noopener"
                style={{ display: 'inline-block', textDecoration: 'none' }}
                aria-label="Featured on Fazier"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://fazier.com/api/v1//public/badges/launch_badges.svg?badge_type=featured&theme=light"
                  alt="Fazier badge"
                  width={250}
                  style={{ display: 'block', width: '200px', maxWidth: '100%', height: 'auto', border: 0, outline: 'none', textDecoration: 'none' }}
                />
              </a>
              <p className="text-xs text-[#998876]">
                Listed on <a href="https://fazier.com/launches/bylineseo.com" rel="noopener" target="_blank" className="underline hover:text-[#1C1917]">fazier.com</a>.
              </p>
            </div>
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
