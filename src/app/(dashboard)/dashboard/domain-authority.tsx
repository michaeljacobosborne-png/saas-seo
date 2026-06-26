'use client'

import { useEffect, useState } from 'react'
import { Shield, Loader2 } from 'lucide-react'

interface DomainRating {
  dr: number
  ahrefsRank: number
}

// Strip protocol / www / path so we send Ahrefs a bare domain.
function normalizeDomain(url: string): string {
  return url
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/.*$/, '')
    .toLowerCase()
}

export default function DomainAuthority({ websiteUrl }: { websiteUrl: string }) {
  const domain = normalizeDomain(websiteUrl)
  const [rating, setRating] = useState<DomainRating | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!domain) return
    let active = true
    async function load() {
      try {
        const res = await fetch(`/api/domain-rating?domains=${encodeURIComponent(domain)}`)
        const data = await res.json()
        if (!active) return
        setRating(data?.ratings?.[domain] ?? null)
      } catch {
        if (active) setRating(null)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [domain])

  const dr = rating?.dr ?? 0
  const barPct = Math.max(0, Math.min(100, dr))

  return (
    <div className="rounded-xl p-5" style={{ background: 'var(--ink-card)', border: '1px solid rgba(184,115,51,0.18)' }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-wider text-[var(--cream-faint)]">Domain authority</span>
        <span className="inline-flex p-1.5 rounded-lg" style={{ background: 'rgba(184,115,51,0.12)' }}>
          <Shield className="w-4 h-4" style={{ color: '#B87333' }} />
        </span>
      </div>

      {loading ? (
        <div className="py-2">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--copper-lt)]" />
        </div>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-[var(--cream)] tabular-nums">
              {rating ? dr : '—'}
            </span>
            <span className="text-xs text-[var(--cream-faint)]">/ 100 DR</span>
          </div>
          {rating && rating.ahrefsRank > 0 && (
            <div className="text-xs text-[var(--cream-faint)] mt-0.5 tabular-nums">
              Ahrefs Rank #{rating.ahrefsRank.toLocaleString()}
            </div>
          )}
          {/* Thin DR / 100 bar */}
          <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(184,115,51,0.12)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${barPct}%`, background: '#B87333' }}
            />
          </div>
          <div className="text-xs text-[var(--cream-faint)] mt-2 truncate" title={domain}>
            {domain}
          </div>
        </>
      )}
    </div>
  )
}
