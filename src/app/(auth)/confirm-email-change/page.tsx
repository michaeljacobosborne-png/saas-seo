'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

function Confirm() {
  const token = useSearchParams().get('token')
  const [state, setState] = useState<'ready' | 'working' | 'done' | 'dead' | 'unavailable'>(token ? 'ready' : 'dead')
  const [message, setMessage] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)

  async function confirm() {
    setState('working')
    try {
      const res = await fetch('/api/account/confirm-email-change', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; code?: string; message?: string; email?: string }
      if (res.ok && data.ok) { setEmail(data.email ?? null); setState('done'); return }
      setMessage(data.message ?? null)
      setState(data.code === 'unavailable' ? 'unavailable' : 'dead')
    } catch {
      setMessage('Something went wrong. Try the link again.')
      setState('ready')
    }
  }

  const btn = { background: 'var(--copper)', color: 'var(--ink)', letterSpacing: '0.04em', textTransform: 'uppercase' as const }
  if (state === 'done') {
    return (
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--cream)' }}>Email address changed</h1>
        <p className="mt-2 mb-6 text-sm" style={{ color: 'var(--cream-dim)' }}>Your Byline account now signs in with {email ?? 'the new address'}. Use it, with your existing password, next time you sign in.</p>
        <Link href="/login" className="block w-full text-center py-2.5 px-4 text-sm font-semibold rounded-lg" style={btn}>Go to sign in</Link>
      </div>
    )
  }
  if (state === 'dead' || state === 'unavailable') {
    return (
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--cream)' }}>This link no longer works</h1>
        <p className="mt-2 mb-6 text-sm" style={{ color: 'var(--cream-dim)' }}>
          {message ?? 'This confirmation link has expired, was cancelled, or has already been used. Request the change again from Settings.'}
        </p>
        <Link href="/settings" className="block w-full text-center py-2.5 px-4 text-sm font-semibold rounded-lg" style={btn}>Go to Settings</Link>
      </div>
    )
  }
  return (
    <div>
      <h1 className="text-2xl font-bold" style={{ color: 'var(--cream)' }}>Confirm your new email address</h1>
      <p className="mt-2 mb-6 text-sm" style={{ color: 'var(--cream-dim)' }}>Confirming switches a Byline account to sign in with this address. Nothing changes until you press the button.</p>
      {message && <p className="mb-4 text-sm px-3 py-2 rounded-lg" style={{ color: '#e05c5c', background: 'rgba(224,92,92,0.1)' }}>{message}</p>}
      <button onClick={confirm} disabled={state === 'working'} className="w-full py-2.5 px-4 text-sm font-semibold rounded-lg disabled:opacity-50" style={btn}>
        {state === 'working' ? 'Confirming…' : 'Confirm this address'}
      </button>
    </div>
  )
}

export default function ConfirmEmailChangePage() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--ink)' }}>
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <span style={{ fontFamily: 'var(--font-playfair, "Playfair Display", serif)', fontSize: '28px', fontWeight: 900, color: 'var(--cream)', letterSpacing: '-0.01em' }}>
            Byline<span style={{ color: 'var(--copper)' }}>.</span>
          </span>
        </div>
        <div className="rounded-2xl p-8" style={{ background: 'var(--ink-card)', border: '1px solid var(--border)' }}>
          <Suspense fallback={null}><Confirm /></Suspense>
        </div>
      </div>
    </div>
  )
}
