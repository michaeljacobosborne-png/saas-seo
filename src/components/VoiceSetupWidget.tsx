'use client'

import { useState, useRef, useCallback, KeyboardEvent } from 'react'
import { X, Sparkles, Lock, Loader2, CheckCircle2, RotateCcw, Send } from 'lucide-react'

type VoiceFingerprint = {
  style_summary: string
  phrases: string[]
  sample: string
  avoid: string
  posts_analyzed: number
  crawled_at: string
}

type Message = { role: 'user' | 'assistant'; content: string }
type Stage = 'idle' | 'crawling' | 'reviewing' | 'chatting' | 'saved'

interface VoiceSetupWidgetProps {
  websiteUrl: string | null
  isPaid: boolean
  existingFingerprint?: VoiceFingerprint | null
  onSaved?: (fingerprint: VoiceFingerprint) => void
}

export function VoiceSetupWidget({ websiteUrl, isPaid, existingFingerprint, onSaved }: VoiceSetupWidgetProps) {
  const [open, setOpen] = useState(false)
  const [stage, setStage] = useState<Stage>('idle')
  const [crawlError, setCrawlError] = useState<string | null>(null)
  const [fingerprint, setFingerprint] = useState<VoiceFingerprint | null>(existingFingerprint ?? null)
  const [messages, setMessages] = useState<Message[]>([])
  const [streamingText, setStreamingText] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // ── Crawl ───────────────────────────────────────────────────────────────────

  const runCrawl = useCallback(async () => {
    setStage('crawling')
    setCrawlError(null)
    try {
      const res = await fetch('/api/brand/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'crawl' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCrawlError(data.error ?? 'Failed to analyze blog')
        setStage('idle')
        return
      }
      setFingerprint(data.fingerprint as VoiceFingerprint)
      setStage('reviewing')
    } catch {
      setCrawlError('Network error. Please try again.')
      setStage('idle')
    }
  }, [])

  const handleOpen = useCallback(() => {
    setOpen(true)
    if (stage !== 'idle') return // already in progress or done
    if (fingerprint) {
      setStage('reviewing')
      return
    }
    runCrawl()
  }, [stage, fingerprint, runCrawl])

  // ── Chat ────────────────────────────────────────────────────────────────────

  const fireChat = useCallback(async (msgs: Message[]) => {
    if (!fingerprint) return
    setStreaming(true)
    setStreamingText('')
    try {
      const res = await fetch('/api/brand/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'chat', messages: msgs, fingerprint }),
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

      setMessages((prev) => [...prev, { role: 'assistant', content: accumulated }])
      setStreamingText('')
      if (accumulated.includes('<voice_accepted/>')) setAccepted(true)
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }])
      setStreamingText('')
    } finally {
      setStreaming(false)
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }, [fingerprint])

  const startChat = useCallback(() => {
    setStage('chatting')
    const initial: Message[] = [{ role: 'user', content: 'Show me a sample paragraph in my voice.' }]
    setMessages(initial)
    fireChat(initial)
  }, [fireChat])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')
    const updated: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(updated)
    fireChat(updated)
  }, [input, streaming, messages, fireChat])

  // ── Save ────────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!fingerprint) return
    setSaving(true)
    try {
      const res = await fetch('/api/brand/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', voiceFingerprint: fingerprint }),
      })
      if (!res.ok) throw new Error('Save failed')
      setStage('saved')
      onSaved?.(fingerprint)
    } catch {
      // Silently fail — user can retry
    } finally {
      setSaving(false)
    }
  }, [fingerprint, onSaved])

  // ── Reset ───────────────────────────────────────────────────────────────────

  const handleReset = () => {
    setStage('idle')
    setFingerprint(existingFingerprint ?? null)
    setMessages([])
    setAccepted(false)
    setCrawlError(null)
    runCrawl()
  }

  const handleClose = () => setOpen(false)

  // ── Render ───────────────────────────────────────────────────────────────────

  const displayMessages = messages.filter((m) => m.content !== '<voice_accepted/>')

  return (
    <>
      {/* Inline card trigger — always visible on brand page */}
      <div className="mt-6 border border-[rgba(184,115,51,0.2)] rounded-xl p-5 bg-[var(--ink)]">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Sparkles className="w-4 h-4 text-[var(--copper)] shrink-0" />
              <h3 className="text-sm font-semibold text-[var(--cream)]">Voice Personality</h3>
              {fingerprint && !open && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                  Tuned ✓
                </span>
              )}
              {!isPaid && (
                <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-[rgba(184,115,51,0.08)] text-[var(--copper)] font-medium border border-[rgba(184,115,51,0.2)]">
                  <Lock className="w-3 h-3" /> Paid
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--cream-faint)] leading-relaxed">
              {fingerprint
                ? `Analyzed ${fingerprint.posts_analyzed} blog post${fingerprint.posts_analyzed !== 1 ? 's' : ''}. Articles will now match your writing style.`
                : websiteUrl
                  ? 'Let Byline read your blog and learn how you actually write.'
                  : 'Add your website URL to your brand profile first.'}
            </p>
          </div>
          <button
            onClick={isPaid && !open ? handleOpen : undefined}
            disabled={!isPaid || open || !websiteUrl}
            className={`shrink-0 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              isPaid && !open && websiteUrl
                ? 'bg-[#B87333] text-white hover:bg-[#A0622A]'
                : 'bg-[var(--ink-deep)] text-[var(--cream-faint)] cursor-not-allowed'
            }`}
          >
            {!isPaid && <Lock className="w-3.5 h-3.5" />}
            {open ? 'In progress…' : fingerprint ? 'Update Voice' : 'Tune Your Voice'}
          </button>
        </div>
        {!isPaid && (
          <p className="mt-3 text-xs text-[var(--cream-faint)] border-t border-[rgba(184,115,51,0.1)] pt-3">
            Voice Personality is available on paid plans.{' '}
            <a href="/pricing" className="text-[var(--copper)] hover:underline">Upgrade →</a>
          </p>
        )}
      </div>

      {/* Floating chat widget */}
      {open && (
        <div
          className="fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl shadow-2xl border border-[rgba(184,115,51,0.25)] bg-[var(--ink)] overflow-hidden"
          style={{ width: 360, maxHeight: 520 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(184,115,51,0.15)] bg-[var(--ink-card)] shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[var(--copper)]" />
              <span className="text-sm font-semibold text-[var(--cream)]">Voice Personality</span>
              {stage === 'saved' && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
            </div>
            <div className="flex items-center gap-1">
              {(stage === 'reviewing' || stage === 'chatting') && (
                <button
                  onClick={handleReset}
                  title="Re-analyze blog"
                  className="p-1.5 rounded-lg text-[var(--cream-faint)] hover:text-[var(--cream)] hover:bg-[var(--ink-deep)] transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={handleClose}
                className="p-1.5 rounded-lg text-[var(--cream-faint)] hover:text-[var(--cream)] hover:bg-[var(--ink-deep)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ minHeight: 0 }}>

            {/* Crawling */}
            {stage === 'crawling' && (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-[var(--copper)]" />
                <p className="text-sm text-[var(--cream-dim)] text-center">Analyzing your blog posts…</p>
                <p className="text-xs text-[var(--cream-faint)] text-center">Takes about 15 seconds.</p>
              </div>
            )}

            {/* Crawl error */}
            {crawlError && stage === 'idle' && (
              <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3 leading-relaxed">{crawlError}</div>
            )}

            {/* Reviewing: show extracted fingerprint */}
            {stage === 'reviewing' && fingerprint && (
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-semibold text-[var(--cream-faint)] uppercase tracking-wider mb-1.5">
                    How you write
                  </p>
                  <p className="text-sm text-[var(--cream-dim)] leading-relaxed">{fingerprint.style_summary}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-[var(--cream-faint)] uppercase tracking-wider mb-1.5">
                    Your patterns
                  </p>
                  <ul className="space-y-1">
                    {fingerprint.phrases.map((p, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-[var(--cream-dim)] leading-relaxed">
                        <span className="text-[var(--copper)] mt-0.5 shrink-0">·</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-[var(--cream-faint)] uppercase tracking-wider mb-1.5">
                    Sample in your voice
                  </p>
                  <p className="text-xs text-[var(--cream-dim)] leading-relaxed italic bg-[var(--ink-deep)] rounded-lg p-3 border border-[rgba(184,115,51,0.1)]">
                    {fingerprint.sample}
                  </p>
                </div>
                <p className="text-[10px] text-[var(--cream-faint)]">
                  Based on {fingerprint.posts_analyzed} blog post{fingerprint.posts_analyzed !== 1 ? 's' : ''}.
                </p>
              </div>
            )}

            {/* Chatting: show conversation */}
            {stage === 'chatting' && (
              <div className="space-y-3">
                {displayMessages.map((m, i) => (
                  <div key={i}>
                    {m.role === 'user' ? (
                      <div className="flex justify-end">
                        <div className="max-w-[85%] bg-[rgba(184,115,51,0.1)] border border-[rgba(184,115,51,0.15)] rounded-xl px-3 py-2 text-xs text-[var(--cream-dim)] leading-relaxed">
                          {m.content}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-[var(--cream-dim)] leading-relaxed whitespace-pre-wrap">
                        {m.content}
                      </p>
                    )}
                  </div>
                ))}
                {streamingText && (
                  <p className="text-sm text-[var(--cream-dim)] leading-relaxed whitespace-pre-wrap">
                    {streamingText}
                  </p>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}

            {/* Saved */}
            {stage === 'saved' && (
              <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
                <p className="text-sm font-semibold text-[var(--cream)]">Voice profile saved!</p>
                <p className="text-xs text-[var(--cream-faint)] leading-relaxed">
                  Byline will now write articles that sound like you.
                </p>
              </div>
            )}
          </div>

          {/* Footer actions */}
          {stage === 'reviewing' && (
            <div className="border-t border-[rgba(184,115,51,0.15)] p-3 flex gap-2 shrink-0">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium bg-[#B87333] text-white rounded-lg hover:bg-[#A0622A] disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {saving ? 'Saving…' : 'Accept & Save'}
              </button>
              <button
                onClick={startChat}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium border border-[rgba(184,115,51,0.25)] text-[var(--cream-dim)] rounded-lg hover:bg-[var(--ink-card)] transition-colors"
              >
                Refine
              </button>
            </div>
          )}

          {stage === 'chatting' && (
            <div className="border-t border-[rgba(184,115,51,0.15)] p-3 space-y-2 shrink-0">
              {accepted && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium bg-[#B87333] text-white rounded-lg hover:bg-[#A0622A] disabled:opacity-50 transition-colors"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  {saving ? 'Saving…' : 'Save Voice Profile'}
                </button>
              )}
              <div className="flex gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
                  }}
                  placeholder="What do you like or want to change?"
                  rows={2}
                  className="flex-1 text-sm px-3 py-2 rounded-lg border border-[rgba(184,115,51,0.2)] bg-[var(--ink-deep)] text-[var(--cream)] placeholder:text-[var(--cream-faint)] focus:outline-none focus:ring-2 focus:ring-[#B87333] resize-none"
                />
                <button
                  onClick={sendMessage}
                  disabled={streaming || !input.trim()}
                  className="px-3 py-2 bg-[#B87333] text-white rounded-lg hover:bg-[#A0622A] disabled:opacity-50 transition-colors self-end"
                >
                  {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {stage === 'saved' && (
            <div className="border-t border-[rgba(184,115,51,0.15)] p-3 shrink-0">
              <button
                onClick={handleClose}
                className="w-full px-3 py-2.5 text-sm font-medium border border-[rgba(184,115,51,0.25)] text-[var(--cream-dim)] rounded-lg hover:bg-[var(--ink-card)] transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </div>
      )}
    </>
  )
}
