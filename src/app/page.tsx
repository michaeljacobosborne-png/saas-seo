import Link from 'next/link'
import { Search, FileText, Sparkles, Check, X } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Byline — Content that ranks. An agent that fixes it.',
  description:
    'Byline is the only SEO platform with an editorial agent that reads your article, identifies what\'s holding it back, and rewrites the weak sections — directly inside your editor.',
}

function GuaranteeLine({ light = false }: { light?: boolean }) {
  return (
    <p className={`text-xs mt-3 ${light ? 'text-indigo-200' : 'text-gray-400'}`}>
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
            ? 'bg-white text-indigo-700 hover:bg-indigo-50'
            : 'bg-indigo-600 text-white hover:bg-indigo-700'
        }`}
      >
        Start writing content that ranks
      </Link>
      <GuaranteeLine light={light} />
    </div>
  )
}

const COMPARISON_ROWS = [
  { feature: 'Editorial agent that rewrites', byline: true, other: false },
  { feature: 'Applies fixes to editor', byline: true, other: false },
  { feature: 'Conversational keyword discovery', byline: true, other: false },
  { feature: 'AEO + GEO scoring', byline: true, other: 'partial' as const },
  { feature: 'Agent memory across sessions', byline: true, other: false },
  { feature: 'Price', byline: 'From $49', other: 'From $89' },
]

export default function HomePage() {
  return (
    <div className="min-h-full bg-white text-gray-900">

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-bold text-xl text-gray-900 tracking-tight">Byline</span>
          <div className="flex items-center gap-4">
            <Link href="/pricing" className="text-sm text-gray-600 hover:text-gray-900 transition-colors hidden sm:block">
              Pricing
            </Link>
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 transition-colors hidden sm:block">
              Log in
            </Link>
            <Link
              href="/pricing"
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Section 1: Hero ── */}
      <section className="pt-20 pb-24 px-6 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6 leading-tight">
            Content that ranks.<br className="hidden sm:block" /> An agent that fixes it.
          </h1>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            Byline is the only SEO platform with an editorial agent that reads your article, identifies
            what&apos;s holding it back, and rewrites the weak sections — directly inside your editor.
          </p>
          <PrimaryCta />
        </div>

        {/* Hero visual placeholder */}
        <div className="mt-16 max-w-4xl mx-auto">
          <div className="rounded-2xl border border-gray-200 shadow-2xl overflow-hidden bg-white">
            {/* Browser chrome */}
            <div className="bg-gray-100 px-4 py-3 flex items-center gap-2 border-b border-gray-200">
              <div className="flex gap-1.5 flex-shrink-0">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 mx-4 bg-white rounded-md px-3 py-1 text-xs text-gray-400 border border-gray-200 truncate text-center">
                app.byline.so/articles/ranking-for-commercial-keywords
              </div>
            </div>
            {/* Two-panel app mockup */}
            <div className="grid grid-cols-2 divide-x divide-gray-200">
              {/* Left: Editor */}
              <div className="p-5 bg-white min-h-52">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
                  <div className="h-2.5 w-2.5 rounded bg-indigo-500" />
                  <span className="text-xs font-medium text-gray-500">Article Editor</span>
                  <div className="ml-auto flex gap-2">
                    <div className="h-2 w-8 rounded bg-gray-200" />
                    <div className="h-2 w-8 rounded bg-gray-200" />
                  </div>
                </div>
                <div className="space-y-2.5">
                  <div className="h-5 w-3/4 rounded bg-gray-800" />
                  <div className="h-3 w-full rounded bg-gray-200" />
                  <div className="h-3 w-5/6 rounded bg-gray-200" />
                  <div className="h-3 w-4/5 rounded bg-gray-200" />
                  <div className="h-4 w-2/3 rounded bg-gray-700 mt-4" />
                  {/* Highlighted lines (agent flagged these) */}
                  <div className="h-3 w-full rounded bg-yellow-100 border border-yellow-300" />
                  <div className="h-3 w-5/6 rounded bg-yellow-100 border border-yellow-300" />
                  <div className="h-3 w-4/5 rounded bg-gray-200" />
                  <div className="h-3 w-full rounded bg-gray-200" />
                  <div className="h-3 w-3/4 rounded bg-gray-200" />
                </div>
              </div>
              {/* Right: Agent chat */}
              <div className="p-5 bg-gray-50 min-h-52">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
                  <div className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                  <span className="text-xs font-medium text-gray-500">Editorial Agent</span>
                </div>
                <div className="space-y-3 text-xs">
                  <div className="bg-indigo-600 text-white rounded-xl rounded-tl-sm px-3 py-2.5 max-w-xs leading-relaxed">
                    Your H2 on line 4 is too generic — try{' '}
                    <span className="font-semibold">&ldquo;How to Rank for Commercial Keywords in 5 Steps&rdquo;</span>
                    {' '}instead.
                  </div>
                  <div className="flex justify-end">
                    <div className="bg-white border border-gray-200 rounded-xl rounded-tr-sm px-3 py-2.5 max-w-[160px] text-gray-700">
                      Rewrite it
                    </div>
                  </div>
                  <div className="bg-indigo-600 text-white rounded-xl rounded-tl-sm px-3 py-2.5 max-w-xs leading-relaxed">
                    <span className="opacity-90">Done. Changed H2 to &ldquo;How to Rank for Commercial Keywords in 5 Steps&rdquo; and updated the opening sentence to match.</span>
                    <span className="flex items-center gap-1 mt-2 bg-white/20 w-fit px-2 py-0.5 rounded text-[10px] font-medium">
                      ✓ Applied
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-400 mt-3">The editorial agent — live inside your editor</p>
        </div>
      </section>

      {/* ── Section 2: Workflow strip ── */}
      <section className="bg-gray-50 px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-3 text-gray-900">
            From keyword to ranked article in under 30 minutes.
          </h2>
          <p className="text-center text-gray-500 mb-14 max-w-xl mx-auto">
            One workflow. Research, generate, score, and fix — all without leaving Byline.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl p-7 shadow-sm border border-gray-100">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center mb-5">
                <Search className="w-6 h-6 text-indigo-600" />
              </div>
              <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-2">
                Step 1 — Research
              </div>
              <h3 className="text-lg font-bold mb-3 text-gray-900">Discover the right keywords</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Tell the discovery agent your topic and audience. It asks the right questions and generates
                15–20 targeted keyword seeds before touching the API — so your results are specific, not generic.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-7 shadow-sm border border-gray-100">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center mb-5">
                <FileText className="w-6 h-6 text-indigo-600" />
              </div>
              <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-2">
                Step 2 — Generate
              </div>
              <h3 className="text-lg font-bold mb-3 text-gray-900">Generate an article that actually fits</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Choose your target word count. Byline generates a fully structured, SEO-optimized article
                matched to the keyword&apos;s search intent — then scores it across SEO, readability, GEO, and AEO.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-7 shadow-sm border border-gray-100">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center mb-5">
                <Sparkles className="w-6 h-6 text-indigo-600" />
              </div>
              <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-2">
                Step 3 — Optimize
              </div>
              <h3 className="text-lg font-bold mb-3 text-gray-900">Let the agent fix what&apos;s underperforming</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
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
            <h2 className="text-3xl font-bold mb-4 text-gray-900">Not a score. An actual fix.</h2>
            <p className="text-gray-500 max-w-xl mx-auto text-lg">
              Every other tool tells you your H2 is wrong. Byline&apos;s agent rewrites it.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            {/* Feature list */}
            <div className="space-y-8">
              <div>
                <h3 className="font-bold text-gray-900 mb-2">Review mode</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Open an article, ask the agent to review it. It reads the full content, identifies specific
                  sentences and sections, and tells you exactly what to change and why.
                </p>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-2">Assist mode</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Select any paragraph. Give an instruction. The agent rewrites it in-place and applies it
                  to your editor with one click — no copy-paste.
                </p>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-2">Score-based shortcuts</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Failed your AEO score? One click sends the agent straight to the fix — &ldquo;Add a FAQ section
                  targeting common questions about [keyword].&rdquo;
                </p>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-2">Memory</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  The agent remembers what it told you before — across sessions and articles — so it never
                  repeats itself.
                </p>
              </div>
            </div>
            {/* Assist mode mockup */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-6">
              <div className="flex items-center gap-2 mb-5 pb-4 border-b border-gray-100">
                <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                <span className="text-xs font-medium text-gray-500">Assist mode — paragraph selected</span>
              </div>
              {/* Selected / highlighted text block */}
              <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 mb-4">
                <div className="h-2.5 w-full rounded bg-blue-200 mb-2" />
                <div className="h-2.5 w-5/6 rounded bg-blue-200 mb-2" />
                <div className="h-2.5 w-4/5 rounded bg-blue-200" />
              </div>
              {/* Instruction */}
              <div className="flex items-start gap-3 bg-gray-50 rounded-lg px-4 py-3 mb-4 border border-gray-100">
                <div className="w-5 h-5 rounded-full bg-indigo-100 flex-shrink-0 flex items-center justify-center mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-indigo-600" />
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Rewrite this to include the primary keyword in the first sentence
                </p>
              </div>
              {/* Streamed response placeholder */}
              <div className="space-y-2 mb-5">
                <div className="h-2.5 w-full rounded bg-gray-100" />
                <div className="h-2.5 w-11/12 rounded bg-gray-100" />
                <div className="h-2.5 w-4/5 rounded bg-gray-100" />
                <div className="h-2.5 w-full rounded bg-gray-100" />
                <div className="h-2.5 w-3/4 rounded bg-gray-100" />
              </div>
              {/* Applied badge */}
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs font-semibold">
                  <Check className="w-3.5 h-3.5" />
                  Applied to editor
                </span>
                <span className="text-xs text-gray-400">1 click</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 4: Comparison ── */}
      <section className="bg-gray-50 px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-10 text-gray-900">Not another ChatGPT wrapper.</h2>
          <div className="space-y-6 text-gray-600 leading-relaxed text-[15px] mb-14">
            <p>
              Surfer SEO gives you a score and a keyword list. Frase gives you a content brief. Both tell you
              what&apos;s wrong. Neither one fixes it. Byline&apos;s editorial agent reads your full article, identifies
              the specific sentences holding you back, and rewrites them — directly inside your editor, with one click.
            </p>
            <p>
              The agent runs on Claude Sonnet — the model SEO professionals reach for when they need real
              editorial judgment, not generic writing tips. It&apos;s grounded in Byline&apos;s SEO framework: E-E-A-T
              signals, topical authority, AEO and GEO optimization for AI search visibility.
            </p>
            <p>
              And because Byline&apos;s keyword database is shared across accounts, your research loads from cache
              on repeat queries. Your results get faster over time, and your cost-per-article stays flat as the
              platform grows.
            </p>
          </div>
          {/* Comparison table */}
          <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white shadow-sm">
            <div className="grid grid-cols-3 bg-gray-800 text-white">
              <div className="px-5 py-4 text-sm font-semibold">Feature</div>
              <div className="px-5 py-4 text-sm font-semibold text-indigo-300">Byline</div>
              <div className="px-5 py-4 text-sm font-semibold text-gray-300">Surfer / Frase</div>
            </div>
            {COMPARISON_ROWS.map((row, i) => (
              <div
                key={row.feature}
                className={`grid grid-cols-3 border-t border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
              >
                <div className="px-5 py-3.5 text-sm text-gray-700 flex items-center">{row.feature}</div>
                <div className="px-5 py-3.5 text-sm font-medium text-indigo-600 flex items-center">
                  {typeof row.byline === 'boolean' ? (
                    row.byline
                      ? <Check className="w-4 h-4 text-indigo-600" />
                      : <X className="w-4 h-4 text-gray-300" />
                  ) : row.byline}
                </div>
                <div className="px-5 py-3.5 text-sm text-gray-500 flex items-center">
                  {typeof row.other === 'boolean' ? (
                    row.other
                      ? <Check className="w-4 h-4 text-emerald-500" />
                      : <X className="w-4 h-4 text-gray-300" />
                  ) : row.other === 'partial' ? (
                    <span className="text-amber-500 text-xs font-medium">Partial</span>
                  ) : row.other}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 5: Pricing preview ── */}
      <section className="px-6 py-20">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4 text-gray-900">Simple pricing. No usage surprises.</h2>
          <p className="text-gray-500 mb-14 max-w-xl mx-auto">
            Pick a plan and start publishing content that ranks. Upgrade or cancel anytime.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Starter */}
            <div className="rounded-2xl border border-gray-200 p-7 text-left">
              <div className="text-sm font-semibold text-gray-500 mb-1">Starter</div>
              <div className="text-3xl font-bold text-gray-900 mb-4">
                $49<span className="text-base font-normal text-gray-400">/mo</span>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed mb-6">
                Research, generate, and score articles. 8 articles per month, 5 agent sessions.
              </p>
              <Link
                href="/pricing"
                className="block w-full text-center py-2.5 rounded-lg border border-indigo-600 text-indigo-600 text-sm font-semibold hover:bg-indigo-50 transition-colors"
              >
                Get started
              </Link>
            </div>
            {/* Growth */}
            <div className="rounded-2xl border-2 border-indigo-500 p-7 text-left relative shadow-lg">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="bg-indigo-500 text-white text-xs font-bold px-3 py-1 rounded-full tracking-wide whitespace-nowrap">
                  MOST POPULAR
                </span>
              </div>
              <div className="text-sm font-semibold text-indigo-600 mb-1">Growth</div>
              <div className="text-3xl font-bold text-gray-900 mb-4">
                $99<span className="text-base font-normal text-gray-400">/mo</span>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed mb-6">
                Full agent access, unlimited articles, Assist mode, and persistent memory.
              </p>
              <Link
                href="/pricing"
                className="block w-full text-center py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
              >
                Get started
              </Link>
            </div>
            {/* Agency */}
            <div className="rounded-2xl border border-gray-200 p-7 text-left">
              <div className="text-sm font-semibold text-gray-500 mb-1">Agency</div>
              <div className="text-3xl font-bold text-gray-900 mb-4">
                $249<span className="text-base font-normal text-gray-400">/mo</span>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed mb-6">
                Multiple brand profiles, team seats, and priority support.
              </p>
              <Link
                href="/pricing"
                className="block w-full text-center py-2.5 rounded-lg border border-indigo-600 text-indigo-600 text-sm font-semibold hover:bg-indigo-50 transition-colors"
              >
                Get started
              </Link>
            </div>
          </div>
          <Link href="/pricing" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors">
            See full plan details →
          </Link>
          <p className="text-xs text-gray-400 mt-4">30-day money-back guarantee. No questions asked.</p>
        </div>
      </section>

      {/* ── Section 6: Final CTA ── */}
      <section className="bg-indigo-600 px-6 py-20 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-8 leading-tight">
            Start with a keyword. Leave with an article that ranks.
          </h2>
          <PrimaryCta light />
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-100 px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-4 text-sm text-gray-400">
          <span>&copy; {new Date().getFullYear()} Peacock Creative Services LLC</span>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-gray-600 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-gray-600 transition-colors">Terms</Link>
            <a href="mailto:policies@bylineseo.com" className="hover:text-gray-600 transition-colors">Contact</a>
          </div>
        </div>
      </footer>

    </div>
  )
}
