import Link from 'next/link'
import { Search, FileText, Sparkles, Check } from 'lucide-react'
import type { Metadata } from 'next'
import NavLinks from './_components/NavLinks'
import FounderBanner from './_components/FounderBanner'
import { ORG_ID, SITE_URL, graph, jsonLdString, organizationNode, personNode, websiteNode } from '@/lib/structured-data'

export const metadata: Metadata = {
  title: 'Byline — AI SEO Writing Tool That Researches, Generates & Fixes Content',
  description:
    'Byline is the AI SEO platform that researches real keywords, generates articles, and rewrites weak sections with an editorial agent — directly inside your editor. Try it free.',
  alternates: {
    canonical: 'https://app.bylineseo.com',
  },
  openGraph: {
    title: 'Byline — AI SEO Writing Tool That Researches, Generates & Fixes Content',
    description:
      'The AI SEO platform with real keyword data, AI article generation, and an editorial agent that rewrites what\'s holding you back.',
    url: 'https://app.bylineseo.com',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Byline — AI SEO Writing Tool',
    description: 'Real keyword data. AI content generation. An editorial agent that fixes what\'s holding you back.',
  },
}

function GuaranteeLine({ light = false }: { light?: boolean }) {
  return (
    <p className={`text-xs mt-3 ${light ? 'text-[#F7F3EC]/70' : 'text-[#7A6555]'}`}>
      30-day money-back guarantee. No questions asked.
    </p>
  )
}

function PrimaryCta({ light = false }: { light?: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <Link
        href="/pricing"
        className={`inline-flex items-center px-8 py-4 rounded-xl text-base font-semibold transition-colors ${
          light
            ? 'bg-[#1C1917] text-[#B87333] hover:bg-[#231F1B]'
            : 'bg-[#B87333] text-[#F7F3EC] hover:bg-[#A0622A]'
        }`}
      >
        Score your first draft
      </Link>
      <GuaranteeLine light={light} />
    </div>
  )
}

