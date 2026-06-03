'use client'

import { useState } from 'react'
import { Globe, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function PublishButton({
  articleId,
  initialStatus,
}: {
  articleId: string
  initialStatus: string
}) {
  const [status, setStatus] = useState(initialStatus)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const isPublished = status === 'published'
  const eligible = status === 'complete' || status === 'published'

  if (!eligible) return null

  async function toggle() {
    setLoading(true)
    const newStatus = isPublished ? 'complete' : 'published'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('articles')
      .update({ status: newStatus })
      .eq('id', articleId)
    if (!error) setStatus(newStatus)
    setLoading(false)
  }

  return (
    <button
      onClick={(e) => { e.preventDefault(); toggle() }}
      disabled={loading}
      title={isPublished ? 'Mark as Complete (unpublish)' : 'Mark as Published'}
      className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full border transition-colors disabled:opacity-50 ${
        isPublished
          ? 'border-[rgba(184,115,51,0.4)] text-[#B87333] bg-[rgba(184,115,51,0.08)]'
          : 'border-[rgba(184,115,51,0.2)] text-[#7A6555] hover:text-[#B87333] hover:border-[rgba(184,115,51,0.4)]'
      }`}
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Globe className="w-3 h-3" />}
      {isPublished ? 'Published' : 'Publish'}
    </button>
  )
}
