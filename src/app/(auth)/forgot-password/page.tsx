'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (res.ok && data.ok) setMessage(data.message ?? null)
      else setError(data.message ?? 'Something went wrong. Try again in a moment.')
    } catch {
      setError('Something went wrong. Try again in a moment.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--ink)' }}>
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <span style={{ fontFamily: 'var(--font-playfair, "Playfair Display", serif)', fontSize: '28px', fontWeight: 900, color: 'var(--cream)', letterSpacing: '-0.01em' }}>
            Byline<span style={{ color: 'var(--copper)' }}>.</span>
          </span>
        </div>
        <div className="rounded-2xl p-8" style={{ background: 'var(--ink-card)', border: '1px solid var(--border)' }}>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--cream)' }}>Reset your password</h1>
          <p className="mt-1 mb-6 text-sm" style={{ color: 'var(--cream-dim)' }}>
            Enter the email address you signed up with and we will send you a link to choose a new password.
          </p>

          {message ? (
            <p role="status" className="text-sm px-3 py-3 rounded-lg" style={{ color: 'var(--cream)', background: 'rgba(184,115,51,0.12)' }}>
              {message} Check your spam folder if it does not arrive within a few minutes.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-1" style={{ color: 'var(--cream-dim)' }}>Email</label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none"
                  style={{ background: 'var(--ink-deep)', border: '1px solid var(--border)', color: 'var(--cream)' }}
                  placeholder="you@example.com"
                />
              </div>
              {error && <p className="text-sm px-3 py-2 rounded-lg" style={{ color: '#e05c5c', background: 'rgba(224,92,92,0.1)' }}>{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 text-sm font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'var(--copper)', color: 'var(--ink)', letterSpacing: '0.04em', textTransform: 'uppercase' }}
              >
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm" style={{ color: 'var(--cream-dim)' }}>
            <Link href="/login" className="font-medium" style={{ color: 'var(--copper)' }}>Back to sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
