'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Search, CheckCircle2, AlertCircle, Loader2, Link2, Unlink, RefreshCw,
} from 'lucide-react'

interface Property {
  siteUrl: string
  permissionLevel: string
}

interface InitialStatus {
  connected: boolean
  property_url: string | null
  has_property: boolean
}

export default function SearchConsoleSection({
  brandProfileId,
  initial,
}: {
  brandProfileId: string | null
  initial: InitialStatus
}) {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<InitialStatus>(initial)
  const [properties, setProperties] = useState<Property[]>([])
  const [loadingProps, setLoadingProps] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [banner, setBanner] = useState<string | null>(null)
  const [showPicker, setShowPicker] = useState(!initial.has_property && initial.connected)

  // Surface the post-OAuth redirect outcome.
  useEffect(() => {
    const gsc = searchParams.get('gsc')
    if (gsc === 'connected') setBanner('Google Search Console connected.')
    else if (gsc === 'error') setError('Couldn’t connect Google Search Console. Please try again.')
  }, [searchParams])

  const loadProperties = useCallback(async () => {
    if (!brandProfileId) return
    setLoadingProps(true)
    setError(null)
    try {
      const res = await fetch(`/api/search-console/properties?brand_profile_id=${brandProfileId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load properties')
      setProperties(data.properties ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load properties')
    } finally {
      setLoadingProps(false)
    }
  }, [brandProfileId])

  // Auto-load the property list whenever the picker is open and we don't have it.
  useEffect(() => {
    if (showPicker && status.connected && properties.length === 0) loadProperties()
  }, [showPicker, status.connected, properties.length, loadProperties])

  async function selectProperty(propertyUrl: string) {
    if (!brandProfileId) return
    setSelecting(true)
    setError(null)
    try {
      const res = await fetch('/api/search-console/properties/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_profile_id: brandProfileId, property_url: propertyUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to set property')
      setStatus({ connected: true, property_url: propertyUrl, has_property: true })
      setShowPicker(false)
      setBanner('Search Console property saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set property')
    } finally {
      setSelecting(false)
    }
  }

  async function disconnect() {
    if (!brandProfileId) return
    setDisconnecting(true)
    setError(null)
    try {
      const res = await fetch('/api/search-console/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_profile_id: brandProfileId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to disconnect')
      setStatus({ connected: false, property_url: null, has_property: false })
      setProperties([])
      setShowPicker(false)
      setBanner('Search Console disconnected.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect')
    } finally {
      setDisconnecting(false)
    }
  }

  const connectHref = brandProfileId
    ? `/api/search-console/auth?brand_profile_id=${brandProfileId}`
    : '#'

  return (
    <div
      className="rounded-2xl p-6 mt-6"
      style={{ background: 'var(--ink-card)', border: '1px solid rgba(184,115,51,0.18)' }}
    >
      <div className="flex items-center gap-2 mb-5">
        <Search className="w-4 h-4" style={{ color: '#B87333' }} />
        <h2 className="text-base font-semibold" style={{ color: '#F7F3EC' }}>Search Console</h2>
      </div>

      {banner && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg text-xs font-medium text-green-400 bg-green-900/30 border border-green-700/40">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          {banner}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg text-xs font-medium text-red-400 bg-red-900/30 border border-red-700/40">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}

      {!brandProfileId ? (
        <p className="text-sm" style={{ color: 'var(--cream-dim)' }}>
          Set up a brand profile first to connect Search Console.
        </p>
      ) : !status.connected ? (
        // ── Not connected ──────────────────────────────────────────────
        <div className="space-y-4">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--cream-dim)' }}>
            Connect Google Search Console to see real clicks, impressions, and rankings for your
            site right inside Byline.
          </p>
          <a
            href={connectHref}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors"
            style={{ background: '#B87333', color: '#F7F3EC' }}
          >
            <Link2 className="w-4 h-4" /> Connect Google Search Console
          </a>
        </div>
      ) : !status.has_property || showPicker ? (
        // ── Connected, picking a property ──────────────────────────────
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--cream-dim)' }}>
            {status.has_property
              ? 'Choose a different Search Console property for this brand.'
              : 'Connected. Now choose which Search Console property to track.'}
          </p>

          {loadingProps ? (
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--cream-faint)' }}>
              <Loader2 className="w-4 h-4 animate-spin" /> Loading your properties…
            </div>
          ) : properties.length === 0 ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm" style={{ color: 'var(--cream-faint)' }}>
                No verified properties found on this Google account.
              </p>
              <button
                onClick={loadProperties}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors"
                style={{ color: '#B87333', borderColor: 'rgba(184,115,51,0.25)' }}
              >
                <RefreshCw className="w-3 h-3" /> Retry
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {properties.map((p) => {
                const isCurrent = p.siteUrl === status.property_url
                return (
                  <button
                    key={p.siteUrl}
                    onClick={() => selectProperty(p.siteUrl)}
                    disabled={selecting}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg text-left transition-colors disabled:opacity-50"
                    style={{ background: 'var(--ink)', border: '1px solid rgba(184,115,51,0.2)' }}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: '#F7F3EC' }}>
                        {p.siteUrl}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--cream-faint)' }}>
                        {p.permissionLevel}
                      </div>
                    </div>
                    {isCurrent ? (
                      <span className="text-xs font-medium shrink-0" style={{ color: '#D4954A' }}>Current</span>
                    ) : selecting ? (
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" style={{ color: 'var(--cream-faint)' }} />
                    ) : (
                      <span className="text-xs font-medium shrink-0" style={{ color: '#B87333' }}>Select</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          <button
            onClick={disconnect}
            disabled={disconnecting}
            className="inline-flex items-center gap-1.5 text-xs font-medium transition-colors disabled:opacity-50"
            style={{ color: 'var(--cream-faint)' }}
          >
            {disconnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlink className="w-3 h-3" />}
            Disconnect
          </button>
        </div>
      ) : (
        // ── Fully connected ────────────────────────────────────────────
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid rgba(184,115,51,0.1)' }}>
            <span className="text-sm" style={{ color: 'var(--cream-dim)' }}>Status</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border text-green-400 bg-green-900/30 border-green-700/40">
              <CheckCircle2 className="w-3 h-3" /> Connected
            </span>
          </div>
          <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid rgba(184,115,51,0.1)' }}>
            <span className="text-sm" style={{ color: 'var(--cream-dim)' }}>Property</span>
            <span className="text-sm font-semibold truncate max-w-[16rem]" style={{ color: '#F7F3EC' }}>
              {status.property_url}
            </span>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={() => { setShowPicker(true); setProperties([]) }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors"
              style={{ color: '#B87333', borderColor: 'rgba(184,115,51,0.25)' }}
            >
              <RefreshCw className="w-3.5 h-3.5" /> Change property
            </button>
            <button
              onClick={disconnect}
              disabled={disconnecting}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50"
              style={{ color: 'var(--cream-faint)' }}
            >
              {disconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
