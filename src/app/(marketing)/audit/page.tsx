'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Search, ChevronRight, Loader2, AlertCircle, Lock,
  ArrowRight, CheckCircle2, Mail, Sparkles,
} from 'lucide-react'

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

function PriorityBadge({ priority }: { priority: Gap['priority'] }) {
  const map = {
    high: 'bg-red-50 text-red-700',
    medium: 'bg-amber-50 text-amber-700',
    low: 'bg-gray-50 text-gray-600',
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
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  // Best-effort display domain for the funnel copy ("...on yourdomain.com").
  function displayDomain(raw: string): string {
    try {
      const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
      return new URL(withProto).hostname.replace(/^www\./, '')
    } catch {
      return raw.replace(/^https?:\/\//i, '').replace(/^www\./, '').split('/')[0]
    }
  }

  async function sendReport() {
    const trimmed = email.trim()
    if (!trimmed || emailStatus === 'sending') return
    setEmailStatus('sending')
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
      setEmailStatus(res.ok ? 'sent' : 'error')
    } catch {
      setEmailStatus('error')
    }
  }

  async function runAudit() {
    const trimmed = url.trim()
    if (!trimmed || status === 'loading') return
    setStatus('loading')
    setProgressStep(0)
    setError(null)
    setResult(null)

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
    <div className="min-h-screen bg-white text-gray-900">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-bold text-xl text-gray-900 tracking-tight">
            Byline
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/pricing"
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors hidden sm:block"
            >
              Pricing
            </Link>
            <Link
              href="/login"
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors hidden sm:block"
            >
              Log in
            </Link>
            <Link
              href="/signup?plan=free&ref=audit"
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
            >
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-16">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-4 text-gray-900 leading-tight">
            Find what&apos;s missing from your content strategy.{' '}
            <span className="text-indigo-600">Free.</span>
          </h1>
          <p className="text-lg text-gray-500 leading-relaxed max-w-xl mx-auto">
            Enter your website URL. We&apos;ll scan your existing content and surface the gaps
            your competitors are filling.
          </p>
        </div>

        {/* Input row */}
        <div className="flex gap-2 mb-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runAudit()}
              placeholder="https://yoursite.com"
              className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              disabled={status === 'loading'}
            />
          </div>
          <button
            onClick={runAudit}
            disabled={status === 'loading' || !url.trim()}
            className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {status === 'loading' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            Run Audit
          </button>
        </div>
        <p className="text-xs text-center text-gray-400 mb-10">
          No email required. Results in ~10 seconds.
        </p>

        {/* Loading state */}
        {status === 'loading' && (
          <div className="bg-gray-50 rounded-2xl p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-4" />
            <p className="text-sm font-medium text-gray-700 mb-4">
              {PROGRESS_STEPS[progressStep]}
            </p>
            <div className="flex items-center justify-center gap-1.5">
              {PROGRESS_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    i <= progressStep ? 'w-8 bg-indigo-500' : 'w-4 bg-gray-200'
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Error state */}
        {status === 'error' && error && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Results */}
        {status === 'done' && result && (
          <div className="space-y-6">
            {/* Trust signal */}
            <p className="text-center text-xs text-gray-400">
              Analyzed 10,000+ URLs across 50+ niches.
            </p>

            {/* Summary banner */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-3">
              <p className="text-sm text-indigo-800">
                Scanned <strong>{result.pageCount}</strong> pages.
                Found <strong>{result.gaps?.length ?? 0}</strong> content gaps.
              </p>
            </div>

            {/* Quick wins */}
            {result.quickWins?.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Quick Wins
                </h2>
                <ul className="space-y-1.5">
                  {result.quickWins.slice(0, 3).map((w, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Free gaps */}
            {freeGaps.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Top Content Gaps
                </h2>
                <div className="space-y-3">
                  {freeGaps.map((gap, i) => (
                    <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3 mb-1.5">
                        <h3 className="text-sm font-semibold text-gray-900">{gap.title}</h3>
                        <PriorityBadge priority={gap.priority} />
                      </div>
                      <p className="text-sm text-gray-500">{gap.description}</p>
                      {gap.suggestedKeyword && (
                        <p className="text-xs text-indigo-600 mt-2 font-medium">
                          → {gap.suggestedKeyword}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Locked section */}
            {lockedGaps.length > 0 ? (
              <div className="relative">
                {/* Blurred preview */}
                <div
                  className="space-y-3 blur-sm select-none pointer-events-none"
                  aria-hidden="true"
                >
                  {lockedGaps.slice(0, 3).map((gap, i) => (
                    <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3 mb-1.5">
                        <h3 className="text-sm font-semibold text-gray-900">{gap.title}</h3>
                        <PriorityBadge priority={gap.priority} />
                      </div>
                      <p className="text-sm text-gray-500">{gap.description}</p>
                    </div>
                  ))}
                </div>

                {/* Overlay CTA */}
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-t from-white via-white/90 to-white/30 rounded-2xl px-6 pt-10 pb-4">
                  <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center mb-3">
                    <Lock className="w-5 h-5 text-indigo-500" />
                  </div>
                  <p className="text-base font-semibold text-gray-900 text-center mb-1">
                    {lockedGaps.length} more gap{lockedGaps.length !== 1 ? 's' : ''} found
                  </p>
                  <p className="text-sm text-gray-500 text-center mb-5">
                    Including{' '}
                    <span className="font-medium text-gray-700">
                      {lockedGaps
                        .slice(0, 2)
                        .map((g) => g.suggestedKeyword || g.title)
                        .join(', ')}
                    </span>
                    {lockedGaps.length > 2 && ` and ${lockedGaps.length - 2} more`}
                  </p>
                  <Link
                    href="/signup?plan=free&ref=audit"
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
                  >
                    Write your first article free — no credit card needed
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    href="/login"
                    className="mt-3 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    Already have an account? Sign in →
                  </Link>
                </div>
              </div>
            ) : (
              /* CTA when fewer than 4 gaps total */
              <div className="text-center pt-2 pb-4">
                <Link
                  href="/signup?plan=free&ref=audit"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
                >
                  Write your first article free — no credit card needed
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <p className="mt-3 text-xs text-gray-500">
                  Already have an account?{' '}
                  <Link href="/login" className="text-indigo-600 hover:text-indigo-700">
                    Sign in →
                  </Link>
                </p>
              </div>
            )}

            {/* Post-audit conversion funnel */}
            <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl p-6 sm:p-8 text-white">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-indigo-200" />
                <p className="text-sm font-medium text-indigo-100">
                  Found {result.gaps?.length ?? 0} content gap
                  {(result.gaps?.length ?? 0) !== 1 ? 's' : ''} on{' '}
                  {displayDomain(url)}
                </p>
              </div>
              <h2 className="text-xl font-bold leading-snug mb-2">
                Want articles that fill these gaps, written in your brand voice?
              </h2>
              <p className="text-sm text-indigo-100 mb-5 leading-relaxed">
                Byline turns these gaps into publish-ready, SEO-optimized articles —
                matched to how your site already sounds.
              </p>

              <Link
                href="/signup?source=lead_magnet&ref=audit"
                className="inline-flex items-center gap-2 px-5 py-3 bg-white text-indigo-700 text-sm font-semibold rounded-xl hover:bg-indigo-50 transition-colors"
              >
                Start free — no credit card required
                <ArrowRight className="w-4 h-4" />
              </Link>

              {/* Email capture for the full breakdown */}
              <div className="mt-6 pt-6 border-t border-white/15">
                {emailStatus === 'sent' ? (
                  <p className="flex items-center gap-2 text-sm text-indigo-50">
                    <CheckCircle2 className="w-4 h-4 text-green-300 shrink-0" />
                    Thanks — we&apos;ll send the full breakdown to {email.trim()}.
                  </p>
                ) : (
                  <>
                    <label className="block text-sm font-medium text-indigo-100 mb-2">
                      Or get the full breakdown by email:
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="flex-1 relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-300" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && sendReport()}
                          placeholder="you@company.com"
                          disabled={emailStatus === 'sending'}
                          className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white/60"
                        />
                      </div>
                      <button
                        onClick={sendReport}
                        disabled={emailStatus === 'sending' || !email.trim()}
                        className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-900/40 text-white text-sm font-semibold rounded-xl hover:bg-indigo-900/60 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                      >
                        {emailStatus === 'sending' ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : null}
                        Send report
                      </button>
                    </div>
                    {emailStatus === 'error' && (
                      <p className="mt-2 text-xs text-indigo-100">
                        Couldn&apos;t save your email — please try again.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
