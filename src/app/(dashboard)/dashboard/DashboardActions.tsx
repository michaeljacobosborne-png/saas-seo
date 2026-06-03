'use client'

import { Bot } from 'lucide-react'

export default function DashboardActions() {
  function openChat() {
    window.dispatchEvent(new CustomEvent('byline:open-chat'))
  }

  return (
    <button
      onClick={openChat}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors"
      style={{ color: '#F7F3EC', borderColor: 'rgba(184,115,51,0.25)', background: '#231F1B' }}
    >
      <Bot className="w-4 h-4" />
      Ask Byline
    </button>
  )
}
