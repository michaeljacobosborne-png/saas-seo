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

const PRIORITY_STYLES = {
  high: 'bg-red-900/30 text-red-400 border border-red-700/30',
  medium: 'bg-amber-900/20 text-amber-400 border border-amber-700/20',
  low: 'bg-[#2A2420] text-[#7A6555] border border-[rgba(184,115,51,0.15)]',
}

function PriorityBadge({ priority }: { priority: Gap['priority'] }) {
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide ${PRIORITY_STYLES[priority]}`}>
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
    <div className="min-h-screen text-[#F7F3EC]" style={{ background: '#1C1917' }}>
      {/* Nav */}
      <nav className="sticky top-0 z-50 backdrop-blur border-b" style={{ background: 'rgba(28,25,23,0.95)', borderColor: 'rgba(184,115,51,0.15)' }}>
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-bold text-xl tracking-tight" style={{ color: '#F7F3EC' }}>
            Byline
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/pricing"
              className="text-sm transition-colors hidden sm:block"
              style={{ color: '#7A6555' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#A89070')}
              onMouseLeave={e => (e.currentTarget.style.color = '#7A6555')}
            >
              Pricing
            </Link>
            <Link
              href="/login"
              className="text-sm transition-colors hidden sm:block"
              style={{ color: '#7A6555' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#A89070')}
              onMouseLeave={e => (e.currentTarget.style.color = '#7A6555')}
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
              style={{ background: '#B87333', color: '#F7F3EC' }}
              onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#A0622A')}
              onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#B87333')}
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-16">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-4 leading-tight" style={{ color: '#F7F3EC' }}>
            Find what&apos;s missing from your content strategy.{' '}
            <span style={{ color: '#B87333' }}>Free.</span>
          </h1>
          <p className="text-lg leading-relaxed max-w-xl mx-auto" style={{ color: '#7A6555' }}>
            Enter your website URL. We&apos;ll scan your existing content and surface the gaps
            your competitors are filling.
          </p>
        </div>

        {/* Input row */}
        <div className="flex gap-2 mb-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#7A6555' }} />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runAudit()}
              placeholder="https://yoursite.com"
              className="w-full pl-9 pr-4 py-3 rounded-xl text-sm focus:outline-none"
              style={{
                background: '#231F1B',
                border: '1px solid rgba(184,115,51,0.25)',
                color: '#F7F3EC',
              }}
              disabled={status === 'loading'}
            />
          </div>
          <button
            onClick={runAudit}
            disabled={status === 'loading' || !url.trim()}
            className="flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            style={{ background: '#B87333', color: '#F7F3EC' }}
            onMouseEnter={e => { if (!e.currentTarget.disabled) (e.currentTarget as HTMLButtonElement).style.background = '#A0622A' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#B87333' }}
          >
            {status === 'loading' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            Run Audit
          </button>
        </div>
        <p className="text-xs text-center mb-10" style={{ color: '#7A6555' }}>
          No email required. Results in ~10 seconds.
        </p>

        {/* Loading state */}
        {status === 'loading' && (
          <div className="rounded-2xl p-12 text-center" style={{ background: '#231F1B', border: '1px solid rgba(184,115,51,0.15)' }}>
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" style={{ color: '#B87333' }} />
            <p className="text-sm font-medium mb-4" style={{ color: '#A89070' }}>
              {PROGRESS_STEPS[progressStep]}
            </p>
            <div className="flex items-center justify-center gap-1.5">
              {PROGRESS_STEPS.map((_, i) => (
                <div
                  key={i}
                  className="h-1.5 rounded-full transition-all duration-500"
                  style={{
                    width: i <= progressStep ? '2rem' : '1rem',
                    background: i <= progressStep ? '#B87333' : '#3A3330',
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Error state */}
        {status === 'error' && error && (
          <div className="flex items-start gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Results */}
        {status === 'done' && result && (
          <div className="space-y-6">
            {/* Summary banner */}
            <div className="rounded-xl px-5 py-3" style={{ background: 'rgba(184,115,51,0.08)', border: '1px solid rgba(184,115,51,0.2)' }}>
              <p className="text-sm" style={{ color: '#A89070' }}>
                Scanned <strong style={{ color: '#F7F3EC' }}>{result.pageCount}</strong> pages.{' '}
                Found <strong style={{ color: '#F7F3EC' }}>{result.gaps.length}</strong> content gaps.
              </p>
            </div>

            {/* Quick wins */}
            {result.quickWins?.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#7A6555' }}>
                  Quick Wins
                </h2>
                <ul className="space-y-1.5">
                  {result.quickWins.slice(0, 3).map((w, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm" style={{ color: '#A89070' }}>
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
                <h2 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#7A6555' }}>
                  Top Content Gaps
                </h2>
                <div className="space-y-3">
                  {freeGaps.map((gap, i) => (
                    <div key={i} className="rounded-xl p-4" style={{ background: '#231F1B', border: '1px solid rgba(184,115,51,0.15)' }}>
                      <div className="flex items-start justify-between gap-3 mb-1.5">
                        <h3 className="text-sm font-semibold" style={{ color: '#F7F3EC' }}>{gap.title}</h3>
                        <PriorityBadge priority={gap.priority} />
                      </div>
                      <p className="text-sm" style={{ color: '#7A6555' }}>{gap.description}</p>
                      {gap.suggestedKeyword && (
                        <p className="text-xs mt-2 font-medium" style={{ color: '#B87333' }}>
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
                <div className="space-y-3 blur-sm select-none pointer-events-none" aria-hidden="true">
                  {lockedGaps.slice(0, 3).map((gap, i) => (
                    <div key={i} className="rounded-xl p-4" style={{ background: '#231F1B', border: '1px solid rgba(184,115,51,0.15)' }}>
                      <div className="flex items-start justify-between gap-3 mb-1.5">
                        <h3 className="text-sm font-semibold" style={{ color: '#F7F3EC' }}>{gap.title}</h3>
                        <PriorityBadge priority={gap.priority} />
                      </div>
                      <p className="text-sm" style={{ color: '#7A6555' }}>{gap.description}</p>
                    </div>
                  ))}
                </div>

                <div
                  className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl px-6 pt-10 pb-4"
                  style={{ background: 'linear-gradient(to top, #1C1917 60%, rgba(28,25,23,0.7) 100%)' }}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: 'rgba(184,115,51,0.1)' }}>
                    <Lock className="w-5 h-5" style={{ color: '#B87333' }} />
                  </div>
                  <p className="text-base font-semibold text-center mb-1" style={{ color: '#F7F3EC' }}>
                    {lockedGaps.length} more gap{lockedGaps.length !== 1 ? 's' : ''} found
                  </p>
                  <p className="text-sm text-center mb-5" style={{ color: '#7A6555' }}>
                    Including{' '}
                    <span style={{ color: '#A89070' }}>
                      {lockedGaps
                        .slice(0, 2)
                        .map((g) => g.suggestedKeyword || g.title)
                        .join(', ')}
                    </span>
                    {lockedGaps.length > 2 && ` and ${lockedGaps.length - 2} more`}
                  </p>
                  <Link
                    href="/signup"
                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-colors"
                    style={{ background: '#B87333', color: '#F7F3EC' }}
                    onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#A0622A')}
                    onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#B87333')}
                  >
                    Start writing — plans from $49/mo
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    href="/login"
                    className="mt-3 text-xs transition-colors"
                    style={{ color: '#7A6555' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#A89070')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#7A6555')}
                  >
                    Already have an account? Sign in →
                  </Link>
                </div>
              </div>
            ) : (
              <div className="text-center pt-2 pb-4">
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-colors"
                  style={{ background: '#B87333', color: '#F7F3EC' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#A0622A')}
                  onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#B87333')}
                >
                  Start writing — plans from $49/mo
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <p className="mt-3 text-xs" style={{ color: '#7A6555' }}>
                  Already have an account?{' '}
                  <Link href="/login" style={{ color: '#B87333' }} className="hover:underline">
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
