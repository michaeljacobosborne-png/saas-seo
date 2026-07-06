'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Search, Loader2, AlertCircle, CheckCircle2, ArrowRight,
  History, RefreshCw, ChevronDown, ChevronUp, Copy, Check,
} from 'lucide-react'

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

interface HistoryEntry {
  id: string
  url: string
  score: number
  grade: string
  created_at: string
}

const playfair = { fontFamily: 'var(--font-playfair, "Playfair Display", serif)' }

function ScoreCircle({ score, grade }: { score: number; grade: string }) {
  const color = score >= 70 ? '#16a34a' : score >= 40 ? '#d97706' : '#dc2626'
  const gradeColor =
    score >= 70 ? 'bg-green-100 text-green-700' :
    score >= 40 ? 'bg-amber-100 text-amber-700' :
    'bg-red-100 text-red-700'
  return (
    <div className="flex items-center gap-6 mb-4">
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center border-4 shrink-0"
        style={{ borderColor: color }}
      >
        <span className="text-2xl font-bold" style={{ color }}>{score}</span>
      </div>
      <div>
        <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl text-xl font-bold mb-1 ${gradeColor}`}>
          {grade}
        </div>
        <p className="text-sm" style={{ color: 'var(--cream-faint)' }}>GEO Score / 100</p>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: Factor['status'] }) {
  const map = { good: 'bg-green-100 text-green-700', 'needs-work': 'bg-amber-100 text-amber-700', missing: 'bg-red-100 text-red-700' }
  const label = { good: 'Good', 'needs-work': 'Needs work', missing: 'Missing' }
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${map[status]}`}>{label[status]}</span>
}

