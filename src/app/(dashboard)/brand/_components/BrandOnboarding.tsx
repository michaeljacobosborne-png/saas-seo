'use client'

import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, CheckCircle2, CircleHelp, Globe, Loader2, ShieldAlert, Sparkles, XCircle } from 'lucide-react'
import type { AccessRow, DerivedField, DerivedProfile, OnboardingAccess } from '@/lib/brand-derive'

type Form = {
  brand_name: string
  website_url: string
  target_audience: string
  industry: string
  tone_notes: string
  content_goals: string
  primary_keywords: string
  competitors: string
  avoid_topics: string
  author_name: string
  author_credentials: string
  author_url: string
}

const EMPTY: Form = {
  brand_name: '', website_url: '', target_audience: '', industry: '', tone_notes: '',
  content_goals: '', primary_keywords: '', competitors: '', avoid_topics: '',
  author_name: '', author_credentials: '', author_url: '',
}

const REQUIRED: (keyof Form)[] = ['brand_name', 'website_url', 'target_audience']

const SOURCE_LABEL: Record<DerivedField['source'], string> = {
  'json-ld': "Read from your site's structured data",
  'og:site_name': "Read from your site's social sharing tags",
  title: "Read from your homepage's title",
  'meta-description': "Read from your homepage's description",
  'meta-author': "Read from your homepage's author tag",
  url: 'The address you entered',
  'page-text': 'Read from your homepage',
  model: 'Suggested from your homepage — check it',
}

function list(s: string): string[] {
  return s.split(',').map((x) => x.trim()).filter(Boolean)
}

const inputCls =
  'w-full px-3 py-2.5 border border-[rgba(184,115,51,0.25)] rounded-lg text-sm bg-[var(--ink)] text-[var(--cream)] placeholder:text-[var(--cream-faint)] focus:outline-none focus:ring-2 focus:ring-[#B87333] focus:border-transparent'

