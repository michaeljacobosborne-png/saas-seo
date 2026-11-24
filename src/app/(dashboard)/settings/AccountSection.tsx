'use client'

import { useState } from 'react'
import { MIN_PASSWORD_LENGTH } from '@/lib/password-reset'

type Result = { ok: boolean; message: string } | null

const field = { background: 'var(--ink-deep)', border: '1px solid rgba(184,115,51,0.18)', color: '#F7F3EC' }
const label = { color: 'var(--cream-dim)' }
const primary = { background: '#B87333', color: 'var(--ink)' }

async function post(path: string, body: unknown): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
    return { ok: !!(res.ok && data.ok), message: data.message ?? (res.ok ? 'Done.' : 'Something went wrong. Try again.') }
  } catch {
    return { ok: false, message: 'Something went wrong. Try again.' }
  }
}

function Notice({ result }: { result: Result }) {
  if (!result) return null
  return (
    <p role={result.ok ? 'status' : 'alert'} className="text-sm px-3 py-2 rounded-lg" style={result.ok ? { color: '#F7F3EC', background: 'rgba(184,115,51,0.12)' } : { color: '#e05c5c', background: 'rgba(224,92,92,0.1)' }}>
      {result.message}
    </p>
  )
}

function ChangePassword() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [result, setResult] = useState<Result>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (next !== confirm) { setResult({ ok: false, message: 'The two new passwords do not match.' }); return }
    setBusy(true)
    const r = await post('/api/account/change-password', { current_password: current, new_password: next })
    setBusy(false)
    if (r.ok) { setCurrent(''); setNext(''); setConfirm(''); setResult({ ok: true, message: 'Password changed. Every other signed-in session was ended, and we have emailed your address to say so.' }) }
    else setResult(r)
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <h3 className="text-sm font-semibold" style={{ color: '#F7F3EC' }}>Change password</h3>
      <div>
        <label htmlFor="cp-current" className="block text-xs mb-1" style={label}>Current password</label>
        <input id="cp-current" type="password" required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none" style={field} />
      </div>
      <div>
        <label htmlFor="cp-new" className="block text-xs mb-1" style={label}>New password (at least {MIN_PASSWORD_LENGTH} characters)</label>
        <input id="cp-new" type="password" required minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none" style={field} />
      </div>
      <div>
        <label htmlFor="cp-confirm" className="block text-xs mb-1" style={label}>Confirm new password</label>
        <input id="cp-confirm" type="password" required minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none" style={field} />
      </div>
      <Notice result={result} />
      <button type="submit" disabled={busy} className="px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-50" style={primary}>{busy ? 'Saving…' : 'Change password'}</button>
    </form>
  )
}

function ChangeEmail({ currentEmail }: { currentEmail: string }) {
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [result, setResult] = useState<Result>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const r = await post('/api/account/change-email', { current_password: password, new_email: email })
    setBusy(false)
    if (r.ok) { setPassword(''); setEmail('') }
    setResult(r)
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <h3 className="text-sm font-semibold" style={{ color: '#F7F3EC' }}>Change email</h3>
      <p className="text-xs" style={label}>Your email is <span style={{ color: '#F7F3EC' }}>{currentEmail}</span>. We send a link to the new address, and nothing changes until you use it. Your current address is told about the request.</p>
      <div>
        <label htmlFor="ce-email" className="block text-xs mb-1" style={label}>New email address</label>
        <input id="ce-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none" style={field} />
      </div>
      <div>
        <label htmlFor="ce-password" className="block text-xs mb-1" style={label}>Current password</label>
        <input id="ce-password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none" style={field} />
      </div>
      <Notice result={result} />
      <button type="submit" disabled={busy} className="px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-50" style={primary}>{busy ? 'Sending…' : 'Send confirmation link'}</button>
    </form>
  )
}

export default function AccountSection({ email, hasPassword }: { email: string; hasPassword: boolean }) {
  return (
    <div className="rounded-2xl p-6 mb-6" style={{ background: 'var(--ink-card)', border: '1px solid rgba(184,115,51,0.18)' }}>
      <h2 className="text-base font-semibold mb-5" style={{ color: '#F7F3EC' }}>Account</h2>
      {hasPassword ? (
        <div className="space-y-8">
          <ChangePassword />
          <div style={{ borderTop: '1px solid rgba(184,115,51,0.1)' }} />
          <ChangeEmail currentEmail={email} />
        </div>
      ) : (
        <p className="text-sm" style={label}>
          You sign in with Google or GitHub, so your email and sign-in belong to that account and there is no password to change here. To set a password for this account, use &ldquo;Forgot your password?&rdquo; on the sign-in page.
        </p>
      )}
    </div>
  )
}
