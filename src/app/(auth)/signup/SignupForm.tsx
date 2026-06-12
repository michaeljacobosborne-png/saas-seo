'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { analytics } from '@/lib/analytics'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12Z"/>
    </svg>
  )
}

export default function SignupForm({
  plan,
  interval,
  auditKeyword,
  auditTopic,
}: {
  plan?: string
  interval?: string
  auditKeyword?: string
  auditTopic?: string
}) {
  const isFree = plan === 'free'

  // Build the post-confirmation callback URL. For a paid signup we carry the
  // chosen plan/interval through email confirmation / OAuth so /auth/callback
  // can drop the user straight into Stripe checkout (no second click). Free
  // signups (or plain signups) just hit the bare callback.
  function callbackUrl(): string {
    const base = `${window.location.origin}/auth/callback`
    if (!plan || isFree) return base
    const params = new URLSearchParams({ plan })
    if (interval) params.set('interval', interval)
    return `${base}?${params.toString()}`
  }

  // Lead magnet bridge: the audit funnel sends the user here with the #1 gap
  // keyword in the query string. Email confirmation drops query params, so stash
  // it in localStorage; the dashboard picks it up to pre-fill the first article.
  // See TODO in src/app/(dashboard)/articles/new/page.tsx.
  useEffect(() => {
    if (!auditKeyword) return
    try {
      localStorage.setItem(
        'byline_audit_intent',
        JSON.stringify({ keyword: auditKeyword, topic: auditTopic ?? '' })
      )
    } catch {
      /* localStorage unavailable (private mode) — non-fatal */
    }
  }, [auditKeyword, auditTopic])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<'google' | 'github' | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)

    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: callbackUrl() },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // Signup succeeded — fire GA4 `sign_up` + Meta `Lead`.
    analytics.signUp(data.user?.id ?? '')

    if (isFree) {
      setMessage('Account created! Check your email to confirm, then sign in to access your free plan.')
    } else {
      setMessage('Check your email for a confirmation link.')
    }
    setLoading(false)
  }

  async function handleOAuth(provider: 'google' | 'github') {
    setError(null)
    setOauthLoading(provider)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: callbackUrl() },
    })
    if (error) {
      setError(error.message)
      setOauthLoading(null)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#1C1917' }}>
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <span style={{ fontFamily: 'var(--font-playfair, "Playfair Display", serif)', fontSize: '28px', fontWeight: 900, color: '#F7F3EC', letterSpacing: '-0.01em' }}>
            Byline<span style={{ color: '#B87333' }}>.</span>
          </span>
        </div>
        <div className="rounded-2xl p-8" style={{ background: '#231F1B', border: '1px solid rgba(184,115,51,0.25)' }}>
          <div className="mb-8">
            <h1 className="text-2xl font-bold" style={{ color: '#F7F3EC' }}>Create your account</h1>
            {isFree ? (
              <div className="mt-2">
                <p className="text-sm" style={{ color: '#A89070' }}>Start with a free article. No credit card needed.</p>
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1" style={{ background: 'rgba(184,115,51,0.12)', border: '1px solid rgba(184,115,51,0.3)' }}>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: '#B87333' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-xs font-semibold" style={{ color: '#D4954A' }}>No credit card required</span>
                </div>
              </div>
            ) : (
              <p className="mt-1 text-sm" style={{ color: '#A89070' }}>Start building your SEO content engine</p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1" style={{ color: '#A89070' }}>
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none"
                style={{ background: '#1C1917', border: '1px solid rgba(184,115,51,0.3)', color: '#F7F3EC' }}
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1" style={{ color: '#A89070' }}>
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none"
                style={{ background: '#1C1917', border: '1px solid rgba(184,115,51,0.3)', color: '#F7F3EC' }}
                placeholder="Min. 6 characters"
              />
            </div>

            {error && (
              <p className="text-sm px-3 py-2 rounded-lg" style={{ color: '#e05c5c', background: 'rgba(224,92,92,0.1)' }}>{error}</p>
            )}
            {message && (
              <p className="text-sm px-3 py-2 rounded-lg" style={{ color: '#B87333', background: 'rgba(184,115,51,0.1)' }}>{message}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 text-sm font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{ background: '#B87333', color: '#1C1917', letterSpacing: '0.04em', textTransform: 'uppercase' }}
            >
              {loading ? 'Creating account…' : isFree ? 'Create free account' : 'Create account'}
            </button>
          </form>

          <div className="mt-6 flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: 'rgba(184,115,51,0.18)' }} />
            <span className="text-xs font-medium" style={{ color: '#A89070' }}>or continue with</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(184,115,51,0.18)' }} />
          </div>

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => handleOAuth('google')}
              disabled={oauthLoading !== null}
              className="flex-1 flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: '#1C1917', color: '#F7F3EC', border: '1px solid rgba(184,115,51,0.3)' }}
            >
              <GoogleIcon />
              {oauthLoading === 'google' ? 'Redirecting…' : 'Google'}
            </button>
            <button
              type="button"
              onClick={() => handleOAuth('github')}
              disabled={oauthLoading !== null}
              className="flex-1 flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: '#1C1917', color: '#F7F3EC', border: '1px solid rgba(184,115,51,0.3)' }}
            >
              <GitHubIcon />
              {oauthLoading === 'github' ? 'Redirecting…' : 'GitHub'}
            </button>
          </div>

          {isFree && (
            <p className="mt-4 text-center text-xs" style={{ color: '#A89070' }}>
              Free plan includes 1 article and 3 AI review turns. Upgrade anytime.
            </p>
          )}

          <p className="mt-4 text-center text-sm" style={{ color: '#A89070' }}>
            Already have an account?{' '}
            <Link href="/login" className="font-medium" style={{ color: '#B87333' }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
