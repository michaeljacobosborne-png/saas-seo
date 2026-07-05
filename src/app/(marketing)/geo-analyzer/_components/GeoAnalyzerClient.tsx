'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import {
  Search,
  Loader2,
  AlertCircle,
  Lock,
  ArrowRight,
  CheckCircle2,
  Mail,
} from 'lucide-react'
import NavLinks from '../../../_components/NavLinks'

interface Factor {
  name: string
  score: number
  maxScore: number
  status: 'good' | 'needs-work' | 'missing'
  detail: string
}

interface Recommendation {
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  impact: string
}

interface AnalysisResult {
  score: number
  grade: string
  breakdown: Factor[]
  recommendations: Recommendation[]
  quickWins: string[]
}

// Playfair Display is loaded globally as a CSS variable in the root layout.
const playfair = { fontFamily: 'var(--font-playfair, "Playfair Display", serif)' }

function ScoreCircle({ score, grade }: { score: number; grade: string }) {
  const color = score >= 70 ? '#16a34a' : score >= 40 ? '#d97706' : '#dc2626'
  const gradeColor = score >= 70 ? 'bg-green-100 text-green-700' : score >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
  return (
    <div className="flex items-center gap-6 mb-6">
      <div
        className="w-24 h-24 rounded-full flex items-center justify-center border-4 shrink-0"
        style={{ borderColor: color }}
      >
        <span className="text-3xl font-bold" style={{ color }}>{score}</span>
      </div>
      <div>
        <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl text-2xl font-bold mb-1 ${gradeColor}`}>
          {grade}
        </div>
        <p className="text-sm text-[#57534E]">GEO Score</p>
        <p className="text-xs text-[#998876]">out of 100</p>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: Factor['status'] }) {
  const map = {
    good: 'bg-green-100 text-green-700',
    'needs-work': 'bg-amber-100 text-amber-700',
    missing: 'bg-red-100 text-red-700',
  }
  const label = { good: 'Good', 'needs-work': 'Needs work', missing: 'Missing' }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${map[status]}`}>
      {label[status]}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: Recommendation['priority'] }) {
  const map = {
    high: 'bg-[#B87333]/12 text-[#9A6228]',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-[#F7F3EC] text-[#57534E]',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[priority]}`}>
      {priority}
    </span>
  )
}

export default function GeoAnalyzerClient() {
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [progress, setProgress] = useState({ step: 0, total: 3, message: '' })
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [emailSubmitted, setEmailSubmitted] = useState(false)
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const resultsRef = useRef<HTMLDivElement>(null)
  const heroFormRef = useRef<HTMLInputElement>(null)

  function scrollToResults() {
    requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function scrollToForm() {
    heroFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    heroFormRef.current?.focus({ preventScroll: true })
  }

  async function handleEmailSubmit() {
    const trimmed = email.trim()
    if (!trimmed || emailStatus === 'sending') return
    setEmailStatus('sending')
    try {
      const res = await fetch('/api/audit/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, url: url.trim(), source: 'geo_analyzer' }),
      })
      if (res.ok) {
        setUnlocked(true)
        setEmailSubmitted(true)
        setEmailStatus('sent')
      } else {
        setEmailStatus('error')
      }
    } catch {
      setEmailStatus('error')
    }
  }

  async function runAnalysis() {
    const trimmed = url.trim()
    if (!trimmed || status === 'loading') return
    setStatus('loading')
    setProgress({ step: 0, total: 3, message: 'Starting...' })
    setError(null)
    setResult(null)
    scrollToResults()

    try {
      const res = await fetch('/api/free-tools/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed, type: 'geo' }),
      })

      if (!res.ok || !res.body) {
        let msg = 'Analysis failed. Check the URL and try again.'
        try {
          const data = await res.json()
          if (data?.error) msg = data.error
        } catch { /* keep generic message */ }
        setError(msg)
        setStatus('error')
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let finalResult: AnalysisResult | null = null
      let streamError: string | null = null

      const handleEvent = (line: string) => {
        const trimmedLine = line.trim()
        if (!trimmedLine) return
        let evt: { type?: string; step?: number; total?: number; message?: string; error?: string } & Partial<AnalysisResult>
        try {
          evt = JSON.parse(trimmedLine)
        } catch {
          return
        }
        if (evt.type === 'progress') {
          setProgress({
            step: evt.step ?? 0,
            total: evt.total ?? 3,
            message: evt.message ?? '',
          })
        } else if (evt.type === 'result') {
          finalResult = {
            score: evt.score ?? 0,
            grade: evt.grade ?? 'F',
            breakdown: evt.breakdown ?? [],
            recommendations: evt.recommendations ?? [],
            quickWins: evt.quickWins ?? [],
          }
        } else if (evt.type === 'error') {
          streamError = evt.error ?? 'Analysis failed. Please try again.'
        }
      }

      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let nl: number
        while ((nl = buffer.indexOf('\n')) !== -1) {
          handleEvent(buffer.slice(0, nl))
          buffer = buffer.slice(nl + 1)
        }
      }
      handleEvent(buffer)

      if (streamError) {
        setError(streamError)
        setStatus('error')
      } else if (finalResult) {
        setResult(finalResult)
        setStatus('done')
      } else {
        setError('Analysis failed. Please try again.')
        setStatus('error')
      }
    } catch {
      setError('Network error. Please try again.')
      setStatus('error')
    }
  }

  const freeRecs = result?.recommendations?.slice(0, 2) ?? []
  const lockedRecs = result?.recommendations?.slice(2) ?? []

  return (
    <div className="min-h-screen bg-[#FDFAF6] text-[#1C1917]">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-[#FDFAF6]/95 backdrop-blur border-b border-[#E7E0D6]">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/">
            <span style={{ ...playfair, fontSize: '22px', fontWeight: 900, color: '#B87333', letterSpacing: '-0.01em' }}>
              byline<span style={{ color: '#1C1917' }}>.</span>
            </span>
          </Link>
          <NavLinks />
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-[#FDFAF6] px-6 pt-20 pb-20 text-center">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#B87333] mb-5">
            Free GEO Analyzer
          </p>
          <h1
            style={playfair}
            className="text-[40px] sm:text-[52px] font-bold leading-[1.08] tracking-tight text-[#1C1917] mb-6"
          >
            Is Your Site Invisible to AI?
          </h1>
          <p className="text-lg text-[#57534E] leading-relaxed max-w-2xl mx-auto mb-10">
            See your GEO score — how likely ChatGPT, Gemini, and Perplexity are to cite and
            recommend your content.
          </p>

          <div className="max-w-xl mx-auto">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#998876]" />
                <input
                  ref={heroFormRef}
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && runAnalysis()}
                  placeholder="https://yoursite.com"
                  className="w-full pl-11 pr-4 py-3.5 bg-white border border-[#E7E0D6] rounded-xl text-sm text-[#1C1917] placeholder:text-[#998876] focus:outline-none focus:ring-2 focus:ring-[#B87333]/40 focus:border-[#B87333] transition-colors"
                  disabled={status === 'loading'}
                />
              </div>
              <button
                onClick={runAnalysis}
                disabled={status === 'loading' || !url.trim()}
                className="flex items-center justify-center gap-2 px-6 py-3.5 bg-[#B87333] text-white text-sm font-semibold rounded-xl hover:bg-[#9A6228] disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
              >
                {status === 'loading' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
                Analyze My Site
              </button>
            </div>
            <p className="text-xs text-[#998876] mt-3">Free. No signup required.</p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-[#F7F3EC] px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <h2 style={playfair} className="text-3xl sm:text-4xl font-bold text-center text-[#1C1917] mb-14">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              { num: '01', heading: 'Crawl your homepage', body: 'Enter your URL and we fetch your page HTML. No login needed — we read what any visitor would see.' },
              { num: '02', heading: 'Score 7 GEO factors', body: 'We check schema markup, author signals, direct answers, factual claims, content structure, brand clarity, and freshness.' },
              { num: '03', heading: 'Get your optimization roadmap', body: 'See exactly which factors hurt your score and get a prioritized list of fixes that will improve your AI citation rate.' },
            ].map((step) => (
              <div key={step.num}>
                <div style={playfair} className="text-3xl font-bold text-[#B87333] mb-3">
                  {step.num}
                </div>
                <h3 className="text-lg font-semibold text-[#1C1917] mb-2">{step.heading}</h3>
                <p className="text-[15px] text-[#57534E] leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Results */}
      <section ref={resultsRef} className="bg-[#FDFAF6] px-6 py-12 scroll-mt-20">
        <div className="max-w-2xl mx-auto">
          {/* Loading */}
          {status === 'loading' && (
            <div className="bg-white border border-[#E7E0D6] rounded-2xl p-12 text-center mb-8">
              <Loader2 className="w-8 h-8 animate-spin text-[#B87333] mx-auto mb-4" />
              <p className="text-sm font-medium text-[#1C1917] mb-4">{progress.message || 'Analyzing...'}</p>
              <div className="flex items-center justify-center gap-1.5">
                {Array.from({ length: progress.total }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-500 ${
                      i < progress.step ? 'w-8 bg-[#B87333]' : 'w-4 bg-[#E7E0D6]'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {status === 'error' && error && (
            <div className="flex items-start gap-3 bg-[#B87333]/8 border border-[#E7E0D6] rounded-xl px-4 py-3 mb-8">
              <AlertCircle className="w-4 h-4 text-[#9A6228] mt-0.5 shrink-0" />
              <p className="text-sm text-[#1C1917]">{error}</p>
            </div>
          )}

          {/* Results */}
          {status === 'done' && result && (
            <div className="space-y-6 mb-8">
              {/* Score + Grade */}
              <div className="bg-white border border-[#E7E0D6] rounded-2xl p-6">
                <ScoreCircle score={result.score} grade={result.grade} />

                {/* 7-factor breakdown */}
                <h2 className="text-xs font-semibold text-[#998876] uppercase tracking-wide mb-4">
                  7 Factor Breakdown
                </h2>
                <div className="space-y-3">
                  {result.breakdown.map((factor, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-[#1C1917]">{factor.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[#998876]">
                            {factor.score}/{factor.maxScore}
                          </span>
                          <StatusBadge status={factor.status} />
                        </div>
                      </div>
                      <div className="h-1.5 bg-[#F7F3EC] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.round((factor.score / factor.maxScore) * 100)}%`,
                            backgroundColor:
                              factor.status === 'good'
                                ? '#16a34a'
                                : factor.status === 'needs-work'
                                ? '#d97706'
                                : '#dc2626',
                          }}
                        />
                      </div>
                      {factor.detail && (
                        <p className="text-xs text-[#57534E] mt-1">{factor.detail}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Wins */}
              {result.quickWins.length > 0 && (
                <div className="bg-white border border-[#E7E0D6] rounded-2xl p-6">
                  <h2 className="text-xs font-semibold text-[#998876] uppercase tracking-wide mb-3">
                    Quick Wins
                  </h2>
                  <ul className="space-y-2">
                    {result.quickWins.slice(0, 3).map((w, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-[#57534E]">
                        <CheckCircle2 className="w-4 h-4 text-[#B87333] mt-0.5 shrink-0" />
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendations — first 2 free */}
              {freeRecs.length > 0 && (
                <div>
                  <h2 className="text-xs font-semibold text-[#998876] uppercase tracking-wide mb-3">
                    Recommendations
                  </h2>
                  <div className="space-y-3">
                    {freeRecs.map((rec, i) => (
                      <div key={i} className="bg-white border border-[#E7E0D6] rounded-xl p-4">
                        <div className="flex items-start justify-between gap-3 mb-1.5">
                          <h3 className="text-sm font-semibold text-[#1C1917]">{rec.title}</h3>
                          <PriorityBadge priority={rec.priority} />
                        </div>
                        <p className="text-sm text-[#57534E]">{rec.description}</p>
                        {rec.impact && (
                          <p className="text-xs text-[#B87333] mt-2 font-medium">Impact: {rec.impact}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Locked recommendations */}
              {lockedRecs.length > 0 ? (
                unlocked ? (
                  <div className="space-y-3">
                    {lockedRecs.map((rec, i) => (
                      <div key={i} className="bg-white border border-[#E7E0D6] rounded-xl p-4">
                        <div className="flex items-start justify-between gap-3 mb-1.5">
                          <h3 className="text-sm font-semibold text-[#1C1917]">{rec.title}</h3>
                          <PriorityBadge priority={rec.priority} />
                        </div>
                        <p className="text-sm text-[#57534E]">{rec.description}</p>
                        {rec.impact && (
                          <p className="text-xs text-[#B87333] mt-2 font-medium">Impact: {rec.impact}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="relative">
                    {/* Blurred preview */}
                    <div className="space-y-3 blur-sm select-none pointer-events-none" aria-hidden="true">
                      {lockedRecs.map((rec, i) => (
                        <div key={i} className="bg-white border border-[#E7E0D6] rounded-xl p-4">
                          <div className="flex items-start justify-between gap-3 mb-1.5">
                            <h3 className="text-sm font-semibold text-[#1C1917]">{rec.title}</h3>
                            <PriorityBadge priority={rec.priority} />
                          </div>
                          <p className="text-sm text-[#57534E]">{rec.description}</p>
                        </div>
                      ))}
                    </div>

                    {/* Email gate overlay */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-t from-[#FDFAF6] via-[#FDFAF6]/90 to-[#FDFAF6]/30 rounded-2xl px-6 pt-10 pb-4">
                      <div className="w-10 h-10 bg-[#B87333]/12 rounded-xl flex items-center justify-center mb-3">
                        <Lock className="w-5 h-5 text-[#B87333]" />
                      </div>
                      <p className="text-base font-semibold text-[#1C1917] text-center mb-1">
                        Unlock your full GEO report
                      </p>
                      <p className="text-sm text-[#57534E] text-center mb-5">
                        {lockedRecs.length} more recommendation{lockedRecs.length !== 1 ? 's' : ''} — free with your email
                      </p>
                      <div className="w-full max-w-sm">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <div className="flex-1 relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#998876]" />
                            <input
                              type="email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleEmailSubmit()}
                              placeholder="you@company.com"
                              disabled={emailStatus === 'sending'}
                              className="w-full pl-9 pr-4 py-2.5 bg-white border border-[#E7E0D6] rounded-xl text-sm text-[#1C1917] placeholder:text-[#998876] focus:outline-none focus:ring-2 focus:ring-[#B87333]/40 focus:border-[#B87333] transition-colors"
                            />
                          </div>
                          <button
                            onClick={handleEmailSubmit}
                            disabled={emailStatus === 'sending' || !email.trim()}
                            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#B87333] text-white text-sm font-semibold rounded-xl hover:bg-[#9A6228] disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                          >
                            {emailStatus === 'sending' ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : null}
                            Unlock report →
                          </button>
                        </div>
                        {emailStatus === 'error' && (
                          <p className="mt-2 text-xs text-[#9A6228] text-center">
                            Couldn&apos;t save your email — please try again.
                          </p>
                        )}
                      </div>
                      <Link
                        href="/login"
                        className="mt-3 text-xs text-[#57534E] hover:text-[#1C1917] transition-colors"
                      >
                        Already have an account? Sign in →
                      </Link>
                    </div>
                  </div>
                )
              ) : null}

              {/* Post-analysis CTA */}
              <div className="bg-[#1C1917] rounded-2xl p-6 sm:p-8 text-[#F7F3EC]">
                <h2 style={playfair} className="text-xl font-bold leading-snug mb-2 text-[#F7F3EC]">
                  Want AI to start recommending your content?
                </h2>
                <p className="text-sm text-[#A89070] mb-5 leading-relaxed">
                  Byline generates publish-ready, GEO-optimized articles that are structured to get
                  cited by ChatGPT, Gemini, and Perplexity.
                </p>
                <Link
                  href={`/signup?plan=free&ref=geo_analyzer${emailSubmitted ? `&email=${encodeURIComponent(email)}` : ''}`}
                  className="inline-flex items-center gap-2 px-5 py-3 bg-[#B87333] text-white text-sm font-semibold rounded-xl hover:bg-[#9A6228] transition-colors"
                >
                  Start free — no credit card required
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* SEO content */}
      <section className="bg-[#F7F3EC] px-6 py-20">
        <div className="max-w-2xl mx-auto">
          <h2 style={playfair} className="text-3xl font-bold text-[#1C1917] mb-5 leading-tight">
            What is GEO (Generative Engine Optimization)?
          </h2>
          <div className="space-y-4 text-[#57534E] text-[17px] leading-relaxed mb-12">
            <p>
              Generative Engine Optimization (GEO) is the practice of structuring your website so
              that AI tools like ChatGPT, Gemini, and Perplexity are more likely to cite and
              recommend your content. As more search behavior shifts to AI-generated answers, showing
              up in those answers — not just in blue links — is becoming critical for visibility.
            </p>
            <p>
              Unlike traditional SEO which targets search ranking algorithms, GEO targets the large
              language models that generate conversational answers. These models favor content with
              clear entity signals, citable facts, structured data, and demonstrated expertise.
              Sites that optimize for these factors are significantly more likely to be referenced
              when someone asks an AI a question in your niche.
            </p>
          </div>

          <h2 style={playfair} className="text-3xl font-bold text-[#1C1917] mb-5 leading-tight">
            How is your GEO score calculated?
          </h2>
          <div className="text-[#57534E] text-[17px] leading-relaxed">
            <p>
              Your GEO score is calculated across 7 weighted factors: schema markup (15 pts), author
              and entity signals (15 pts), direct answer content (20 pts), factual citable claims
              (15 pts), content structure (15 pts), brand and entity clarity (10 pts), and freshness
              signals (10 pts). Each factor is scored based on signals found in your page HTML, with
              a maximum total of 100 points. A score of 70+ indicates your site is well-positioned
              for AI citation; below 40 means there are significant gaps to address.
            </p>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-[#1C1917] px-6 py-24 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 style={playfair} className="text-3xl sm:text-4xl font-bold text-[#F7F3EC] mb-4 leading-tight">
            Ready to optimize for AI?
          </h2>
          <p className="text-lg text-[#A89070] mb-9 leading-relaxed">
            Run a free GEO analysis above — or sign up to generate your first AI-ready article in
            under 60 seconds.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={scrollToForm}
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-[#B87333] text-white text-sm font-semibold rounded-xl hover:bg-[#9A6228] transition-colors w-full sm:w-auto"
            >
              Analyze My Site
            </button>
            <Link
              href="/signup?plan=free&ref=geo_analyzer"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-transparent border border-[#B87333] text-[#D4954A] text-sm font-semibold rounded-xl hover:bg-[#B87333]/10 transition-colors w-full sm:w-auto"
            >
              Start Free <ArrowRight className="w-4 h-4" />
            </Link>
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
