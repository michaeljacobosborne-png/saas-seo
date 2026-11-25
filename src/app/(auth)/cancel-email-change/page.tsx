'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

function Cancel() {
  const token = useSearchParams().get('token')
  const [state, setState] = useState<'ready' | 'working' | 'done' | 'failed'>(token ? 'ready' : 'failed')
  const [message, setMessage] = useState<string | null>(token ? null : 'This link has expired.')

  async function cancel() {
    setState('working')
    try {
      const res = await fetch('/api/account/cancel-email-change', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (res.ok && data.ok) { setState('done'); return }
      setMessage(data.message ?? 'This link has expired.')
      setState('failed')
    } catch {
      setMessage('Something went wrong. Try the link again.')
      setState('ready')
    }
  }

  const btn = { background: 'var(--copper)', color: 'var(--ink)', letterSpacing: '0.04em', textTransform: 'uppercase' as const }
  if (state === 'done') {
    return (
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--cream)' }}>The change is cancelled</h1>
        <p className="mt-2 mb-6 text-sm" style={{ color: 'var(--cream-dim)' }}>Your email address has not changed, and the confirmation link that was sent no longer works. If you did not ask for the change, someone may have access to your account. Reset your password now: it ends every other session.</p>
        <Link href="/forgot-password" className="block w-full text-center py-2.5 px-4 text-sm font-semibold rounded-lg" style={btn}>Reset my password</Link>
      </div>
    )
  }
  if (state === 'failed') {
    return (
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--cream)' }}>This link cannot be used</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--cream-dim)' }}>{message}</p>
      </div>
    )
  }
  return (
    <div>
      <h1 className="text-2xl font-bold" style={{ color: 'var(--cream)' }}>Cancel the email change?</h1>
      <p className="mt-2 mb-6 text-sm" style={{ color: 'var(--cream-dim)' }}>Someone asked to change the email address on your Byline account. Nothing has changed yet. Cancelling stops it, and your current address stays as it is.</p>
      {message && <p className="mb-4 text-sm px-3 py-2 rounded-lg" style={{ color: '#e05c5c', background: 'rgba(224,92,92,0.1)' }}>{message}</p>}
      <button onClick={cancel} disabled={state === 'working'} className="w-full py-2.5 px-4 text-sm font-semibold rounded-lg disabled:opacity-50" style={btn}>
        {state === 'working' ? 'Cancelling…' : 'Cancel this change'}
      </button>
    </div>
  )
}

export default function CancelEmailChangePage() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--ink)' }}>
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <span style={{ fontFamily: 'var(--font-playfair, "Playfair Display", serif)', fontSize: '28px', fontWeight: 900, color: 'var(--cream)', letterSpacing: '-0.01em' }}>
            Byline<span style={{ color: 'var(--copper)' }}>.</span>
          </span>
        </div>
        <div className="rounded-2xl p-8" style={{ background: 'var(--ink-card)', border: '1px solid var(--border)' }}>
          <Suspense fallback={null}><Cancel /></Suspense>
        </div>
      </div>
    </div>
  )
}
