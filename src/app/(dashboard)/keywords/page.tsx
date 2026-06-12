'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { KeywordProject } from '@/lib/supabase/types'
import AnglePicker, { type Angle } from '@/components/AnglePicker'
import {
  Search, Plus, ChevronRight, Loader2, AlertCircle, CheckCircle2, Clock,
  Trash2, X, Send, Bookmark, Bot, Sparkles, ArrowRight,
} from 'lucide-react'

const STATUS_CONFIG = {
  pending: { label: 'Pending', icon: Clock, className: 'bg-[var(--ink-card)] text-[var(--cream-dim)]' },
  researching: { label: 'Researching…', icon: Loader2, className: 'bg-[var(--hover)] text-[var(--copper)]' },
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
// The agent path walks through topic entry → angle selection → the chat itself.
type AgentStage = 'topic' | 'angle' | 'chat'
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
  // Agent-path staging: collect a topic, pick a research angle, then chat.
  const [agentStage, setAgentStage] = useState<AgentStage>('topic')
  const [topicInput, setTopicInput] = useState('')
  const [topic, setTopic] = useState('')
  const [selectedAngle, setSelectedAngle] = useState<Angle | null>(null)
  // Mirrored into refs so streamDiscovery can read the latest values without
  // re-creating the callback (and re-firing the auto-start effect).
  const topicRef = useRef('')
  const angleRef = useRef<Angle | null>(null)
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
      const angle = angleRef.current
      const res = await fetch('/api/keywords/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          topic: topicRef.current || undefined,
          angle: angle ? { headline: angle.headline, description: angle.description } : undefined,
        }),
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

  // Auto-trigger the first question once the agent reaches the chat stage
  // (after topic + angle have been captured).
  useEffect(() => {
    if (showDiscover && discoverMode === 'agent' && agentStage === 'chat' && !discoverInitialized.current) {
      discoverInitialized.current = true
      streamDiscovery([{ role: 'user', content: 'ready' }])
    }
  }, [showDiscover, discoverMode, agentStage, streamDiscovery])

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [discoverMessages])

  function openDiscover() {
    discoverInitialized.current = false
    setDiscoverMode('choose')
    setAgentStage('topic')
    setTopicInput('')
    setTopic('')
    setSelectedAngle(null)
    topicRef.current = ''
    angleRef.current = null
    setDiscoverMessages([])
    setBrief(null)
    setDiscoverInput('')
    setDirectKeyword('')
    setCreateError(null)
    setShowDiscover(true)
  }

  // Topic entry → angle selection
  function handleTopicSubmit() {
    const t = topicInput.trim()
    if (!t) return
    setTopic(t)
    topicRef.current = t
    setAgentStage('angle')
  }

  function handleAngleSelect(angle: Angle) {
    setSelectedAngle(angle)
    angleRef.current = angle
    setAgentStage('chat')
  }

  function handleAngleSkip() {
    setSelectedAngle(null)
    angleRef.current = null
    setAgentStage('chat')
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
          <h1 className="text-2xl font-bold" style={{ color: 'var(--cream)' }}>Keyword Research</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--cream-dim)' }}>
            Discover high-value keywords for your content strategy.
          </p>
          <div className="flex gap-1 mt-3">
            <span className="px-3 py-1 text-xs font-medium rounded-full text-[var(--cream)]" style={{ background: 'var(--copper)' }}>
              Projects
            </span>
            <Link
              href="/keywords/saved"
              className="px-3 py-1 text-xs font-medium rounded-full transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              style={{ background: 'var(--ink-card)', color: 'var(--cream-dim)' }}
            >
              <Bookmark className="w-3 h-3 inline mr-1 -mt-px" />
              Saved Keywords
            </Link>
          </div>
        </div>
        <button
          onClick={openDiscover}
          className="flex items-center gap-2 px-4 py-2 text-[var(--cream)] text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
          style={{ background: 'var(--copper)' }}
        >
          <Plus className="w-4 h-4" />
          New Research
        </button>
      </div>

      {/* Projects list */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--cream-faint)' }} />
        </div>
      ) : projects.length === 0 ? (
        <div className="border-2 border-dashed rounded-2xl p-12 text-center" style={{ borderColor: 'var(--border)' }}>
          <div className="inline-flex p-3 bg-violet-50 rounded-xl mb-4">
            <Search className="w-6 h-6 text-violet-500" />
          </div>
          <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--cream-dim)' }}>No projects yet</h3>
          <p className="text-sm mb-4" style={{ color: 'var(--cream-dim)' }}>
            Start a conversation with the AI research assistant to discover targeted keywords.
          </p>
          <button
            onClick={openDiscover}
            className="inline-flex items-center gap-2 px-4 py-2 text-[var(--cream)] text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
            style={{ background: 'var(--copper)' }}
          >
            <Plus className="w-4 h-4" />
            New Research
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([folderName, folderProjects]) => (
            <div key={folderName}>
              <h2 className="text-xs font-semibold uppercase tracking-wider mb-2 px-1" style={{ color: 'var(--cream-faint)' }}>
                {folderName}
              </h2>
              <div className="border rounded-xl overflow-hidden" style={{ background: 'var(--ink)', borderColor: 'var(--border)' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b" style={{ borderColor: 'var(--border)', background: 'var(--ink-card)' }}>
                      <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--cream-dim)' }}>Project</th>
                      <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--cream-dim)' }}>Seed Topic</th>
                      <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--cream-dim)' }}>Status</th>
                      <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--cream-dim)' }}>Created</th>
                      <th className="w-16" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--border)]">
                    {folderProjects.map((p) => {
                      const status = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.pending
                      const StatusIcon = status.icon
                      return (
                        <tr
                          key={p.id}
                          onClick={() => router.push(`/keywords/${p.id}`)}
                          className="cursor-pointer transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                        >
                          <td className="px-4 py-3 font-medium" style={{ color: 'var(--cream)' }}>{p.name}</td>
                          <td className="px-4 py-3" style={{ color: 'var(--cream-dim)' }}>{p.seed_topic}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.className}`}>
                              <StatusIcon className={`w-3 h-3 ${p.status === 'researching' ? 'animate-spin' : ''}`} />
                              {status.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs" style={{ color: 'var(--cream-faint)' }}>
                            {new Date(p.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 justify-end">
                              <button
                                onClick={(e) => handleDelete(e, p.id, p.name)}
                                disabled={deletingId === p.id}
                                className="p-1.5 text-[var(--cream-dim)] hover:text-red-500 transition-colors rounded disabled:opacity-50"
                                title="Delete project"
                              >
                                {deletingId === p.id
                                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  : <Trash2 className="w-3.5 h-3.5" />
                                }
                              </button>
                              <ChevronRight className="w-4 h-4" style={{ color: 'var(--cream-dim)' }} />
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
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'var(--ink)' }}>
          {/* Header */}
          <div className="border-b px-6 py-4 flex items-center justify-between shrink-0" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-50 rounded-lg">
                <Bot className="w-4 h-4 text-violet-600" />
              </div>
              <div>
                <h2 className="font-semibold text-sm" style={{ color: 'var(--cream)' }}>New Research</h2>
                <p className="text-xs" style={{ color: 'var(--cream-faint)' }}>
                  {discoverMode === 'agent' ? 'AI discovery · Haiku' : discoverMode === 'direct' ? 'Direct keyword' : 'Choose a path'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowDiscover(false)}
              className="p-2 text-[var(--cream-faint)] hover:text-[var(--cream-dim)] transition-colors rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Path chooser */}
          {discoverMode === 'choose' && (
            <div className="flex-1 flex items-center justify-center px-6 py-10">
              <div className="w-full max-w-2xl">
                <p className="text-center text-sm mb-6" style={{ color: 'var(--cream-dim)' }}>How do you want to start?</p>
                <div className="grid grid-cols-2 gap-4">

                  {/* Direct path — secondary */}
                  <button
                    onClick={() => setDiscoverMode('direct')}
                    className="group flex flex-col items-start text-left p-5 rounded-2xl border transition-all hover:bg-black/5 dark:hover:bg-white/5"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <div className="p-2.5 rounded-xl mb-4" style={{ background: 'var(--ink-card)' }}>
                      <Search className="w-5 h-5" style={{ color: 'var(--cream-dim)' }} />
                    </div>
                    <h3 className="font-semibold text-sm mb-1" style={{ color: 'var(--cream)' }}>I have a keyword</h3>
                    <p className="text-xs leading-relaxed mb-4" style={{ color: 'var(--cream-dim)' }}>
                      Enter a keyword and run research immediately. Best when you already know what you want to target.
                    </p>
                    <span className="mt-auto flex items-center gap-1 text-xs font-medium text-[var(--cream-dim)] group-hover:text-[var(--cream)] transition-colors">
                      Use this path <ArrowRight className="w-3 h-3" />
                    </span>
                  </button>

                  {/* AI discovery path — featured */}
                  <button
                    onClick={() => setDiscoverMode('agent')}
                    className="group flex flex-col items-start text-left p-5 rounded-2xl border-2 bg-[rgba(184,115,51,0.08)] hover:bg-[rgba(184,115,51,0.12)] transition-all relative overflow-hidden"
                    style={{ borderColor: 'var(--copper)' }}
                  >
                    <span className="absolute top-3.5 right-3.5 text-[10px] font-semibold px-2 py-0.5 rounded-full text-[var(--cream)] tracking-wide" style={{ background: 'var(--copper)' }}>
                      RECOMMENDED
                    </span>
                    <div className="p-2.5 bg-[rgba(184,115,51,0.12)] rounded-xl mb-4 group-hover:bg-[rgba(184,115,51,0.2)] transition-colors">
                      <Sparkles className="w-5 h-5" style={{ color: 'var(--copper)' }} />
                    </div>
                    <h3 className="font-semibold text-sm mb-1" style={{ color: 'var(--cream)' }}>Help me find keywords</h3>
                    <p className="text-xs leading-relaxed mb-4" style={{ color: 'var(--cream-dim)' }}>
                      Answer 4 quick questions. The AI builds a research brief with 15–20 targeted seed keywords tailored to your audience.
                    </p>
                    <span className="mt-auto flex items-center gap-1 text-xs font-medium text-[var(--copper)] group-hover:text-[var(--copper-lt)] transition-colors">
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
                <h3 className="text-base font-semibold mb-1 text-center" style={{ color: 'var(--cream)' }}>Enter your keyword</h3>
                <p className="text-sm text-center mb-6" style={{ color: 'var(--cream-dim)' }}>
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
                    className="w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#B87333] focus:border-transparent"
                    style={{ background: 'var(--ink-card)', color: 'var(--cream)', borderColor: 'var(--border)' }}
                  />
                  {createError && (
                    <p className="text-xs text-red-600">{createError}</p>
                  )}
                  <button
                    type="submit"
                    disabled={directRunning || !directKeyword.trim()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 text-[var(--cream)] text-sm font-medium rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
                    style={{ background: 'var(--copper)' }}
                  >
                    {directRunning
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating project…</>
                      : <><Search className="w-4 h-4" /> Run Research</>
                    }
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDiscoverMode('choose'); setCreateError(null) }}
                    className="w-full text-xs text-[var(--cream-faint)] hover:text-[var(--cream-dim)] py-1 transition-colors"
                  >
                    Back
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Agent path — Stage 1: topic entry */}
          {discoverMode === 'agent' && agentStage === 'topic' && (
            <div className="flex-1 flex items-center justify-center px-6 py-10">
              <div className="w-full max-w-md">
                <h3 className="text-base font-semibold mb-1 text-center" style={{ color: 'var(--cream)' }}>What topic do you want to explore?</h3>
                <p className="text-sm text-center mb-6" style={{ color: 'var(--cream-dim)' }}>
                  We&apos;ll suggest a few research angles before building your brief.
                </p>
                <form
                  onSubmit={(e) => { e.preventDefault(); handleTopicSubmit() }}
                  className="space-y-3"
                >
                  <input
                    type="text"
                    autoFocus
                    value={topicInput}
                    onChange={(e) => setTopicInput(e.target.value)}
                    placeholder="e.g. content marketing for B2B SaaS"
                    className="w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#B87333] focus:border-transparent"
                    style={{ background: 'var(--ink-card)', color: 'var(--cream)', borderColor: 'var(--border)' }}
                  />
                  <button
                    type="submit"
                    disabled={!topicInput.trim()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 text-[var(--cream)] text-sm font-medium rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
                    style={{ background: 'var(--copper)' }}
                  >
                    <ArrowRight className="w-4 h-4" /> Continue
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscoverMode('choose')}
                    className="w-full text-xs text-[var(--cream-faint)] hover:text-[var(--cream-dim)] py-1 transition-colors"
                  >
                    Back
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Agent path — Stage 2: research angle picker */}
          {discoverMode === 'agent' && agentStage === 'angle' && (
            <div className="flex-1 overflow-y-auto px-6 py-10">
              <AnglePicker topic={topic} onSelect={handleAngleSelect} onSkip={handleAngleSkip} />
              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => setAgentStage('topic')}
                  className="text-xs text-[var(--cream-faint)] hover:text-[var(--cream-dim)] transition-colors"
                >
                  ← Change topic
                </button>
              </div>
            </div>
          )}

          {/* Agent path — Stage 3: chat messages */}
          {discoverMode === 'agent' && agentStage === 'chat' && (
            <>
              {selectedAngle && (
                <div className="shrink-0 border-b px-6 py-2.5" style={{ borderColor: 'var(--border)', background: 'var(--ink-card)' }}>
                  <div className="max-w-2xl mx-auto flex items-center gap-2 text-xs" style={{ color: 'var(--cream-dim)' }}>
                    <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--copper-lt)' }} />
                    <span style={{ color: 'var(--cream-faint)' }}>Angle:</span>
                    <span className="font-medium truncate" style={{ color: 'var(--cream)' }}>{selectedAngle.headline}</span>
                  </div>
                </div>
              )}
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
                        <div
                          className="max-w-lg rounded-2xl px-4 py-3 text-sm leading-relaxed"
                          style={
                            msg.role === 'user'
                              ? { background: 'var(--copper)', color: '#F7F3EC', borderBottomRightRadius: '0.25rem' }
                              : { background: 'var(--ink-card)', color: 'var(--cream)', borderBottomLeftRadius: '0.25rem' }
                          }
                        >
                          {msg.content
                            ? msg.content
                            : <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--cream-faint)' }} />
                          }
                        </div>
                      </div>
                    ))}
                  <div ref={chatEndRef} />
                </div>
              </div>

              {/* Brief summary card */}
              {brief && (
                <div className="shrink-0 border-t px-6 py-5" style={{ borderColor: 'var(--border)', background: 'var(--ink-card)' }}>
                  <div className="max-w-2xl mx-auto">
                    <div className="border rounded-xl p-4 mb-4 shadow-sm" style={{ background: 'var(--ink)', borderColor: 'var(--border)' }}>
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-4 h-4" style={{ color: 'var(--copper-lt)' }} />
                        <h3 className="text-sm font-semibold" style={{ color: 'var(--cream)' }}>Research brief ready</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                        <div>
                          <span className="font-medium" style={{ color: 'var(--cream-faint)' }}>Topic</span>
                          <p className="mt-0.5" style={{ color: 'var(--cream)' }}>{brief.topic}</p>
                        </div>
                        <div>
                          <span className="font-medium" style={{ color: 'var(--cream-faint)' }}>Intent</span>
                          <p className="mt-0.5 capitalize" style={{ color: 'var(--cream)' }}>{brief.intent}</p>
                        </div>
                        <div className="col-span-2">
                          <span className="font-medium" style={{ color: 'var(--cream-faint)' }}>Audience</span>
                          <p className="mt-0.5" style={{ color: 'var(--cream)' }}>{brief.audience}</p>
                        </div>
                        <div>
                          <span className="font-medium" style={{ color: 'var(--cream-faint)' }}>Competitors</span>
                          <p className="mt-0.5" style={{ color: 'var(--cream)' }}>{brief.competitors.join(', ')}</p>
                        </div>
                        <div>
                          <span className="font-medium" style={{ color: 'var(--cream-faint)' }}>Seed keywords</span>
                          <p className="mt-0.5" style={{ color: 'var(--cream)' }}>{brief.seed_keywords.length} phrases ready</p>
                        </div>
                      </div>
                    </div>
                    {createError && (
                      <p className="text-xs text-red-600 mb-3">{createError}</p>
                    )}
                    <button
                      onClick={handleRunResearch}
                      disabled={creatingProject}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 text-[var(--cream)] text-sm font-medium rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
                      style={{ background: 'var(--copper)' }}
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
                <div className="shrink-0 border-t px-6 py-4" style={{ borderColor: 'var(--border)' }}>
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
                      className="flex-1 px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#B87333] focus:border-transparent disabled:opacity-50"
                      style={{ background: 'var(--ink-card)', color: 'var(--cream)', borderColor: 'var(--border)' }}
                    />
                    <button
                      onClick={handleDiscoverSend}
                      disabled={discoverStreaming || !discoverInput.trim()}
                      className="p-2.5 text-[var(--cream)] rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
                      style={{ background: 'var(--copper)' }}
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
