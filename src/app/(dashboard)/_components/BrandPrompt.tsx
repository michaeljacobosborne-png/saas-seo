'use client'

/**
 * The brand profile is optional context, not a gate (2026-11-22). Tracking a page
 * and running an audit need no brand. These prompts say where a profile earns its
 * keep and link to the form: a dismissible card on the dashboard, a plain notice
 * where the article generator cannot work without one, and a note on a tracked
 * page where the engine's reading of the site's name looks uncertain.
 */
import Link from 'next/link'
import { useState, useSyncExternalStore } from 'react'
import { X } from 'lucide-react'

const DISMISS_KEY = 'byline.brandPrompt.dashboard.dismissed'

const card = { background: 'var(--ink-card)', border: '1px solid rgba(184,115,51,0.3)' }
const cta = { background: 'var(--copper)', color: '#fff' }

const subscribe = (notify: () => void) => {
  window.addEventListener('storage', notify)
  window.addEventListener('byline-brand-prompt', notify)
  return () => {
    window.removeEventListener('storage', notify)
    window.removeEventListener('byline-brand-prompt', notify)
  }
}
const readDismissed = () => {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export function DashboardBrandPrompt() {
  // Server render and first paint treat the card as dismissed, so a dismissed card never flashes.
  const stored = useSyncExternalStore(subscribe, readDismissed, () => true)
  const [dismissedNow, setDismissedNow] = useState(false)
  if (stored || dismissedNow) return null

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, '1')
      window.dispatchEvent(new Event('byline-brand-prompt'))
    } catch {
      /* storage unavailable: it only stays hidden for this visit */
    }
    setDismissedNow(true)
  }

  return (
    <div className="relative rounded-xl p-5 mb-6" style={card} role="region" aria-label="Brand profile">
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="absolute right-3 top-3" style={{ color: 'var(--cream-faint)' }}>
        <X className="h-4 w-4" />
      </button>
      <h2 className="text-sm font-semibold" style={{ color: 'var(--cream)' }}>Add your brand name (optional)</h2>
      <p className="mt-1 text-sm leading-relaxed max-w-2xl" style={{ color: 'var(--cream-dim)' }}>
        A brand profile lets the article generator write in your voice. You can track pages and run audits without one.
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <Link href="/brand" className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold" style={cta}>Add brand name</Link>
        <button type="button" onClick={dismiss} className="text-sm underline" style={{ color: 'var(--cream-faint)' }}>Not now</button>
      </div>
    </div>
  )
}

/** Where the article generator cannot work without a profile: say so, and link to it. */
export function ArticlesBrandNotice() {
  return (
    <div className="rounded-xl p-5" style={card} role="region" aria-label="Brand profile needed">
      <h2 className="text-sm font-semibold" style={{ color: 'var(--cream)' }}>The article generator needs a brand profile</h2>
      <p className="mt-1 text-sm leading-relaxed max-w-2xl" style={{ color: 'var(--cream-dim)' }}>
        It writes in your brand&apos;s voice, so it cannot start without knowing the brand: a name, who it is for and how it sounds. It takes about two minutes. Tracking pages and running audits do not need it.
      </p>
      <Link href="/brand" className="mt-3 inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold" style={cta}>Set up your brand profile</Link>
    </div>
  )
}

/** On a tracked page where the engine could not tie the site's name to its domain. */
export function TrackedBrandNote({ counted, hasProfile }: { counted: string[]; hasProfile: boolean }) {
  return (
    <div className="mb-6 rounded-xl p-4 text-sm leading-relaxed" style={card} role="note">
      <strong className="block mb-1" style={{ color: 'var(--cream)' }}>Check how Byline read this site&apos;s name</strong>
      <span style={{ color: 'var(--cream-dim)' }}>
        {counted.length
          ? `Brand-claim proximity looked for ${counted.map((n) => `“${n}”`).join(' or ')}. Neither obviously relates to the domain, so it may not be what you call yourselves. The report lists every name it counted.`
          : 'Byline could not read a name for this site, so Brand-claim proximity could not be checked against one.'}
      </span>
      {!hasProfile && (
        <span className="block mt-2">
          <Link href="/brand" className="underline" style={{ color: 'var(--copper-lt)' }}>Add your brand name</Link>
          <span style={{ color: 'var(--cream-faint)' }}> (optional)</span>
        </span>
      )}
    </div>
  )
}