export default function BrandOnboarding({ onStartChat }: { onStartChat: () => void }) {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [phase, setPhase] = useState<'url' | 'scanning' | 'review'>('url')
  const [access, setAccess] = useState<OnboardingAccess | null>(null)
  const [accessDone, setAccessDone] = useState(false)
  const [derived, setDerived] = useState<DerivedProfile | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [form, setForm] = useState<Form>(EMPTY)
  // A ref, not state: the scan's stream callback must see edits made mid-scan.
  const touched = useRef<Set<keyof Form>>(new Set())
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [authorNotice, setAuthorNotice] = useState(false)

  // Fill untouched fields as values arrive, never overwriting what the user typed.
  function applyDerived(p: DerivedProfile) {
    setDerived(p)
    setForm((f) => {
      const next = { ...f }
      const put = (k: keyof Form, v: string | undefined | null) => {
        if (v && !touched.current.has(k)) next[k] = v
      }
      put('website_url', p.website_url?.value)
      put('brand_name', p.brand_name?.value)
      put('target_audience', p.target_audience?.value)
      put('industry', p.industry?.value)
      put('tone_notes', p.tone_notes?.value)
      put('content_goals', p.content_goals?.value)
      put('primary_keywords', p.primary_keywords?.value.join(', '))
      put('author_name', p.author_name?.value)
      return next
    })
  }

  async function scan(e: FormEvent) {
    e.preventDefault()
    if (!url.trim()) return
    setPhase('scanning')
    setAccess(null)
    setAccessDone(false)
    setDerived(null)
    setScanError(null)
    setForm({ ...EMPTY, website_url: url.trim() })
    touched.current = new Set()

    try {
      const res = await fetch('/api/brand/derive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Could not scan that site.')
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        let nl: number
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim()
          buf = buf.slice(nl + 1)
          if (!line) continue
          const ev = JSON.parse(line)
          if (ev.type === 'access') {
            setAccess(ev.access)
            setAccessDone(true)
          } else if (ev.type === 'profile') {
            applyDerived(ev.profile)
            if (ev.final) setPhase('review')
          } else if (ev.type === 'error') {
            setScanError(ev.error)
          } else if (ev.type === 'done') {
            setAccessDone(true)
            setPhase('review')
          }
        }
      }
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Could not scan that site.')
      setAccessDone(true)
    }
    setPhase('review')
  }

  function set(k: keyof Form) {
    return (e: { target: { value: string } }) => {
      setForm((f) => ({ ...f, [k]: e.target.value }))
      touched.current.add(k)
    }
  }

  const missing = REQUIRED.filter((k) => !form[k].trim())

  async function save() {
    if (missing.length) return
    setSaving(true)
    setSaveError(null)
    try {
      const website = /^https?:\/\//i.test(form.website_url.trim()) ? form.website_url.trim() : `https://${form.website_url.trim()}`
      const res = await fetch('/api/brand/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_name: form.brand_name,
          website_url: website,
          target_audience: form.target_audience,
          industry: form.industry,
          tone_notes: form.tone_notes,
          content_goals: form.content_goals,
          avoid_topics: form.avoid_topics,
          primary_keywords: list(form.primary_keywords),
          competitors: list(form.competitors),
          // Author fields only when given, so a profile without them never
          // touches columns that may not exist yet.
          ...(form.author_name.trim()
            ? { author_name: form.author_name, author_credentials: form.author_credentials, author_url: form.author_url }
            : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Save failed')
      if (form.author_name.trim() && data.authorSaved === false) {
        // Profile saved; the author could not be stored yet. Say so rather than drop it silently.
        setAuthorNotice(true)
        setSaving(false)
        return
      }
      router.push('/dashboard')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed')
      setSaving(false)
    }
  }

  // ── Step 1: the only question ───────────────────────────────────────────────
  if (phase === 'url') {
    return (
      <div className="p-8 max-w-xl mx-auto">
        <h1 className="text-2xl font-bold text-[var(--cream)]">Set up your brand</h1>
        <p className="mt-1 text-sm text-[var(--cream-dim)]">
          Enter your website. We&apos;ll read it and fill in your profile, so you only correct what we got wrong.
        </p>
        <form onSubmit={scan} className="mt-6 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--copper-lt)]" />
            <input
              type="text"
              inputMode="url"
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="yourcompany.com"
              className="w-full pl-10 pr-4 py-3.5 text-base border-2 border-[rgba(184,115,51,0.35)] rounded-xl bg-[var(--ink)] text-[var(--cream)] placeholder:text-[var(--cream-faint)] focus:outline-none focus:ring-2 focus:ring-[#B87333] focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={!url.trim()}
            className="flex items-center justify-center gap-2 px-5 py-3.5 bg-[#B87333] text-white text-sm font-medium rounded-xl hover:bg-[#A0622A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Scan my site
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
        <button
          onClick={onStartChat}
          className="mt-5 flex items-center gap-1.5 text-xs text-[var(--cream-faint)] hover:text-[var(--copper-lt)] transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" />
          No website yet? Set up by chatting with the agent instead
        </button>
      </div>
    )
  }

  // ── Step 2: show what we found, then ask only for corrections ───────────────
  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--cream)]">Set up your brand</h1>
        <p className="mt-1 text-sm text-[var(--cream-dim)]">
          {url.replace(/^https?:\/\//i, '')} ·{' '}
          <button onClick={() => setPhase('url')} className="underline underline-offset-2 hover:text-[var(--copper-lt)]">
            change
          </button>
        </p>
      </div>

      <AccessCard access={access} done={accessDone} />

      <section className="rounded-xl border border-[rgba(184,115,51,0.2)] bg-[var(--ink)] p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-[var(--cream)]">Your profile</h2>
          <p className="mt-0.5 text-sm text-[var(--cream-dim)]">
            {phase === 'scanning'
              ? 'Reading your site…'
              : scanError
                ? scanError
                : 'We filled this in from your site. Fix anything that is off.'}
          </p>
        </div>

        <Field label="Brand name" required derived={derived?.brand_name}>
          <input value={form.brand_name} onChange={set('brand_name')} placeholder="Acme" className={inputCls} />
        </Field>
        <Field label="Website" required derived={derived?.website_url}>
          <input value={form.website_url} onChange={set('website_url')} placeholder="https://acme.com" className={inputCls} />
        </Field>
        <Field label="Who you write for" required derived={derived?.target_audience} hint="One or two sentences.">
          <textarea value={form.target_audience} onChange={set('target_audience')} rows={2} placeholder="Marketing leads at B2B SaaS companies." className={`${inputCls} resize-none`} />
        </Field>

        {/* Optional, but asked up front: a named author feeds the Citable score (decision 17). */}
        <div className="rounded-lg border border-[rgba(184,115,51,0.15)] px-4 py-4 space-y-4">
          <p className="text-sm text-[var(--cream-dim)]">
            Who writes your articles? <span className="text-[var(--cream-faint)]">Optional. A named author with real experience is one of the strongest attribution signals, and we check it appears on your published pages.</span>
          </p>
          <Field label="Author name" derived={derived?.author_name}>
            <input value={form.author_name} onChange={set('author_name')} placeholder="Jane Doe" className={inputCls} />
          </Field>
          <Field label="Their experience, in one line" hint="e.g. 12 years running payroll for small businesses.">
            <input value={form.author_credentials} onChange={set('author_credentials')} className={inputCls} />
          </Field>
          <Field label="Author profile link" hint="LinkedIn, an author page, or similar.">
            <input value={form.author_url} onChange={set('author_url')} placeholder="https://" className={inputCls} />
          </Field>
        </div>

        <details className="group rounded-lg border border-[rgba(184,115,51,0.15)] px-4 py-3">
          <summary className="cursor-pointer text-sm text-[var(--cream-dim)] select-none">
            Optional details
            {derived && ` — ${[form.industry, form.tone_notes, form.content_goals, form.primary_keywords].filter((v) => v.trim()).length} filled in from your site`}
          </summary>
          <div className="mt-4 space-y-4">
            <Field label="Industry" derived={derived?.industry}>
              <input value={form.industry} onChange={set('industry')} className={inputCls} />
            </Field>
            <Field label="Voice and tone" derived={derived?.tone_notes}>
              <textarea value={form.tone_notes} onChange={set('tone_notes')} rows={2} className={`${inputCls} resize-none`} />
            </Field>
            <Field label="Content goals" derived={derived?.content_goals}>
              <textarea value={form.content_goals} onChange={set('content_goals')} rows={2} className={`${inputCls} resize-none`} />
            </Field>
            <Field label="Primary keywords" derived={derived?.primary_keywords} hint="Comma separated.">
              <input value={form.primary_keywords} onChange={set('primary_keywords')} className={inputCls} />
            </Field>
            <Field label="Competitors" hint="Comma separated.">
              <input value={form.competitors} onChange={set('competitors')} className={inputCls} />
            </Field>
            <Field label="Topics to avoid">
              <textarea value={form.avoid_topics} onChange={set('avoid_topics')} rows={2} className={`${inputCls} resize-none`} />
            </Field>
          </div>
        </details>

        {saveError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{saveError}</p>}

        {authorNotice && (
          <div className="rounded-lg border border-[rgba(184,115,51,0.3)] px-4 py-3 text-sm text-[var(--cream-dim)]">
            Your profile is saved. The author could not be stored yet; you can add it later under Brand.
            <button onClick={() => router.push('/dashboard')} className="ml-3 font-medium text-[var(--copper-lt)] hover:underline">
              Continue
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={save}
            disabled={saving || missing.length > 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#B87333] text-white text-sm font-medium rounded-lg hover:bg-[#A0622A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Saving…' : 'Looks right — start writing'}
          </button>
          {missing.length > 0 && phase === 'review' && (
            <span className="text-xs text-[var(--cream-faint)]">Needed: {missing.map((k) => FIELD_NAMES[k]).join(', ')}</span>
          )}
        </div>
      </section>
    </div>
  )
}

const FIELD_NAMES: Record<keyof Form, string> = {
  brand_name: 'brand name', website_url: 'website', target_audience: 'who you write for', industry: 'industry',
  tone_notes: 'voice', content_goals: 'goals', primary_keywords: 'keywords', competitors: 'competitors', avoid_topics: 'topics to avoid',
  author_name: 'author', author_credentials: 'author experience', author_url: 'author link',
}

function Field({
  label, required, derived, hint, children,
}: {
  label: string
  required?: boolean
  derived?: DerivedField<string> | DerivedField<string[]> | null
  hint?: string
  children: ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[var(--cream-dim)] mb-1.5">
        {label}
        {required && <span className="text-[var(--copper-lt)]"> *</span>}
      </label>
      {children}
      {(derived || hint) && (
        <p className="mt-1 text-xs text-[var(--cream-faint)]">
          {derived ? SOURCE_LABEL[derived.source] : hint}
          {derived?.evidence && derived.source !== 'url' && (
            <span className="block mt-0.5 italic truncate" title={derived.evidence}>&ldquo;{derived.evidence}&rdquo;</span>
          )}
        </p>
      )}
    </div>
  )
}

const STATE_UI: Record<AccessRow['state'], { label: string; icon: ReactNode; cls: string }> = {
  served: { label: 'Served', icon: <CheckCircle2 className="w-3.5 h-3.5" />, cls: 'text-green-500' },
  refused: { label: 'Refused', icon: <XCircle className="w-3.5 h-3.5" />, cls: 'text-red-500' },
  'robots-disallowed': { label: 'Blocked by robots.txt', icon: <ShieldAlert className="w-3.5 h-3.5" />, cls: 'text-amber-500' },
  unknown: { label: 'Unknown', icon: <CircleHelp className="w-3.5 h-3.5" />, cls: 'text-[var(--cream-faint)]' },
}

function AccessCard({ access, done }: { access: OnboardingAccess | null; done: boolean }) {
  return (
    <section className="rounded-xl border border-[rgba(184,115,51,0.3)] bg-[rgba(184,115,51,0.06)] p-6">
      <p className="text-xs uppercase tracking-wider text-[var(--copper-lt)] font-medium">Crawler access test</p>
      {!access ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-[var(--cream-dim)]">
          {done ? (
            'The crawler access test did not complete for this site.'
          ) : (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-[var(--copper-lt)]" />
              Requesting your homepage as each AI search crawler…
            </>
          )}
        </p>
      ) : (
        <>
          <p className="mt-2 text-base font-semibold text-[var(--cream)]">{access.headline}</p>
          <ul className="mt-4 divide-y divide-[rgba(184,115,51,0.12)]">
            {access.rows.map((r) => {
              const ui = STATE_UI[r.state]
              return (
                <li key={r.token} className="py-2 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm">
                  <span className="text-[var(--cream)] min-w-[9rem]">{r.label}</span>
                  <span className={`inline-flex items-center gap-1 ${ui.cls}`}>{ui.icon}{ui.label}</span>
                  <span className="basis-full sm:basis-auto sm:ml-auto text-xs text-[var(--cream-faint)] truncate max-w-full" title={r.evidence}>
                    {r.evidence}
                  </span>
                </li>
              )
            })}
          </ul>
          {access.caveats[0] && <p className="mt-3 text-xs text-[var(--cream-faint)]">{access.caveats[0]}</p>}
        </>
      )}
    </section>
  )
}
