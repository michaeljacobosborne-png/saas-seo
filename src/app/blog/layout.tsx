import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    default: 'Byline Blog — SEO, content, and AEO insights',
    template: '%s — Byline Blog',
  },
  description:
    'Practical guides on SEO, content operations, and answer-engine optimization from the team building Byline.',
}

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full bg-[#1C1917] text-[var(--cream)] flex flex-col flex-1">
      <nav className="sticky top-0 z-50 bg-[#1C1917]/95 backdrop-blur border-b border-[rgba(184,115,51,0.15)]">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link
            href="/"
            style={{
              fontFamily: 'var(--font-playfair, "Playfair Display", serif)',
              fontSize: '22px',
              fontWeight: 900,
              color: '#F7F3EC',
              letterSpacing: '-0.01em',
            }}
          >
            Byline<span style={{ color: '#B87333' }}>.</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/blog"
              className="text-sm text-[#A89070] hover:text-[var(--cream)] transition-colors hidden sm:block"
            >
              Blog
            </Link>
            <Link
              href="/pricing"
              className="text-sm text-[#A89070] hover:text-[var(--cream)] transition-colors hidden sm:block"
            >
              Pricing
            </Link>
            <Link
              href="/login"
              className="text-sm font-medium px-4 py-2 rounded-lg bg-[#B87333] text-[#1C1917] hover:bg-[#D4954A] transition-colors"
            >
              Try Byline
            </Link>
          </div>
        </div>
      </nav>

      <div className="flex-1">{children}</div>

      <footer className="border-t border-[rgba(184,115,51,0.15)] mt-20">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-[#7A6555]">
          <span>© {new Date().getFullYear()} Byline</span>
          <Link href="/blog" className="hover:text-[#A89070] transition-colors">
            Blog
          </Link>
          <Link href="/pricing" className="hover:text-[#A89070] transition-colors">
            Pricing
          </Link>
          <Link href="/privacy" className="hover:text-[#A89070] transition-colors">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-[#A89070] transition-colors">
            Terms
          </Link>
        </div>
      </footer>
    </div>
  )
}
