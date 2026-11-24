'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Ask for the sign-up confirmation email again. Shown when a confirmation link
 * failed or when someone tries to sign in before confirming. The answer is the
 * same whether or not the address has an unconfirmed account.
 */
export default function ResendConfirmation({ initialEmail = '' }: { initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function resend(e?: React.SyntheticEvent) {
    e?.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setLoading(false)
    if (error) {
      setError(/rate|seconds|too many/i.test(error.message) ? 'Please wait a minute before asking again.' : 'We could not send that just now. Try again in a minute.')
      return
    }
    setMessage('If that address has an account waiting to be confirmed, we have sent a new confirmation link. Use the newest email.')
  }

  return (
    <div className="mt-4 rounded-lg p-4" style={{ background: 'var(--ink-deep)', border: '1px solid var(--border)' }}>
      <p className="text-sm font-medium" style={{ color: 'var(--cream)' }}>Send the confirmation email again</p>
      {message ? (
        <p role="status" className="mt-2 text-sm" style={{ color: 'var(--cream-dim)' }}>{message}</p>
      ) : (
        <div className="mt-2 flex gap-2">
          <input
            type="email"
            aria-label="Email address to confirm"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') resend(e) }}
            placeholder="you@example.com"
            className="flex-1 min-w-0 px-3 py-2 rounded-lg text-sm focus:outline-none"
            style={{ background: 'var(--ink)', border: '1px solid var(--border)', color: 'var(--cream)' }}
          />
          <button
            type="button"
            onClick={resend}
            disabled={loading || !email.includes('@')}
            className="px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
            style={{ background: 'var(--copper)', color: 'var(--ink)' }}
          >
            {loading ? 'Sending…' : 'Resend'}
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-sm" style={{ color: '#e05c5c' }}>{error}</p>}
    </div>
  )
}
