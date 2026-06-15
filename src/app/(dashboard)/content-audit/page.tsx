'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { BrandProfile } from '@/lib/supabase/types'
import Link from 'next/link'
import SearchConsolePages from './search-console-pages'
import {
  BarChart2, RefreshCw, Loader2, AlertCircle, ArrowRight,
  Search, FileText, CheckCircle2, Clock, ChevronDown, ChevronUp, Shield,
} from 'lucide-react'

type DomainRating = { dr: number; ahrefsRank: number }

// Best-effort competitor name → domain. Competitors are stored as free text and
// may be names ("Ahrefs") rather than domains ("ahrefs.com"). Strip common
// prefixes + lowercase; if there's no dot, guess `<name>.com`. Imperfect — a
// wrong guess just yields a null DR (shown as "—").
function competitorToDomain(raw: string): string {
  const cleaned = raw.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/.*$/, '').toLowerCase()
  if (!cleaned) return ''
  if (cleaned.includes('.')) return cleaned
  return cleaned.replace(/\s+/g, '') + '.com'
}

function DrBadge({ rating }: { rating: DomainRating | null | undefined }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border border-[rgba(184,115,51,0.3)] text-[var(--copper-lt)]"
      style={{ background: 'rgba(184,115,51,0.1)' }}
      title="Ahrefs Domain Rating"
    >
      <Shield className="w-3 h-3" />
      DR {rating ? rating.dr : '—'}
    </span>
  )
}

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
const LS_RESULT_KEY = 'byline_audit_result_v2'
type CachedAudit = { result: AuditResult; url: string; runAt: string }

