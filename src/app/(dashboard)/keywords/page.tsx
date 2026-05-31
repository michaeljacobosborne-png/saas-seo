'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { KeywordProject } from '@/lib/supabase/types'
import {
  Search, Plus, ChevronRight, Loader2, AlertCircle, CheckCircle2, Clock,
  Trash2, X, Send, Bookmark, Bot, Sparkles, ArrowRight,
} from 'lucide-react'

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
  const entries = Array.from(map.entries())
  const general = entries.filter(([k]) => k === 'General')
  const rest = entries.filter(([k]) => k !== 'General').sort(([a], [b]) => a.localeCompare(b))
  return [...rest, ...general]
}

type DiscoverMode = 'choose' | 'direct' | 'agent'
type Message = { role: 'user' | 'assistant'; content: string }

interface ResearchBrief {
  topic: string
  audience: string
  intent: string
  competitors: string[]
  seed_keywords: string[]
}

export default function KeywordsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [projects, setProjects] = useState<KeywordProject[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Discovery panel
  const [showDiscover, setShowDiscover] = useState(false)
  const [discoverMode, setDiscoverMode] = useState<DiscoverMode>('choose')
  const [discoverMessages, setDiscoverMessages] = useState<Message[]>([])
  const [discoverInput, setDiscoverInput] = useState('')
  const [discoverStreaming, setDiscoverStreaming] = useState(false)
  const [brief, setBrief] = useState<ResearchBrief | null>(null)
  const [creatingProject, setCreatingProject] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  // Direct keyword path
  const [directKeyword, setDirectKeyword] = useState('')
  const [directRunning, setDirectRunning] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const discoverInitialized = useRef(false)

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

  useEffect(() => { fetchProjects() }, [fetchProjects])

  // Stream a discovery conversation turn
  const streamDiscovery = useCallback(async (apiMessages: Message[]) => {
    setDiscoverStreaming(true)
    setDiscoverMessages((prev) => [...prev, { role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/keywords/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      })

      if (!res.ok || !res.body) {
        setDiscoverMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: 'Something went wrong. Please try again.' }
          return updated
        })
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        accumulated += chunk
        setDiscoverMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = { ...updated[updated.length - 1], content: accumulated }
          return updated
        })
      }

      // Detect completed research brief
      const match = accumulated.match(/<research_brief>\s*([\s\S]*?)\s*<\/research_brief>/)
      if (match) {
        try { setBrief(JSON.parse(match[1])) } catch { /* invalid JSON — keep chatting */ }
      }
    } finally {
      setDiscoverStreaming(false)
    }
  }, [])

  // Auto-trigger first question when user picks the agent path
  useEffect(() => {
    if (showDiscover && discoverMode === 'agent' && !discoverInitialized.current) {
      discoverInitialized.current = true
      streamDiscovery([{ role: 'user', content: 'ready' }])
    }
  }, [showDiscover, discoverMode, streamDiscovery])

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [discoverMessages])

  function openDiscover() {
    discoverInitialized.current = false
    setDiscoverMode('choose')
    setDiscoverMessages([])
    setBrief(null)
    setDiscoverInput('')
    setDirectKeyword('')
    setCreateError(null)
    setShowDiscover(true)
  }

  async function handleDiscoverSend() {
    const text = discoverInput.trim()
    if (!text || discoverStreaming) return

    const updatedMessages: Message[] = [...discoverMessages, { role: 'user', content: text }]
    setDiscoverMessages(updatedMessages)
    setDiscoverInput('')

    // Prepend hidden trigger so the model always has a valid first user turn
    await streamDiscovery([{ role: 'user', content: 'ready' }, ...updatedMessages])
  }

  async function handleDirectResearch() {
    const kw = directKeyword.trim()
    if (!kw || directRunning) return
    setDirectRunning(true)
    setCreateError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setDirectRunning(false); return }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('keyword_projects')
      .insert({
        user_id: user.id,
        name: kw,
        seed_topic: kw,
        status: 'pending',
      })
      .select('id')
      .single()

    if (error || !data) {
      setCreateError(error?.message ?? 'Failed to create project')
      setDirectRunning(false)
      return
    }

    router.push(`/keywords/${(data as { id: string }).id}`)
  }

  async function handleRunResearch() {
    if (!brief || creatingProject) return
    setCreatingProject(true)
    setCreateError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setCreatingProject(false); return }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('keyword_projects')
      .insert({
        user_id: user.id,
        name: brief.topic,
        seed_topic: brief.topic,
        status: 'pending',
        research_brief: brief,
      })
      .select('id')
      .single()

    if (error || !data) {
      setCreateError(error?.message ?? 'Failed to create project')
      setCreatingProject(false)
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Keyword Research</h1>
          <p className="mt-1 text-sm text-gray-500">
            Discover high-value keywords for your content strategy.
          </p>
          <div className="flex gap-1 mt-3">
            <span className="px-3 py-1 text-xs font-medium rounded-full bg-indigo-600 text-white">
              Projects
            </span>
            <Link
              href="/keywords/saved"
              className="px-3 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
            >
              <Bookmark className="w-3 h-3 inline mr-1 -mt-px" />
              Saved Keywords
            </Link>
          </div>
        </div>
        <button
          onClick={openDiscover}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Research
        </button>
      </div>

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
            Start a conversation with the AI research assistant to discover targeted keywords.
          </p>
          <button
            onClick={openDiscover}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Research
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

      {/* Discovery panel */}
      {showDiscover && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          {/* Header */}
          <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-50 rounded-lg">
                <Bot className="w-4 h-4 text-violet-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 text-sm">New Research</h2>
                <p className="text-xs text-gray-400">
                  {discoverMode === 'agent' ? 'AI discovery · Haiku' : discoverMode === 'direct' ? 'Direct keyword' : 'Choose a path'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowDiscover(false)}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Path chooser */}
          {discoverMode === 'choose' && (
            <div className="flex-1 flex items-center justify-center px-6 py-10">
              <div className="w-full max-w-2xl">
                <p className="text-center text-sm text-gray-500 mb-6">How do you want to start?</p>
                <div className="grid grid-cols-2 gap-4">

                  {/* Direct path — secondary */}
                  <button
                    onClick={() => setDiscoverMode('direct')}
                    className="group flex flex-col items-start text-left p-5 rounded-2xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all"
                  >
                    <div className="p-2.5 bg-gray-100 rounded-xl mb-4 group-hover:bg-gray-200 transition-colors">
                      <Search className="w-5 h-5 text-gray-500" />
                    </div>
                    <h3 className="font-semibold text-gray-900 text-sm mb-1">I have a keyword</h3>
                    <p className="text-xs text-gray-500 leading-relaxed mb-4">
                      Enter a keyword and run research immediately. Best when you already know what you want to target.
                    </p>
                    <span className="mt-auto flex items-center gap-1 text-xs font-medium text-gray-600 group-hover:text-gray-800 transition-colors">
                      Use this path <ArrowRight className="w-3 h-3" />
                    </span>
                  </button>

                  {/* AI discovery path — featured */}
                  <button
                    onClick={() => setDiscoverMode('agent')}
                    className="group flex flex-col items-start text-left p-5 rounded-2xl border-2 border-indigo-500 bg-indigo-50 hover:bg-indigo-100 transition-all relative overflow-hidden"
                  >
                    <span className="absolute top-3.5 right-3.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-600 text-white tracking-wide">
                      RECOMMENDED
                    </span>
                    <div className="p-2.5 bg-indigo-100 rounded-xl mb-4 group-hover:bg-indigo-200 transition-colors">
                      <Sparkles className="w-5 h-5 text-indigo-600" />
                    </div>
                    <h3 className="font-semibold text-gray-900 text-sm mb-1">Help me find keywords</h3>
                    <p className="text-xs text-gray-600 leading-relaxed mb-4">
                      Answer 4 quick questions. The AI builds a research brief with 15–20 targeted seed keywords tailored to your audience.
                    </p>
                    <span className="mt-auto flex items-center gap-1 text-xs font-medium text-indigo-600 group-hover:text-indigo-700 transition-colors">
                      Start conversation <ArrowRight className="w-3 h-3" />
                    </span>
                  </button>

                </div>
              </div>
            </div>
          )}

          {/* Direct keyword path */}
          {discoverMode === 'direct' && (
            <div className="flex-1 flex items-center justify-center px-6 py-10">
              <div className="w-full max-w-md">
                <h3 className="text-base font-semibold text-gray-900 mb-1 text-center">Enter your keyword</h3>
                <p className="text-sm text-gray-500 text-center mb-6">
                  We&apos;ll fetch keyword ideas from DataForSEO and cluster them automatically.
                </p>
                <form
                  onSubmit={(e) => { e.preventDefault(); handleDirectResearch() }}
                  className="space-y-3"
                >
                  <input
                    type="text"
                    autoFocus
                    value={directKeyword}
                    onChange={(e) => setDirectKeyword(e.target.value)}
                    placeholder="e.g. saas content marketing"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  {createError && (
                    <p className="text-xs text-red-600">{createError}</p>
                  )}
                  <button
                    type="submit"
                    disabled={directRunning || !directKeyword.trim()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {directRunning
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating project…</>
                      : <><Search className="w-4 h-4" /> Run Research</>
                    }
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDiscoverMode('choose'); setCreateError(null) }}
                    className="w-full text-xs text-gray-400 hover:text-gray-600 py-1 transition-colors"
                  >
                    Back
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Agent path — chat messages */}
          {discoverMode === 'agent' && (
            <>
              <div className="flex-1 overflow-y-auto px-6 py-6">
                <div className="max-w-2xl mx-auto space-y-4">
                  {discoverMessages
                    .filter((m) => !m.content.includes('<research_brief>'))
                    .map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'assistant' && (
                          <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center mr-2.5 shrink-0 mt-0.5">
                            <Bot className="w-3.5 h-3.5 text-violet-600" />
                          </div>
                        )}
                        <div className={`max-w-lg rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-indigo-600 text-white rounded-br-sm'
                            : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                        }`}>
                          {msg.content
                            ? msg.content
                            : <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                          }
                        </div>
                      </div>
                    ))}
                  <div ref={chatEndRef} />
                </div>
              </div>

              {/* Brief summary card */}
              {brief && (
                <div className="shrink-0 border-t border-gray-100 bg-gray-50 px-6 py-5">
                  <div className="max-w-2xl mx-auto">
                    <div className="bg-white border border-indigo-200 rounded-xl p-4 mb-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-4 h-4 text-indigo-500" />
                        <h3 className="text-sm font-semibold text-gray-900">Research brief ready</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                        <div>
                          <span className="text-gray-400 font-medium">Topic</span>
                          <p className="text-gray-800 mt-0.5">{brief.topic}</p>
                        </div>
                        <div>
                          <span className="text-gray-400 font-medium">Intent</span>
                          <p className="text-gray-800 mt-0.5 capitalize">{brief.intent}</p>
                        </div>
                        <div className="col-span-2">
                          <span className="text-gray-400 font-medium">Audience</span>
                          <p className="text-gray-800 mt-0.5">{brief.audience}</p>
                        </div>
                        <div>
                          <span className="text-gray-400 font-medium">Competitors</span>
                          <p className="text-gray-800 mt-0.5">{brief.competitors.join(', ')}</p>
                        </div>
                        <div>
                          <span className="text-gray-400 font-medium">Seed keywords</span>
                          <p className="text-gray-800 mt-0.5">{brief.seed_keywords.length} phrases ready</p>
                        </div>
                      </div>
                    </div>
                    {createError && (
                      <p className="text-xs text-red-600 mb-3">{createError}</p>
                    )}
                    <button
                      onClick={handleRunResearch}
                      disabled={creatingProject}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      {creatingProject
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating project…</>
                        : <><Sparkles className="w-4 h-4" /> Run Research</>
                      }
                    </button>
                  </div>
                </div>
              )}

              {/* Chat input */}
              {!brief && (
                <div className="shrink-0 border-t border-gray-100 px-6 py-4">
                  <div className="max-w-2xl mx-auto flex gap-2">
                    <input
                      type="text"
                      value={discoverInput}
                      onChange={(e) => setDiscoverInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleDiscoverSend()
                        }
                      }}
                      placeholder="Type your answer…"
                      disabled={discoverStreaming}
                      className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
                    />
                    <button
                      onClick={handleDiscoverSend}
                      disabled={discoverStreaming || !discoverInput.trim()}
                      className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
