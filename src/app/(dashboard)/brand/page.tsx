'use client'

import { useCallback, useEffect, useRef, useState, KeyboardEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { BrandProfile } from '@/lib/supabase/types'
import {
  Loader2, Send, X, Plus, Building2, Target, MessageSquare,
  TrendingUp, Shield, Users, CheckCircle2, Pencil,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Message = { role: 'user' | 'assistant'; content: string }

type ParsedProfile = {
  company_name: string
  industry: string
  target_audience: string
  brand_voice: string
  content_goals: string
  competitors: string[]
  avoid_topics: string
  tone_examples: string
}

type EditForm = {
  brand_name: string
  website_url: string
  industry: string
  target_audience: string
  tone_notes: string
  content_goals: string
  avoid_topics: string
  competitors: string[]
  primary_keywords: string[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractProfile(text: string): ParsedProfile | null {
  const match = text.match(/<brand_profile>([\s\S]*?)<\/brand_profile>/)
  if (!match) return null
  try {
    return JSON.parse(match[1].trim()) as ParsedProfile
  } catch {
    return null
  }
}

// ─── TagInput ─────────────────────────────────────────────────────────────────

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
    if (trimmed && !tags.includes(trimmed)) onChange([...tags, trimmed])
    setInput('')
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() }
    if (e.key === 'Backspace' && input === '' && tags.length > 0) onChange(tags.slice(0, -1))
  }

  return (
    <div className="min-h-[42px] w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md text-xs font-medium">
          {tag}
          <button type="button" onClick={() => onChange(tags.filter((t) => t !== tag))} className="hover:text-indigo-900">
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BrandPage() {
  const [pageState, setPageState] = useState<'loading' | 'chat' | 'profile'>('loading')
  const [existingProfile, setExistingProfile] = useState<BrandProfile | null>(null)
  const [isUpdate, setIsUpdate] = useState(false)

  // Chat state
  const [messages, setMessages] = useState<Message[]>([])
  const [streamingText, setStreamingText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [userInput, setUserInput] = useState('')
  const [parsedProfile, setParsedProfile] = useState<ParsedProfile | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState<EditForm>({
    brand_name: '', website_url: '', industry: '', target_audience: '',
    tone_notes: '', content_goals: '', avoid_topics: '', competitors: [], primary_keywords: [],
  })
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatInitialized = useRef(false)
  const supabase = createClient()

  // ── Data fetching ────────────────────────────────────────────────────────────

  const fetchProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setPageState('chat'); return }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('brand_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (data) {
      const profile = data as BrandProfile
      setExistingProfile(profile)
      setEditForm({
        brand_name: profile.brand_name,
        website_url: profile.website_url ?? '',
        industry: profile.industry ?? '',
        target_audience: profile.target_audience ?? '',
        tone_notes: profile.tone_notes ?? '',
        content_goals: profile.content_goals ?? '',
        avoid_topics: profile.avoid_topics ?? '',
        competitors: profile.competitors ?? [],
        primary_keywords: profile.primary_keywords ?? [],
      })
      setPageState('profile')
    } else {
      setPageState('chat')
    }
  }, [supabase])

  useEffect(() => { fetchProfile() }, [fetchProfile])

  // ── Chat automation ──────────────────────────────────────────────────────────

  const fireAgentMessage = useCallback(async (msgs: Message[]) => {
    setIsStreaming(true)
    setStreamingText('')

    try {
      const res = await fetch('/api/brand/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: msgs }),
      })

      if (!res.ok || !res.body) throw new Error('API error')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setStreamingText(accumulated)
      }

      const profile = extractProfile(accumulated)
      if (profile) {
        setParsedProfile(profile)
        setStreamingText('')
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: accumulated }])
        setStreamingText('')
      }
    } catch {
      setStreamingText('')
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }])
    } finally {
      setIsStreaming(false)
    }
  }, [])

  // Fire first message on mount for new users
  useEffect(() => {
    if (pageState !== 'chat' || chatInitialized.current || isUpdate) return
    chatInitialized.current = true
    fireAgentMessage([])
  }, [pageState, isUpdate, fireAgentMessage])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText, parsedProfile])

  // ── User actions ─────────────────────────────────────────────────────────────

  function sendMessage() {
    const text = userInput.trim()
    if (!text || isStreaming) return
    setUserInput('')
    const updated: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(updated)
    fireAgentMessage(updated)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  async function saveProfile() {
    if (!parsedProfile) return
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch('/api/brand/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsedProfile),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Save failed')
      chatInitialized.current = false
      await fetchProfile()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function enterUpdateMode() {
    const companyName = existingProfile?.brand_name ?? 'your company'
    chatInitialized.current = true
    setParsedProfile(null)
    setSaveError(null)
    setMessages([{
      role: 'assistant',
      content: `I can see you've set up a profile for ${companyName}. What would you like to update?`,
    }])
    setIsUpdate(true)
    setPageState('chat')
  }

  async function handleEditSave() {
    setEditSaving(true)
    setEditError(null)
    try {
      const res = await fetch('/api/brand/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Save failed')
      setShowEditModal(false)
      await fetchProfile()
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setEditSaving(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (pageState === 'loading') {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    )
  }

  // ── Chat UI ──────────────────────────────────────────────────────────────────

  if (pageState === 'chat') {
    const isBuildingProfile = streamingText.includes('<brand_profile>')

    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-200 bg-white">
          <h1 className="text-xl font-semibold text-gray-900">
            {isUpdate ? 'Update your brand profile' : 'Set up your brand'}
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Answer a few questions and we'll build your profile automatically.
          </p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[72%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-sm'
                    : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {/* Streaming bubble */}
          {streamingText && !isBuildingProfile && (
            <div className="flex justify-start">
              <div className="max-w-[72%] px-4 py-3 rounded-2xl rounded-bl-sm text-sm leading-relaxed whitespace-pre-wrap bg-white border border-gray-200 text-gray-800 shadow-sm">
                {streamingText}
                <span className="inline-block w-1.5 h-3.5 bg-gray-400 ml-0.5 animate-pulse rounded-sm" />
              </div>
            </div>
          )}

          {/* Building profile indicator */}
          {isBuildingProfile && (
            <div className="flex justify-start">
              <div className="px-4 py-3 rounded-2xl rounded-bl-sm text-sm bg-white border border-gray-200 text-gray-500 shadow-sm flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                Building your profile…
              </div>
            </div>
          )}

          {/* Typing indicator when first message is loading */}
          {isStreaming && messages.length === 0 && !streamingText && (
            <div className="flex justify-start">
              <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-white border border-gray-200 shadow-sm flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          )}

          {/* Profile ready card */}
          {parsedProfile && (
            <div className="flex justify-start w-full">
              <div className="w-full max-w-lg bg-white border border-green-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-green-50 border-b border-green-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800">Profile ready</span>
                </div>
                <div className="px-5 py-4 space-y-3 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Company: </span>
                    <span className="text-gray-600">{parsedProfile.company_name}</span>
                    {parsedProfile.industry && (
                      <span className="ml-2 text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">{parsedProfile.industry}</span>
                    )}
                  </div>
                  {parsedProfile.target_audience && (
                    <div>
                      <span className="font-medium text-gray-700">Audience: </span>
                      <span className="text-gray-600">{parsedProfile.target_audience}</span>
                    </div>
                  )}
                  {parsedProfile.brand_voice && (
                    <div>
                      <span className="font-medium text-gray-700">Voice: </span>
                      <span className="text-gray-600">{parsedProfile.brand_voice}</span>
                    </div>
                  )}
                  {parsedProfile.content_goals && (
                    <div>
                      <span className="font-medium text-gray-700">Goal: </span>
                      <span className="text-gray-600">{parsedProfile.content_goals}</span>
                    </div>
                  )}
                  {parsedProfile.competitors?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      <span className="font-medium text-gray-700 self-center">Competitors: </span>
                      {parsedProfile.competitors.map((c) => (
                        <span key={c} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">{c}</span>
                      ))}
                    </div>
                  )}
                  {parsedProfile.avoid_topics && (
                    <div>
                      <span className="font-medium text-gray-700">Avoid: </span>
                      <span className="text-gray-600">{parsedProfile.avoid_topics}</span>
                    </div>
                  )}
                </div>
                {saveError && (
                  <p className="px-5 pb-3 text-xs text-red-600">{saveError}</p>
                )}
                <div className="px-5 py-3 border-t border-gray-100 flex items-center gap-4">
                  <button
                    onClick={saveProfile}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {saving ? 'Saving…' : 'Save profile'}
                  </button>
                  <button
                    onClick={() => setParsedProfile(null)}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Edit answers
                  </button>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        {!parsedProfile && (
          <div className="px-8 py-4 border-t border-gray-200 bg-white">
            <div className="flex items-end gap-3">
              <textarea
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isStreaming}
                rows={1}
                placeholder="Type a message…"
                className="flex-1 resize-none px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 max-h-32 overflow-y-auto"
                style={{ height: 'auto' }}
                onInput={(e) => {
                  const t = e.currentTarget
                  t.style.height = 'auto'
                  t.style.height = `${t.scrollHeight}px`
                }}
              />
              <button
                onClick={sendMessage}
                disabled={isStreaming || !userInput.trim()}
                className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Profile view ─────────────────────────────────────────────────────────────

  const p = existingProfile!

  return (
    <div className="p-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Brand Profile</h1>
          <p className="mt-1 text-sm text-gray-500">
            Your persistent brand memory — the AI uses this to write content that sounds like you.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setShowEditModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit manually
          </button>
          <button
            onClick={enterUpdateMode}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Update with Agent
          </button>
        </div>
      </div>

      {/* Profile card */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {/* Company / industry */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center gap-3">
          <Building2 className="w-5 h-5 text-indigo-500 flex-shrink-0" />
          <div>
            <p className="font-semibold text-gray-900">{p.brand_name}</p>
            {p.industry && <p className="text-sm text-gray-500">{p.industry}</p>}
          </div>
          {p.website_url && (
            <a
              href={p.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-xs text-indigo-600 hover:underline"
            >
              {p.website_url.replace(/^https?:\/\//, '')}
            </a>
          )}
        </div>

        <div className="divide-y divide-gray-100">
          {/* Target audience */}
          {p.target_audience && (
            <div className="px-6 py-4 flex gap-3">
              <Users className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Target Audience</p>
                <p className="text-sm text-gray-800">{p.target_audience}</p>
              </div>
            </div>
          )}

          {/* Brand voice */}
          {(p.tone_notes || p.brand_voice) && (
            <div className="px-6 py-4 flex gap-3">
              <MessageSquare className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Brand Voice</p>
                {p.brand_voice && (
                  <span className="inline-block text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium mb-1.5 capitalize">
                    {p.brand_voice}
                  </span>
                )}
                {p.tone_notes && <p className="text-sm text-gray-800">{p.tone_notes}</p>}
              </div>
            </div>
          )}

          {/* Content goals */}
          {p.content_goals && (
            <div className="px-6 py-4 flex gap-3">
              <TrendingUp className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Content Goal</p>
                <p className="text-sm text-gray-800">{p.content_goals}</p>
              </div>
            </div>
          )}

          {/* Competitors */}
          {p.competitors?.length > 0 && (
            <div className="px-6 py-4 flex gap-3">
              <Target className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Competitors</p>
                <div className="flex flex-wrap gap-1.5">
                  {p.competitors.map((c) => (
                    <span key={c} className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full">{c}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Avoid topics */}
          {p.avoid_topics && (
            <div className="px-6 py-4 flex gap-3">
              <Shield className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Avoid</p>
                <p className="text-sm text-gray-800">{p.avoid_topics}</p>
              </div>
            </div>
          )}

          {/* Primary keywords */}
          {p.primary_keywords?.length > 0 && (
            <div className="px-6 py-4 flex gap-3">
              <Plus className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Primary Keywords</p>
                <div className="flex flex-wrap gap-1.5">
                  {p.primary_keywords.map((k) => (
                    <span key={k} className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full">{k}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Edit profile</h2>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
              {[
                { label: 'Brand Name', key: 'brand_name' as const, placeholder: 'Acme Corp' },
                { label: 'Website URL', key: 'website_url' as const, placeholder: 'https://acme.com' },
                { label: 'Industry', key: 'industry' as const, placeholder: 'SaaS / B2B Software' },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input
                    type="text"
                    value={editForm[key] as string}
                    onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              ))}

              {[
                { label: 'Target Audience', key: 'target_audience' as const, placeholder: 'Marketing managers at mid-market B2B companies' },
                { label: 'Voice & Tone Notes', key: 'tone_notes' as const, placeholder: 'Direct, data-backed, no jargon.' },
                { label: 'Content Goals', key: 'content_goals' as const, placeholder: 'Generate leads and build search authority' },
                { label: 'Topics to Avoid', key: 'avoid_topics' as const, placeholder: 'Avoid mentioning competitors by name, no ROI guarantees' },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <textarea
                    value={editForm[key] as string}
                    onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                    rows={2}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                  />
                </div>
              ))}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Competitors</label>
                <TagInput
                  tags={editForm.competitors}
                  onChange={(tags) => setEditForm((f) => ({ ...f, competitors: tags }))}
                  placeholder="Type a competitor and press Enter…"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Primary Keywords</label>
                <TagInput
                  tags={editForm.primary_keywords}
                  onChange={(tags) => setEditForm((f) => ({ ...f, primary_keywords: tags }))}
                  placeholder="Type a keyword and press Enter…"
                />
              </div>

              {editError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{editError}</p>}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex items-center gap-3">
              <button
                onClick={handleEditSave}
                disabled={editSaving}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {editSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {editSaving ? 'Saving…' : 'Save changes'}
              </button>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
