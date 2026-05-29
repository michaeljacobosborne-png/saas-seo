'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, FileText, Sparkles } from 'lucide-react'

const FEATURES = [
  {
    icon: Search,
    title: 'Research Keywords',
    description: 'Discover high-value keywords with our AI-powered discovery agent.',
  },
  {
    icon: FileText,
    title: 'Generate Articles',
    description: 'Create SEO-optimized content that ranks and reads like a human wrote it.',
  },
  {
    icon: Sparkles,
    title: 'Optimize with the Agent',
    description: 'Get specific editorial feedback and apply fixes directly to your article.',
  },
]

type PollStatus = 'polling' | 'active' | 'timeout'

export default function WelcomePage() {
  const router = useRouter()
  const [status, setStatus] = useState<PollStatus>('polling')

  useEffect(() => {
    let cancelled = false
    let attempts = 0
    const maxAttempts = 20

    async function poll() {
      if (cancelled) return
      try {
        const res = await fetch('/api/billing/subscription-status')
        const json = await res.json() as { active: boolean }
        if (json.active) { setStatus('active'); return }
      } catch { /* network blip — keep polling */ }

      attempts++
      if (attempts >= maxAttempts) { setStatus('timeout'); return }
      setTimeout(poll, 500)
    }

    void poll()
    return () => { cancelled = true }
  }, [])

  return (
    <>
      <style>{`
        @keyframes checkDraw {
          from { stroke-dashoffset: 50; opacity: 0; }
          to   { stroke-dashoffset: 0;  opacity: 1; }
        }
        @keyframes circlePop {
          0%   { transform: scale(0.6); opacity: 0; }
          70%  { transform: scale(1.1); }
          100% { transform: scale(1);   opacity: 1; }
        }
        .check-circle { animation: circlePop 0.45s cubic-bezier(.36,.07,.19,.97) forwards; }
        .check-path   { stroke-dasharray: 50; animation: checkDraw 0.4s 0.3s ease forwards; opacity: 0; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fadeUp 0.5s ease forwards; }
        .fade-up-1 { animation: fadeUp 0.5s 0.05s ease forwards; opacity: 0; }
        .fade-up-2 { animation: fadeUp 0.5s 0.1s ease forwards; opacity: 0; }
        .fade-up-3 { animation: fadeUp 0.5s 0.2s ease forwards; opacity: 0; }
        .fade-up-4 { animation: fadeUp 0.5s 0.35s ease forwards; opacity: 0; }
        @keyframes dotPulse {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40%            { transform: scale(1);   opacity: 1; }
        }
        .dot-1 { animation: dotPulse 1.2s 0s   infinite; }
        .dot-2 { animation: dotPulse 1.2s 0.2s infinite; }
        .dot-3 { animation: dotPulse 1.2s 0.4s infinite; }
      `}</style>

      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
        {/* Wordmark */}
        <div className="mb-10 fade-up">
          <span className="text-3xl font-extrabold text-indigo-600 tracking-tight">Byline</span>
        </div>

        {/* Animated checkmark */}
        <div className="mb-8">
          <div className="check-circle w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="#22c55e"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-9 h-9"
            >
              <path className="check-path" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        {/* Headline */}
        <h1 className="fade-up-1 text-3xl font-bold text-gray-900 mb-3 text-center">
          You&apos;re all set.
        </h1>
        <p className="fade-up-2 text-base text-gray-500 text-center max-w-sm mb-10">
          Your account is being activated — this takes just a moment.
        </p>

        {/* Polling dots */}
        {status === 'polling' && (
          <div className="flex items-center gap-2 mb-10">
            <span className="dot-1 inline-block w-2.5 h-2.5 bg-indigo-400 rounded-full" />
            <span className="dot-2 inline-block w-2.5 h-2.5 bg-indigo-400 rounded-full" />
            <span className="dot-3 inline-block w-2.5 h-2.5 bg-indigo-400 rounded-full" />
          </div>
        )}

        {/* Active: feature cards + CTA */}
        {status === 'active' && (
          <div className="flex flex-col items-center w-full max-w-2xl">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full mb-8">
              {FEATURES.map(({ icon: Icon, title, description }, i) => (
                <div
                  key={title}
                  className={`bg-gray-50 border border-gray-200 rounded-2xl p-5 fade-up-${i + 2 as 2 | 3 | 4}`}
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <div className="inline-flex p-2.5 bg-indigo-50 rounded-xl mb-3">
                    <Icon className="w-5 h-5 text-indigo-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm mb-1">{title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
                </div>
              ))}
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="fade-up-4 px-8 py-3 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 active:scale-95 transition-all"
            >
              Go to Dashboard →
            </button>
          </div>
        )}

        {/* Timeout */}
        {status === 'timeout' && (
          <p className="text-sm text-gray-500 text-center">
            Taking longer than expected —{' '}
            <Link href="/dashboard" className="text-indigo-600 hover:text-indigo-700 underline underline-offset-2">
              go to dashboard
            </Link>{' '}
            or{' '}
            <a
              href="mailto:support@byline.so"
              className="text-indigo-600 hover:text-indigo-700 underline underline-offset-2"
            >
              contact support
            </a>
          </p>
        )}
      </div>
    </>
  )
}
