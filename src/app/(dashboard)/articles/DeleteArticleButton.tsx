'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2 } from 'lucide-react'

export default function DeleteArticleButton({ articleId }: { articleId: string }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(false)

  async function handleDelete() {
    if (deleting) return
    if (!window.confirm('Delete this article? This cannot be undone.')) return
    setDeleting(true)
    setError(false)
    try {
      const res = await fetch(`/api/articles/${articleId}`, { method: 'DELETE' })
      if (!res.ok) {
        setError(true)
        setDeleting(false)
        return
      }
      // Re-fetch the server component list so the row disappears.
      router.refresh()
    } catch {
      setError(true)
      setDeleting(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      title={error ? 'Failed — click to retry' : 'Delete article'}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border transition-colors disabled:opacity-50 ${
        error
          ? 'border-red-200 text-red-600 hover:bg-red-50'
          : 'border-[rgba(184,115,51,0.2)] text-[var(--cream-dim)] hover:bg-red-50 hover:text-red-600 hover:border-red-200'
      }`}
    >
      {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
      {error ? 'Retry' : 'Delete'}
    </button>
  )
}
