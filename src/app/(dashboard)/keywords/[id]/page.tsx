'use client'

import { useEffect, useState, useCallback, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { KeywordProject } from '@/lib/supabase/types'
import {
  ArrowLeft, Sparkles, Loader2, AlertCircle, CheckCircle2,
  ChevronUp, ChevronDown, BookmarkPlus, X, Bookmark, RefreshCw,
} from 'lucide-react'

interface Keyword {
  id: string
  project_id: string
  keyword: string
  avg_monthly_searches: number | null
  competition: string | null
  competition_index: number | null
  cpc: number | null
  keyword_difficulty: number | null
  cluster: string | null
  selected: boolean
}

type SortField = 'keyword' | 'avg_monthly_searches' | 'keyword_difficulty' | 'cpc'
type SortDir = 'asc' | 'desc'

const COMPETITION_COLORS: Record<string, string> = {
  LOW: 'text-green-600 bg-green-50',
  MEDIUM: 'text-amber-600 bg-amber-50',
  HIGH: 'text-red-600 bg-red-50',
}

type ToastStage = 'fetching' | 'clustering' | 'saving' | 'complete' | 'error'

const TOAST_CONFIG: Record<ToastStage, { label: string; progress: number }> = {
  fetching:   { label: 'Fetching keywords…',  progress: 25 },
  clustering: { label: 'Clustering topics…',  progress: 60 },
  saving:     { label: 'Saving results…',      progress: 85 },
  complete:   { label: 'Complete!',            progress: 100 },
  error:      { label: 'Research failed',      progress: 100 },
}

function DifficultyBar({ value }: { value: number | null }) {
  if (value === null) return <span className="text-gray-300">—</span>
  const color = value < 30 ? 'bg-green-400' : value < 60 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-gray-600 tabular-nums">{value}</span>
    </div>
  )
}

function SortHeader({
  label, field, sort, onSort,
}: { label: string; field: SortField; sort: { field: SortField; dir: SortDir }; onSort: (f: SortField) => void }) {
  const active = sort.field === field
  return (
    <button
      onClick={() => onSort(field)}
      className="flex items-center gap-1 text-left font-medium text-gray-500 hover:text-gray-700 group"
    >
      {label}
      <span className="flex flex-col -space-y-1">
        <ChevronUp className={`w-3 h-3 ${active && sort.dir === 'asc' ? 'text-indigo-600' : 'text-gray-300 group-hover:text-gray-400'}`} />
        <ChevronDown className={`w-3 h-3 ${active && sort.dir === 'desc' ? 'text-indigo-600' : 'text-gray-300 group-hover:text-gray-400'}`} />
      </span>
    </button>
  )
}

