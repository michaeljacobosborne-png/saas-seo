'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MessageCircle, X, Send, Loader2 } from 'lucide-react'

type Message = { role: 'user' | 'assistant'; content: string }

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [streamingText, setStreamingText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [input, setInput] = useState('')
  const initialized = useRef(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => { scrollToBottom() }, [messages, streamingText])

  const sendMessage = useCallback(async (text: string) => {
    const userMsg: Message | null = text.trim() ? { role: 'user', content: text.trim() } : null
    const newMessages = userMsg ? [...messages, userMsg] : messages

    if (userMsg) setMessages(newMessages)
    setIsStreaming(true)
    setStreamingText('')

    try {
      const res = await fetch('/api/brand/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })

      if (!res.ok || !res.body) throw new Error('API error')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        // Strip brand_profile XML tags from display
        const display = accumulated.replace(/<brand_profile>[\s\S]*?<\/brand_profile>/g, '').trim()
        setStreamingText(display)
      }

      const display = accumulated.replace(/<brand_profile>[\s\S]*?<\/brand_profile>/g, '').trim()
      setMessages((prev) => [...prev, { role: 'assistant', content: display }])
      setStreamingText('')
    } catch {
      setStreamingText('')
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }])
    } finally {
      setIsStreaming(false)
    }
  }, [messages])

  // Listen for external open trigger (e.g. dashboard "Ask Agent" button)
  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener('byline:open-chat', handler)
    return () => window.removeEventListener('byline:open-chat', handler)
  }, [])

  // Auto-greet on first open
  useEffect(() => {
    if (open && !initialized.current) {
      initialized.current = true
      sendMessage('')
    }
  }, [open, sendMessage])

  function handleSend() {
    if (!input.trim() || isStreaming) return
    const text = input
    setInput('')
    sendMessage(text)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center rounded-full shadow-lg transition-transform hover:scale-110"
        style={{ background: '#B87333', width: '52px', height: '52px' }}
        title="Ask a question"
        aria-label="Toggle chat"
      >
        {open
          ? <X className="w-5 h-5" style={{ color: '#F7F3EC' }} />
          : <MessageCircle className="w-6 h-6" style={{ color: '#F7F3EC' }} />
        }
      </button>

      {/* Panel */}
      {open && (
        <div
          className="fixed bottom-[76px] right-6 z-50 rounded-xl shadow-xl flex flex-col overflow-hidden"
          style={{
            width: '380px',
            height: '500px',
            background: '#231F1B',
            border: '1px solid rgba(184,115,51,0.25)',
          }}
        >
          {/* Header */}
          <div
            className="px-4 py-3 flex items-center justify-between flex-shrink-0"
            style={{ borderBottom: '1px solid rgba(184,115,51,0.18)', background: '#1C1917' }}
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-sm font-semibold" style={{ color: '#F7F3EC', fontFamily: 'DM Sans, sans-serif' }}>
                Byline Assistant
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="transition-colors"
              style={{ color: '#7A6555' }}
              aria-label="Close chat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ fontFamily: 'DM Sans, sans-serif' }}>
            {messages.length === 0 && !streamingText && !isStreaming && (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#7A6555' }} />
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed whitespace-pre-wrap"
                  style={
                    msg.role === 'user'
                      ? { background: '#B87333', color: '#F7F3EC' }
                      : { background: '#2A2420', color: '#F7F3EC' }
                  }
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {streamingText && (
              <div className="flex justify-start">
                <div
                  className="max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed whitespace-pre-wrap"
                  style={{ background: '#2A2420', color: '#F7F3EC' }}
                >
                  {streamingText}
                  <span className="inline-block w-1 h-3.5 ml-0.5 align-middle animate-pulse" style={{ background: '#D4954A' }} />
                </div>
              </div>
            )}
            {isStreaming && !streamingText && (
              <div className="flex justify-start">
                <div className="px-3 py-2 rounded-xl" style={{ background: '#2A2420' }}>
                  <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#D4954A' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div
            className="px-3 py-3 flex items-center gap-2 flex-shrink-0"
            style={{ borderTop: '1px solid rgba(184,115,51,0.18)' }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about your brand or content…"
              disabled={isStreaming}
              className="flex-1 px-3 py-2 text-sm rounded-lg outline-none focus:ring-1 focus:ring-[#B87333] disabled:opacity-50"
              style={{
                background: '#1C1917',
                border: '1px solid rgba(184,115,51,0.2)',
                color: '#F7F3EC',
                fontFamily: 'DM Sans, sans-serif',
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              className="flex items-center justify-center rounded-lg transition-colors disabled:opacity-40"
              style={{ background: '#B87333', width: '36px', height: '36px', flexShrink: 0 }}
              aria-label="Send"
            >
              <Send className="w-4 h-4" style={{ color: '#F7F3EC' }} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
