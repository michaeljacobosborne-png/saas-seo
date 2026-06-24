'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import {
  Search, ChevronRight, Loader2, AlertCircle, Lock,
  ArrowRight, CheckCircle2, Mail, Sparkles, Zap, Target, Telescope,
} from 'lucide-react'
import NavLinks from '../../_components/NavLinks'

type Gap = {
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  suggestedKeyword: string
}

type AuditResult = {
  gaps: Gap[]
  topicClusters: unknown[]
  quickWins: string[]
  pageCount: number
}

const PROGRESS_STEPS = [
  'Scanning your sitemap...',
  'Analyzing content gaps...',
  'Building your report...',
]

// Playfair Display is loaded globally as a CSS variable in the root layout.
const playfair = { fontFamily: 'var(--font-playfair, "Playfair Display", serif)' }

function PriorityBadge({ priority }: { priority: Gap['priority'] }) {
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

export default function PublicAuditPage() {
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [progressStep, setProgressStep] = useState(0)
  const [result, setResult] = useState<AuditResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [emailUnlocked, setEmailUnlocked] = useState(false)
  const [capturedEmail, setCapturedEmail] = useState('')
  const [unlockStatus, setUnlockStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  // Anchors for the in-page scroll behaviour: starting an audit scrolls the
  // results into view; the bottom CTA scrolls back up to the hero input.
  const resultsRef = useRef<HTMLDivElement>(null)
  const heroFormRef = useRef<HTMLInputElement>(null)

  function scrollToResults() {
    // Wait a frame so the results/loading block has mounted before scrolling.
    requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function scrollToForm() {
    heroFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    heroFormRef.current?.focus({ preventScroll: true })
  }

  // Best-effort display domain for the funnel copy ("...on yourdomain.com").
  function displayDomain(raw: string): string {
    try {
      const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
      return new URL(withProto).hostname.replace(/^www\./, '')
    } catch {
      return raw.replace(/^https?:\/\//i, '').replace(/^www\./, '').split('/')[0]
    }
  }

  async function handleEmailUnlock() {
    const trimmed = email.trim()
    if (!trimmed || unlockStatus === 'sending') return
    setUnlockStatus('sending')
    try {
      const res = await fetch('/api/audit/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmed,
          url: url.trim(),
          gapCount: result?.gaps?.length ?? 0,
        }),
      })
      if (res.ok) {
        setEmailUnlocked(true)
        setCapturedEmail(trimmed)
        try {
          localStorage.setItem(
            'byline_audit_result_v2',
            JSON.stringify({ result, url: url.trim(), runAt: new Date().toISOString() })
          )
          localStorage.setItem('byline_audit_email', trimmed)
        } catch {
          /* localStorage unavailable — non-fatal */
        }
        setUnlockStatus('sent')
      } else {
        setUnlockStatus('error')
      }
    } catch {
      setUnlockStatus('error')
    }
  }

  async function runAudit() {
    const trimmed = url.trim()
    if (!trimmed || status === 'loading') return
    setStatus('loading')
    setProgressStep(0)
    setError(null)
    setResult(null)
    scrollToResults()

    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      })

      // The route streams newline-delimited JSON (progress events followed by a
      // final `result` or `error` event), all over HTTP 200. A non-streaming
      // response means an early failure (e.g. 400 bad request) — surface that.
      if (!res.ok || !res.body) {
        let msg = 'Audit failed. Check the URL and try again.'
        try {
          const data = await res.json()
          if (data?.error) msg = data.error
        } catch {
          /* response wasn't JSON — keep the generic message */
        }
        setError(msg)
        setStatus('error')
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let finalResult: AuditResult | null = null
      let streamError: string | null = null

      const handleEvent = (line: string) => {
        const trimmedLine = line.trim()
        if (!trimmedLine) return
        let evt: { type?: string; step?: number; error?: string } & Partial<AuditResult>
        try {
          evt = JSON.parse(trimmedLine)
        } catch {
          return // ignore partial/garbage lines
        }
        if (evt.type === 'progress' && typeof evt.step === 'number') {
          const idx = Math.min(Math.max(evt.step - 1, 0), PROGRESS_STEPS.length - 1)
          setProgressStep(idx)
        } else if (evt.type === 'result') {
          finalResult = {
            gaps: evt.gaps ?? [],
            topicClusters: evt.topicClusters ?? [],
            quickWins: evt.quickWins ?? [],
            pageCount: evt.pageCount ?? 0,
          }
        } else if (evt.type === 'error') {
          streamError = evt.error ?? 'Audit failed. Please try again.'
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
      handleEvent(buffer) // flush any trailing line

      if (streamError) {
        setError(streamError)
        setStatus('error')
      } else if (finalResult) {
        setResult(finalResult)
        setStatus('done')
      } else {
        setError('Audit failed. Please try again.')
        setStatus('error')
      }
    } catch {
      setError('Network error. Please try again.')
      setStatus('error')
    }
  }

  const freeGaps = result?.gaps?.slice(0, 3) ?? []
  const lockedGaps = result?.gaps?.slice(3) ?? []

  return (
    <div className="min-h-screen bg-[#FDFAF6] text-[#1C1917]">
      {/* ── Nav ── */}
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

      {/* ── Section 2: Hero ── */}
      <section className="bg-[#FDFAF6] px-6 pt-20 pb-20 text-center">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#B87333] mb-5">
            Free Content Gap Audit
          </p>
          <h1
            style={playfair}
            className="text-[40px] sm:text-[52px] font-bold leading-[1.08] tracking-tight text-[#1C1917] mb-6"
          >
            See Exactly Where Your Content Strategy Is Losing
          </h1>
          <p className="text-lg text-[#57534E] leading-relaxed max-w-2xl mx-auto mb-10">
            Byline maps your published content against real search demand and shows you the gaps your
            competitors are filling — in under 60 seconds.
          </p>

          {/* URL input form — the above-the-fold CTA */}
          <div className="max-w-xl mx-auto">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#998876]" />
                <input
                  ref={heroFormRef}
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && runAudit()}
                  placeholder="https://yoursite.com"
                  className="w-full pl-11 pr-4 py-3.5 bg-white border border-[#E7E0D6] rounded-xl text-sm text-[#1C1917] placeholder:text-[#998876] focus:outline-none focus:ring-2 focus:ring-[#B87333]/40 focus:border-[#B87333] transition-colors"
                  disabled={status === 'loading'}
                />
              </div>
              <button
                onClick={runAudit}
                disabled={status === 'loading' || !url.trim()}
                className="flex items-center justify-center gap-2 px-6 py-3.5 bg-[#B87333] text-white text-sm font-semibold rounded-xl hover:bg-[#9A6228] disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
              >
                {status === 'loading' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
                Run Audit
              </button>
            </div>
            <p className="text-xs text-[#998876] mt-3">
              No login required. Results in ~10 seconds.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 3: How It Works ── */}
      <section className="bg-[#F7F3EC] px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <h2 style={playfair} className="text-3xl sm:text-4xl font-bold text-center text-[#1C1917] mb-14">
            How the Audit Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              {
                num: '01',
                heading: 'We crawl your sitemap',
                body: "Enter your domain and we pull every page you've published. No login needed — we use your sitemap to see exactly what content you've built.",
              },
              {
                num: '02',
                heading: 'We map content against search intent',
                body: "Every page gets matched against real keyword clusters. We're not just counting words — we're analyzing whether your content covers the queries that actually drive traffic in your niche.",
              },
              {
                num: '03',
                heading: 'You get a prioritized gap report',
                body: "The audit surfaces content topics with real search demand that your site doesn't cover. Each gap is scored by opportunity — so you know exactly what to build next.",
              },
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

      {/* ── Section 4: Why This Matters ── */}
      <section className="bg-[#FDFAF6] px-6 py-20">
        <div className="max-w-2xl mx-auto">
          <h2 style={playfair} className="text-3xl sm:text-4xl font-bold text-[#1C1917] mb-8 leading-tight">
            Most content strategies are based on guesses
          </h2>
          <div className="space-y-5 text-[#57534E] text-[17px] leading-relaxed">
            <p>
              Your team picks topics based on what feels right — what the CEO mentioned in a meeting,
              what a customer asked about last week, what a competitor wrote about last month.
            </p>
            <p>
              Meanwhile, your competitors are methodically filling every intent cluster in your niche.
              And Google is rewarding them for it.
            </p>
            <p>
              The content that drives compounding organic traffic isn&apos;t the content you think you
              need. It&apos;s the 40–60 topics that sit one step outside your current coverage — the
              adjacent questions your audience is already searching for that you&apos;ve never answered.
            </p>
            <p>
              A content gap audit is the difference between a content calendar built on instinct and one
              built on data. Most teams skip it because it&apos;s tedious to do manually. Byline does it
              in under a minute.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 5: The Audit Tool (results) ── */}
      <section ref={resultsRef} className="bg-[#FDFAF6] px-6 scroll-mt-20">
        <div className="max-w-2xl mx-auto">
          {/* Loading state */}
          {status === 'loading' && (
            <div className="bg-white border border-[#E7E0D6] rounded-2xl p-12 text-center mb-8">
              <Loader2 className="w-8 h-8 animate-spin text-[#B87333] mx-auto mb-4" />
              <p className="text-sm font-medium text-[#1C1917] mb-4">
                {PROGRESS_STEPS[progressStep]}
              </p>
              <div className="flex items-center justify-center gap-1.5">
                {PROGRESS_STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-500 ${
                      i <= progressStep ? 'w-8 bg-[#B87333]' : 'w-4 bg-[#E7E0D6]'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Error state */}
          {status === 'error' && error && (
            <div className="flex items-start gap-3 bg-[#B87333]/8 border border-[#E7E0D6] rounded-xl px-4 py-3 mb-8">
              <AlertCircle className="w-4 h-4 text-[#9A6228] mt-0.5 shrink-0" />
              <p className="text-sm text-[#1C1917]">{error}</p>
            </div>
          )}

          {/* Results */}
          {status === 'done' && result && (
            <div className="space-y-6 mb-8">
              {/* Trust signal */}
              <p className="text-center text-xs text-[#998876]">
                Analyzed 10,000+ URLs across 50+ niches.
              </p>

              {/* Summary banner */}
              <div className="bg-[#B87333]/8 border border-[#E7E0D6] rounded-xl px-5 py-3">
                <p className="text-sm text-[#1C1917]">
                  Scanned <strong>{result.pageCount}</strong> pages.
                  Found <strong>{result.gaps?.length ?? 0}</strong> content gaps.
                </p>
              </div>

              {/* Quick wins */}
              {result.quickWins?.length > 0 && (
                <div>
                  <h2 className="text-xs font-semibold text-[#998876] uppercase tracking-wide mb-3">
                    Quick Wins
                  </h2>
                  <ul className="space-y-1.5">
                    {result.quickWins.slice(0, 3).map((w, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-[#57534E]">
                        <CheckCircle2 className="w-4 h-4 text-[#B87333] mt-0.5 shrink-0" />
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Free gaps */}
              {freeGaps.length > 0 && (
                <div>
                  <h2 className="text-xs font-semibold text-[#998876] uppercase tracking-wide mb-3">
                    Top Content Gaps
                  </h2>
                  <div className="space-y-3">
                    {freeGaps.map((gap, i) => (
                      <div key={i} className="bg-white border border-[#E7E0D6] rounded-xl p-4">
                        <div className="flex items-start justify-between gap-3 mb-1.5">
                          <h3 className="text-sm font-semibold text-[#1C1917]">{gap.title}</h3>
                          <PriorityBadge priority={gap.priority} />
                        </div>
                        <p className="text-sm text-[#57534E]">{gap.description}</p>
                        {gap.suggestedKeyword && (
                          <p className="text-xs text-[#B87333] mt-2 font-medium">
                            → {gap.suggestedKeyword}
                          </p>
                        )}
                        {emailUnlocked && (
                          <Link
                            href={`/signup?plan=free&ref=audit&email=${encodeURIComponent(capturedEmail)}&audit_keyword=${encodeURIComponent(gap.suggestedKeyword || gap.title)}&audit_topic=${encodeURIComponent(gap.title)}`}
                            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#B87333] hover:text-[#9A6228] transition-colors"
                          >
                            Write this article <ArrowRight className="w-3 h-3" />
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Locked section */}
              {lockedGaps.length > 0 ? (
                emailUnlocked ? (
                  /* All gaps unlocked — render them as normal gap cards */
                  <div>
                    <h2 className="text-xs font-semibold text-[#998876] uppercase tracking-wide mb-3">
                      More Content Gaps
                    </h2>
                    <div className="space-y-3">
                      {lockedGaps.map((gap, i) => (
                        <div key={i} className="bg-white border border-[#E7E0D6] rounded-xl p-4">
                          <div className="flex items-start justify-between gap-3 mb-1.5">
                            <h3 className="text-sm font-semibold text-[#1C1917]">{gap.title}</h3>
                            <PriorityBadge priority={gap.priority} />
                          </div>
                          <p className="text-sm text-[#57534E]">{gap.description}</p>
                          {gap.suggestedKeyword && (
                            <p className="text-xs text-[#B87333] mt-2 font-medium">
                              → {gap.suggestedKeyword}
                            </p>
                          )}
                          <Link
                            href={`/signup?plan=free&ref=audit&email=${encodeURIComponent(capturedEmail)}&audit_keyword=${encodeURIComponent(gap.suggestedKeyword || gap.title)}&audit_topic=${encodeURIComponent(gap.title)}`}
                            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#B87333] hover:text-[#9A6228] transition-colors"
                          >
                            Write this article <ArrowRight className="w-3 h-3" />
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Email wall */
                  <div className="relative">
                    {/* Blurred preview */}
                    <div
                      className="space-y-3 blur-sm select-none pointer-events-none"
                      aria-hidden="true"
                    >
                      {lockedGaps.slice(0, 3).map((gap, i) => (
                        <div key={i} className="bg-white border border-[#E7E0D6] rounded-xl p-4">
                          <div className="flex items-start justify-between gap-3 mb-1.5">
                            <h3 className="text-sm font-semibold text-[#1C1917]">{gap.title}</h3>
                            <PriorityBadge priority={gap.priority} />
                          </div>
                          <p className="text-sm text-[#57534E]">{gap.description}</p>
                        </div>
                      ))}
                    </div>

                    {/* Overlay email wall */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-t from-[#FDFAF6] via-[#FDFAF6]/90 to-[#FDFAF6]/30 rounded-2xl px-6 pt-10 pb-4">
                      <div className="w-10 h-10 bg-[#B87333]/12 rounded-xl flex items-center justify-center mb-3">
                        <Lock className="w-5 h-5 text-[#B87333]" />
                      </div>
                      <p className="text-base font-semibold text-[#1C1917] text-center mb-1">
                        {lockedGaps.length} more gap{lockedGaps.length !== 1 ? 's' : ''} found
                      </p>
                      <p className="text-sm text-[#57534E] text-center mb-5">
                        Including{' '}
                        <span className="font-medium text-[#1C1917]">
                          {lockedGaps
                            .slice(0, 2)
                            .map((g) => g.suggestedKeyword || g.title)
                            .join(', ')}
                        </span>
                        {lockedGaps.length > 2 && ` and ${lockedGaps.length - 2} more`}
                      </p>
                      <div className="w-full max-w-sm">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <div className="flex-1 relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#998876]" />
                            <input
                              type="email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleEmailUnlock()}
                              placeholder="you@company.com"
                              disabled={unlockStatus === 'sending'}
                              className="w-full pl-9 pr-4 py-2.5 bg-white border border-[#E7E0D6] rounded-xl text-sm text-[#1C1917] placeholder:text-[#998876] focus:outline-none focus:ring-2 focus:ring-[#B87333]/40 focus:border-[#B87333] transition-colors"
                            />
                          </div>
                          <button
                            onClick={handleEmailUnlock}
                            disabled={unlockStatus === 'sending' || !email.trim()}
                            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#B87333] text-white text-sm font-semibold rounded-xl hover:bg-[#9A6228] disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                          >
                            {unlockStatus === 'sending' ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : null}
                            See all {lockedGaps.length + freeGaps.length} gaps →
                          </button>
                        </div>
                        {unlockStatus === 'error' && (
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
              ) : (
                /* CTA when fewer than 4 gaps total */
                <div className="text-center pt-2 pb-4">
                  <Link
                    href="/signup?plan=free&ref=audit"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#B87333] text-white text-sm font-semibold rounded-xl hover:bg-[#9A6228] transition-colors"
                  >
                    Write your first article free — no credit card needed
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <p className="mt-3 text-xs text-[#57534E]">
                    Already have an account?{' '}
                    <Link href="/login" className="text-[#B87333] hover:text-[#9A6228]">
                      Sign in →
                    </Link>
                  </p>
                </div>
              )}

              {/* Post-audit conversion funnel */}
              <div className="bg-[#1C1917] rounded-2xl p-6 sm:p-8 text-[#F7F3EC]">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-5 h-5 text-[#D4954A]" />
                  <p className="text-sm font-medium text-[#A89070]">
                    Found {result.gaps?.length ?? 0} content gap
                    {(result.gaps?.length ?? 0) !== 1 ? 's' : ''} on{' '}
                    {displayDomain(url)}
                  </p>
                </div>
                <h2 style={playfair} className="text-xl font-bold leading-snug mb-2 text-[#F7F3EC]">
                  Want articles that fill these gaps, written in your brand voice?
                </h2>
                <p className="text-sm text-[#A89070] mb-5 leading-relaxed">
                  Byline turns these gaps into publish-ready, SEO-optimized articles —
                  matched to how your site already sounds.
                </p>

                <Link
                  href={`/signup?plan=free&ref=audit&email=${encodeURIComponent(capturedEmail)}&source=lead_magnet`}
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

      {/* ── Section 6: What You Get ── */}
      <section className="bg-[#F7F3EC] px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <h2 style={playfair} className="text-3xl sm:text-4xl font-bold text-center text-[#1C1917] mb-14">
            What the Audit Tells You
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: Zap,
                heading: 'Quick Wins',
                body: 'Low-competition content gaps you can start filling this week. Topics with real search demand and manageable competition scores.',
              },
              {
                icon: Target,
                heading: 'Strategic Opportunities',
                body: 'High-value topics worth a full content build-out. These are the pieces that compound — articles that earn links and rank for dozens of long-tail variants.',
              },
              {
                icon: Telescope,
                heading: 'Competitive Intelligence',
                body: 'See what your rivals rank for that you don’t. The audit cross-references your content map against common competitor signals to surface the clearest gaps.',
              },
            ].map((card) => {
              const Icon = card.icon
              return (
                <div
                  key={card.heading}
                  className="bg-white rounded-2xl border border-[#E7E0D6] p-7 shadow-sm"
                >
                  <div className="w-11 h-11 rounded-xl bg-[#B87333]/10 flex items-center justify-center mb-5">
                    <Icon className="w-5 h-5 text-[#B87333]" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#1C1917] mb-2">{card.heading}</h3>
                  <p className="text-[15px] text-[#57534E] leading-relaxed">{card.body}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Section 7: CTA (dark bookend) ── */}
      <section className="bg-[#1C1917] px-6 py-24 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 style={playfair} className="text-3xl sm:text-4xl font-bold text-[#F7F3EC] mb-4 leading-tight">
            Ready to turn gaps into traffic?
          </h2>
          <p className="text-lg text-[#A89070] mb-9 leading-relaxed">
            Run a free audit above — or sign up to generate your first article in under 60 seconds.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={scrollToForm}
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-[#B87333] text-white text-sm font-semibold rounded-xl hover:bg-[#9A6228] transition-colors w-full sm:w-auto"
            >
              Run Free Audit
            </button>
            <Link
              href="/signup?plan=free&ref=audit"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-transparent border border-[#B87333] text-[#D4954A] text-sm font-semibold rounded-xl hover:bg-[#B87333]/10 transition-colors w-full sm:w-auto"
            >
              Start Free <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
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