export default function KeywordProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()

  const [project, setProject] = useState<KeywordProject | null>(null)
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [loading, setLoading] = useState(true)
  const [researching, setResearching] = useState(false)
  const [researchError, setResearchError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedCount, setSavedCount] = useState(0)
  const [activeCluster, setActiveCluster] = useState<string>('All')
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: 'avg_monthly_searches', dir: 'desc' })
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Save-for-later state
  const [saveMenu, setSaveMenu] = useState<{ kwId: string } | null>(null)
  const [savedFolders, setSavedFolders] = useState<string[]>([])
  const [newFolderText, setNewFolderText] = useState('')
  const [showNewFolderFor, setShowNewFolderFor] = useState<string | null>(null)
  const [savingKw, setSavingKw] = useState<string | null>(null)
  const [savedKwIds, setSavedKwIds] = useState<Set<string>>(new Set())

  const [toastVisible, setToastVisible] = useState(false)
  const [toastStage, setToastStage] = useState<ToastStage>('fetching')
  const [toastErrorMsg, setToastErrorMsg] = useState<string | null>(null)
  const stageTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  const fetchData = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: proj } = await (supabase as any)
      .from('keyword_projects')
      .select('*')
      .eq('id', id)
      .single()
    setProject(proj as KeywordProject)

    if (proj?.status === 'complete') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: kws } = await (supabase as any)
        .from('keywords')
        .select('*')
        .eq('project_id', id)
        .order('avg_monthly_searches', { ascending: false })
      setKeywords((kws as Keyword[]) ?? [])

      // Pre-check already-selected keywords
      const alreadySelected = new Set<string>(
        ((kws as Keyword[]) ?? []).filter((k) => k.selected).map((k) => k.id)
      )
      setSelected(alreadySelected)
    }

    setLoading(false)
  }, [id, supabase])

  useEffect(() => { fetchData() }, [fetchData])

  // Auto-start research when a freshly-created project lands here in 'pending' state.
  const autoResearched = useRef(false)
  useEffect(() => {
    if (project?.status === 'pending' && !autoResearched.current) {
      autoResearched.current = true
      handleResearch()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.status])

  // Poll every 4 s while research is running so the UI updates when it completes.
  useEffect(() => {
    if (!project || (project.status !== 'pending' && project.status !== 'researching')) return
    const timer = setInterval(fetchData, 4000)
    return () => clearInterval(timer)
  }, [project?.status, fetchData])

  // Clean up any pending toast timers when navigating away.
  useEffect(() => {
    return () => { stageTimers.current.forEach(clearTimeout) }
  }, [])

  async function handleResearch() {
    if (!project) return
    setResearching(true)
    setResearchError(null)

    // Show toast and schedule optimistic stage advances
    stageTimers.current.forEach(clearTimeout)
    stageTimers.current = []
    setToastErrorMsg(null)
    setToastStage('fetching')
    setToastVisible(true)
    stageTimers.current.push(setTimeout(() => setToastStage('clustering'), 7000))
    stageTimers.current.push(setTimeout(() => setToastStage('saving'), 14000))

    // Use seeds from research_brief if the project was created via discovery chat
    const brief = project.research_brief as { seed_keywords?: string[] } | null
    const seeds = brief?.seed_keywords
    const researchBody: Record<string, unknown> = { project_id: id }
    if (seeds?.length) {
      researchBody.seeds = seeds
      researchBody.brief = project.research_brief
    } else {
      researchBody.seed_topic = project.seed_topic
    }

    const res = await fetch('/api/keywords/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(researchBody),
    })

    // API resolved — cancel any pending stage advances
    stageTimers.current.forEach(clearTimeout)
    stageTimers.current = []

    const json = await res.json()

    if (!res.ok) {
      const msg = json.error ?? 'Research failed'
      setResearchError(msg)
      setToastStage('error')
      setToastErrorMsg(msg)
      stageTimers.current.push(setTimeout(() => setToastVisible(false), 6000))
      setResearching(false)
      fetchData()
      return
    }

    setToastStage('complete')
    stageTimers.current.push(setTimeout(() => setToastVisible(false), 3000))
    setResearching(false)
    fetchData()
  }

  async function handleSaveSelected() {
    if (selected.size === 0) return
    setSaving(true)

    const ids = Array.from(selected)

    // Mark selected=true for checked, false for unchecked
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('keywords')
      .update({ selected: true })
      .in('id', ids)

    // Unmark any previously selected that are now unchecked
    const unselectedIds = keywords.filter((k) => !selected.has(k.id)).map((k) => k.id)
    if (unselectedIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('keywords')
        .update({ selected: false })
        .in('id', unselectedIds)
    }

    setSavedCount(ids.length)
    setSaving(false)
    setTimeout(() => setSavedCount(0), 3000)
  }

  async function loadFolders() {
    if (savedFolders.length > 0) return
    const res = await fetch('/api/keywords/saved')
    if (!res.ok) { setSavedFolders(['General']); return }
    const { keywords } = await res.json()
    const folders = [...new Set<string>((keywords ?? []).map((k: { folder: string }) => k.folder))]
    setSavedFolders(folders.length ? folders : ['General'])
  }

  async function handleSaveKeyword(kw: Keyword, folder: string) {
    setSavingKw(kw.id)
    setSaveMenu(null)
    setShowNewFolderFor(null)
    await fetch('/api/keywords/saved', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword: kw.keyword,
        volume: kw.avg_monthly_searches,
        difficulty: kw.keyword_difficulty,
        cpc: kw.cpc,
        folder,
      }),
    })
    setSavedKwIds((prev) => new Set([...prev, kw.id]))
    setSavingKw(null)
    // Add new folder to local list if not already there
    if (!savedFolders.includes(folder)) setSavedFolders((prev) => [...prev, folder])
  }

  function toggleSort(field: SortField) {
    setSort((prev) =>
      prev.field === field
        ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { field, dir: 'desc' }
    )
  }

  function toggleSelect(kwId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(kwId) ? next.delete(kwId) : next.add(kwId)
      return next
    })
  }

  function toggleAll(visible: Keyword[]) {
    const visibleIds = visible.map((k) => k.id)
    const allChecked = visibleIds.every((id) => selected.has(id))
    setSelected((prev) => {
      const next = new Set(prev)
      if (allChecked) visibleIds.forEach((id) => next.delete(id))
      else visibleIds.forEach((id) => next.add(id))
      return next
    })
  }

  // Close save dropdown on outside click
  useEffect(() => {
    if (!saveMenu) return
    function handle() { setSaveMenu(null); setShowNewFolderFor(null) }
    document.addEventListener('click', handle)
    return () => document.removeEventListener('click', handle)
  }, [saveMenu])

  // Cluster tabs
  const clusters = ['All', ...Array.from(new Set(keywords.map((k) => k.cluster ?? 'Other'))).sort()]

  // Filter + sort
  const filtered = keywords
    .filter((k) => activeCluster === 'All' || k.cluster === activeCluster)
    .sort((a, b) => {
      const aVal = a[sort.field] ?? -Infinity
      const bVal = b[sort.field] ?? -Infinity
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sort.dir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sort.dir === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number)
    })

  const allVisibleSelected = filtered.length > 0 && filtered.every((k) => selected.has(k.id))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="p-8">
        <p className="text-gray-500">Project not found.</p>
      </div>
    )
  }

  const lastResearched = project.last_researched_at ? new Date(project.last_researched_at) : null
  const daysSinceResearch = lastResearched
    ? Math.floor((Date.now() - lastResearched.getTime()) / (1000 * 60 * 60 * 24))
    : null
  const isDataStale = daysSinceResearch !== null ? daysSinceResearch >= 90 : keywords.length > 0

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <button
            onClick={() => router.push('/keywords')}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-3 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Keywords
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
          <p className="mt-0.5 text-sm text-gray-500">Seed: <span className="font-medium text-gray-700">{project.seed_topic}</span></p>
        </div>

        {project.status === 'pending' && (
          <button
            onClick={handleResearch}
            disabled={researching}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
          >
            {researching ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Researching…</>
            ) : (
              <><Sparkles className="w-4 h-4" /> Start Research</>
            )}
          </button>
        )}

        {project.status === 'complete' && keywords.length > 0 && (
          <div className="flex flex-col items-end gap-2">
            {/* Staleness badge + refresh control */}
            <div className="flex flex-col items-end gap-1">
              {daysSinceResearch !== null && (
                <span className="text-xs text-gray-400">
                  Last updated {daysSinceResearch === 0 ? 'today' : `${daysSinceResearch} day${daysSinceResearch !== 1 ? 's' : ''} ago`}
                </span>
              )}
              {isDataStale ? (
                <button
                  onClick={handleResearch}
                  disabled={researching}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-medium rounded-lg hover:bg-amber-100 disabled:opacity-60 transition-colors"
                >
                  {researching
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <RefreshCw className="w-3.5 h-3.5" />}
                  Data may be stale — Refresh
                </button>
              ) : (
                <button
                  onClick={handleResearch}
                  disabled={researching}
                  className="text-xs text-gray-400 hover:text-indigo-500 transition-colors disabled:opacity-60"
                >
                  {researching ? 'Refreshing…' : 'Refresh data'}
                </button>
              )}
            </div>

            {/* Save selected */}
            <button
              onClick={handleSaveSelected}
              disabled={saving || selected.size === 0}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
              ) : savedCount > 0 ? (
                <><CheckCircle2 className="w-4 h-4" /> Saved {savedCount}</>
              ) : (
                <><BookmarkPlus className="w-4 h-4" /> Save {selected.size > 0 ? `${selected.size} ` : ''}Selected</>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Error */}
      {researchError && (
        <div className="mb-6 flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <div className="text-sm text-red-700">
            <span className="font-medium">Research failed:</span> {researchError}
          </div>
        </div>
      )}

      {/* Pending state */}
      {project.status === 'pending' && !researching && (
        <div className="border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center">
          <div className="inline-flex p-3 bg-indigo-50 rounded-xl mb-4">
            <Sparkles className="w-6 h-6 text-indigo-500" />
          </div>
          <h3 className="text-base font-semibold text-gray-700 mb-2">Ready to research</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            Click &quot;Start Research&quot; to fetch 50 keyword ideas from DataForSEO and automatically cluster them by topic.
          </p>
        </div>
      )}

      {/* Researching state */}
      {(project.status === 'researching' || researching) && (
        <div className="border-2 border-dashed border-indigo-100 rounded-2xl p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400 mx-auto mb-4" />
          <h3 className="text-base font-semibold text-gray-700 mb-1">Researching keywords…</h3>
          <p className="text-sm text-gray-400">Fetching data + clustering with AI. Takes ~10 seconds.</p>
        </div>
      )}

      {/* Keywords table */}
      {project.status === 'complete' && keywords.length > 0 && (
        <>
          {/* Cluster tabs */}
          <div className="flex gap-1 mb-4 flex-wrap">
            {clusters.map((c) => (
              <button
                key={c}
                onClick={() => setActiveCluster(c)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                  activeCluster === c
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {c}
                {c !== 'All' && (
                  <span className={`ml-1.5 ${activeCluster === c ? 'text-indigo-200' : 'text-gray-400'}`}>
                    {keywords.filter((k) => k.cluster === c).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={() => toggleAll(filtered)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left">
                    <SortHeader label="Keyword" field="keyword" sort={sort} onSort={toggleSort} />
                  </th>
                  <th className="px-4 py-3 text-left">
                    <SortHeader label="Volume" field="avg_monthly_searches" sort={sort} onSort={toggleSort} />
                  </th>
                  <th className="px-4 py-3 text-left">
                    <SortHeader label="Difficulty" field="keyword_difficulty" sort={sort} onSort={toggleSort} />
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Competition</th>
                  <th className="px-4 py-3 text-left">
                    <SortHeader label="CPC" field="cpc" sort={sort} onSort={toggleSort} />
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Cluster</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((kw) => (
                  <tr
                    key={kw.id}
                    onClick={() => toggleSelect(kw.id)}
                    className={`cursor-pointer transition-colors ${selected.has(kw.id) ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
                  >
                    <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(kw.id)}
                        onChange={() => toggleSelect(kw.id)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-4 py-2.5 font-medium text-gray-800">{kw.keyword}</td>
                    <td className="px-4 py-2.5 tabular-nums text-gray-600">
                      {kw.avg_monthly_searches != null
                        ? kw.avg_monthly_searches.toLocaleString()
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <DifficultyBar value={kw.keyword_difficulty} />
                    </td>
                    <td className="px-4 py-2.5">
                      {kw.competition ? (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${COMPETITION_COLORS[kw.competition] ?? 'bg-gray-100 text-gray-600'}`}>
                          {kw.competition}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-gray-600">
                      {kw.cpc != null ? `$${kw.cpc.toFixed(2)}` : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        {kw.cluster ?? 'Other'}
                      </span>
                    </td>
                    <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <div className="relative">
                        <button
                          onClick={() => {
                            loadFolders()
                            setSaveMenu(saveMenu?.kwId === kw.id ? null : { kwId: kw.id })
                            setShowNewFolderFor(null)
                            setNewFolderText('')
                          }}
                          title={savedKwIds.has(kw.id) ? 'Saved' : 'Save for later'}
                          className={`p-1.5 rounded transition-colors ${
                            savedKwIds.has(kw.id) || savingKw === kw.id
                              ? 'text-indigo-500'
                              : 'text-gray-300 hover:text-indigo-400'
                          }`}
                        >
                          {savingKw === kw.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Bookmark className={`w-3.5 h-3.5 ${savedKwIds.has(kw.id) ? 'fill-indigo-500' : ''}`} />
                          }
                        </button>

                        {saveMenu?.kwId === kw.id && (
                          <div
                            className="absolute right-0 bottom-full mb-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-40 text-sm"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {[...new Set(['General', ...savedFolders])].map((f) => (
                              <button
                                key={f}
                                onClick={() => handleSaveKeyword(kw, f)}
                                className="w-full text-left px-3 py-2 hover:bg-gray-50 text-gray-700"
                              >
                                {f}
                              </button>
                            ))}
                            {showNewFolderFor === kw.id ? (
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault()
                                  if (newFolderText.trim()) handleSaveKeyword(kw, newFolderText.trim())
                                }}
                                className="border-t border-gray-100"
                              >
                                <input
                                  autoFocus
                                  value={newFolderText}
                                  onChange={(e) => setNewFolderText(e.target.value)}
                                  placeholder="Folder name…"
                                  className="w-full px-3 py-2 text-sm focus:outline-none"
                                />
                              </form>
                            ) : (
                              <button
                                onClick={() => { setShowNewFolderFor(kw.id); setNewFolderText('') }}
                                className="w-full text-left px-3 py-2 hover:bg-gray-50 text-indigo-600 font-medium border-t border-gray-100"
                              >
                                + New folder…
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between text-xs text-gray-400">
              <span>{filtered.length} keywords{activeCluster !== 'All' ? ` in "${activeCluster}"` : ''}</span>
              {selected.size > 0 && (
                <span className="text-indigo-600 font-medium">{selected.size} selected</span>
              )}
            </div>
          </div>
        </>
      )}

      {/* Research progress toast — bottom-right fixed card */}
      {toastVisible && (
        <div className="fixed bottom-5 right-5 z-50 w-72 bg-white rounded-xl shadow-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {toastStage === 'complete' ? (
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
              ) : toastStage === 'error' ? (
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              ) : (
                <Loader2 className="w-4 h-4 text-indigo-500 animate-spin shrink-0" />
              )}
              <span className="text-sm font-semibold text-gray-800">Keyword Research</span>
            </div>
            <button
              onClick={() => setToastVisible(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className={`text-xs mb-3 ${
            toastStage === 'error' ? 'text-red-600' :
            toastStage === 'complete' ? 'text-green-600' : 'text-gray-500'
          }`}>
            {TOAST_CONFIG[toastStage].label}
            {toastStage === 'error' && toastErrorMsg ? `: ${toastErrorMsg}` : ''}
          </p>

          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${
                toastStage === 'error' ? 'bg-red-400' :
                toastStage === 'complete' ? 'bg-green-400' : 'bg-indigo-500'
              }`}
              style={{ width: `${TOAST_CONFIG[toastStage].progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
