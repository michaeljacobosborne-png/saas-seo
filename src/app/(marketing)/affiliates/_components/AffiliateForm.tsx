'use client'

import { useState } from 'react'

const PLATFORMS = [
  'Blog/Website',
  'YouTube',
  'Newsletter',
  'X (Twitter)',
  'LinkedIn',
  'Podcast',
  'Instagram',
  'TikTok',
  'Other',
]

export function AffiliateForm() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    website: '',
    platforms: [] as string[],
    audienceSize: '',
    promoPlan: '',
  })
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  function togglePlatform(platform: string) {
    setForm(prev => ({
      ...prev,
      platforms: prev.platforms.includes(platform)
        ? prev.platforms.filter(p => p !== platform)
        : [...prev.platforms, platform],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('submitting')
    setErrorMsg('')

    try {
      const res = await fetch('/api/affiliates/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Something went wrong. Please try again.')
        setStatus('error')
      } else {
        setStatus('success')
      }
    } catch {
      setErrorMsg('Network error. Please try again.')
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div className="rounded-2xl border border-[#E7E0D6] bg-[#F7F3EC] p-8 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#B87333]/12 mx-auto">
          <svg className="w-7 h-7 text-[#B87333]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="mb-2 text-xl font-bold text-[#1C1917]">Application received!</h3>
        <p className="text-[#57534E]">Thanks! We&apos;ll be in touch within 48 hours.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#1C1917]">
            Full Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            placeholder="Jane Smith"
            className="w-full rounded-xl border border-[#E7E0D6] bg-white px-4 py-2.5 text-[#1C1917] placeholder-[#998876] focus:border-[#B87333] focus:outline-none focus:ring-2 focus:ring-[#B87333]/30"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#1C1917]">
            Email Address <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            required
            value={form.email}
            onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
            placeholder="jane@example.com"
            className="w-full rounded-xl border border-[#E7E0D6] bg-white px-4 py-2.5 text-[#1C1917] placeholder-[#998876] focus:border-[#B87333] focus:outline-none focus:ring-2 focus:ring-[#B87333]/30"
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-[#1C1917]">
          Website or main platform URL
        </label>
        <input
          type="url"
          value={form.website}
          onChange={e => setForm(p => ({ ...p, website: e.target.value }))}
          placeholder="https://yourblog.com"
          className="w-full rounded-xl border border-[#E7E0D6] bg-white px-4 py-2.5 text-[#1C1917] placeholder-[#998876] focus:border-[#B87333] focus:outline-none focus:ring-2 focus:ring-[#B87333]/30"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-[#1C1917]">
          Where do you promote content?
        </label>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map(platform => (
            <button
              key={platform}
              type="button"
              onClick={() => togglePlatform(platform)}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                form.platforms.includes(platform)
                  ? 'border-[#B87333] bg-[#B87333]/10 text-[#9A6228]'
                  : 'border-[#E7E0D6] bg-white text-[#57534E] hover:border-[#B87333]/40 hover:text-[#1C1917]'
              }`}
            >
              {platform}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-[#1C1917]">
          Audience size
        </label>
        <select
          value={form.audienceSize}
          onChange={e => setForm(p => ({ ...p, audienceSize: e.target.value }))}
          className="w-full rounded-xl border border-[#E7E0D6] bg-white px-4 py-2.5 text-[#1C1917] focus:border-[#B87333] focus:outline-none focus:ring-2 focus:ring-[#B87333]/30"
        >
          <option value="">Select audience size</option>
          <option value="under_1k">Under 1,000</option>
          <option value="1k_10k">1,000 – 10,000</option>
          <option value="10k_50k">10,000 – 50,000</option>
          <option value="50k_plus">50,000+</option>
        </select>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-[#1C1917]">
          How do you plan to promote Byline?
        </label>
        <textarea
          value={form.promoPlan}
          onChange={e => setForm(p => ({ ...p, promoPlan: e.target.value }))}
          placeholder="A quick overview of how you'd introduce Byline to your audience..."
          rows={3}
          className="w-full rounded-xl border border-[#E7E0D6] bg-white px-4 py-2.5 text-[#1C1917] placeholder-[#998876] focus:border-[#B87333] focus:outline-none focus:ring-2 focus:ring-[#B87333]/30"
        />
      </div>

      {status === 'error' && (
        <p className="text-sm text-red-600">{errorMsg}</p>
      )}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="w-full rounded-xl bg-[#B87333] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#9A6228] disabled:opacity-60"
      >
        {status === 'submitting' ? 'Submitting…' : 'Apply to the Affiliate Program'}
      </button>
    </form>
  )
}
