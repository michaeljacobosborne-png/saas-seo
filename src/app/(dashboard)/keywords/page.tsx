'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { KeywordProject } from '@/lib/supabase/types'
import { Search, Plus, ChevronRight, Loader2, AlertCircle, CheckCircle2, Clock, Trash2 } from 'lucide-react'

const STATUS_CONFIG = {
  pending: { label: 'Pending', icon: Clock, className: 'bg-gray-100 text-gray-600' },
  researching: { label: 'Researching…', icon: Loader2, className: 'bg-blue-50 text-blue-600' },
  complete: { label: 'Complete', icon: CheckCircle2, className: 'bg-green-50 text-green-700' },
  error: { label: 'Error', icon: AlertCircle, className: 'bg-red-50 text-red-600' },
}

function groupByFolder(projects: KeywordProject[]): [string, KeywordProject[]][] {
  const map = new Map<string, KeywordProject[]>()
  for (const p of projects) {
    const key = p.folder?.trim() || 'General'
    const arr = map.get(key) ?? []
    arr.push(p)
    map.set(key, arr)
  }
  // General always last
  const entries = Array.from(map.entries())
  const general = entries.filter(([k]) => k === 'General')
  const rest = entries.filter(([k]) => k !== 'General').sort(([a], [b]) => a.localeCompare(b))
  return [...rest, ...general]
}

export default function KeywordsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [projects, setProjects] = useState<KeywordProject[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [seedTopic, setSeedTopic] = useState('')
  const [folder, setFolder] = useState('')
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchProjects = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('keyword_projects')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setProjects((data as KeywordProject[]) ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setCreating(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('keyword_projects')
      .insert({
        user_id: user.id,
        name,
        seed_topic: seedTopic,
        folder: folder.trim() || null,
        status: 'pending',
      })
      .select('id')
      .single()

    if (error) {
      setFormError(error.message)
      setCreating(false)
      return
    }

    router.push(`/keywords/${(data as { id: string }).id}`)
  }

  async function handleDelete(e: React.MouseEvent, projectId: string, projectName: string) {
    e.stopPropagation()
    if (!window.confirm(`Delete "${projectName}" and all its keywords? This cannot be undone.`)) return

    setDeletingId(projectId)
    try {
      const res = await fetch(`/api/keywords/${projectId}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json()
        alert(body.error ?? 'Delete failed')
        return
      }
      setProjects((prev) => prev.filter((p) => p.id !== projectId))
    } finally {
      setDeletingId(null)
    }
  }

  const grouped = groupByFolder(projects)

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Keyword Research</h1>
          <p className="mt-1 text-sm text-gray-500">
            Discover high-value keywords for your content strategy.
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setName(''); setSeedTopic(''); setFolder('') }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      {/* New project form */}
      {showForm && (
        <div className="mb-6 bg-white border border-indigo-200 rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">New Keyword Project</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Q3 Blog Topics"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Seed Topic
                </label>
                <input
                  type="text"
                  required
                  value={seedTopic}
                  onChange={(e) => setSeedTopic(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="saas marketing software"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Folder <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input
                type="text"
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Blog Content, Competitor Research…"
              />
            </div>

            {formError && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{formError}</p>
            )}

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Create Project
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Projects list */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      ) : projects.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center">
          <div className="inline-flex p-3 bg-violet-50 rounded-xl mb-4">
            <Search className="w-6 h-6 text-violet-500" />
          </div>
          <h3 className="text-base font-semibold text-gray-700 mb-2">No projects yet</h3>
          <p className="text-sm text-gray-500 mb-4">
            Create a project with a seed topic and we&apos;ll find 50 related keywords with search volume data.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([folderName, folderProjects]) => (
            <div key={folderName}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2 px-1">
                {folderName}
              </h2>
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Project</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Seed Topic</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Created</th>
                      <th className="w-16" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {folderProjects.map((p) => {
                      const status = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.pending
                      const StatusIcon = status.icon
                      return (
                        <tr
                          key={p.id}
                          onClick={() => router.push(`/keywords/${p.id}`)}
                          className="hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                          <td className="px-4 py-3 text-gray-500">{p.seed_topic}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.className}`}>
                              <StatusIcon className={`w-3 h-3 ${p.status === 'researching' ? 'animate-spin' : ''}`} />
                              {status.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs">
                            {new Date(p.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 justify-end">
                              <button
                                onClick={(e) => handleDelete(e, p.id, p.name)}
                                disabled={deletingId === p.id}
                                className="p-1.5 text-gray-300 hover:text-red-500 transition-colors rounded disabled:opacity-50"
                                title="Delete project"
                              >
                                {deletingId === p.id
                                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  : <Trash2 className="w-3.5 h-3.5" />
                                }
                              </button>
                              <ChevronRight className="w-4 h-4 text-gray-300" />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
