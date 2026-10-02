'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { SavedKeyword } from '@/lib/supabase/types'
import {
  Bookmark, ChevronDown, ChevronUp, Loader2, Trash2, Pencil, Check,
  X, Sparkles, FileText, AlertCircle,
} from 'lucide-react'

function DifficultyBar({ value }: { value: number | null }) {
  if (value === null) return <span className="text-[var(--cream-dim)]">—</span>
  const color = value < 30 ? 'bg-green-400' : value < 60 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2">
      <div className="w-14 h-1.5 bg-[var(--ink-deep)] rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-[var(--cream-dim)] tabular-nums">{value}</span>
    </div>
  )
}

export default function SavedKeywordsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [grouped, setGrouped] = useState<Record<string, SavedKeyword[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set())
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [writingId, setWritingId] = useState<string | null>(null)

  // Folder rename state
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renaming, setRenaming] = useState(false)

  const fetchSaved = useCallback(async () => {
    const res = await fetch('/api/keywords/saved')
    if (!res.ok) { setError('Failed to load saved keywords'); setLoading(false); return }
    const { grouped: g } = await res.json()
    setGrouped(g ?? {})
    setOpenFolders(new Set(Object.keys(g ?? {})))
    setLoading(false)
  }, [])

  useEffect(() => { fetchSaved() }, [fetchSaved])

  function toggleFolder(folder: string) {
    setOpenFolders((prev) => {
      const next = new Set(prev)
      next.has(folder) ? next.delete(folder) : next.add(folder)
      return next
    })
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Remove this saved keyword?')) return
    setDeletingId(id)
    await fetch('/api/keywords/saved', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setGrouped((prev) => {
      const next: Record<string, SavedKeyword[]> = {}
      for (const [folder, kws] of Object.entries(prev)) {
        const filtered = kws.filter((k) => k.id !== id)
        if (filtered.length) next[folder] = filtered
      }
      return next
    })
    setDeletingId(null)
  }

  async function handleWriteArticle(kw: SavedKeyword) {
    setWritingId(kw.id)
    try {
      // Create a blank article
      const res = await fetch('/api/articles', { method: 'POST' })
      if (!res.ok) { setWritingId(null); return }
      const { articleId } = await res.json()

      // Set target_keyword directly via Supabase client
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('articles')
        .update({ target_keyword: kw.keyword })
        .eq('id', articleId)

      // Mark has_article on saved keyword
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('saved_keywords')
        .update({ has_article: true, article_id: articleId })
        .eq('id', kw.id)

      router.push(`/articles/${articleId}`)
    } catch {
      setWritingId(null)
    }
  }

  async function handleRenameFolder(oldFolder: string) {
    const newFolder = renameValue.trim()
    if (!newFolder || newFolder === oldFolder) { setRenamingFolder(null); return }
    setRenaming(true)
    await fetch('/api/keywords/saved', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldFolder, newFolder }),
    })
    setGrouped((prev) => {
      const next: Record<string, SavedKeyword[]> = {}
      for (const [folder, kws] of Object.entries(prev)) {
        next[folder === oldFolder ? newFolder : folder] = kws.map((k) =>
          k.folder === oldFolder ? { ...k, folder: newFolder } : k
        )
      }
      return next
    })
    setOpenFolders((prev) => {
      const next = new Set(prev)
      if (next.has(oldFolder)) { next.delete(oldFolder); next.add(newFolder) }
      return next
    })
    setRenaming(false)
    setRenamingFolder(null)
  }

  const folderEntries = Object.entries(grouped).sort(([a], [b]) => {
    if (a === 'General') return 1
    if (b === 'General') return -1
    return a.localeCompare(b)
  })

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--cream)]">Saved Keywords</h1>
          <p className="mt-1 text-sm text-[var(--cream-dim)]">Keywords saved for future articles, organised by folder.</p>
          <div className="flex gap-1 mt-3">
            <Link
              href="/keywords"
              className="px-3 py-1 text-xs font-medium rounded-full bg-[var(--ink-deep)] text-[var(--cream-dim)] hover:bg-[var(--ink-deep)] transition-colors"
            >
              Projects
            </Link>
            <span className="px-3 py-1 text-xs font-medium rounded-full bg-[#B87333] text-white">
              <Bookmark className="w-3 h-3 inline mr-1 -mt-px" />
              Saved Keywords
            </span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--cream-faint)]" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-red-600 text-sm">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      ) : folderEntries.length === 0 ? (
        <div className="border-2 border-dashed border-[rgba(184,115,51,0.2)] rounded-2xl p-12 text-center">
          <div className="inline-flex p-3 bg-violet-50 rounded-xl mb-4">
            <Bookmark className="w-6 h-6 text-violet-500" />
          </div>
          <h3 className="text-base font-semibold text-[var(--cream-dim)] mb-2">No saved keywords yet</h3>
          <p className="text-sm text-[var(--cream-dim)] mb-4">
            Run a keyword research project and bookmark keywords using the
            {' '}<Bookmark className="w-3.5 h-3.5 inline" />{' '}icon on each row.
          </p>
          <Link
            href="/keywords"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#B87333] text-white text-sm font-medium rounded-lg hover:bg-[#A0622A] transition-colors"
          >
            Go to Projects
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {folderEntries.map(([folder, kws]) => (
            <div key={folder} className="bg-[var(--ink)] border border-[rgba(184,115,51,0.2)] rounded-xl overflow-hidden">
              {/* Folder header */}
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[var(--ink-card)] transition-colors"
                onClick={() => toggleFolder(folder)}
              >
                <div className="flex items-center gap-2">
                  {renamingFolder === folder ? (
                    <form
                      onSubmit={(e) => { e.preventDefault(); handleRenameFolder(folder) }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1.5"
                    >
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        className="px-2 py-1 text-sm border border-[rgba(184,115,51,0.3)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B87333] w-40"
                      />
                      <button type="submit" disabled={renaming} className="p-1 text-green-600 hover:text-green-700">
                        {renaming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      </button>
                      <button type="button" onClick={() => setRenamingFolder(null)} className="p-1 text-[var(--cream-faint)] hover:text-[var(--cream-dim)]">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  ) : (
                    <>
                      <span className="font-semibold text-sm text-[var(--cream)]">{folder}</span>
                      <span className="text-xs text-[var(--cream-faint)] bg-[var(--ink-deep)] px-1.5 py-0.5 rounded-full">{kws.length}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setRenamingFolder(folder)
                          setRenameValue(folder)
                        }}
                        className="p-1 text-[var(--cream-dim)] hover:text-[var(--cream-dim)] transition-colors opacity-0 group-hover:opacity-100"
                        title="Rename folder"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
                {openFolders.has(folder)
                  ? <ChevronUp className="w-4 h-4 text-[var(--cream-faint)]" />
                  : <ChevronDown className="w-4 h-4 text-[var(--cream-faint)]" />
                }
              </div>

              {/* Keywords table */}
              {openFolders.has(folder) && (
                <table className="w-full text-sm border-t border-[rgba(184,115,51,0.15)]">
                  <thead>
                    <tr className="bg-[var(--ink-card)]">
                      <th className="text-left px-4 py-2.5 font-medium text-[var(--cream-dim)]">Keyword</th>
                      <th className="text-left px-4 py-2.5 font-medium text-[var(--cream-dim)]">Volume</th>
                      <th className="text-left px-4 py-2.5 font-medium text-[var(--cream-dim)]">Difficulty</th>
                      <th className="text-left px-4 py-2.5 font-medium text-[var(--cream-dim)]">CPC</th>
                      <th className="text-left px-4 py-2.5 font-medium text-[var(--cream-dim)]">Status</th>
                      <th className="w-24" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {kws.map((kw) => (
                      <tr key={kw.id} className="hover:bg-[var(--ink-card)] transition-colors">
                        <td className="px-4 py-2.5 font-medium text-[var(--cream)]">{kw.keyword}</td>
                        <td className="px-4 py-2.5 tabular-nums text-[var(--cream-dim)]">
                          {kw.volume != null ? kw.volume.toLocaleString() : <span className="text-[var(--cream-dim)]">—</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          <DifficultyBar value={kw.difficulty} />
                        </td>
                        <td className="px-4 py-2.5 tabular-nums text-[var(--cream-dim)]">
                          {kw.cpc != null ? `$${Number(kw.cpc).toFixed(2)}` : <span className="text-[var(--cream-dim)]">—</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          {kw.has_article ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700">
                              <FileText className="w-3 h-3" />
                              Has article
                            </span>
                          ) : (
                            <span className="text-xs text-[var(--cream-faint)]">No article yet</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1 justify-end">
                            {!kw.has_article && (
                              <button
                                onClick={() => handleWriteArticle(kw)}
                                disabled={writingId === kw.id}
                                title="Write article for this keyword"
                                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg text-[var(--copper)] border border-[rgba(184,115,51,0.25)] hover:bg-[rgba(184,115,51,0.08)] disabled:opacity-50 transition-colors"
                              >
                                {writingId === kw.id
                                  ? <Loader2 className="w-3 h-3 animate-spin" />
                                  : <Sparkles className="w-3 h-3" />
                                }
                                Write
                              </button>
                            )}
                            {kw.has_article && kw.article_id && (
                              <button
                                onClick={() => router.push(`/articles/${kw.article_id}`)}
                                title="View article"
                                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg text-[var(--cream-dim)] border border-[rgba(184,115,51,0.2)] hover:bg-[var(--ink-card)] transition-colors"
                              >
                                <FileText className="w-3 h-3" />
                                View
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(kw.id)}
                              disabled={deletingId === kw.id}
                              title="Remove"
                              className="p-1.5 text-[var(--cream-dim)] hover:text-red-500 transition-colors rounded disabled:opacity-50"
                            >
                              {deletingId === kw.id
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Trash2 className="w-3.5 h-3.5" />
                              }
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
