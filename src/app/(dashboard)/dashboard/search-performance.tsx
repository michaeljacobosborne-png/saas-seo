'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { TrendingUp, MousePointerClick, Eye, Percent, ArrowDownUp, Loader2, AlertCircle, ArrowRight } from 'lucide-react'

interface PerfRow {
  keys: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
}
interface PerfTotals {
  clicks: number
  impressions: number
  ctr: number
  position: number
}

function StatCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-xl p-5" style={{ background: '#231F1B', border: '1px solid rgba(184,115,51,0.18)' }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-wider text-[#7A6555]">{label}</span>
        <span className="inline-flex p-1.5 rounded-lg" style={{ background: 'rgba(184,115,51,0.12)' }}>
          <Icon className="w-4 h-4" style={{ color: '#B87333' }} />
        </span>
      </div>
      <div className="text-3xl font-bold text-[#F7F3EC] tabular-nums">{value}</div>
    </div>
  )
}

export default function SearchPerformance({
  brandProfileId,
  connected,
  hasProperty,
}: {
  brandProfileId: string
  connected: boolean
  hasProperty: boolean
}) {
  const [rows, setRows] = useState<PerfRow[]>([])
  const [totals, setTotals] = useState<PerfTotals | null>(null)
  const [loading, setLoading] = useState(connected && hasProperty)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!connected || !hasProperty) return
    let active = true
    async function load() {
      try {
        const res = await fetch(
          `/api/search-console/performance?brand_profile_id=${brandProfileId}&days=28&dimensions=query`
        )
        const data = await res.json()
        if (!active) return
        if (!res.ok) throw new Error(data.error ?? 'Failed to load Search Console data')
        setRows(data.rows ?? [])
        setTotals(data.totals ?? null)
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load Search Console data')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [brandProfileId, connected, hasProperty])

  // Not connected (or no property picked yet) → subtle CTA card.
  if (!connected || !hasProperty) {
    return (
      <div className="mt-8">
        <Link
          href="/settings"
          className="flex items-center justify-between gap-4 rounded-xl p-5 transition-colors hover:bg-[#2A2420] group"
          style={{ background: '#231F1B', border: '1px solid rgba(184,115,51,0.18)' }}
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex p-2 rounded-lg" style={{ background: 'rgba(184,115,51,0.12)' }}>
              <TrendingUp className="w-5 h-5" style={{ color: '#B87333' }} />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-[#F7F3EC]">
                {connected ? 'Finish connecting Search Console' : 'Connect Search Console'}
              </h3>
              <p className="text-sm text-[#A89070]">
                {connected
                  ? 'Pick a property to see your real clicks, impressions, and rankings.'
                  : 'See real clicks, impressions, and rankings for your site.'}
              </p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-[#7A6555] group-hover:text-[#B87333] transition-colors shrink-0" />
        </Link>
      </div>
    )
  }

  const fmt = (n: number) => Math.round(n).toLocaleString()
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`
  const pos = (n: number) => (n > 0 ? n.toFixed(1) : '—')

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#B87333]" />
          <h2 className="text-sm font-semibold text-[#F7F3EC]">Search Performance</h2>
        </div>
        <span className="text-xs text-[#7A6555]">Last 28 days</span>
      </div>

      {error ? (
        <div className="flex items-start gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(220,60,60,0.08)', border: '1px solid rgba(220,60,60,0.25)' }}>
          <AlertCircle className="w-4 h-4 text-[#f87171] mt-0.5 shrink-0" />
          <p className="text-sm text-[#f87171]">{error}</p>
        </div>
      ) : loading ? (
        <div className="rounded-xl p-12 text-center" style={{ background: '#231F1B', border: '1px solid rgba(184,115,51,0.18)' }}>
          <Loader2 className="w-6 h-6 animate-spin text-[#D4954A] mx-auto" />
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard icon={MousePointerClick} label="Total clicks" value={fmt(totals?.clicks ?? 0)} />
            <StatCard icon={Eye} label="Total impressions" value={fmt(totals?.impressions ?? 0)} />
            <StatCard icon={Percent} label="Avg CTR" value={pct(totals?.ctr ?? 0)} />
            <StatCard icon={ArrowDownUp} label="Avg position" value={pos(totals?.position ?? 0)} />
          </div>

          {/* Top queries */}
          <div className="rounded-xl overflow-hidden" style={{ background: '#231F1B', border: '1px solid rgba(184,115,51,0.18)' }}>
            <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(184,115,51,0.15)' }}>
              <h3 className="text-sm font-semibold text-[#F7F3EC]">Top queries</h3>
            </div>
            {rows.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-[#A89070]">
                No Search Console data for this period yet.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wider text-[#7A6555]" style={{ borderBottom: '1px solid rgba(184,115,51,0.1)' }}>
                    <th className="text-left font-medium px-5 py-2.5">Query</th>
                    <th className="text-right font-medium px-3 py-2.5">Clicks</th>
                    <th className="text-right font-medium px-3 py-2.5">Impr.</th>
                    <th className="text-right font-medium px-3 py-2.5">CTR</th>
                    <th className="text-right font-medium px-5 py-2.5">Pos.</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((r, i) => (
                    <tr key={i} className="text-[#A89070]" style={{ borderBottom: i < 4 ? '1px solid rgba(184,115,51,0.08)' : undefined }}>
                      <td className="px-5 py-3 text-[#F7F3EC] truncate max-w-[18rem]">{r.keys[0] ?? '—'}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{fmt(r.clicks)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{fmt(r.impressions)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{pct(r.ctr)}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{pos(r.position)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}
