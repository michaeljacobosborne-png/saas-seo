import type { Metadata } from 'next'
import Link from 'next/link'
import { FOUNDER, ORG_ID, SITE_URL, graph, jsonLdString, organizationNode, personNode, websiteNode } from '@/lib/structured-data'

/**
 * About Byline and the person behind it.
 *
 * Every fact here is verifiable from a public source linked on the page. Nothing
 * about Michael's background, clients or credentials is stated until he supplies
 * it: an About page with an invented credential would be the exact failure the
 * product exists to catch. The book is confirmed by its public Audible listing.
 */

const BOOK = {
  title: "Generative Engine Optimization (GEO): The SEO Practitioner's Playbook for Ranking in AI Search",
  url: 'https://www.audible.com/pd/Generative-Engine-Optimization-GEO-Audiobook/B0H85NGH2R',
}

const PROFILES = [
  { label: 'Amazon author page', url: 'https://www.amazon.com/stores/Michael-Jacobs/author/B0H7PGQ2ZL' },
  { label: 'The book on Audible', url: BOOK.url },
  { label: 'LinkedIn', url: 'https://www.linkedin.com/in/michael-j-osborne-32bb7957/' },
  { label: 'X', url: 'https://x.com/MichaelJacobSeo' },
  { label: 'GitHub', url: 'https://github.com/michaeljacobosborne-png' },
]

const ABOUT = [
  {
    q: 'Who is behind Byline?',
    a: `Byline is built by Michael Jacobs, the author of ${BOOK.title}. The book is written for experienced SEO practitioners, content teams and agency staff, and covers how AI search systems retrieve the pages they cite, what AI crawlers need before they can read a page, and how a domain becomes a recognisable entity.`,
  },
  {
    q: 'Why does Byline work the way it does?',
    a: 'Because a finding is only worth something if you can check it. Byline scores pages in deterministic code, shows the evidence under every finding, withholds a score when it cannot read enough of a page to stand behind one, and never claims to measure whether an AI system cites you. A language model writes the explanation beside a finding and never sets the score.',
  },
  {
    q: 'What happens when Byline gets something wrong?',
    a: 'It gets fixed in the open. Auditing eight SEO agency homepages in October 2026 exposed errors in our own engine, including a CAPTCHA script read as a bot challenge and a legal company name searched for instead of the trading name. Both were fixed, tested against the real pages, and all eight sites re-run before any finding was used. Changes that move scores are recorded with a new engine version.',
  },
]

export const metadata: Metadata = {
  title: 'About Byline and Michael Jacobs | Byline',
  description:
    'Byline is an AI search readiness tool built by Michael Jacobs, author of a practitioner book on Generative Engine Optimization. How it works, why, and where to check his work.',
  alternates: { canonical: `${SITE_URL}/about` },
}

const jsonLd = graph(
  organizationNode(),
  websiteNode(),
  personNode({ slug: 'michael-osborne' }),
  {
    '@type': 'AboutPage',
    '@id': `${SITE_URL}/about#page`,
    url: `${SITE_URL}/about`,
    name: 'About Byline',
    about: { '@id': ORG_ID },
    mainEntity: { '@id': FOUNDER.id },
  },
  {
    '@type': 'Book',
    name: BOOK.title,
    author: { '@id': FOUNDER.id },
    url: BOOK.url,
  },
  {
    '@type': 'FAQPage',
    mainEntity: ABOUT.map((s) => ({ '@type': 'Question', name: s.q, acceptedAnswer: { '@type': 'Answer', text: s.a } })),
  },
)

const playfair = { fontFamily: 'var(--font-playfair, "Playfair Display", serif)' }

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#FDFAF6] text-[#1C1917]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} />

      <nav className="sticky top-0 z-50 bg-[#FDFAF6]/95 backdrop-blur border-b border-[#E7E0D6]">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/">
            <span style={{ ...playfair, fontSize: '22px', fontWeight: 900, color: '#B87333', letterSpacing: '-0.01em' }}>
              byline<span style={{ color: '#1C1917' }}>.</span>
            </span>
          </Link>
          <div className="flex items-center gap-6 text-sm">
            <Link href="/geo-analyzer" className="text-[#57534E] hover:text-[#1C1917] transition-colors">
              GEO Analyzer
            </Link>
            <Link href="/pricing" className="text-[#57534E] hover:text-[#1C1917] transition-colors">
              Pricing
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-6 pt-16 pb-20">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#B87333] mb-4">About</p>
        <h1 style={playfair} className="text-[36px] sm:text-[44px] font-bold leading-[1.1] tracking-tight mb-6">
          Byline, and the person who builds it
        </h1>
        <p className="text-lg text-[#57534E] leading-relaxed mb-14">
          Byline is an AI search readiness tool for SEOs. It scores whether a page can be retrieved and cited by
          AI search, in code, with the evidence under every finding. It is built by Michael Jacobs.
        </p>

        <div className="space-y-12 text-[17px] text-[#57534E] leading-relaxed">
          {ABOUT.map((s) => (
            <section key={s.q}>
              <h2 style={playfair} className="text-2xl sm:text-3xl font-bold text-[#1C1917] mb-4 leading-tight">
                {s.q}
              </h2>
              <p>{s.a}</p>
              {s.q === 'What happens when Byline gets something wrong?' && (
                <p className="mt-4">
                  The findings from those eight audits are summarised on the{' '}
                  <Link href="/" className="text-[#B87333] underline">homepage</Link>, and the full rubric is on the{' '}
                  <Link href="/geo-analyzer" className="text-[#B87333] underline">GEO Analyzer page</Link>.
                </p>
              )}
            </section>
          ))}

          <section>
            <h2 style={playfair} className="text-2xl sm:text-3xl font-bold text-[#1C1917] mb-4 leading-tight">
              Where can I check Michael&apos;s work?
            </h2>
            <ul className="space-y-2">
              {PROFILES.map((p) => (
                <li key={p.url}>
                  <a href={p.url} rel="noopener me" target="_blank" className="text-[#B87333] underline">
                    {p.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 style={playfair} className="text-2xl sm:text-3xl font-bold text-[#1C1917] mb-4 leading-tight">
              How do I get in touch?
            </h2>
            <p>
              Email{' '}
              <a href="mailto:hi@bylineseo.com" className="text-[#B87333] underline">hi@bylineseo.com</a>. Byline is
              operated by Peacock Creative Services LLC.
            </p>
          </section>
        </div>
      </main>
    </div>
  )
}
