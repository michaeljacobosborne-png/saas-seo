'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Bot, X, Send, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'

type Message = { role: 'user' | 'assistant'; content: string }
type View = 'chat' | 'cancel'

const GREETING: Message = {
  role: 'assistant',
  content:
    "Hi — I'm Byline Support. Ask me anything about keywords, articles, scoring, billing, or your account. I can also help you cancel your plan or get a message to Michael.",
}

const QUICK_ACTIONS = [
  'Why is my keyword research stuck?',
  'How does article scoring work?',
  'I want to cancel my subscription',
]

export default function SupportWidget() {
  const pathname = usePathname()
  // The /brand page has its own bottom-anchored chat input. On mobile the floating
  // launcher overlaps that page's send button, so hide it there on small screens.
  const onBrandPage = pathname === '/brand'

  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>('chat')
  const [messages, setMessages] = useState<Message[]>([GREETING])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)

  // Cancel form state
  const [cancelReason, setCancelReason] = useState('')
  const [wantRefund, setWantRefund] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelDone, setCancelDone] = useState<string | null>(null)

  const messagesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || streaming) return
    setInput('')

    const outgoing: Message[] = [...messages, { role: 'user', content: trimmed }]
    setMessages([...outgoing, { role: 'assistant', content: '' }])
    setStreaming(true)

    try {
      // Send the real conversation (excluding the static greeting) to the API.
      const apiMessages = outgoing.filter((m) => m !== GREETING)
      const res = await fetch('/api/support/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      })

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: 'Something went wrong.' }))
        setMessages((prev) => {
          const next = [...prev]
          next[next.length - 1] = { role: 'assistant', content: err.error || 'Something went wrong. Please try again.' }
          return next
        })
        setStreaming(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          next[next.length - 1] = { role: 'assistant', content: (last?.content ?? '') + chunk }
          return next
        })
      }
    } catch {
      setMessages((prev) => {
        const next = [...prev]
        next[next.length - 1] = { role: 'assistant', content: 'Connection interrupted. Please try again.' }
        return next
      })
    } finally {
      setStreaming(false)
    }
  }

  async function escalateToHuman() {
    if (streaming) return
    setStreaming(true)
    const convo = messages.filter((m) => m !== GREETING)
    try {
      const res = await fetch('/api/support/escalate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: 'User asked to speak with a human from the support widget',
          category: 'account',
          priority: 'p1',
          reason: 'Manual escalation from widget',
          conversation: convo,
        }),
      })
      const data = await res.json().catch(() => ({}))
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.ok
            ? `I've passed this to Michael. ${data.availability ?? ''}`.trim()
            : "I couldn't reach the escalation channel just now — please email hi@bylineseo.com and we'll jump on it.",
        },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "I couldn't reach the escalation channel just now — please email hi@bylineseo.com." },
      ])
    } finally {
      setStreaming(false)
    }
  }

  async function submitCancel() {
    if (cancelling) return
    setCancelling(true)
    try {
      const res = await fetch('/api/support/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason, refundRequested: wantRefund }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setCancelDone(data.message ?? 'Your cancellation has been scheduled.')
      } else {
        setCancelDone(data.error ?? 'We could not process the cancellation. Please try again or email hi@bylineseo.com.')
      }
    } catch {
      setCancelDone('We could not process the cancellation. Please email hi@bylineseo.com.')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <>
      {/* Launcher — icon-only on mobile (smaller footprint so it doesn't overlap
          bottom chat inputs); full pill on md+. Hidden on /brand on mobile, where
          the page has its own bottom-anchored send button. */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open support"
          className={`fixed bottom-5 right-5 z-50 items-center gap-2 p-3.5 md:px-4 md:py-3 rounded-full shadow-lg transition-transform hover:scale-105 ${
            onBrandPage ? 'hidden md:flex' : 'flex'
          }`}
          style={{ background: '#B87333', color: '#F7F3EC' }}
        >
          <Bot className="w-5 h-5" />
          <span className="hidden md:inline text-sm font-semibold">Support</span>
        </button>
      )}

      {/* Panel */}
      {open && (
        <div
          className="fixed bottom-5 right-5 z-50 flex flex-col rounded-2xl shadow-2xl overflow-hidden"
          style={{
            width: 'min(384px, calc(100vw - 2.5rem))',
            height: 'min(560px, calc(100vh - 2.5rem))',
            background: '#1C1917',
            border: '1px solid rgba(184,115,51,0.25)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{ borderBottom: '1px solid rgba(184,115,51,0.18)', background: '#231F1B' }}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#B87333' }} />
              <span className="font-semibold text-sm" style={{ color: '#F7F3EC' }}>
                Byline Support
              </span>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close support" style={{ color: '#7A6555' }} className="hover:text-[#A89070] transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {view === 'chat' ? (
            <>
              {/* Messages */}
              <div ref={messagesRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {messages.map((msg, i) => {
                  const streamingThis = streaming && i === messages.length - 1 && msg.role === 'assistant'
                  return (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.role === 'user' ? (
                        <div className="max-w-[85%] px-3.5 py-2.5 text-sm rounded-2xl rounded-tr-sm leading-relaxed" style={{ background: '#B87333', color: '#F7F3EC' }}>
                          {msg.content}
                        </div>
                      ) : (
                        <div
                          className="max-w-[92%] px-3.5 py-2.5 text-sm rounded-2xl rounded-tl-sm leading-relaxed whitespace-pre-wrap"
                          style={{ background: '#231F1B', border: '1px solid rgba(184,115,51,0.2)', color: '#F7F3EC' }}
                        >
                          {msg.content || (streamingThis ? '' : '')}
                          {streamingThis && !msg.content && <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#A89070' }} />}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Quick actions (only before the user has said anything) */}
              {messages.filter((m) => m.role === 'user').length === 0 && (
                <div className="px-4 pb-2 flex flex-wrap gap-2 shrink-0">
                  {QUICK_ACTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      disabled={streaming}
                      className="text-xs px-2.5 py-1.5 rounded-full transition-colors disabled:opacity-50"
                      style={{ background: '#231F1B', border: '1px solid rgba(184,115,51,0.25)', color: '#A89070' }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {/* Footer actions */}
              <div className="px-4 pb-2 flex items-center gap-3 shrink-0">
                <button onClick={() => setView('cancel')} className="text-xs hover:underline" style={{ color: '#7A6555' }}>
                  Cancel subscription
                </button>
                <span style={{ color: '#3A332C' }}>·</span>
                <button onClick={escalateToHuman} disabled={streaming} className="text-xs hover:underline disabled:opacity-50" style={{ color: '#7A6555' }}>
                  Talk to a human
                </button>
              </div>

              {/* Input */}
              <div className="px-3 py-3 shrink-0" style={{ borderTop: '1px solid rgba(184,115,51,0.15)' }}>
                <div className="flex items-end gap-2">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        sendMessage(input)
                      }
                    }}
                    placeholder="Ask a question…"
                    disabled={streaming}
                    rows={1}
                    className="flex-1 resize-none text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 disabled:opacity-50"
                    style={{ background: '#231F1B', border: '1px solid rgba(184,115,51,0.2)', color: '#F7F3EC', maxHeight: '120px' }}
                  />
                  <button
                    onClick={() => sendMessage(input)}
                    disabled={!input.trim() || streaming}
                    aria-label="Send"
                    className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl disabled:opacity-40 transition-colors"
                    style={{ background: '#B87333', color: '#F7F3EC' }}
                  >
                    {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Cancel view */
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {cancelDone ? (
                <div className="flex flex-col items-center text-center pt-6">
                  <CheckCircle2 className="w-10 h-10 mb-3" style={{ color: '#B87333' }} />
                  <p className="text-sm leading-relaxed mb-5" style={{ color: '#F7F3EC' }}>{cancelDone}</p>
                  <button
                    onClick={() => {
                      setView('chat')
                      setCancelDone(null)
                      setCancelReason('')
                      setWantRefund(false)
                    }}
                    className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
                    style={{ background: '#B87333', color: '#F7F3EC' }}
                  >
                    Back to chat
                  </button>
                </div>
              ) : (
                <>
                  <button onClick={() => setView('chat')} className="text-xs mb-3 hover:underline" style={{ color: '#7A6555' }}>
                    ← Back
                  </button>
                  <h3 className="font-semibold text-sm mb-1" style={{ color: '#F7F3EC' }}>
                    Cancel your subscription
                  </h3>
                  <div className="flex items-start gap-2 text-xs mb-4 p-2.5 rounded-lg" style={{ background: '#231F1B', border: '1px solid rgba(184,115,51,0.18)', color: '#A89070' }}>
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#B87333' }} />
                    <span>Your plan stays active until the end of the current billing period. Your articles and brand profile are preserved.</span>
                  </div>

                  <label className="block text-xs mb-1.5" style={{ color: '#A89070' }}>
                    What made you decide to cancel? (optional)
                  </label>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    rows={3}
                    placeholder="Helps us improve Byline…"
                    className="w-full resize-none text-sm rounded-xl px-3 py-2.5 mb-4 focus:outline-none focus:ring-2"
                    style={{ background: '#231F1B', border: '1px solid rgba(184,115,51,0.2)', color: '#F7F3EC' }}
                  />

                  <label className="flex items-start gap-2 mb-5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={wantRefund}
                      onChange={(e) => setWantRefund(e.target.checked)}
                      className="mt-0.5"
                      style={{ accentColor: '#B87333' }}
                    />
                    <span className="text-xs leading-relaxed" style={{ color: '#A89070' }}>
                      I&apos;d also like to request a refund. (Reviewed personally by Michael — refunds are available within 30 days of your first payment.)
                    </span>
                  </label>

                  <button
                    onClick={submitCancel}
                    disabled={cancelling}
                    className="w-full py-2.5 text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                    style={{ background: '#B87333', color: '#F7F3EC' }}
                  >
                    {cancelling && <Loader2 className="w-4 h-4 animate-spin" />}
                    {wantRefund ? 'Cancel & request refund' : 'Confirm cancellation'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </>
  )
}