function PriorityBadge({ priority }: { priority: Recommendation['priority'] }) {
  const map = {
    high: 'bg-[rgba(184,115,51,0.12)] text-[var(--copper)]',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-[var(--ink-card)] text-[var(--cream-faint)]',
  }
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[priority]}`}>{priority}</span>
}

export default function DashboardGeoAnalyzer() {
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [progress, setProgress] = useState({ step: 0, total: 3, message: '' })
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [saving, setSaving] = useState(false)
  const [shareToken, setShareToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const resultsRef = useRef<HTMLDivElement>(null)

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  // Admin gate — only the account owner can access this page
  useEffect(() => {
    async function checkAdmin() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setIsAdmin(false); return }
      const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? 'michaeljacobosborne@gmail.com'
      setIsAdmin(user.email === adminEmail)
    }
    checkAdmin()
  }, [])

  // Pre-fill with user's own site URL from brand profile
  useEffect(() => {
    async function prefill() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('brand_profiles')
        .select('website_url')
        .eq('user_id', user.id)
        .maybeSingle()
      if (data?.website_url && !url) setUrl(data.website_url)
    }
    prefill()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load history
  useEffect(() => {
    async function loadHistory() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('audit_results')
        .select('id, url, created_at, result')
        .eq('user_id', user.id)
        .eq('tool', 'geo')
        .order('created_at', { ascending: false })
        .limit(10)
      if (data) {
        setHistory(data.map((row: { id: string; url: string; created_at: string; result: { score?: number; grade?: string } }) => ({
          id: row.id,
          url: row.url,
          created_at: row.created_at,
          score: row.result?.score ?? 0,
          grade: row.result?.grade ?? '?',
        })))
      }
    }
    loadHistory()
  }, [])

  async function copyShareLink() {
    if (!shareToken) return
    const link = `${window.location.origin}/report/${shareToken}`
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function saveResult(analysisResult: AnalysisResult, analyzedUrl: string) {
    setSaving(true)
    setShareToken(null)
    try {
      const res = await fetch('/api/audit/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: analyzedUrl,
          result: analysisResult,
          tool: 'geo',
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.shareToken) setShareToken(data.shareToken)
      }
      // Refresh history
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('audit_results')
        .select('id, url, created_at, result')
        .eq('user_id', user.id)
        .eq('tool', 'geo')
        .order('created_at', { ascending: false })
        .limit(10)
      if (data) {
        setHistory(data.map((row: { id: string; url: string; created_at: string; result: { score?: number; grade?: string } }) => ({
          id: row.id,
          url: row.url,
          created_at: row.created_at,
          score: row.result?.score ?? 0,
          grade: row.result?.grade ?? '?',
        })))
      }
    } finally {
      setSaving(false)
    }
  }

  async function runAnalysis() {
    const trimmed = url.trim()
    if (!trimmed || status === 'loading') return
    setStatus('loading')
    setProgress({ step: 0, total: 3, message: 'Starting...' })
    setError(null)
    setResult(null)
    requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))

    try {
      const res = await fetch('/api/free-tools/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed, type: 'geo' }),
      })

      if (!res.ok || !res.body) {
        let msg = 'Analysis failed. Check the URL and try again.'
        try { const d = await res.json(); if (d?.error) msg = d.error } catch { /* keep */ }
        setError(msg); setStatus('error'); return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let finalResult: AnalysisResult | null = null
      let streamError: string | null = null

      const handleEvent = (line: string) => {
        const t = line.trim(); if (!t) return
        let evt: { type?: string; step?: number; total?: number; message?: string; error?: string } & Partial<AnalysisResult>
        try { evt = JSON.parse(t) } catch { return }
        if (evt.type === 'progress') setProgress({ step: evt.step ?? 0, total: evt.total ?? 3, message: evt.message ?? '' })
        else if (evt.type === 'result') finalResult = { score: evt.score ?? 0, grade: evt.grade ?? 'F', breakdown: evt.breakdown ?? [], recommendations: evt.recommendations ?? [], quickWins: evt.quickWins ?? [] }
        else if (evt.type === 'error') streamError = evt.error ?? 'Analysis failed.'
      }

      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let nl: number
        while ((nl = buffer.indexOf('\n')) !== -1) { handleEvent(buffer.slice(0, nl)); buffer = buffer.slice(nl + 1) }
      }
      handleEvent(buffer)

      if (streamError) { setError(streamError); setStatus('error') }
      else if (finalResult) {
        setResult(finalResult); setStatus('done')
        // Auto-save to account
        await saveResult(finalResult, trimmed)
      } else { setError('Analysis failed. Please try again.'); setStatus('error') }
    } catch { setError('Network error. Please try again.'); setStatus('error') }
  }

  // Admin gate — show loading or access denied
  if (isAdmin === null) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--copper)' }} />
      </div>
    )
  }
  if (!isAdmin) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <h1 style={{ ...playfair, color: 'var(--cream)' }} className="text-2xl font-bold mb-3">Internal tool</h1>
        <p className="text-sm" style={{ color: 'var(--cream-faint)' }}>This feature is not available on your plan.</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 style={{ ...playfair, color: 'var(--cream)' }} className="text-3xl font-bold mb-2">
          GEO Analyzer
        </h1>
        <p className="text-sm" style={{ color: 'var(--cream-faint)' }}>
          Score how likely ChatGPT, Gemini, and Perplexity are to cite your content. Results save automatically.
        </p>
      </div>

      {/* Input */}
      <div className="rounded-2xl border p-6 mb-6" style={{ background: 'var(--ink-card)', borderColor: 'var(--border)' }}>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--cream-faint)' }} />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runAnalysis()}
              placeholder="https://yoursite.com"
              disabled={status === 'loading'}
              className="w-full pl-10 pr-4 py-3 rounded-xl text-sm border focus:outline-none focus:ring-2 transition-colors"
              style={{
                background: 'var(--ink)',
                borderColor: 'var(--border)',
                color: 'var(--cream)',
              }}
            />
          </div>
          <button
            onClick={runAnalysis}
            disabled={status === 'loading' || !url.trim()}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            style={{ background: 'var(--copper)', color: '#fff' }}
          >
            {status === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            Analyze
          </button>
        </div>
      </div>

      {/* Results */}
      <div ref={resultsRef} className="scroll-mt-20">
        {status === 'loading' && (
          <div className="rounded-2xl border p-12 text-center mb-6" style={{ background: 'var(--ink-card)', borderColor: 'var(--border)' }}>
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" style={{ color: 'var(--copper)' }} />
            <p className="text-sm font-medium mb-4" style={{ color: 'var(--cream)' }}>{progress.message || 'Analyzing...'}</p>
            <div className="flex items-center justify-center gap-1.5">
              {Array.from({ length: progress.total }).map((_, i) => (
                <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i < progress.step ? 'w-8' : 'w-4'}`}
                  style={{ background: i < progress.step ? 'var(--copper)' : 'var(--border)' }} />
              ))}
            </div>
          </div>
        )}

        {status === 'error' && error && (
          <div className="flex items-start gap-3 rounded-xl px-4 py-3 mb-6 border" style={{ background: 'rgba(184,115,51,0.08)', borderColor: 'var(--border)' }}>
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--copper)' }} />
            <p className="text-sm" style={{ color: 'var(--cream)' }}>{error}</p>
          </div>
        )}

        {status === 'done' && result && (
          <div className="space-y-4 mb-6">
            {saving && (
              <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style={{ color: 'var(--cream-faint)', background: 'var(--ink-card)', border: '1px solid var(--border)' }}>
                <Loader2 className="w-3 h-3 animate-spin" />
                Saving to your account...
              </div>
            )}
            {!saving && shareToken && (
              <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border" style={{ background: 'var(--ink-card)', borderColor: 'rgba(184,115,51,0.3)' }}>
                <div>
                  <p className="text-xs font-semibold" style={{ color: 'var(--copper)' }}>Saved to your account</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--cream-faint)' }}>
                    app.bylineseo.com/report/{shareToken.slice(0, 8)}…
                  </p>
                </div>
                <button
                  onClick={copyShareLink}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors shrink-0"
                  style={{ color: copied ? '#16a34a' : 'var(--copper)', borderColor: copied ? '#16a34a' : 'rgba(184,115,51,0.4)' }}
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied!' : 'Copy link'}
                </button>
              </div>
            )}

            {/* Score */}
            <div className="rounded-2xl border p-6" style={{ background: 'var(--ink-card)', borderColor: 'var(--border)' }}>
              <ScoreCircle score={result.score} grade={result.grade} />
              <h2 className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: 'var(--cream-faint)' }}>
                7 Factor Breakdown
              </h2>
              <div className="space-y-3">
                {result.breakdown.map((factor, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium" style={{ color: 'var(--cream)' }}>{factor.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: 'var(--cream-faint)' }}>{factor.score}/{factor.maxScore}</span>
                        <StatusBadge status={factor.status} />
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.round((factor.score / factor.maxScore) * 100)}%`,
                          backgroundColor: factor.status === 'good' ? '#16a34a' : factor.status === 'needs-work' ? '#d97706' : '#dc2626',
                        }}
                      />
                    </div>
                    {factor.detail && <p className="text-xs mt-1" style={{ color: 'var(--cream-faint)' }}>{factor.detail}</p>}
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Wins */}
            {result.quickWins.length > 0 && (
              <div className="rounded-2xl border p-6" style={{ background: 'var(--ink-card)', borderColor: 'var(--border)' }}>
                <h2 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--cream-faint)' }}>Quick Wins</h2>
                <ul className="space-y-2">
                  {result.quickWins.map((w, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--cream-dim)' }}>
                      <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--copper)' }} />
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* All Recommendations — no gate in dashboard */}
            {result.recommendations.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--cream-faint)' }}>Recommendations</h2>
                <div className="space-y-3">
                  {result.recommendations.map((rec, i) => (
                    <div key={i} className="rounded-xl border p-4" style={{ background: 'var(--ink-card)', borderColor: 'var(--border)' }}>
                      <div className="flex items-start justify-between gap-3 mb-1.5">
                        <h3 className="text-sm font-semibold" style={{ color: 'var(--cream)' }}>{rec.title}</h3>
                        <PriorityBadge priority={rec.priority} />
                      </div>
                      <p className="text-sm" style={{ color: 'var(--cream-dim)' }}>{rec.description}</p>
                      {rec.impact && <p className="text-xs mt-2 font-medium" style={{ color: 'var(--copper)' }}>Impact: {rec.impact}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Re-run */}
            <button
              onClick={runAnalysis}
              className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl border transition-colors"
              style={{ color: 'var(--cream-dim)', borderColor: 'var(--border)' }}
            >
              <RefreshCw className="w-4 h-4" />
              Run again
            </button>
          </div>
        )}
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="rounded-2xl border" style={{ background: 'var(--ink-card)', borderColor: 'var(--border)' }}>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between px-6 py-4 text-sm font-semibold"
            style={{ color: 'var(--cream)' }}
          >
            <span className="flex items-center gap-2"><History className="w-4 h-4" style={{ color: 'var(--copper)' }} /> Past GEO Scans</span>
            {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showHistory && (
            <div className="border-t" style={{ borderColor: 'var(--border)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                    <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--cream-faint)' }}>URL</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--cream-faint)' }}>Score</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--cream-faint)' }}>Date</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} className="border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                      <td className="px-6 py-3 font-mono text-xs truncate max-w-[180px]" style={{ color: 'var(--cream-dim)' }}>{h.url}</td>
                      <td className="px-4 py-3">
                        <span className="font-semibold" style={{ color: h.score >= 70 ? '#16a34a' : h.score >= 40 ? '#d97706' : '#dc2626' }}>
                          {h.score} ({h.grade})
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--cream-faint)' }}>
                        {new Date(h.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => { setUrl(h.url); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                          className="text-xs px-3 py-1 rounded-lg border transition-colors"
                          style={{ color: 'var(--copper)', borderColor: 'rgba(184,115,51,0.3)' }}
                        >
                          Re-run
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
