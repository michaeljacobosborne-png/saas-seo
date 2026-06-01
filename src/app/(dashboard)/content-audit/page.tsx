'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { BrandProfile } from '@/lib/supabase/types'
import Link from 'next/link'
import {
  BarChart2, RefreshCw, Loader2, AlertCircle, ArrowRight,
  Search, FileText, CheckCircle2, Clock, ChevronDown, ChevronUp,
} from 'lucide-react'

type Gap = {
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  suggestedKeyword: string
}

type TopicCluster = {
  cluster: string
  covered: string[]
  missing: string[]
}

type AuditResult = {
  gaps: Gap[]
  topicClusters: TopicCluster[]
  quickWins: string[]
  pageCount: number
}

const LS_KEY = 'byline_audit_last_run'

function PriorityBadge({ priority }: { priority: Gap['priority'] }) {
  const map = {
    high: 'bg-[rgba(220,60,60,0.12)] text-[#f87171] border-[rgba(220,60,60,0.3)]',
    medium: 'bg-[rgba(184,115,51,0.12)] text-[#D4954A] border-[rgba(184,115,51,0.3)]',
    low: 'bg-[#231F1B] text-[#A89070] border-[rgba(184,115,51,0.2)]',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${map[priority]}`}>
      {priority}
    </span>
  )
}

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function DashboardAuditPage() {
  const supabase = createClient()

  const [brand, setBrand] = useState<BrandProfile | null>(null)
  const [auditUrl, setAuditUrl] = useState('')
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<AuditResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastRun, setLastRun] = useState<Date | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [savedKeywords, setSavedKeywords] = useState<string[]>([])
  const [writtenKeywords, setWrittenKeywords] = useState<string[]>([])
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null)
  const [pageLoaded, setPageLoaded] = useState(false)
  const [urlForRun, setUrlForRun] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY)
    if (stored) setLastRun(new Date(stored))
  }, [])

  useEffect(() => {
    let active = true
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !active) return
      setUserId(user.id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any
      const [brandRes, kwRes, artRes] = await Promise.all([
        sb.from('brand_profiles').select('*').eq('user_id', user.id).maybeSingle(),
        sb.from('saved_keywords').select('keyword').eq('user_id', user.id).limit(100),
        sb.from('articles')
          .select('target_keyword')
          .eq('user_id', user.id)
          .not('target_keyword', 'is', null)
          .limit(100),
      ])
      if (!active) return
      const profile = brandRes.data as BrandProfile | null
      setBrand(profile)
      const brandUrl = profile?.website_url ?? ''
      setAuditUrl(brandUrl)
      setSavedKeywords((kwRes.data ?? []).map((k: { keyword: string }) => k.keyword))
      setWrittenKeywords(
        (artRes.data ?? [])
          .map((a: { target_keyword: string | null }) => a.target_keyword)
          .filter(Boolean) as string[]
      )
      if (brandUrl) setUrlForRun(brandUrl)
      setPageLoaded(true)
    }
    load()
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const runAudit = useCallback(async (targetUrl: string) => {
    if (!targetUrl.trim()) return
    setStatus('loading')
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl.trim(), userId: userId ?? undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Audit failed')
        setStatus('error')
        return
      }
      setResult(data)
      setStatus('done')
      const now = new Date()
      setLastRun(now)
      localStorage.setItem(LS_KEY, now.toISOString())
    } catch {
      setError('Network error. Please try again.')
      setStatus('error')
    }
  }, [userId])

  // Auto-run once brand URL is resolved
  useEffect(() => {
    if (pageLoaded && urlForRun) {
      runAudit(urlForRun)
      setUrlForRun(null)
    }
  }, [pageLoaded, urlForRun, runAudit])

  const unwrittenSaved = savedKeywords.filter(
    (kw) => !writtenKeywords.some((wk) => wk.toLowerCase().includes(kw.toLowerCase()))
  )

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BarChart2 className="w-5 h-5 text-[#D4954A]" />
            <h1 className="text-2xl font-bold text-[#F7F3EC]">Content Audit</h1>
          </div>
          <p className="text-sm text-[#A89070]">
            {auditUrl ? `Scanning ${auditUrl}` : 'See exactly where your content strategy has gaps.'}
          </p>
          {lastRun && (
            <p className="text-xs text-[#7A6555] mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Last audited {timeAgo(lastRun)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setShowUrlInput((v) => !v)}
            className="px-3 py-1.5 text-xs text-[#A89070] border border-[rgba(184,115,51,0.2)] rounded-lg hover:bg-[#231F1B] transition-colors"
          >
            Change URL
          </button>
          <button
            onClick={() => runAudit(auditUrl)}
            disabled={status === 'loading' || !auditUrl}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#B87333] border border-[rgba(184,115,51,0.25)] rounded-lg hover:bg-[rgba(184,115,51,0.08)] disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${status === 'loading' ? 'animate-spin' : ''}`} />
            Re-run audit
          </button>
        </div>
      </div>

      {/* Intro blurb — shown before first run */}
      {status === 'idle' && !result && (
        <div className="mb-8 rounded-xl px-5 py-4 border border-[rgba(184,115,51,0.18)]" style={{ background: '#231F1B' }}>
          <p className="text-sm text-[#A89070] leading-relaxed">
            Byline scans your site, cross-references your published content against search demand in your niche, and surfaces the topics your competitors are ranking for that you haven&apos;t touched yet. You&apos;ll see your coverage broken down by topic cluster, a prioritized list of gaps worth writing, and the keywords already sitting in your research library that still need articles. Most audits take under 15 seconds.
          </p>
        </div>
      )}
      {status !== 'idle' && <div className="mb-8" />}

      {/* URL override */}
      {(showUrlInput || (!brand?.website_url && !auditUrl)) && (
        <div className="mb-6 flex gap-2">
          <input
            type="url"
            value={auditUrl}
            onChange={(e) => setAuditUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runAudit(auditUrl)}
            placeholder="https://yoursite.com"
            className="flex-1 px-3 py-2 border border-[rgba(184,115,51,0.2)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#B87333]"
          />
          <button
            onClick={() => { setShowUrlInput(false); runAudit(auditUrl) }}
            disabled={status === 'loading' || !auditUrl}
            className="px-4 py-2 bg-[#B87333] text-[#F7F3EC] text-sm font-medium rounded-xl hover:bg-[#A0622A] disabled:opacity-50 transition-colors"
          >
            Run
          </button>
        </div>
      )}

      {!brand?.website_url && !auditUrl && status === 'idle' && (
        <div className="rounded-xl px-4 py-3 mb-6 text-sm text-[#D4954A] border border-[rgba(184,115,51,0.3)]" style={{background:"rgba(184,115,51,0.08)"}}>
          <span className="font-medium">No website URL in your brand profile.</span>{' '}
          <Link href="/brand" className="underline hover:text-[#D4954A]">
            Set it up first →
          </Link>
        </div>
      )}

      {/* Loading */}
      {status === 'loading' && (
        <div className="bg-[#231F1B] rounded-2xl p-16 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#D4954A] mx-auto mb-4" />
          <p className="text-sm font-medium text-[#A89070]">
            Scanning {auditUrl} for content gaps...
          </p>
          <p className="text-xs text-[#7A6555] mt-2">Takes about 10 seconds.</p>
        </div>
      )}

      {/* Error */}
      {status === 'error' && error && (
        <div className="flex items-start gap-3 rounded-xl px-4 py-3" style={{background:"rgba(220,60,60,0.08)",border:"1px solid rgba(220,60,60,0.25)"}}>
          <AlertCircle className="w-4 h-4 text-[#f87171] mt-0.5 shrink-0" />
          <p className="text-sm text-[#f87171]">{error}</p>
        </div>
      )}

      {/* Results */}
      {status === 'done' && result && (
        <div className="space-y-8">
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { value: result.pageCount, label: 'Pages scanned', color: 'text-[#F7F3EC]' },
              { value: result.gaps.length, label: 'Content gaps', color: 'text-[#B87333]' },
              { value: unwrittenSaved.length, label: 'Saved keywords not yet written', color: 'text-[#D4954A]' },
            ].map(({ value, label, color }) => (
              <div key={label} className="bg-[#1C1917] border border-[rgba(184,115,51,0.2)] rounded-xl p-4 text-center">
                <div className={`text-2xl font-bold ${color}`}>{value}</div>
                <div className="text-xs text-[#A89070] mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          {/* Saved keywords cross-reference */}
          {unwrittenSaved.length > 0 && (
            <div className="rounded-xl p-5 border border-[rgba(184,115,51,0.25)]" style={{background:"rgba(184,115,51,0.07)""}}>
              <h2 className="text-sm font-semibold text-[#F7F3EC] mb-1">
                You&apos;ve saved these keywords but haven&apos;t written about them yet
              </h2>
              <p className="text-xs text-[#A89070] mb-3">
                These are already in your research pipeline — write them first.
              </p>
              <div className="flex flex-wrap gap-2}}>
                {unwrittenSaved.map((kw) => (
                  <Link
                    key={kw}
                    href="/articles/new"
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-[#1C1917] border border-[rgba(184,115,51,0.3)] text-[#D4954A] rounded-full hover:border-[#B87333] transition-colors"
                  >
                    {kw}
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Quick wins */}
          {result.quickWins?.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-[#F7F3EC] mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#D4954A]" />
                Quick Wins
              </h2>
              <ul className="space-y-2">
                {result.quickWins.map((w, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-[#A89070] bg-[#1C1917] border border-[rgba(184,115,51,0.15)] rounded-lg px-4 py-2.5"
                  >
                    <CheckCircle2 className="w-4 h-4 text-[#D4954A] mt-0.5 shrink-0" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* All gaps */}
          <div>
            <h2 className="text-sm font-semibold text-[#F7F3EC] mb-3">
              All Content Gaps ({result.gaps.length})
            </h2>
            <div className="space-y-3">
              {result.gaps.map((gap, i) => {
                const isSaved = savedKeywords.some(
                  (kw) => kw.toLowerCase() === gap.suggestedKeyword?.toLowerCase()
                )
                return (
                  <div key={i} className="bg-[#1C1917] border border-[rgba(184,115,51,0.2)] rounded-xl p-4">
                    <div className="flex items-start gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center flex-wrap gap-2 mb-1">
                          <h3 className="text-sm font-semibold text-[#F7F3EC]">{gap.title}</h3>
                          <PriorityBadge priority={gap.priority} />
                          {isSaved && (
                            <span className="text-xs px-2 py-0.5 bg-[rgba(184,115,51,0.08)] text-[#A0622A] border border-[rgba(184,115,51,0.25)] rounded-full font-medium">
                              Saved keyword
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-[#A89070]">{gap.description}</p>
                        {gap.suggestedKeyword && (
                          <p className="text-xs text-[#B87333] mt-1.5 font-medium">
                            Keyword: {gap.suggestedKeyword}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-3 border-t border-[rgba(184,115,51,0.15)]">
                      <Link
                        href={`/keywords?seed=${encodeURIComponent(gap.suggestedKeyword || gap.title)}`}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-[rgba(184,115,51,0.2)] text-[#A89070] rounded-lg hover:border-[#B87333] hover:text-[#B87333] transition-colors"
                      >
                        <Search className="w-3 h-3" />
                        Research this keyword →
                      </Link>
                      <Link
                        href="/articles/new"
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-[#B87333] text-[#F7F3EC] rounded-lg hover:bg-[#A0622A] transition-colors"
                      >
                        <FileText className="w-3 h-3" />
                        Write this article →
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Topic coverage map */}
          {result.topicClusters?.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-[#F7F3EC] mb-3">Topic Coverage Map</h2>
              <div className="space-y-2">
                {result.topicClusters.map((tc) => {
                  const isOpen = expandedCluster === tc.cluster
                  return (
                    <div
                      key={tc.cluster}
                      className="bg-[#1C1917] border border-[rgba(184,115,51,0.2)] rounded-xl overflow-hidden"
                    >
                      <button
                        onClick={() => setExpandedCluster(isOpen ? null : tc.cluster)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#231F1B] transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-sm font-medium text-[#F7F3EC]">{tc.cluster}</span>
                          <span className="text-xs text-[#D4954A] bg-[rgba(184,115,51,0.1)] px-2 py-0.5 rounded-full border border-[rgba(184,115,51,0.2)]">
                            {tc.covered.length} covered
                          </span>
                          <span className="text-xs text-[#f87171] bg-[rgba(220,60,60,0.1)] px-2 py-0.5 rounded-full border border-[rgba(220,60,60,0.2)]">
                            {tc.missing.length} missing
                          </span>
                        </div>
                        {isOpen
                          ? <ChevronUp className="w-4 h-4 text-[#7A6555] shrink-0" />
                          : <ChevronDown className="w-4 h-4 text-[#7A6555] shrink-0" />
                        }
                      </button>
                      {isOpen && (
                        <div className="border-t border-[rgba(184,115,51,0.15)] px-4 py-3 grid grid-cols-2 gap-4">
                          {tc.covered.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-[#D4954A] mb-2">Covered</p>
                              <ul className="space-y-1">
                                {tc.covered.map((c) => (
                                  <li key={c} className="flex items-start gap-1.5 text-xs text-[#A89070]">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-[#D4954A] mt-0.5 shrink-0" />
                                    {c}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {tc.missing.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-[#f87171] mb-2">Missing</p>
                              <ul className="space-y-1">
                                {tc.missing.map((m) => (
                                  <li key={m} className="flex items-start gap-1.5 text-xs text-[#A89070]">
                                    <div className="w-3.5 h-3.5 rounded-full border border-[rgba(220,60,60,0.4)] mt-0.5 shrink-0 flex-shrink-0" />
                                    {m}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
