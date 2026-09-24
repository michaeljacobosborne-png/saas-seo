'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CopyPlus, Loader2 } from 'lucide-react'

export default function DuplicateArticleButton({ articleId }: { articleId: string }) {
  const router = useRouter()
  const [duplicating, setDuplicating] = useState(false)
  const [error, setError] = useState(false)

  async function handleDuplicate() {
    if (duplicating) return
    setDuplicating(true)
    setError(false)
    try {
      const res = await fetch(`/api/articles/${articleId}/fork`, { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.id) {
        setError(true)
        setDuplicating(false)
        return
      }
      router.push(`/articles/${json.id}`)
    } catch {
      setError(true)
      setDuplicating(false)
    }
  }

  return (
    <button
      onClick={handleDuplicate}
      disabled={duplicating}
      title={error ? 'Failed — click to retry' : 'Duplicate article'}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border transition-colors disabled:opacity-50 ${
        error
          ? 'border-red-200 text-red-600 hover:bg-red-50'
          : 'border-[rgba(184,115,51,0.2)] text-[var(--cream-dim)] hover:bg-[var(--ink-card)]'
      }`}
    >
      {duplicating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CopyPlus className="w-3.5 h-3.5" />}
      {error ? 'Retry' : 'Duplicate'}
    </button>
  )
}
