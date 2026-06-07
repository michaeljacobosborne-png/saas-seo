'use client'

import { useState } from 'react'
import { CreditCard, Loader2, AlertCircle } from 'lucide-react'

export default function ManageBillingButton({ hasBilling }: { hasBilling: boolean }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function openPortal() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? 'Failed to open billing portal')
      }
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  if (!hasBilling) {
    return (
      <p className="text-xs" style={{ color: '#7A6555' }}>
        No billing account yet.{' '}
        <a href="/pricing" style={{ color: '#B87333' }} className="hover:underline">
          View plans →
        </a>
      </p>
    )
  }

  return (
    <div>
      {error && (
        <div className="flex items-center gap-2 mb-3 text-xs text-red-400">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}
      <button
        onClick={openPortal}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        style={{ background: '#B87333', color: '#F7F3EC' }}
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Opening portal…</>
        ) : (
          <><CreditCard className="w-4 h-4" /> Manage Subscription</>
        )}
      </button>
    </div>
  )
}
