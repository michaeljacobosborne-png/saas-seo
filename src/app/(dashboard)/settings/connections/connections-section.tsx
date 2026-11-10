'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Globe, CheckCircle2, AlertCircle, Loader2, Link2, Unlink, RefreshCw, Plus,
} from 'lucide-react'

interface Connection {
  id: string
  platform: string
  site_url: string
  display_name: string | null
  status: string | null
  last_tested: string | null
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'never'
  const then = new Date(iso).getTime()
  const diff = Date.now() - then
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ConnectionsSection() {
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  // Connect form
  const [siteUrl, setSiteUrl] = useState('')
  const [username, setUsername] = useState('')
  const [appPassword, setAppPassword] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [banner, setBanner] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/publish/connections')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load connections')
      setConnections(data.connections ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load connections')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Inline async wrapper keeps the setState out of the effect body (matches the
    // codebase convention and avoids react-hooks/set-state-in-effect).
    async function init() { await load() }
    init()
  }, [load])

  async function connect() {
    if (connecting) return
    setConnecting(true)
    setFormError(null)
    setBanner(null)
    try {
      const res = await fetch('/api/publish/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'wordpress', siteUrl, username, appPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to connect')
      setBanner(`Connected to ${data.displayName ?? siteUrl}.`)
      setSiteUrl(''); setUsername(''); setAppPassword('')
      setShowForm(false)
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to connect')
    } finally {
      setConnecting(false)
    }
  }

  async function test(id: string) {
    setBusyId(id)
    setError(null)
    setBanner(null)
    try {
      const res = await fetch(`/api/publish/${id}/test`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Connection test failed')
      setBanner('Connection is healthy.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection test failed')
    } finally {
      setBusyId(null)
      await load()
    }
  }

  async function remove(id: string) {
    setBusyId(id)
    setError(null)
    setBanner(null)
    try {
      const res = await fetch(`/api/publish/${id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Failed to remove connection')
      setConnections((prev) => prev.filter((c) => c.id !== id))
      setBanner('Connection removed.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove connection')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="rounded-2xl p-6 mt-6" style={{ background: 'var(--ink-card)', border: '1px solid rgba(184,115,51,0.18)' }}>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4" style={{ color: '#B87333' }} />
          <h2 className="text-base font-semibold" style={{ color: '#F7F3EC' }}>Publishing Connections</h2>
        </div>
        {!showForm && (
          <button
            onClick={() => { setShowForm(true); setFormError(null) }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors"
            style={{ color: '#B87333', borderColor: 'rgba(184,115,51,0.25)' }}
          >
            <Plus className="w-3.5 h-3.5" /> Connect WordPress
          </button>
        )}
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

      {/* Connect form */}
      {showForm && (
        <div className="mb-5 p-4 rounded-xl" style={{ background: 'var(--ink)', border: '1px solid rgba(184,115,51,0.2)' }}>
          <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--cream-dim)' }}>
            Connect a WordPress site to publish articles as drafts. Create an{' '}
            <span className="font-medium" style={{ color: '#F7F3EC' }}>Application Password</span> under
            Users → Profile in your WP admin, and paste it below.
          </p>

          {formError && (
            <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg text-xs font-medium text-red-400 bg-red-900/30 border border-red-700/40">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {formError}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--cream-dim)' }}>Site URL</label>
              <input
                type="url"
                value={siteUrl}
                onChange={(e) => setSiteUrl(e.target.value)}
                placeholder="https://yourblog.com"
                className="w-full text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#B87333] focus:border-transparent"
                style={{ background: 'var(--ink-card)', border: '1px solid rgba(184,115,51,0.2)', color: '#F7F3EC' }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--cream-dim)' }}>Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="WordPress username"
                autoComplete="off"
                className="w-full text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#B87333] focus:border-transparent"
                style={{ background: 'var(--ink-card)', border: '1px solid rgba(184,115,51,0.2)', color: '#F7F3EC' }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--cream-dim)' }}>Application Password</label>
              <input
                type="password"
                value={appPassword}
                onChange={(e) => setAppPassword(e.target.value)}
                placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                autoComplete="off"
                className="w-full text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#B87333] focus:border-transparent"
                style={{ background: 'var(--ink-card)', border: '1px solid rgba(184,115,51,0.2)', color: '#F7F3EC' }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={connect}
              disabled={connecting || !siteUrl || !username || !appPassword}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              style={{ background: '#B87333', color: '#F7F3EC' }}
            >
              {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              {connecting ? 'Connecting…' : 'Connect'}
            </button>
            <button
              onClick={() => { setShowForm(false); setFormError(null) }}
              disabled={connecting}
              className="px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              style={{ color: 'var(--cream-faint)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Connection list */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--cream-faint)' }}>
          <Loader2 className="w-4 h-4 animate-spin" /> Loading connections…
        </div>
      ) : connections.length === 0 ? (
        !showForm && (
          <p className="text-sm" style={{ color: 'var(--cream-dim)' }}>
            No sites connected yet. Connect a WordPress site to publish your articles in one click.
          </p>
        )
      ) : (
        <div className="space-y-2">
          {connections.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg"
              style={{ background: 'var(--ink)', border: '1px solid rgba(184,115,51,0.2)' }}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate" style={{ color: '#F7F3EC' }}>
                    {c.display_name || c.site_url}
                  </span>
                  {c.status === 'error' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full text-red-400 bg-red-900/30 border border-red-700/40">
                      <AlertCircle className="w-2.5 h-2.5" /> Error
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full text-green-400 bg-green-900/30 border border-green-700/40">
                      <CheckCircle2 className="w-2.5 h-2.5" /> Active
                    </span>
                  )}
                </div>
                <div className="text-xs truncate" style={{ color: 'var(--cream-faint)' }}>
                  {c.site_url} · tested {timeAgo(c.last_tested)}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => test(c.id)}
                  disabled={busyId === c.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50"
                  style={{ color: '#B87333', borderColor: 'rgba(184,115,51,0.25)' }}
                >
                  {busyId === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Test
                </button>
                <button
                  onClick={() => remove(c.id)}
                  disabled={busyId === c.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                  style={{ color: 'var(--cream-faint)' }}
                >
                  <Unlink className="w-3 h-3" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
