'use client'

import { useEffect, useState } from 'react'
import { CreditCard, Loader2, CheckCircle2, AlertCircle, Settings } from 'lucide-react'

interface SubscriptionInfo {
  status: string | null
  plan_name: string | null
  current_period_end: string | null
}

export default function SettingsPage() {
  const [sub, setSub] = useState<SubscriptionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalError, setPortalError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/billing/subscription-info')
      .then((r) => r.json())
      .then((data) => { setSub(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function handleManageBilling() {
    setPortalLoading(true)
    setPortalError(null)
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to open billing portal')
      window.location.href = data.url
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : 'Something went wrong')
      setPortalLoading(false)
    }
  }

  const statusColors: Record<string, string> = {
    active: 'text-green-400 bg-green-900/30 border-green-700/40',
    trialing: 'text-amber-400 bg-amber-900/30 border-amber-700/40',
    past_due: 'text-red-400 bg-red-900/30 border-red-700/40',
    canceled: 'text-[#7A6555] bg-[#2A2420] border-[rgba(184,115,51,0.15)]',
    unpaid: 'text-red-400 bg-red-900/30 border-red-700/40',
  }

  const statusLabel: Record<string, string> = {
    active: 'Active',
    trialing: 'Trial',
    past_due: 'Past Due',
    canceled: 'Canceled',
    unpaid: 'Unpaid',
  }

  return (
    <div className="p-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 rounded-lg" style={{ background: 'rgba(184,115,51,0.1)' }}>
          <Settings className="w-5 h-5" style={{ color: '#B87333' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#F7F3EC' }}>Settings</h1>
          <p className="text-sm" style={{ color: '#7A6555' }}>Manage your account and billing</p>
        </div>
      </div>

      {/* Billing card */}
      <div
        className="rounded-2xl p-6"
        style={{ background: '#231F1B', border: '1px solid rgba(184,115,51,0.18)' }}
      >
        <div className="flex items-center gap-2 mb-5">
          <CreditCard className="w-4 h-4" style={{ color: '#B87333' }} />
          <h2 className="text-base font-semibold" style={{ color: '#F7F3EC' }}>Billing &amp; Subscription</h2>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-4" style={{ color: '#7A6555' }}>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading subscription info…</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Plan row */}
            <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid rgba(184,115,51,0.1)' }}>
              <span className="text-sm" style={{ color: '#A89070' }}>Current plan</span>
              <span className="text-sm font-semibold" style={{ color: '#F7F3EC' }}>
                {sub?.plan_name ?? 'Free'}
              </span>
            </div>

            {/* Status row */}
            <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid rgba(184,115,51,0.1)' }}>
              <span className="text-sm" style={{ color: '#A89070' }}>Status</span>
              {sub?.status ? (
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${statusColors[sub.status] ?? 'text-[#A89070] bg-[#2A2420] border-[rgba(184,115,51,0.15)]'}`}>
                  {sub.status === 'active' || sub.status === 'trialing'
                    ? <CheckCircle2 className="w-3 h-3" />
                    : <AlertCircle className="w-3 h-3" />}
                  {statusLabel[sub.status] ?? sub.status}
                </span>
              ) : (
                <span className="text-sm" style={{ color: '#7A6555' }}>No active subscription</span>
              )}
            </div>

            {/* Renewal row */}
            {sub?.current_period_end && (
              <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid rgba(184,115,51,0.1)' }}>
                <span className="text-sm" style={{ color: '#A89070' }}>
                  {sub.status === 'canceled' ? 'Access until' : 'Next renewal'}
                </span>
                <span className="text-sm" style={{ color: '#F7F3EC' }}>
                  {new Date(sub.current_period_end).toLocaleDateString('en-US', {
                    month: 'long', day: 'numeric', year: 'numeric'
                  })}
                </span>
              </div>
            )}

            {/* CTA */}
            <div className="pt-2">
              {portalError && (
                <div className="flex items-center gap-2 mb-3 text-xs text-red-400">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {portalError}
                </div>
              )}
              <button
                onClick={handleManageBilling}
                disabled={portalLoading || !sub?.status}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                style={{ background: '#B87333', color: '#F7F3EC' }}
                onMouseEnter={(e) => { if (!portalLoading && sub?.status) (e.currentTarget as HTMLButtonElement).style.background = '#A0622A' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#B87333' }}
              >
                {portalLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Opening portal…</>
                ) : (
                  <><CreditCard className="w-4 h-4" /> Manage Subscription</>
                )}
              </button>
              {!sub?.status && !loading && (
                <p className="mt-2 text-xs" style={{ color: '#7A6555' }}>
                  No billing account found. <a href="/pricing" style={{ color: '#B87333' }} className="hover:underline">View plans →</a>
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
