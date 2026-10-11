import Link from 'next/link'
import { Search, FileText, Sparkles, Check } from 'lucide-react'
import type { Metadata } from 'next'
import NavLinks from './_components/NavLinks'
import FounderBanner from './_components/FounderBanner'
import { ORG_ID, SITE_URL, graph, jsonLdString, organizationNode, personNode, websiteNode } from '@/lib/structured-data'
import { ENGINE_VERSION } from '@/lib/geo-audit/types'

export const metadata: Metadata = {
  title: 'Byline: AI search readiness, scored from your page with the evidence',
  description:
    'Byline scores whether AI search can reach, parse and lift a clean passage from your pages, with the evidence behind every finding. It withholds the score when it cannot read enough to publish one. It does not measure AI visibility.',
  alternates: {
    canonical: 'https://app.bylineseo.com',
  },
  openGraph: {
    title: 'Byline: AI search readiness, scored from your page',
    description:
      'Two scores, rule-derived in code. Retrievable out of 100, Citable as a band. Evidence under every finding, and no score at all when the evidence is thin.',
    url: 'https://app.bylineseo.com',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Byline: AI search readiness, scored from your page',
    description: 'Rule-derived scores for AI search readiness, with the evidence shown. No visibility claims, no ranking forecasts.',
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

/**
 * The opening answer to each question heading, used both on the page and in the
 * FAQPage markup so the two can never say different things. Every figure here
 * has a public source linked beside it on the page.
 */
const FAQ = [
  {
    question: 'What does Byline do?',
    answer:
      'Byline reads a page the way a crawler does and scores two things. Retrievable is a score out of 100 for whether an engine can reach the page, parse it and lift a clean passage out of it. Citable is a band for whether a lifted passage carries anything that points back to you, such as a named author or data only you publish.',
  },
  {
    question: 'Why does Byline score the page instead of AI answers?',
    answer:
      "Because citations move when nothing on the page changes. Otterly.AI reported that between July and September 2026 Reddit's share of ChatGPT citations fell 94% while its share of Perplexity citations rose 86%. In Semrush's 30-day test, Google AI Mode cited 48 of 81 unchanged pages on day six and 21 on day thirty.",
  },
  {
    question: 'What do other AI readiness scores report?',
    answer:
      "Otterly.AI, an AI search monitoring vendor, also publishes a content readiness score. Its public API describes that score as 13 named dimensions, such as specificity and paragraph cohesion, each returned as a number from 0 to 100 with a free-text explanation.",
  },
  {
    question: "How is Byline's approach different?",
    answer:
      "Each Byline finding names its threshold and quotes what it found. 'Self-contained sections 0/8: no section pairs a heading with enough prose to stand alone (target: 8+ sections of 40+ words)' is a line you can check in a browser in a minute. Factors that cannot be checked are marked unable to assess and left out of the total, never scored as zero.",
  },
]

const jsonLd = graph(organizationNode(), websiteNode(), personNode({ slug: 'michael-osborne' }), {
  '@type': 'FAQPage',
  '@id': `${SITE_URL}/#faq`,
  mainEntity: FAQ.map((f) => ({
    '@type': 'Question',
    name: f.question,
    acceptedAnswer: { '@type': 'Answer', text: f.answer },
  })),
}, {
  '@type': 'SoftwareApplication',
  '@id': `${SITE_URL}/#software`,
  name: 'Byline',
  url: SITE_URL,
  publisher: { '@id': ORG_ID },
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description:
    'Scores how ready a page is for AI search to reach, parse and quote, in deterministic code with the evidence shown, and drafts articles scored against the same rubric before they publish.',
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
    'Free content map',
    'Evidence shown for every finding',
    'Deterministic scoring, no model-set scores',
    'Stored run history with engine version',
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
            Byline is an AI search readiness tool for SEOs. It scores whether a page can be retrieved and
            cited, in code, with the evidence under every finding.
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
          <p className="text-sm text-[#7A6555] mt-3">The editorial agent, live inside your editor</p>
        </div>
      </section>

      {/* ── The four questions a practitioner arrives with, then the evidence ── */}
      <section className="bg-[#231F1B] px-6 py-20">
        <div className="max-w-3xl mx-auto space-y-16 text-[#A89070] leading-relaxed text-[15px]">
          <div>
            <h2 className="text-3xl font-bold mb-6 text-[#F7F3EC]">What does Byline do?</h2>
            <div className="space-y-5">
              <p>{FAQ[0].answer}</p>
              <p>
                Every finding shows the evidence it was scored from, down to the heading text as found or the line
                in your robots.txt that decided a crawler&apos;s access. When too little of a page can be read, Byline
                publishes no score rather than a guess. The same rubric scores drafts in the editor before you
                publish them.
              </p>
            </div>
            <h3 className="text-xl font-bold mt-10 mb-4 text-[#F7F3EC]">Retrievable vs citable</h3>
            <p className="mb-5">
              The two halves fail for different reasons and need different fixes, so Byline reports them
              separately and never blends them into one number.
            </p>
            <div className="overflow-x-auto rounded-xl border border-[rgba(184,115,51,0.2)]">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#2A2420] text-[#F7F3EC]">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold"> </th>
                    <th scope="col" className="px-4 py-3 font-semibold">Retrievable</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Citable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(184,115,51,0.15)]">
                  <tr>
                    <th scope="row" className="px-4 py-3 font-medium text-[#F7F3EC]">The question</th>
                    <td className="px-4 py-3">Can an engine reach the page, parse it and lift a clean passage?</td>
                    <td className="px-4 py-3">If a passage is lifted, does anything in it point back to you?</td>
                  </tr>
                  <tr>
                    <th scope="row" className="px-4 py-3 font-medium text-[#F7F3EC]">Reported as</th>
                    <td className="px-4 py-3">A score from 0 to 100</td>
                    <td className="px-4 py-3">A band: Strong, Adequate, Weak or Absent</td>
                  </tr>
                  <tr>
                    <th scope="row" className="px-4 py-3 font-medium text-[#F7F3EC]">What is checked</th>
                    <td className="px-4 py-3">Access 30, Parseability 25, Chunkability 25, Extractability 20</td>
                    <td className="px-4 py-3">Six attribution signals, from named authorship to original evidence</td>
                  </tr>
                  <tr>
                    <th scope="row" className="px-4 py-3 font-medium text-[#F7F3EC]">When evidence is thin</th>
                    <td className="px-4 py-3">No score below 60% of the points being assessable</td>
                    <td className="px-4 py-3">Marked unable to assess, never scored as absent</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="text-3xl font-bold mb-6 text-[#F7F3EC]">Why does Byline score the page instead of AI answers?</h2>
            <div className="space-y-5">
              <p>{FAQ[1].answer}</p>
              <p>
                A single visibility number averages those movements into something that happened to nobody. What
                stays still, and what you can change, is the page. So the score comes from deterministic code
                reading your HTML. A language model writes the explanation beside a finding and nothing else. It
                cannot set a score, a status or a band.
              </p>
              <p className="text-sm">
                Sources:{' '}
                <a href="https://otterly.ai/blog/reddit-ban-geo-experiment/" className="underline hover:text-[#F7F3EC]" rel="noopener" target="_blank">Otterly.AI, 1 October 2026</a>
                {' '}and{' '}
                <a href="https://www.semrush.com/blog/how-fast-do-ai-search-platforms-cite-new-content/" className="underline hover:text-[#F7F3EC]" rel="noopener" target="_blank">Semrush, 10 December 2025</a>.
              </p>
            </div>
          </div>

          <div>
            <h2 className="text-3xl font-bold mb-6 text-[#F7F3EC]">What do other AI readiness scores report?</h2>
            <div className="space-y-5">
              <p>{FAQ[2].answer}</p>
              <p>
                The schema has no field for text quoted from the page, and it does not say how the dimensions
                combine into the overall score. Otterly also runs prompt monitoring across AI engines, which is a
                different product; this is about its readiness score only. The schema is public, under
                PublicApiContentCheckContentAnalysis in{' '}
                <a href="https://data.otterly.ai/v1/openapi.json" className="underline hover:text-[#F7F3EC]" rel="noopener" target="_blank">Otterly&apos;s API specification</a>,
                checked on 11 October 2026.
              </p>
            </div>
          </div>

          <div>
            <h2 className="text-3xl font-bold mb-6 text-[#F7F3EC]">How is Byline&apos;s approach different?</h2>
            <div className="space-y-5">
              <p>{FAQ[3].answer}</p>
              <p>
                Every report records the engine version that produced it, currently {ENGINE_VERSION}, so two runs can be
                checked for whether the rubric moved between them. A language model never decides a score, and the
                score is withheld when the page cannot support one.
              </p>
            </div>
          </div>

          <div>
            <h2 className="text-3xl font-bold mb-6 text-[#F7F3EC]">What did we find on eight SEO agency homepages?</h2>
            <div className="space-y-5">
              <p>
                In October 2026 we audited the homepages of eight SEO agencies in the UK and US. All eight could be
                read well enough to score, between 62 and 79 on engine 2026.10. Wherever the crawler check could be
                attributed, every AI crawler was served the page. On two sites an ordinary browser request was
                refused too, so every crawler row there was reported as unknown, not blocked.
              </p>
              <p>
                The gaps were on the page. Seven of the eight had fewer than eight sections that stand alone when
                quoted. Four had no heading phrased as a question. One had its main Organization markup fail to
                parse because of a line break inside a text string.
              </p>
              <p>
                Those runs also exposed errors in our own engine: a CAPTCHA script on a contact form read as a bot
                challenge, and a legal company name searched for instead of the trading name. We fixed both and
                re-ran all eight before using any finding.
              </p>
            </div>
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
            Research, generate, score and fix, all without leaving Byline.
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
                Step 1: Research
              </div>
              <h3 className="text-lg font-bold mb-3 text-[#F7F3EC]">Discover the right keywords</h3>
              <p className="text-[#A89070] text-sm leading-relaxed">
                Tell the discovery agent your topic and audience. It asks the right questions and generates
                15–20 targeted keyword seeds before touching the API, so your results fit your topic.
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
                Step 2: Generate
              </div>
              <h3 className="text-lg font-bold mb-3 text-[#F7F3EC]">Generate an article that actually fits</h3>
              <p className="text-[#A89070] text-sm leading-relaxed">
                Choose your target word count. Byline generates a fully structured, SEO-optimized article
                matched to the keyword&apos;s search intent, then scores how retrievable and citable it is before you publish.
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
                Step 3: Optimize
              </div>
              <h3 className="text-lg font-bold mb-3 text-[#F7F3EC]">Let the agent fix what the scorer flagged</h3>
              <p className="text-[#A89070] text-sm leading-relaxed">
                Select any section. Tell the agent to rewrite it. The fix drops in directly, with no copy-paste
                and no leaving the editor. The agent also surfaces content gaps and suggests your next article.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 3: Agent demo ── */}
      <section className="px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4 text-[#F7F3EC]">How does the editorial agent fix what the scorer flags?</h2>
            <p className="text-[#A89070] max-w-xl mx-auto text-lg">
              The scorer finds the problem in code. The agent drafts the fix inside your editor, and you choose
              whether to apply it.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            {/* Feature list */}
            <div className="space-y-8">
              <div>
                <h3 className="font-bold text-[#F7F3EC] mb-2">Review mode</h3>
                <p className="text-[#A89070] text-sm leading-relaxed">
                  Ask the agent to review an article. It reads the full draft and the scorer&apos;s findings, then
                  suggests changes that quote the lines they mean.
                </p>
              </div>
              <div>
                <h3 className="font-bold text-[#F7F3EC] mb-2">Assist mode</h3>
                <p className="text-[#A89070] text-sm leading-relaxed">
                  Select any paragraph. Give an instruction. The agent rewrites it in-place and applies it
                  to your editor with one click. No copy-paste.
                </p>
              </div>
              <div>
                <h3 className="font-bold text-[#F7F3EC] mb-2">Score-based shortcuts</h3>
                <p className="text-[#A89070] text-sm leading-relaxed">
                  Failed a check? One click sends the agent straight to the fix: &ldquo;Add a FAQ section
                  targeting common questions about [keyword].&rdquo;
                </p>
              </div>
              <div>
                <h3 className="font-bold text-[#F7F3EC] mb-2">Agent Memory</h3>
                <p className="text-[#A89070] text-sm leading-relaxed">
                  The agent keeps a memory of what it has already told you, across sessions and articles.
                </p>
              </div>
            </div>
            {/* Assist mode mockup */}
            <div className="bg-[#1C1917] rounded-2xl border border-[rgba(184,115,51,0.2)] shadow-lg p-6">
              <div className="flex items-center gap-2 mb-5 pb-4 border-b border-[rgba(184,115,51,0.15)]">
                <div className="w-2.5 h-2.5 rounded-full bg-[rgba(184,115,51,0.08)]0" />
                <span className="text-xs font-medium text-[#A89070]">Assist mode: paragraph selected</span>
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
