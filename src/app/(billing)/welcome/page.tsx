'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const MAX_ATTEMPTS = 20 // 20 × 500ms = 10 seconds

export default function WelcomePage() {
  const router = useRouter()
  const [attempt, setAttempt] = useState(0)
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    if (attempt >= MAX_ATTEMPTS) {
      setTimedOut(true)
      return
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/billing/subscription-status')
        const data = await res.json() as { active: boolean }
        if (data.active) {
          router.push('/dashboard')
        } else {
          setAttempt(a => a + 1)
        }
      } catch {
        setAttempt(a => a + 1)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [attempt, router])

  if (timedOut) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4 text-center">
        <p style={{ color: 'rgba(247,243,236,0.7)' }} className="text-sm">
          This is taking longer than expected.{' '}
          <a href="/dashboard" style={{ color: '#F7F3EC' }} className="underline">
            Go to dashboard
          </a>{' '}
          or{' '}
          <a href="/pricing" style={{ color: '#F7F3EC' }} className="underline">
            return to pricing
          </a>
          .
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div
        className="w-8 h-8 rounded-full border-4 animate-spin"
        style={{ borderColor: 'rgba(247,243,236,0.2)', borderTopColor: '#F7F3EC' }}
      />
      <p style={{ color: 'rgba(247,243,236,0.7)' }} className="text-sm">
        Setting up your account&hellip;
      </p>
    </div>
  )
}
