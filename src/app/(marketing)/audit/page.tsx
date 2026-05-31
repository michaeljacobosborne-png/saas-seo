'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Search, ChevronRight, Loader2, AlertCircle, Lock,
  ArrowRight, CheckCircle2,
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

  async function runAudit() {
    const trimmed = url.trim()
    if (!trimmed || status === 'loading') return
    setStatus('loading')
    setProgressStep(0)
    setError(null)
    setResult(null)

    const timers = [0, 2200, 5000].map((delay, i) =>
      setTimeout(() => setProgressStep(i), delay)
    )

    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      })
      const data = await res.json()
      timers.forEach(clearTimeout)
      if (!res.ok) {
        setError(data.error ?? 'Audit failed. Check the URL and try again.')
        setStatus('error')
        return
      }
      setResult(data)
      setStatus('done')
    } catch {
      timers.forEach(clearTimeout)
      setError('Network error. Please try again.')
      setStatus('error')
    }
  }

  const freeGaps = result?.gaps.slice(0, 3) ?? []
  const lockedGaps = result?.gaps.slice(3) ?? []

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
            {/* Summary banner */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-3">
              <p className="text-sm text-indigo-800">
                Scanned <strong>{result.pageCount}</strong> pages.
                Found <strong>{result.gaps.length}</strong> content gaps.
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
          </div>
        )}
      </main>
    </div>
  )
}
