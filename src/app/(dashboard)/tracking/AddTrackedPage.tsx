'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus } from 'lucide-react'

/** Start tracking a page. The first run is recorded straight away (about 15 seconds). */
export default function AddTrackedPage({ atLimit, limit }: { atLimit: boolean; limit: number }) {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch('/api/tracked-pages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) })
      const json = await res.json()
      if (!res.ok) setMessage(json.error ?? 'Could not start tracking that page.')
      else {
        if (json.error) setMessage(json.error)
        setUrl('')
        router.refresh()
      }
    } catch {
      setMessage('Could not reach the server. Try again.')
    } finally {
      setBusy(false)
    }
  }

  if (atLimit) {
    return (
      <p className="text-sm" style={{ color: 'var(--cream-dim)' }}>
        You are tracking {limit} page{limit === 1 ? '' : 's'}, the most your plan allows. Stop tracking one to add another.
      </p>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/page"
          className="flex-1 rounded-xl px-4 py-2.5 text-sm"
          style={{ background: 'var(--ink)', border: '1px solid var(--border)', color: 'var(--cream)' }}
          required
        />
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
          style={{ background: 'var(--copper)', color: '#fff' }}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {busy ? 'Recording the first run…' : 'Track this page'}
        </button>
      </div>
      {message && <p className="text-sm" style={{ color: 'var(--cream-dim)' }}>{message}</p>}
    </form>
  )
}
