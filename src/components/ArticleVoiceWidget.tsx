'use client'

import { useState, useRef, useCallback, KeyboardEvent } from 'react'
import { Sparkles, X, Send, Loader2, CheckCircle2, Lock } from 'lucide-react'
import { marked } from 'marked'

type Message = { role: 'user' | 'assistant'; content: string }

interface ArticleVoiceWidgetProps {
  isPaid: boolean
  hasVoiceProfile: boolean
  agentOpen: boolean
  selectedText?: string
  selectionRange?: { from: number; to: number } | null
  applyAtRangeRef: React.MutableRefObject<((from: number, to: number, html: string) => void) | null>
  replaceContentRef: React.MutableRefObject<((markdown: string) => void) | null>
  getEditorTextRef: React.MutableRefObject<(() => string) | null>
}

export function ArticleVoiceWidget({
  isPaid,
  hasVoiceProfile,
  agentOpen,
  selectedText,
  selectionRange,
  applyAtRangeRef,
  replaceContentRef,
  getEditorTextRef,
}: ArticleVoiceWidgetProps) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [streamingText, setStreamingText] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [input, setInput] = useState('')
  const [appliedIdx, setAppliedIdx] = useState<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Position shifts left when agent panel (340px) is open; 24px from right otherwise
  const rightPx = agentOpen ? 364 : 24

  const sendMessage = useCallback(async (overrideInput?: string) => {
    const text = (overrideInput ?? input).trim()
    if (!text || streaming) return
    if (!overrideInput) setInput('')

    const newMessages: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(newMessages)
    setStreaming(true)
    setStreamingText('')

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const currentText = getEditorTextRef.current?.() ?? ''
      const res = await fetch('/api/brand/voice-tune', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction: text,
          selectedText: selectedText || undefined,
          articleContent: selectedText ? undefined : currentText.slice(0, 6000),
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const err = await res.json().catch(() => ({})) as any
        setMessages((prev) => [...prev, { role: 'assistant', content: err.error ?? 'Something went wrong.' }])
        return
      }
      if (!res.body) throw new Error('No body')

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
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }])
      setStreamingText('')
    } finally {
      setStreaming(false)
    }
  }, [input, streaming, messages, selectedText, getEditorTextRef])

  const handleApply = useCallback((content: string, msgIdx: number) => {
    const html = marked.parse(content) as string
    if (selectionRange && selectedText) {
      applyAtRangeRef.current?.(selectionRange.from, selectionRange.to, html)
    } else {
      replaceContentRef.current?.(content)
    }
    setAppliedIdx(msgIdx)
    setTimeout(() => setAppliedIdx((cur) => (cur === msgIdx ? null : cur)), 2500)
  }, [selectionRange, selectedText, applyAtRangeRef, replaceContentRef])

  const handleClose = () => {
    abortRef.current?.abort()
    setOpen(false)
  }

  const quickPrompts = [
    selectedText ? 'Rewrite this in my voice' : 'Tune this article to my voice',
    'Make it more conversational',
    'Remove the corporate-sounding parts',
  ]

  // ── Closed pill button ────────────────────────────────────────────────────────
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed z-40 flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg bg-[var(--ink)] border border-[rgba(184,115,51,0.3)] text-sm font-medium text-[var(--cream-dim)] hover:text-[var(--cream)] hover:border-[rgba(184,115,51,0.55)] hover:shadow-xl transition-all"
        style={{ bottom: 24, right: rightPx }}
        title={
          !isPaid ? 'Paid plan required'
          : !hasVoiceProfile ? 'Set up Voice Personality on the Brand page first'
          : 'Voice tuning'
        }
      >
        <Sparkles className="w-3.5 h-3.5 text-[var(--copper)]" />
        Voice
        {(!isPaid || !hasVoiceProfile) && <Lock className="w-3 h-3 text-[var(--cream-faint)] ml-0.5" />}
      </button>
    )
  }

  // ── Open widget ───────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed z-40 flex flex-col rounded-2xl shadow-2xl border border-[rgba(184,115,51,0.25)] bg-[var(--ink)] overflow-hidden"
      style={{ bottom: 24, right: rightPx, width: 320, maxHeight: 420 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[rgba(184,115,51,0.15)] bg-[var(--ink-card)] rounded-t-2xl shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-[var(--copper)]" />
          <span className="text-sm font-semibold text-[var(--cream)]">Voice</span>
          {selectedText && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-[rgba(184,115,51,0.1)] border border-[rgba(184,115,51,0.2)] text-[var(--copper)]">
              Selection
            </span>
          )}
        </div>
        <button
          onClick={handleClose}
          className="p-1 rounded-lg text-[var(--cream-faint)] hover:text-[var(--cream)] hover:bg-[var(--ink-deep)] transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Gate messages */}
      {!isPaid && (
        <div className="p-5 text-center">
          <p className="text-sm text-[var(--cream-dim)] mb-3">Voice tuning is available on paid plans.</p>
          <a href="/pricing" className="text-sm font-medium text-[var(--copper)] hover:underline">Upgrade →</a>
        </div>
      )}

      {isPaid && !hasVoiceProfile && (
        <div className="p-5 text-center">
          <p className="text-sm text-[var(--cream-dim)] mb-3">Set up your Voice Personality profile first.</p>
          <a href="/brand" className="text-sm font-medium text-[var(--copper)] hover:underline">Set up Voice →</a>
        </div>
      )}

      {/* Chat area */}
      {isPaid && hasVoiceProfile && (
        <>
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5" style={{ minHeight: 0 }}>
            {/* Quick prompts (shown when no messages yet) */}
            {messages.length === 0 && !streamingText && (
              <div className="space-y-1.5">
                {quickPrompts.map((p) => (
                  <button
                    key={p}
                    onClick={() => sendMessage(p)}
                    disabled={streaming}
                    className="w-full text-left text-xs px-3 py-2 rounded-lg border border-[rgba(184,115,51,0.15)] text-[var(--cream-dim)] hover:bg-[var(--ink-card)] hover:text-[var(--cream)] transition-colors disabled:opacity-50"
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}

            {/* Messages */}
            {messages.map((m, i) => (
              <div key={i}>
                {m.role === 'user' ? (
                  <div className="flex justify-end">
                    <div className="max-w-[85%] bg-[rgba(184,115,51,0.1)] border border-[rgba(184,115,51,0.15)] rounded-xl px-3 py-2 text-xs text-[var(--cream-dim)] leading-relaxed">
                      {m.content}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <p className="text-xs text-[var(--cream-dim)] leading-relaxed whitespace-pre-wrap">{m.content}</p>
                    <button
                      onClick={() => handleApply(m.content, i)}
                      className="flex items-center gap-1.5 text-xs font-medium text-[var(--copper)] hover:text-[#A0622A] transition-colors"
                    >
                      {appliedIdx === i ? (
                        <><CheckCircle2 className="w-3 h-3 text-green-500" /> Applied</>
                      ) : (
                        <>Apply →</>
                      )}
                    </button>
                  </div>
                )}
              </div>
            ))}

            {/* Streaming text */}
            {streamingText && (
              <p className="text-xs text-[var(--cream-dim)] leading-relaxed whitespace-pre-wrap">{streamingText}</p>
            )}
          </div>

          {/* Input bar */}
          <div className="border-t border-[rgba(184,115,51,0.15)] p-2.5 flex gap-2 shrink-0">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                if (e.key === 'Enter') { e.preventDefault(); sendMessage() }
              }}
              placeholder="How should I adjust your voice?"
              className="flex-1 text-xs px-3 py-2 rounded-lg border border-[rgba(184,115,51,0.2)] bg-[var(--ink-deep)] text-[var(--cream)] placeholder:text-[var(--cream-faint)] focus:outline-none focus:ring-1 focus:ring-[#B87333]"
            />
            <button
              onClick={() => sendMessage()}
              disabled={streaming || !input.trim()}
              className="px-2.5 py-2 bg-[#B87333] text-white rounded-lg hover:bg-[#A0622A] disabled:opacity-50 transition-colors"
            >
              {streaming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
