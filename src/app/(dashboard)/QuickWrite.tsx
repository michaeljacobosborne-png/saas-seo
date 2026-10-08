'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'

// "Quick Write" fast lane — type a phrase and skip straight to article
// generation. Navigates to /articles/new?keyword=<phrase>, where the wizard
// pre-fills the topic and auto-triggers brief generation.
export default function QuickWrite() {
  const router = useRouter()
  const [topic, setTopic] = useState('')

  function submit() {
    const t = topic.trim()
    if (!t) return
    router.push(`/articles/new?keyword=${encodeURIComponent(t)}`)
  }

  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--ink-card)', border: '1px solid rgba(184,115,51,0.18)' }}>
      <label className="block text-xs font-medium mb-2" style={{ color: 'var(--cream-dim)' }}>
        Quick Write
      </label>
      <form
        onSubmit={(e) => { e.preventDefault(); submit() }}
        className="flex flex-col sm:flex-row gap-2"
      >
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Type a topic or keyword to write about…"
          className="flex-1 px-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-[var(--copper)]"
          style={{ background: 'var(--ink)', color: 'var(--cream)', borderColor: 'var(--border)' }}
        />
        <button
          type="submit"
          disabled={!topic.trim()}
          className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap"
          style={{ background: 'var(--copper)', color: '#F7F3EC' }}
        >
          <Sparkles className="w-4 h-4" />
          Quick Write →
        </button>
      </form>
    </div>
  )
}