const jsonLd = graph(organizationNode(), websiteNode(), personNode({ slug: 'michael-osborne' }), {
  '@type': 'SoftwareApplication',
  '@id': `${SITE_URL}/#software`,
  name: 'Byline',
  url: SITE_URL,
  publisher: { '@id': ORG_ID },
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description:
    'AI SEO platform with real keyword research, article generation, and an editorial agent that identifies and rewrites weak content sections.',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    description: 'Free trial available',
  },
  featureList: [
    'AI keyword research',
    'SEO content generation',
    'Editorial rewrite agent',
    'GEO (Generative Engine Optimization) scoring',
    'Answer Optimization analysis',
    'Free SEO audit tool',
  ],
})

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }}
      />
    <div className="min-h-full bg-[#1C1917] text-[#F7F3EC]">

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 bg-[#1C1917]/95 backdrop-blur border-b border-[rgba(184,115,51,0.15)]">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <span style={{ fontFamily: 'var(--font-playfair, "Playfair Display", serif)', fontSize: '22px', fontWeight: 900, color: '#F7F3EC', letterSpacing: '-0.01em' }}>Byline<span style={{ color: '#B87333' }}>.</span></span>
          <NavLinks />
        </div>
      </nav>

      {/* ── Section 1: Hero ── */}
      <section className="pt-20 pb-24 px-6 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6 leading-tight">
            Scored from your page.<br className="hidden sm:block" /> An agent that fixes it.
          </h1>
          <p className="text-xl text-[#A89070] max-w-2xl mx-auto mb-10 leading-relaxed">
            Byline scores your article in code, shows the evidence behind every finding, and its editorial
            agent rewrites the flagged sections — directly inside your editor.
          </p>
          <PrimaryCta />
        </div>

        {/* Hero visual */}
        <div className="mt-16 max-w-5xl mx-auto">
          <div className="rounded-2xl border border-[rgba(184,115,51,0.2)] shadow-2xl overflow-hidden">
            <div className="bg-[#2A2420] px-4 py-3 flex items-center gap-2 border-b border-[rgba(184,115,51,0.2)]">
              <div className="flex gap-1.5"><div className="w-3 h-3 rounded-full bg-red-400" /><div className="w-3 h-3 rounded-full bg-yellow-400" /><div className="w-3 h-3 rounded-full bg-green-400" /></div>
              <div className="flex-1 mx-4 bg-[#1C1917] rounded-md px-3 py-1 text-xs text-[#7A6555] border border-[rgba(184,115,51,0.2)] truncate text-center">app.bylineseo.com/articles</div>
            </div>
            <div className="grid grid-cols-2">
              <img src="/dashboard-screenshot-1.png" alt="Byline article editor" className="w-full" />
              <img src="/dashboard-screenshot-2.png" alt="Byline editorial agent" className="w-full border-l border-[rgba(184,115,51,0.2)]" />
            </div>
          </div>
          <p className="text-sm text-[#7A6555] mt-3">The editorial agent — live inside your editor</p>
        </div>
      </section>

      {/* ── Comparison ── */}
      <section className="bg-[#231F1B] px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-10 text-[#F7F3EC]">Not another ChatGPT wrapper.</h2>
          <div className="space-y-6 text-[#A89070] leading-relaxed text-[15px]">
            <p>
              Surfer SEO gives you a score and a keyword list. Frase gives you a content brief. Both tell you
              what&apos;s wrong. Neither one fixes it. Byline&apos;s editorial agent reads your full article, identifies
              the specific sentences holding you back, and rewrites them — directly inside your editor, with one click.
            </p>
            <p>
              The findings come from deterministic code that reads your page, with the evidence shown under each
              one. The agent, which runs on Claude Sonnet, writes the fix. It never sets a score. Byline does not
              measure AI visibility, and nothing that reads a page&apos;s HTML can.
            </p>
            <p>
              And because Byline&apos;s keyword database is shared across accounts, your research loads from cache
              on repeat queries. Your results get faster over time, and your cost-per-article stays flat as the
              platform grows.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 2: Workflow strip ── */}
      <section className="bg-[#231F1B] px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-3 text-[#F7F3EC]">
            From keyword to scored draft in one workflow.
          </h2>
          <p className="text-center text-[#A89070] mb-14 max-w-xl mx-auto">
            One workflow. Research, generate, score, and fix — all without leaving Byline.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#1C1917] rounded-2xl p-7 shadow-sm border border-[rgba(184,115,51,0.15)]">
              <div className="flex items-center gap-3 mb-5">
                <span className="w-8 h-8 rounded-full bg-[#B87333] text-[#F7F3EC] flex items-center justify-center text-sm font-bold flex-shrink-0">1</span>
                <div className="w-12 h-12 rounded-xl bg-[rgba(184,115,51,0.08)] flex items-center justify-center">
                  <Search className="w-6 h-6 text-[#B87333]" />
                </div>
              </div>
              <div className="text-xs font-semibold text-[#B87333] uppercase tracking-wider mb-2">
                Step 1 — Research
              </div>
              <h3 className="text-lg font-bold mb-3 text-[#F7F3EC]">Discover the right keywords</h3>
              <p className="text-[#A89070] text-sm leading-relaxed">
                Tell the discovery agent your topic and audience. It asks the right questions and generates
                15–20 targeted keyword seeds before touching the API — so your results are specific, not generic.
              </p>
            </div>
            <div className="bg-[#1C1917] rounded-2xl p-7 shadow-sm border border-[rgba(184,115,51,0.15)]">
              <div className="flex items-center gap-3 mb-5">
                <span className="w-8 h-8 rounded-full bg-[#B87333] text-[#F7F3EC] flex items-center justify-center text-sm font-bold flex-shrink-0">2</span>
                <div className="w-12 h-12 rounded-xl bg-[rgba(184,115,51,0.08)] flex items-center justify-center">
                  <FileText className="w-6 h-6 text-[#B87333]" />
                </div>
              </div>
              <div className="text-xs font-semibold text-[#B87333] uppercase tracking-wider mb-2">
                Step 2 — Generate
              </div>
              <h3 className="text-lg font-bold mb-3 text-[#F7F3EC]">Generate an article that actually fits</h3>
              <p className="text-[#A89070] text-sm leading-relaxed">
                Choose your target word count. Byline generates a fully structured, SEO-optimized article
                matched to the keyword&apos;s search intent — then checks it for how retrievable and citable it is before you publish.
              </p>
            </div>
            <div className="bg-[#1C1917] rounded-2xl p-7 shadow-sm border border-[rgba(184,115,51,0.15)]">
              <div className="flex items-center gap-3 mb-5">
                <span className="w-8 h-8 rounded-full bg-[#B87333] text-[#F7F3EC] flex items-center justify-center text-sm font-bold flex-shrink-0">3</span>
                <div className="w-12 h-12 rounded-xl bg-[rgba(184,115,51,0.08)] flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-[#B87333]" />
                </div>
              </div>
              <div className="text-xs font-semibold text-[#B87333] uppercase tracking-wider mb-2">
                Step 3 — Optimize
              </div>
              <h3 className="text-lg font-bold mb-3 text-[#F7F3EC]">Let the agent fix what&apos;s underperforming</h3>
              <p className="text-[#A89070] text-sm leading-relaxed">
                Select any section. Tell the agent to rewrite it. The fix drops in directly — no copy-paste,
                no leaving the editor. The agent also surfaces content gaps and suggests your next article.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 3: Agent demo ── */}
      <section className="px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4 text-[#F7F3EC]">Not a score. An actual fix.</h2>
            <p className="text-[#A89070] max-w-xl mx-auto text-lg">
              Every other tool tells you your H2 is wrong. Byline&apos;s agent rewrites it.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            {/* Feature list */}
            <div className="space-y-8">
              <div>
                <h3 className="font-bold text-[#F7F3EC] mb-2">Review mode</h3>
                <p className="text-[#A89070] text-sm leading-relaxed">
                  Open an article, ask the agent to review it. It reads the full content, identifies specific
                  sentences and sections, and tells you exactly what to change and why.
                </p>
              </div>
              <div>
                <h3 className="font-bold text-[#F7F3EC] mb-2">Assist mode</h3>
                <p className="text-[#A89070] text-sm leading-relaxed">
                  Select any paragraph. Give an instruction. The agent rewrites it in-place and applies it
                  to your editor with one click — no copy-paste.
                </p>
              </div>
              <div>
                <h3 className="font-bold text-[#F7F3EC] mb-2">Score-based shortcuts</h3>
                <p className="text-[#A89070] text-sm leading-relaxed">
                  Failed your AEO score? One click sends the agent straight to the fix — &ldquo;Add a FAQ section
                  targeting common questions about [keyword].&rdquo;
                </p>
              </div>
              <div>
                <h3 className="font-bold text-[#F7F3EC] mb-2">Agent Memory</h3>
                <p className="text-[#A89070] text-sm leading-relaxed">
                  The agent remembers what it told you before — across sessions and articles — so it never
                  repeats itself.
                </p>
              </div>
            </div>
            {/* Assist mode mockup */}
            <div className="bg-[#1C1917] rounded-2xl border border-[rgba(184,115,51,0.2)] shadow-lg p-6">
              <div className="flex items-center gap-2 mb-5 pb-4 border-b border-[rgba(184,115,51,0.15)]">
                <div className="w-2.5 h-2.5 rounded-full bg-[rgba(184,115,51,0.08)]0" />
                <span className="text-xs font-medium text-[#A89070]">Assist mode — paragraph selected</span>
              </div>
              {/* Selected / highlighted text block */}
              <div className="rounded-lg bg-[rgba(184,115,51,0.08)] border border-blue-200 px-4 py-3 mb-4">
                <div className="h-2.5 w-full rounded bg-blue-200 mb-2" />
                <div className="h-2.5 w-5/6 rounded bg-blue-200 mb-2" />
                <div className="h-2.5 w-4/5 rounded bg-blue-200" />
              </div>
              {/* Instruction */}
              <div className="flex items-start gap-3 bg-[#231F1B] rounded-lg px-4 py-3 mb-4 border border-[rgba(184,115,51,0.15)]">
                <div className="w-5 h-5 rounded-full bg-[rgba(184,115,51,0.12)] flex-shrink-0 flex items-center justify-center mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-[#B87333]" />
                </div>
                <p className="text-xs text-[#A89070] leading-relaxed">
                  Rewrite this to include the primary keyword in the first sentence
                </p>
              </div>
              {/* Streamed response placeholder */}
              <div className="space-y-2 mb-5">
                <div className="h-2.5 w-full rounded bg-[#2A2420]" />
                <div className="h-2.5 w-11/12 rounded bg-[#2A2420]" />
                <div className="h-2.5 w-4/5 rounded bg-[#2A2420]" />
                <div className="h-2.5 w-full rounded bg-[#2A2420]" />
                <div className="h-2.5 w-3/4 rounded bg-[#2A2420]" />
              </div>
              {/* Applied badge */}
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 bg-[rgba(184,115,51,0.12)] text-[#D4954A] border border-[rgba(184,115,51,0.3)] px-3 py-1.5 rounded-lg text-xs font-semibold">
                  <Check className="w-3.5 h-3.5" />
                  Applied to editor
                </span>
                <span className="text-xs text-[#7A6555]">1 click</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Social proof ── */}

      <FounderBanner />

      {/* ── Section 5: Pricing preview ── */}
      <section className="px-6 py-20">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4 text-[#F7F3EC]">Simple pricing. Start small, scale when you&apos;re ready.</h2>
          <p className="text-[#A89070] mb-14 max-w-xl mx-auto">
            Pick a plan and score every draft before you publish it. Upgrade or cancel anytime.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Starter */}
            <div className="rounded-2xl border border-[rgba(184,115,51,0.2)] p-7 text-left">
              <div className="text-sm font-semibold text-[#A89070] mb-1">Starter</div>
              <div className="text-3xl font-bold text-[#F7F3EC] mb-4">
                $49<span className="text-base font-normal text-[#7A6555]">/mo</span>
              </div>
              <p className="text-sm text-[#A89070] leading-relaxed mb-6">
                Research, generate, and score articles. 8 articles per month, 10 keyword sessions.
              </p>
              <Link
                href="/pricing"
                className="block w-full text-center py-2.5 rounded-lg border border-[#B87333] text-[#B87333] text-sm font-semibold hover:bg-[rgba(184,115,51,0.08)] transition-colors"
              >
                Get started
              </Link>
            </div>
            {/* Growth */}
            <div className="rounded-2xl border-2 border-[#B87333] p-7 text-left relative shadow-lg">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="bg-[#B87333] text-[#F7F3EC] text-xs font-bold px-3 py-1 rounded-full tracking-wide whitespace-nowrap">
                  MOST POPULAR
                </span>
              </div>
              <div className="text-sm font-semibold text-[#B87333] mb-1">Growth</div>
              <div className="text-3xl font-bold text-[#F7F3EC] mb-4">
                $99<span className="text-base font-normal text-[#7A6555]">/mo</span>
              </div>
              <p className="text-sm text-[#A89070] leading-relaxed mb-6">
                Full agent access, 30 articles a month, Assist mode, and persistent memory.
              </p>
              <Link
                href="/pricing"
                className="block w-full text-center py-2.5 rounded-lg bg-[#B87333] text-[#F7F3EC] text-sm font-semibold hover:bg-[#A0622A] transition-colors"
              >
                Get started
              </Link>
            </div>
            {/* Multi-Brand */}
            <div className="rounded-2xl border border-[rgba(184,115,51,0.2)] p-7 text-left">
              <div className="text-sm font-semibold text-[#A89070] mb-1">Multi-Brand</div>
              <div className="text-3xl font-bold text-[#F7F3EC] mb-4">
                $249<span className="text-base font-normal text-[#7A6555]">/mo</span>
              </div>
              <p className="text-sm text-[#A89070] leading-relaxed mb-6">
                Multiple brand profiles, team seats, and priority support.
              </p>
              <Link
                href="/pricing"
                className="block w-full text-center py-2.5 rounded-lg border border-[#B87333] text-[#B87333] text-sm font-semibold hover:bg-[rgba(184,115,51,0.08)] transition-colors"
              >
                Get started
              </Link>
            </div>
          </div>
          <Link href="/pricing" className="text-sm text-[#B87333] hover:text-[#A0622A] font-medium transition-colors">
            See full plan details →
          </Link>
          <p className="text-xs text-[#7A6555] mt-4">30-day money-back guarantee. No questions asked.</p>
        </div>
      </section>

      {/* ── Section 6: Final CTA ── */}
      <section className="bg-[#B87333] px-6 py-20 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-[#F7F3EC] mb-8 leading-tight">
            Start with a keyword. Leave with a draft you can check line by line.
          </h2>
          <PrimaryCta light />
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[rgba(184,115,51,0.15)] px-6 pt-14 pb-10">
        <div className="max-w-5xl mx-auto">
          {/* Column grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-10 mb-12">
            {/* Brand */}
            <div className="col-span-2 sm:col-span-1">
              <p className="text-[#B87333] font-semibold text-base mb-3">Byline</p>
              <p className="text-[#7A6555] text-sm leading-relaxed">
                Content structured for search and easy for AI engines to read, quote and credit.
              </p>
            </div>

            {/* Free Tools */}
            <div>
              <p className="text-[#A89070] text-xs font-semibold uppercase tracking-wider mb-4">Free Tools</p>
              <ul className="space-y-3 text-sm text-[#7A6555]">
                <li><Link href="/geo-analyzer" className="hover:text-[#A89070] transition-colors">GEO Analyzer</Link></li>
                <li><Link href="/ao-analyzer" className="hover:text-[#A89070] transition-colors">AO Analyzer</Link></li>
                <li><Link href="/audit" className="hover:text-[#A89070] transition-colors">Content Audit</Link></li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <p className="text-[#A89070] text-xs font-semibold uppercase tracking-wider mb-4">Company</p>
              <ul className="space-y-3 text-sm text-[#7A6555]">
                <li><Link href="/pricing" className="hover:text-[#A89070] transition-colors">Pricing</Link></li>
                <li><Link href="/blog" className="hover:text-[#A89070] transition-colors">Blog</Link></li>
                <li><Link href="/affiliates" className="hover:text-[#A89070] transition-colors">Affiliates</Link></li>
                <li><a href="mailto:policies@bylineseo.com" className="hover:text-[#A89070] transition-colors">Contact</a></li>
              </ul>
            </div>

            {/* Account */}
            <div>
              <p className="text-[#A89070] text-xs font-semibold uppercase tracking-wider mb-4">Account</p>
              <ul className="space-y-3 text-sm text-[#7A6555]">
                <li><Link href="/login" className="hover:text-[#A89070] transition-colors">Log In</Link></li>
                <li><Link href="/signup" className="hover:text-[#A89070] transition-colors">Sign Up</Link></li>
                <li><Link href="/privacy" className="hover:text-[#A89070] transition-colors">Privacy</Link></li>
                <li><Link href="/terms" className="hover:text-[#A89070] transition-colors">Terms</Link></li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-8 border-t border-[rgba(184,115,51,0.12)] text-xs text-[#7A6555]">
            <span>&copy; {new Date().getFullYear()} Peacock Creative Services LLC</span>
            <div className="flex items-center gap-5">
              <a href="#" aria-label="Byline on X" className="hover:text-[#A89070] transition-colors">X</a>
              <a href="#" aria-label="Byline on LinkedIn" className="hover:text-[#A89070] transition-colors">LinkedIn</a>
            </div>
          </div>
        </div>
      </footer>

    </div>
    </>
  )
}
