'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { MIN_PASSWORD_LENGTH } from '@/lib/password-reset'

function ResetForm() {
  const router = useRouter()
  const params = useSearchParams()
  const tokenHash = params.get('token_hash')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [expired, setExpired] = useState(!tokenHash)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError('The two passwords do not match.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token_hash: tokenHash, password }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; code?: string; message?: string }
      if (res.ok && data.ok) {
        router.push('/dashboard')
        router.refresh()
        return
      }
      if (data.code === 'expired') setExpired(true)
      else setError(data.message ?? 'Something went wrong. Try again.')
    } catch {
      setError('Something went wrong. Try again.')
    }
    setLoading(false)
  }

  const input = { background: 'var(--ink-deep)', border: '1px solid var(--border)', color: 'var(--cream)' }

  if (expired) {
    return (
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--cream)' }}>This link no longer works</h1>
        <p className="mt-2 mb-6 text-sm" style={{ color: 'var(--cream-dim)' }}>
          This reset link has expired or has already been used. Reset links work once and last one hour. If you asked for more than one, only the newest works.
        </p>
        <Link
          href="/forgot-password"
          className="block w-full text-center py-2.5 px-4 text-sm font-semibold rounded-lg"
          style={{ background: 'var(--copper)', color: 'var(--ink)', letterSpacing: '0.04em', textTransform: 'uppercase' }}
        >
          Request a new link
        </Link>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold" style={{ color: 'var(--cream)' }}>Choose a new password</h1>
      <p className="mt-1 mb-6 text-sm" style={{ color: 'var(--cream-dim)' }}>At least {MIN_PASSWORD_LENGTH} characters. You will be signed in once it is saved.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1" style={{ color: 'var(--cream-dim)' }}>New password</label>
          <input id="password" type="password" required minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none" style={input} />
        </div>
        <div>
          <label htmlFor="confirm" className="block text-sm font-medium mb-1" style={{ color: 'var(--cream-dim)' }}>Confirm new password</label>
          <input id="confirm" type="password" required minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none" style={input} />
        </div>
        {error && <p className="text-sm px-3 py-2 rounded-lg" style={{ color: '#e05c5c', background: 'rgba(224,92,92,0.1)' }}>{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 text-sm font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: 'var(--copper)', color: 'var(--ink)', letterSpacing: '0.04em', textTransform: 'uppercase' }}
        >
          {loading ? 'Saving…' : 'Save new password'}
        </button>
      </form>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--ink)' }}>
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <span style={{ fontFamily: 'var(--font-playfair, "Playfair Display", serif)', fontSize: '28px', fontWeight: 900, color: 'var(--cream)', letterSpacing: '-0.01em' }}>
            Byline<span style={{ color: 'var(--copper)' }}>.</span>
          </span>
        </div>
        <div className="rounded-2xl p-8" style={{ background: 'var(--ink-card)', border: '1px solid var(--border)' }}>
          <Suspense fallback={null}>
            <ResetForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
