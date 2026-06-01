import Link from 'next/link'
import { CheckCircle } from 'lucide-react'

export default function WelcomePage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-6">
          <CheckCircle className="w-16 h-16" style={{ color: '#B87333' }} />
        </div>
        <h1
          className="text-3xl font-bold mb-3"
          style={{
            fontFamily: 'var(--font-playfair, "Playfair Display", serif)',
            color: '#F7F3EC',
          }}
        >
          You&apos;re in.
        </h1>
        <p className="text-base mb-8" style={{ color: '#A89070' }}>
          Your Byline subscription is active. Time to start ranking.
        </p>
        <Link
          href="/brand"
          className="inline-block px-8 py-3 rounded-lg text-sm font-semibold transition-colors"
          style={{ background: '#B87333', color: '#1C1917' }}
        >
          Set up your brand →
        </Link>
        <p className="mt-4 text-xs" style={{ color: '#7A6555' }}>
          Or{' '}
          <Link href="/dashboard" style={{ color: '#A89070' }} className="underline underline-offset-2">
            go to your dashboard
          </Link>
        </p>
      </div>
    </div>
  )
}