function PriorityBadge({ priority }: { priority: Gap['priority'] }) {
  const map = {
    high: 'bg-[rgba(220,60,60,0.12)] text-[#f87171] border-[rgba(220,60,60,0.3)]',
    medium: 'bg-[rgba(184,115,51,0.12)] text-[var(--copper-lt)] border-[rgba(184,115,51,0.3)]',
    low: 'bg-[var(--ink-card)] text-[var(--cream-dim)] border-[rgba(184,115,51,0.2)]',
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
  // Live crawl/analysis progress streamed from /api/audit.
  const [progress, setProgress] = useState<{ message: string; step: number; total: number } | null>(null)
  // Shown after 15s so users on large sites know the longer wait is expected.
  const [showSlowHint, setShowSlowHint] = useState(false)
  // Competitor Domain Ratings, keyed by the guessed domain (competitorToDomain).
  const [competitorDr, setCompetitorDr] = useState<Record<string, DomainRating | null>>({})

  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY)
    if (stored) setLastRun(new Date(stored))

    const raw = localStorage.getItem(LS_RESULT_KEY)
    if (raw) {
      try {
        const cached: CachedAudit = JSON.parse(raw)
        setResult(cached.result)
        setStatus('done')
        setLastRun(new Date(cached.runAt))
      } catch { /* ignore */ }
    }
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
      // If there's no local cache but the DB has a saved audit, hydrate from it
      // (cross-device persistence) instead of triggering a fresh run.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dbAudit = (profile as any)?.last_audit
      if (!localStorage.getItem(LS_RESULT_KEY) && dbAudit) {
        const dbCache = dbAudit as CachedAudit
        localStorage.setItem(LS_RESULT_KEY, JSON.stringify(dbCache))
        setResult(dbCache.result)
        setStatus('done')
        setLastRun(new Date(dbCache.runAt))
      }

      // Only trigger auto-run if we have no cached result
      const hasCached = !!localStorage.getItem(LS_RESULT_KEY)
      if (brandUrl && !hasCached) setUrlForRun(brandUrl)
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
    setProgress(null)
    setShowSlowHint(false)

    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl.trim(), userId: userId ?? undefined }),
      })

      // Early validation failures (400/422) come back as plain JSON, not a stream.
      if (!res.ok || !res.body) {
        let msg = 'Audit failed'
        try {
          const data = await res.json()
          msg = data.error ?? msg
        } catch { /* keep default */ }
        setError(msg)
        setStatus('error')
        return
      }

      // Consume the newline-delimited JSON stream: progress events, then a
      // terminal result or error event.
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let finalResult: AuditResult | null = null
      let streamError: string | null = null

      const handleLine = (line: string) => {
        const trimmed = line.trim()
        if (!trimmed) return
        let evt: { type?: string; message?: string; step?: number; total?: number; error?: string; [k: string]: unknown }
        try {
          evt = JSON.parse(trimmed)
        } catch {
          return
        }
        if (evt.type === 'progress') {
          setProgress({ message: evt.message ?? '', step: evt.step ?? 0, total: evt.total ?? 0 })
        } else if (evt.type === 'result') {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { type, ...data } = evt
          finalResult = data as unknown as AuditResult
        } else if (evt.type === 'error') {
          streamError = evt.error ?? 'Audit failed'
        }
      }

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let nl
        while ((nl = buffer.indexOf('\n')) !== -1) {
          handleLine(buffer.slice(0, nl))
          buffer = buffer.slice(nl + 1)
        }
      }
      handleLine(buffer) // flush any trailing line

      if (streamError) {
        setError(streamError)
        setStatus('error')
        return
      }
      if (!finalResult) {
        setError('Audit failed. Please try again.')
        setStatus('error')
        return
      }

      setResult(finalResult)
      setStatus('done')
      const now = new Date()
      setLastRun(now)
      localStorage.setItem(LS_KEY, now.toISOString())

      const toCache: CachedAudit = { result: finalResult, url: targetUrl.trim(), runAt: now.toISOString() }
      localStorage.setItem(LS_RESULT_KEY, JSON.stringify(toCache))
      // Also persist to brand_profiles for cross-device access (non-fatal)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from('brand_profiles')
            .update({ last_audit: toCache })
            .eq('user_id', session.user.id)
        }
      } catch { /* ignore — local cache already written */ }
    } catch {
      setError('Network error. Please try again.')
      setStatus('error')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // Auto-run once brand URL is resolved — but never when a cached result exists
  useEffect(() => {
    if (!pageLoaded || !urlForRun || status === 'loading') return
    if (localStorage.getItem(LS_RESULT_KEY)) {
      setUrlForRun(null)
      return
    }
    runAudit(urlForRun)
    setUrlForRun(null)
  }, [pageLoaded, urlForRun, status, runAudit])

  // After 15s of loading, surface the "large sites can take a while" hint.
  useEffect(() => {
    if (status !== 'loading') {
      setShowSlowHint(false)
      return
    }
    const t = setTimeout(() => setShowSlowHint(true), 15000)
    return () => clearTimeout(t)
  }, [status])

  // Batch-fetch competitor Domain Ratings once the audit result is shown.
  useEffect(() => {
    const competitors = brand?.competitors ?? []
    if (status !== 'done' || competitors.length === 0) return
    const domains = Array.from(
      new Set(competitors.map(competitorToDomain).filter(Boolean))
    ).slice(0, 10)
    if (domains.length === 0) return
    let active = true
    async function load() {
      try {
        const res = await fetch(`/api/domain-rating?domains=${encodeURIComponent(domains.join(','))}`)
        const data = await res.json()
        if (active && res.ok) setCompetitorDr(data.ratings ?? {})
      } catch { /* leave badges as "—" */ }
    }
    load()
    return () => { active = false }
  }, [status, brand])

  const unwrittenSaved = savedKeywords.filter(
    (kw) => !writtenKeywords.some((wk) => wk.toLowerCase().includes(kw.toLowerCase()))
  )

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BarChart2 className="w-5 h-5 text-[var(--copper-lt)]" />
            <h1 className="text-2xl font-bold text-[var(--cream)]">Content Audit</h1>
          </div>
          <p className="text-sm text-[var(--cream-dim)] flex items-center gap-1.5">
            {status === 'loading' ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--copper-lt)]" />
                Scanning {auditUrl}…
              </>
            ) : auditUrl ? (
              `Audit for ${auditUrl}`
            ) : (
              'See exactly where your content strategy has gaps.'
            )}
          </p>
          {lastRun && (
            <p className="text-xs text-[var(--cream-faint)] mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Last audited {timeAgo(lastRun)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setShowUrlInput((v) => !v)}
            className="px-3 py-1.5 text-xs text-[var(--cream-dim)] border border-[rgba(184,115,51,0.2)] rounded-lg hover:bg-[var(--ink-card)] transition-colors"
          >
            Change URL
          </button>
          <button
            onClick={() => { localStorage.removeItem(LS_RESULT_KEY); runAudit(auditUrl) }}
            disabled={status === 'loading' || !auditUrl}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--copper)] border border-[rgba(184,115,51,0.25)] rounded-lg hover:bg-[rgba(184,115,51,0.08)] disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${status === 'loading' ? 'animate-spin' : ''}`} />
            Re-run audit
          </button>
        </div>
      </div>

      {/* Intro blurb — shown before first run */}
      {status === 'idle' && !result && (
        <div className="mb-8 rounded-xl px-5 py-4 border border-[rgba(184,115,51,0.18)]" style={{ background: 'var(--ink-card)' }}>
          <p className="text-sm text-[var(--cream-dim)] leading-relaxed">
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
            className="px-4 py-2 bg-[#B87333] text-white text-sm font-medium rounded-xl hover:bg-[#A0622A] disabled:opacity-50 transition-colors"
          >
            Run
          </button>
        </div>
      )}

      {!brand?.website_url && !auditUrl && status === 'idle' && (
        <div className="rounded-xl px-4 py-3 mb-6 text-sm text-[var(--copper-lt)] border border-[rgba(184,115,51,0.3)]" style={{background:"rgba(184,115,51,0.08)"}}>
          <span className="font-medium">No website URL in your brand profile.</span>{' '}
          <Link href="/brand" className="underline hover:text-[var(--copper-lt)]">
            Set it up first →
          </Link>
        </div>
      )}

      {/* Loading — must be unmissable so users know the scan is running */}
      {status === 'loading' && (
        <div className="bg-[var(--ink-card)] rounded-2xl p-16 text-center border border-[rgba(184,115,51,0.25)]">
          <style>{`@keyframes audit-progress {0%{transform:translateX(-120%)}100%{transform:translateX(420%)}}`}</style>
          <Loader2 className="w-10 h-10 animate-spin text-[var(--copper-lt)] mx-auto mb-4" />
          <p className="text-base font-semibold text-[var(--cream)]">
            Scanning {auditUrl}…
          </p>
          <p className="text-sm text-[var(--cream-dim)] mt-1">
            {progress?.message ?? 'Crawling your site and cross-referencing search demand…'}
          </p>

          {/* Progress bar — determinate when we have step/total, else an animated indeterminate bar */}
          <div className="mt-5 max-w-sm mx-auto h-1.5 rounded-full overflow-hidden bg-[rgba(184,115,51,0.15)]">
            {progress && progress.total > 0 ? (
              <div
                className="h-full bg-[var(--copper)] rounded-full transition-all duration-500 ease-out"
                style={{ width: `${Math.min(100, Math.round((progress.step / progress.total) * 100))}%` }}
              />
            ) : (
              <div
                className="h-full w-1/4 bg-[var(--copper)] rounded-full"
                style={{ animation: 'audit-progress 1.2s ease-in-out infinite' }}
              />
            )}
          </div>

          {progress && progress.total > 0 && (
            <p className="text-xs text-[var(--copper-lt)] mt-2">
              Step {progress.step} of {progress.total}
            </p>
          )}
          {showSlowHint && (
            <p className="text-xs text-[var(--cream-faint)] mt-2">
              Large sites may take up to 60 seconds…
            </p>
          )}
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
              { value: result.pageCount, label: 'Pages scanned', color: 'text-[var(--cream)]' },
              { value: result.gaps?.length ?? 0, label: 'Content gaps', color: 'text-[var(--copper)]' },
              { value: unwrittenSaved.length, label: 'Saved keywords not yet written', color: 'text-[var(--copper-lt)]' },
            ].map(({ value, label, color }) => (
              <div key={label} className="bg-[var(--ink)] border border-[rgba(184,115,51,0.2)] rounded-xl p-4 text-center">
                <div className={`text-2xl font-bold ${color}`}>{value}</div>
                <div className="text-xs text-[var(--cream-dim)] mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          {/* Competitor Domain Authority */}
          {(brand?.competitors?.length ?? 0) > 0 && (
            <div className="rounded-xl p-5 border border-[rgba(184,115,51,0.2)]" style={{ background: 'var(--ink)' }}>
              <h2 className="text-sm font-semibold text-[var(--cream)] mb-1 flex items-center gap-2">
                <Shield className="w-4 h-4 text-[var(--copper-lt)]" />
                Competitor Domain Authority
              </h2>
              <p className="text-xs text-[var(--cream-dim)] mb-3">
                Ahrefs Domain Rating (0–100) for each competitor&apos;s backlink profile. Domains are
                inferred from competitor names, so some lookups may show &ldquo;—&rdquo;.
              </p>
              <div className="flex flex-col gap-2">
                {brand!.competitors.map((name) => {
                  const domain = competitorToDomain(name)
                  return (
                    <div
                      key={name}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-[rgba(184,115,51,0.15)]"
                      style={{ background: 'var(--ink-card)' }}
                    >
                      <div className="min-w-0">
                        <span className="text-sm text-[var(--cream)]">{name}</span>
                        {domain && domain !== name.toLowerCase() && (
                          <span className="text-xs text-[var(--cream-faint)] ml-2">{domain}</span>
                        )}
                      </div>
                      <DrBadge rating={competitorDr[domain]} />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Saved keywords cross-reference */}
          {unwrittenSaved.length > 0 && (
            <div className="rounded-xl p-5 border border-[rgba(184,115,51,0.25)]" style={{background:"rgba(184,115,51,0.07)"}}>
              <h2 className="text-sm font-semibold text-[var(--cream)] mb-1">
                You&apos;ve saved these keywords but haven&apos;t written about them yet
              </h2>
              <p className="text-xs text-[var(--cream-dim)] mb-3">
                These are already in your research pipeline — write them first.
              </p>
              <div className="flex flex-wrap gap-2">
                {unwrittenSaved.map((kw) => (
                  <Link
                    key={kw}
                    href="/articles/new"
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-[var(--ink)] border border-[rgba(184,115,51,0.3)] text-[var(--copper-lt)] rounded-full hover:border-[#B87333] transition-colors"
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
              <h2 className="text-sm font-semibold text-[var(--cream)] mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[var(--copper-lt)]" />
                Quick Wins
              </h2>
              <ul className="space-y-2">
                {result.quickWins.map((w, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-[var(--cream-dim)] bg-[var(--ink)] border border-[rgba(184,115,51,0.15)] rounded-lg px-4 py-2.5"
                  >
                    <CheckCircle2 className="w-4 h-4 text-[var(--copper-lt)] mt-0.5 shrink-0" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* All gaps */}
          <div>
            <h2 className="text-sm font-semibold text-[var(--cream)] mb-3">
              All Content Gaps ({result.gaps?.length ?? 0})
            </h2>
            <div className="space-y-3">
              {(result.gaps ?? []).map((gap, i) => {
                const isSaved = savedKeywords.some(
                  (kw) => kw.toLowerCase() === gap.suggestedKeyword?.toLowerCase()
                )
                return (
                  <div key={i} className="bg-[var(--ink)] border border-[rgba(184,115,51,0.2)] rounded-xl p-4">
                    <div className="flex items-start gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center flex-wrap gap-2 mb-1">
                          <h3 className="text-sm font-semibold text-[var(--cream)]">{gap.title}</h3>
                          <PriorityBadge priority={gap.priority} />
                          {isSaved && (
                            <span className="text-xs px-2 py-0.5 bg-[rgba(184,115,51,0.08)] text-[#A0622A] border border-[rgba(184,115,51,0.25)] rounded-full font-medium">
                              Saved keyword
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-[var(--cream-dim)]">{gap.description}</p>
                        {gap.suggestedKeyword && (
                          <p className="text-xs text-[var(--copper)] mt-1.5 font-medium">
                            Keyword: {gap.suggestedKeyword}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-3 border-t border-[rgba(184,115,51,0.15)]">
                      <Link
                        href={`/keywords?seed=${encodeURIComponent(gap.suggestedKeyword || gap.title)}`}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-[rgba(184,115,51,0.2)] text-[var(--cream-dim)] rounded-lg hover:border-[#B87333] hover:text-[var(--copper)] transition-colors"
                      >
                        <Search className="w-3 h-3" />
                        Research this keyword →
                      </Link>
                      <Link
                        href="/articles/new"
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-[#B87333] text-white rounded-lg hover:bg-[#A0622A] transition-colors"
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
              <h2 className="text-sm font-semibold text-[var(--cream)] mb-3">Topic Coverage Map</h2>
              <div className="space-y-2">
                {result.topicClusters.map((tc) => {
                  const isOpen = expandedCluster === tc.cluster
                  return (
                    <div
                      key={tc.cluster}
                      className="bg-[var(--ink)] border border-[rgba(184,115,51,0.2)] rounded-xl overflow-hidden"
                    >
                      <button
                        onClick={() => setExpandedCluster(isOpen ? null : tc.cluster)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[var(--ink-card)] transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-sm font-medium text-[var(--cream)]">{tc.cluster}</span>
                          <span className="text-xs text-[var(--copper-lt)] bg-[rgba(184,115,51,0.1)] px-2 py-0.5 rounded-full border border-[rgba(184,115,51,0.2)]">
                            {tc.covered.length} covered
                          </span>
                          <span className="text-xs text-[#f87171] bg-[rgba(220,60,60,0.1)] px-2 py-0.5 rounded-full border border-[rgba(220,60,60,0.2)]">
                            {tc.missing.length} missing
                          </span>
                        </div>
                        {isOpen
                          ? <ChevronUp className="w-4 h-4 text-[var(--cream-faint)] shrink-0" />
                          : <ChevronDown className="w-4 h-4 text-[var(--cream-faint)] shrink-0" />
                        }
                      </button>
                      {isOpen && (
                        <div className="border-t border-[rgba(184,115,51,0.15)] px-4 py-3 grid grid-cols-2 gap-4">
                          {tc.covered.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-[var(--copper-lt)] mb-2">Covered</p>
                              <ul className="space-y-1">
                                {tc.covered.map((c) => (
                                  <li key={c} className="flex items-start gap-1.5 text-xs text-[var(--cream-dim)]">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-[var(--copper-lt)] mt-0.5 shrink-0" />
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
                                  <li key={m} className="flex items-start gap-1.5 text-xs text-[var(--cream-dim)]">
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

      {/* Top performing pages from Search Console (or connect CTA) */}
      <SearchConsolePages brandProfileId={brand?.id ?? null} />
    </div>
  )
}
