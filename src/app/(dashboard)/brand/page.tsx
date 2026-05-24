'use client'

import { useEffect, useState, useCallback, KeyboardEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { BrandProfile, BrandVoice } from '@/lib/supabase/types'
import { X, Plus, Loader2, CheckCircle2 } from 'lucide-react'

const BRAND_VOICE_OPTIONS: { value: BrandVoice; label: string }[] = [
  { value: 'professional', label: 'Professional' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'authoritative', label: 'Authoritative' },
  { value: 'conversational', label: 'Conversational' },
  { value: 'witty', label: 'Witty' },
  { value: 'inspirational', label: 'Inspirational' },
]

// Reusable tag input component
function TagInput({
  tags,
  onChange,
  placeholder,
}: {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder: string
}) {
  const [input, setInput] = useState('')

  function add() {
    const trimmed = input.trim()
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed])
    }
    setInput('')
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add()
    }
    if (e.key === 'Backspace' && input === '' && tags.length > 0) {
      onChange(tags.slice(0, -1))
    }
  }

  function remove(tag: string) {
    onChange(tags.filter((t) => t !== tag))
  }

  return (
    <div className="min-h-[42px] w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md text-xs font-medium"
        >
          {tag}
          <button
            type="button"
            onClick={() => remove(tag)}
            className="hover:text-indigo-900 focus:outline-none"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={add}
        placeholder={tags.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[120px] outline-none bg-transparent placeholder:text-gray-400"
      />
    </div>
  )
}

type FormState = {
  brand_name: string
  website_url: string
  industry: string
  target_audience: string
  brand_voice: BrandVoice | ''
  tone_notes: string
  competitors: string[]
  primary_keywords: string[]
}

const EMPTY_FORM: FormState = {
  brand_name: '',
  website_url: '',
  industry: '',
  target_audience: '',
  brand_voice: '',
  tone_notes: '',
  competitors: [],
  primary_keywords: [],
}

export default function BrandPage() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [profileId, setProfileId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const fetchProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('brand_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      console.error(error)
    } else if (data) {
      const profile = data as BrandProfile
      setProfileId(profile.id)
      setForm({
        brand_name: profile.brand_name,
        website_url: profile.website_url ?? '',
        industry: profile.industry ?? '',
        target_audience: profile.target_audience ?? '',
        brand_voice: (profile.brand_voice as BrandVoice) ?? '',
        tone_notes: profile.tone_notes ?? '',
        competitors: profile.competitors ?? [],
        primary_keywords: profile.primary_keywords ?? [],
      })
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Not authenticated.')
      setSaving(false)
      return
    }

    const payload = {
      user_id: user.id,
      brand_name: form.brand_name,
      website_url: form.website_url || null,
      industry: form.industry || null,
      target_audience: form.target_audience || null,
      brand_voice: form.brand_voice || null,
      tone_notes: form.tone_notes || null,
      competitors: form.competitors,
      primary_keywords: form.primary_keywords,
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const table = supabase.from('brand_profiles') as any
    let err
    if (profileId) {
      const { error } = await table.update(payload).eq('id', profileId)
      err = error
    } else {
      const { data, error } = await table.insert(payload).select('id').single()
      if (data) setProfileId((data as { id: string }).id)
      err = error
    }

    if (err) {
      setError(err.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Brand Profile</h1>
        <p className="mt-1 text-sm text-gray-500">
          This is your persistent brand memory — the AI uses it to generate content that sounds like you.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Brand Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Brand Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={form.brand_name}
            onChange={(e) => set('brand_name', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="Acme Corp"
          />
        </div>

        {/* Website URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Website URL</label>
          <input
            type="url"
            value={form.website_url}
            onChange={(e) => set('website_url', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="https://acme.com"
          />
        </div>

        {/* Industry */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
          <input
            type="text"
            value={form.industry}
            onChange={(e) => set('industry', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="SaaS / B2B Software"
          />
        </div>

        {/* Target Audience */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Target Audience</label>
          <input
            type="text"
            value={form.target_audience}
            onChange={(e) => set('target_audience', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="Marketing managers at mid-market B2B companies"
          />
        </div>

        {/* Brand Voice */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Brand Voice</label>
          <select
            value={form.brand_voice}
            onChange={(e) => set('brand_voice', e.target.value as BrandVoice | '')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
          >
            <option value="">Select a voice…</option>
            {BRAND_VOICE_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {/* Tone Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tone Notes</label>
          <textarea
            value={form.tone_notes}
            onChange={(e) => set('tone_notes', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            placeholder="E.g. Avoid jargon. Use data to back claims. Never use exclamation marks. Oxford comma always."
          />
        </div>

        {/* Competitors */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Competitors</label>
          <TagInput
            tags={form.competitors}
            onChange={(tags) => set('competitors', tags)}
            placeholder="Type a competitor and press Enter…"
          />
          <p className="mt-1 text-xs text-gray-400">Press Enter or comma to add. Used for gap analysis.</p>
        </div>

        {/* Primary Keywords */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Primary Keywords</label>
          <TagInput
            tags={form.primary_keywords}
            onChange={(tags) => set('primary_keywords', tags)}
            placeholder="Type a keyword and press Enter…"
          />
          <p className="mt-1 text-xs text-gray-400">Core terms that define your topic space.</p>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Saving…' : profileId ? 'Save changes' : 'Create profile'}
          </button>

          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-green-600">
              <CheckCircle2 className="w-4 h-4" />
              Saved
            </span>
          )}
        </div>
      </form>
    </div>
  )
}
