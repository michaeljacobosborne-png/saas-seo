'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Globe, Loader2, AlertCircle, ArrowRight } from 'lucide-react'

interface PerfRow {
  keys: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
}

// "Top Performing Pages from Search Console" — shows which URLs drive traffic.
// Self-contained: checks connection status, then loads page-dimension performance.
// Renders nothing until it knows the status, so it never flashes on audit pages
// for users who haven't connected.
export default function SearchConsolePages({ brandProfileId }: { brandProfileId: string | null }) {
  const [state, setState] = useState<'checking' | 'disconnected' | 'loading' | 'done' | 'error'>('checking')
  const [rows, setRows] = useState<PerfRow[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!brandProfileId) { setState('disconnected'); return }
    let active = true
    async function load() {
      try {
        const statusRes = await fetch(`/api/search-console/status?brand_profile_id=${brandProfileId}`)
        const status = await statusRes.json()
        if (!active) return
        if (!statusRes.ok || !status.connected || !status.has_property) {
          setState('disconnected')
          return
        }
        setState('loading')
        const res = await fetch(
          `/api/search-console/performance?brand_profile_id=${brandProfileId}&days=28&dimensions=page`
        )
        const data = await res.json()
        if (!active) return
        if (!res.ok) throw new Error(data.error ?? 'Failed to load Search Console data')
        setRows(data.rows ?? [])
        setState('done')
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load Search Console data')
          setState('error')
        }
      }
    }
    load()
    return () => { active = false }
  }, [brandProfileId])

  if (state === 'checking') return null

  const fmt = (n: number) => Math.round(n).toLocaleString()
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`
  const pos = (n: number) => (n > 0 ? n.toFixed(1) : '—')
  const shortPath = (url: string) => {
    try {
      const u = new URL(url)
      return (u.pathname === '/' ? u.host : u.pathname) || url
    } catch {
      return url
    }
  }

  // Not connected → subtle, optional add-on prompt. The audit above works fully
  // without Search Console; GSC just layers real impressions/clicks/position on
  // top, so this is framed as an enhancement, never a requirement.
  if (state === 'disconnected') {
    return (
      <div className="mt-8">
        <Link
          href="/settings"
          className="flex items-center justify-between gap-4 rounded-xl px-5 py-4 transition-colors hover:bg-[var(--ink-card)] group"
          style={{ background: 'var(--ink)', border: '1px solid rgba(184,115,51,0.18)' }}
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex p-2 rounded-lg" style={{ background: 'rgba(184,115,51,0.12)' }}>
              <Globe className="w-5 h-5" style={{ color: '#B87333' }} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-[var(--cream)]">
                  Add Search Console for performance data
                </h3>
                <span className="text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded-full text-[var(--cream-faint)] border border-[rgba(184,115,51,0.25)]">
                  Optional
                </span>
              </div>
              <p className="text-sm text-[var(--cream-dim)]">
                Connect it to layer real impressions, clicks, and rankings onto this audit. Not required — your audit above is already complete.
              </p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-[var(--cream-faint)] group-hover:text-[var(--copper)] transition-colors shrink-0" />
        </Link>
      </div>
    )
  }

  return (
    <div className="mt-8">
      <h2 className="text-sm font-semibold text-[var(--cream)] mb-3 flex items-center gap-2">
        <Globe className="w-4 h-4 text-[var(--copper-lt)]" />
        Top Performing Pages from Search Console
        <span className="text-xs font-normal text-[var(--cream-faint)]">· Last 28 days</span>
      </h2>

      {state === 'error' ? (
        <div className="flex items-start gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(220,60,60,0.08)', border: '1px solid rgba(220,60,60,0.25)' }}>
          <AlertCircle className="w-4 h-4 text-[#f87171] mt-0.5 shrink-0" />
          <p className="text-sm text-[#f87171]">{error}</p>
        </div>
      ) : state === 'loading' ? (
        <div className="rounded-xl p-10 text-center" style={{ background: 'var(--ink)', border: '1px solid rgba(184,115,51,0.2)' }}>
          <Loader2 className="w-6 h-6 animate-spin text-[var(--copper-lt)] mx-auto" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl p-8 text-center text-sm text-[var(--cream-dim)]" style={{ background: 'var(--ink)', border: '1px solid rgba(184,115,51,0.2)' }}>
          No Search Console data for this period yet.
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--ink)', border: '1px solid rgba(184,115,51,0.2)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-[var(--cream-faint)]" style={{ borderBottom: '1px solid rgba(184,115,51,0.12)' }}>
                <th className="text-left font-medium px-5 py-2.5">Page</th>
                <th className="text-right font-medium px-3 py-2.5">Clicks</th>
                <th className="text-right font-medium px-3 py-2.5">Impr.</th>
                <th className="text-right font-medium px-3 py-2.5">Avg pos.</th>
                <th className="text-right font-medium px-5 py-2.5">CTR</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 10).map((r, i) => {
                const url = r.keys[0] ?? ''
                return (
                  <tr key={i} className="text-[var(--cream-dim)]" style={{ borderBottom: i < Math.min(rows.length, 10) - 1 ? '1px solid rgba(184,115,51,0.08)' : undefined }}>
                    <td className="px-5 py-3 max-w-[20rem]">
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--cream)] hover:text-[var(--copper)] transition-colors truncate block"
                        title={url}
                      >
                        {shortPath(url)}
                      </a>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{fmt(r.clicks)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{fmt(r.impressions)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{pos(r.position)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{pct(r.ctr)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
