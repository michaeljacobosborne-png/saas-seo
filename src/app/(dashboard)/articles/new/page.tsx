'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { KeywordProject, BrandProfile } from '@/lib/supabase/types'
import {
  ArrowLeft, ArrowRight, Sparkles, Loader2, CheckCircle2,
  AlertCircle, ChevronUp, ChevronDown, FileText, Info, Plus, X,
  MessageSquare, Send, Undo2,
} from 'lucide-react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OutlineSection = Record<string, any>
type OutlineChatMessage = { role: 'user' | 'system'; text: string }

interface Keyword {
  id: string
  keyword: string
  avg_monthly_searches: number | null
  keyword_difficulty: number | null
  cpc: number | null
  competition: string | null
  cluster: string | null
}

type SortField = 'avg_monthly_searches' | 'keyword_difficulty' | 'keyword'
type SortDir = 'asc' | 'desc'

const WORD_COUNT_OPTIONS = [800, 1200, 1800, 2500] as const
type WordCountOption = typeof WORD_COUNT_OPTIONS[number]

function suggestWordCount(keyword: string): WordCountOption {
  const kw = keyword.toLowerCase()
  if (/guide|how to|what is|best |complete/.test(kw)) return 1800
  if (/\bvs\b|review|alternative/.test(kw)) return 1200
  return 1200
}

function DifficultyBar({ value }: { value: number | null }) {
  if (value === null) return <span className="text-[var(--cream-dim)]">—</span>
  const color = value < 30 ? 'bg-green-400' : value < 60 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-[var(--ink-deep)] rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-[var(--cream-dim)] tabular-nums">{value}</span>
    </div>
  )
}

function StepIndicator({ current }: { current: number }) {
  const steps = ['Project', 'Keywords', 'Brief', 'Draft', 'Done']
  return (
    <div className="flex items-center gap-2 mb-8">
      {steps.map((label, i) => {
        const n = i + 1
        const done = n < current
        const active = n === current
        return (
          <div key={label} className="flex items-center gap-2">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors ${
              done ? 'bg-[#B87333] text-white' :
              active ? 'bg-[rgba(184,115,51,0.12)] text-[#A0622A] ring-2 ring-indigo-600' :
              'bg-[var(--ink-deep)] text-[var(--cream-faint)]'
            }`}>
              {done ? <CheckCircle2 className="w-4 h-4" /> : n}
            </div>
            <span className={`text-xs font-medium ${active ? 'text-[#A0622A]' : done ? 'text-[var(--cream-dim)]' : 'text-[var(--cream-faint)]'}`}>
              {label}
            </span>
            {i < steps.length - 1 && (
              <div className={`w-8 h-px mx-1 ${done ? 'bg-indigo-300' : 'bg-[var(--ink-deep)]'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function SortBtn({
  field, label, sortField, sortDir, onSort,
}: {
  field: SortField; label: string
  sortField: SortField; sortDir: SortDir
  onSort: (f: SortField) => void
}) {
  const active = sortField === field
  return (
    <button onClick={() => onSort(field)} className="flex items-center gap-1 font-medium text-[var(--cream-dim)] hover:text-[var(--cream-dim)] group">
      {label}
      <span className="flex flex-col -space-y-1">
        <ChevronUp className={`w-3 h-3 ${active && sortDir === 'asc' ? 'text-[var(--copper)]' : 'text-[var(--cream-dim)] group-hover:text-[var(--cream-faint)]'}`} />
        <ChevronDown className={`w-3 h-3 ${active && sortDir === 'desc' ? 'text-[var(--copper)]' : 'text-[var(--cream-dim)] group-hover:text-[var(--cream-faint)]'}`} />
      </span>
    </button>
  )
}

export default function NewArticlePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--cream-faint)]" />
        </div>
      }
    >
      <NewArticleWizard />
    </Suspense>
  )
}

function NewArticleWizard() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const projectParam = searchParams.get('project')
  const keywordParam = searchParams.get('keyword')

  // TODO(lead-magnet): pick up the audit funnel keyword and pre-fill the brief.
  // The /audit → /signup CTA stashes localStorage `byline_audit_intent` =
  //   { keyword: string, topic: string }  (also passed as ?audit_keyword=&audit_topic=).
  // Today this wizard requires a completed keyword *project*, so an audit keyword
  // has no project to attach to. Completing this means adding a single-keyword
  // entry path (e.g. seed an ad-hoc project / brief directly from the keyword),
  // then clearing the stash once consumed.

  const [step, setStep] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [projects, setProjects] = useState<KeywordProject[]>([])
  const [projectsLoading, setProjectsLoading] = useState(true)
  const [selectedProject, setSelectedProject] = useState<KeywordProject | null>(null)

  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [kwLoading, setKwLoading] = useState(false)
  const [selectedKws, setSelectedKws] = useState<Set<string>>(new Set())
  const [sortField, setSortField] = useState<SortField>('avg_monthly_searches')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [brandProfile, setBrandProfile] = useState<BrandProfile | null>(null)

  const [articleId, setArticleId] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [brief, setBrief] = useState<Record<string, any> | null>(null)
  const [targetWordCount, setTargetWordCount] = useState<WordCountOption>(1200)
  const [generatingStatus, setGeneratingStatus] = useState<'generating' | 'expanding' | 'expanded' | null>(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  // ─── Quick-write mode (skip keyword project, derive seeds from topic) ───
  const [writeMode, setWriteMode] = useState<'project' | 'quick'>('project')
  const [quickWriteTopic, setQuickWriteTopic] = useState('')

  // ─── Conversational outline editor (Step 3) ───
  const [outlineChatOpen, setOutlineChatOpen] = useState(false)
  const [outlineChatInput, setOutlineChatInput] = useState('')
  const [outlineChatMessages, setOutlineChatMessages] = useState<OutlineChatMessage[]>([])
  const [outlineChatSending, setOutlineChatSending] = useState(false)
  const [outlineToast, setOutlineToast] = useState(false)
  const [canUndoOutline, setCanUndoOutline] = useState(false)
  const previousOutlineRef = useRef<OutlineSection[] | null>(null)

  // Load initial data
  useEffect(() => {
    let active = true
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !active) return
      const [{ data: projs }, { data: brand }] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from('keyword_projects').select('*').eq('user_id', user.id).eq('status', 'complete').order('created_at', { ascending: false }),
        supabase.from('brand_profiles').select('*').eq('user_id', user.id).maybeSingle(),
      ])
      if (!active) return
      setProjects((projs as KeywordProject[]) ?? [])
      setBrandProfile(brand as BrandProfile | null)
      setProjectsLoading(false)
    }
    load()
    return () => { active = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // If arriving from the keywords page via ?project=<id>, auto-select that project
  // and skip Step 1. Only completed projects appear in `projects`, so a match here
  // means research is done — jump straight to keyword selection (Step 2).
  const autoSelected = useRef(false)
  useEffect(() => {
    if (autoSelected.current || !projectParam || projectsLoading) return
    const match = projects.find((p) => p.id === projectParam)
    if (match) {
      autoSelected.current = true
      setSelectedProject(match)
      setStep(2)
    }
  }, [projectParam, projectsLoading, projects])

  // Arriving from a "Quick Write" entry point via ?keyword=<phrase>: pre-fill the
  // quick-write topic and (once the brand profile has loaded) jump straight to
  // generating the brief — skipping the keyword/project selection entirely. If
  // no brand profile exists, we stay on Step 1's Quick Write panel (which shows
  // the "set up brand first" notice) rather than firing a request that can't run.
  const quickAutoStarted = useRef(false)
  useEffect(() => {
    if (quickAutoStarted.current || !keywordParam || projectsLoading) return
    quickAutoStarted.current = true
    const topic = keywordParam.trim()
    if (!topic) return
    setWriteMode('quick')
    setQuickWriteTopic(topic)
    if (brandProfile) void handleQuickWriteBrief(topic)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keywordParam, projectsLoading, brandProfile])

  // Load keywords when project changes
  useEffect(() => {
    if (!selectedProject) return
    const project = selectedProject
    let active = true
    async function load() {
      if (active) { setKwLoading(true); setSelectedKws(new Set()) }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('keywords')
        .select('id, keyword, avg_monthly_searches, keyword_difficulty, cpc, competition, cluster')
        .eq('project_id', project.id)
        .order('avg_monthly_searches', { ascending: false })
      if (!active) return
      setKeywords((data as Keyword[]) ?? [])
      setKwLoading(false)
    }
    void load()
    return () => { active = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject?.id])

  function toggleKw(kw: string) {
    setSelectedKws((prev) => {
      const next = new Set(prev)
      if (next.has(kw)) next.delete(kw)
      else next.add(kw)
      return next
    })
  }

  function handleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  const sortedKws = [...keywords].sort((a, b) => {
    const av = a[sortField] ?? (sortDir === 'asc' ? Infinity : -Infinity)
    const bv = b[sortField] ?? (sortDir === 'asc' ? Infinity : -Infinity)
    if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv as string) : (bv as string).localeCompare(av)
    return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number)
  })

  async function handleGenerateBrief() {
    if (!selectedProject || selectedKws.size === 0 || !brandProfile) return
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Session expired — please sign in again.'); setLoading(false); return }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any

    // Free tier: enforce 1-article cap
    const { data: userProfile } = await supabaseAny
      .from('profiles')
      .select('account_type')
      .eq('user_id', user.id)
      .maybeSingle()

    if (userProfile?.account_type === 'free') {
      const { count } = await supabaseAny
        .from('articles')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

      if ((count ?? 0) >= 1) {
        setShowUpgradeModal(true)
        setLoading(false)
        return
      }
    }

    const { data: newArticle, error: insertErr } = await supabaseAny
      .from('articles')
      .insert({ user_id: user.id, brand_profile_id: brandProfile.id, keyword_project_id: selectedProject.id, status: 'draft' })
      .select('id')
      .single()

    if (insertErr) { setError(insertErr.message); setLoading(false); return }

    const newId = (newArticle as { id: string }).id
    setArticleId(newId)

    const res = await fetch('/api/articles/generate-brief', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        articleId: newId,
        keywordProjectId: selectedProject.id,
        selectedKeywords: Array.from(selectedKws),
        brandProfileId: brandProfile.id,
      }),
    })

    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Brief generation failed'); setLoading(false); return }

    setBrief(json.brief)
    setTargetWordCount(suggestWordCount(json.brief?.target_keyword ?? ''))
    setStep(3)
    setLoading(false)
  }

  // Quick-write: topic → keyword seeds (via intent layer) → brief (no project needed).
  // Accepts an explicit topic so the ?keyword= auto-trigger doesn't race the
  // quickWriteTopic state update.
  async function handleQuickWriteBrief(topicArg?: string) {
    const topic = (topicArg ?? quickWriteTopic).trim()
    if (!topic || !brandProfile) return
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Session expired — please sign in again.'); setLoading(false); return }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any

    const { data: userProfile } = await supabaseAny
      .from('profiles').select('account_type').eq('user_id', user.id).maybeSingle()

    if (userProfile?.account_type === 'free') {
      const { count } = await supabaseAny
        .from('articles').select('*', { count: 'exact', head: true }).eq('user_id', user.id)
      if ((count ?? 0) >= 1) { setShowUpgradeModal(true); setLoading(false); return }
    }

    const { data: newArticle, error: insertErr } = await supabaseAny
      .from('articles')
      .insert({ user_id: user.id, brand_profile_id: brandProfile.id, status: 'draft' })
      .select('id')
      .single()

    if (insertErr) { setError(insertErr.message); setLoading(false); return }

    const newId = (newArticle as { id: string }).id
    setArticleId(newId)

    const res = await fetch('/api/articles/generate-brief', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleId: newId, directTopic: topic, brandProfileId: brandProfile.id }),
    })

    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Brief generation failed'); setLoading(false); return }

    setBrief(json.brief)
    setTargetWordCount(suggestWordCount(json.brief?.target_keyword ?? topic))
    setStep(3)
    setLoading(false)
  }

  async function handleGenerateDraft() {
    if (!articleId) return
    setLoading(true)
    setError(null)
    setStep(4)
    setGeneratingStatus('generating')

    // Poll for status updates so the UI reflects when Pass 2 fires
    const pollId = setInterval(async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any)
          .from('articles')
          .select('status')
          .eq('id', articleId)
          .single()
        if (data?.status === 'expanding') setGeneratingStatus('expanding')
      } catch { /* ignore poll errors */ }
    }, 2000)

    const res = await fetch('/api/articles/generate-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleId, target_word_count: targetWordCount }),
    })
    clearInterval(pollId)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = await res.json() as Record<string, any>
    if (!res.ok) {
      setError(json.error ?? 'Draft generation failed')
      setStep(3)
      setLoading(false)
      return
    }

    if (json.pass_count === 2) setGeneratingStatus('expanded')

    // Auto-score (non-blocking — best effort)
    await fetch('/api/articles/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleId }),
    })

    setStep(5)
    setLoading(false)
  }

  // ─── Editable outline helpers (write back into `brief` before draft generation) ───
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function updateOutlineField(i: number, field: string, value: any) {
    setBrief((prev) => {
      if (!prev) return prev
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const outline = [...((prev.outline as any[]) ?? [])]
      outline[i] = { ...outline[i], [field]: value }
      return { ...prev, outline }
    })
  }

  function addOutlineSection() {
    setBrief((prev) => {
      if (!prev) return prev
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const outline = [...((prev.outline as any[]) ?? [])]
      outline.push({ heading: '', heading_level: 2, notes: '', word_count_target: 150 })
      return { ...prev, outline }
    })
  }

  function removeOutlineSection(i: number) {
    setBrief((prev) => {
      if (!prev) return prev
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const outline = ((prev.outline as any[]) ?? []).filter((_: any, idx: number) => idx !== i)
      return { ...prev, outline }
    })
  }

  function setOutline(newOutline: OutlineSection[]) {
    setBrief((prev) => (prev ? { ...prev, outline: newOutline } : prev))
  }

  // Natural-language outline edits. Sends the current outline + the user's
  // request to the streaming outline-chat route and applies the result.
  async function handleOutlineChat() {
    const text = outlineChatInput.trim()
    if (!text || outlineChatSending || !brief) return

    const currentOutline = (brief.outline as OutlineSection[]) ?? []
    const articleTitle = (brief.h1_options as string[] | undefined)?.[0]
      ?? (brief.target_keyword as string | undefined)
      ?? 'Untitled'

    setOutlineChatSending(true)
    setOutlineChatInput('')
    setOutlineChatMessages((prev) => [...prev, { role: 'user' as const, text }].slice(-8))

    try {
      const res = await fetch('/api/articles/outline-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outline: currentOutline, message: text, articleTitle }),
      })

      if (!res.ok || !res.body) {
        setOutlineChatMessages((prev) => [...prev, { role: 'system' as const, text: 'Could not update the outline. Please try again.' }].slice(-8))
        return
      }

      // Drain the SSE stream, then parse the single data event it carries.
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
      }

      let updated: OutlineSection[] | null = null
      let errMsg: string | null = null
      for (const block of buffer.split('\n\n')) {
        const line = block.trim()
        if (!line.startsWith('data:')) continue
        try {
          const json = JSON.parse(line.slice(5).trim()) as { type: string; outline?: OutlineSection[]; error?: string }
          if (json.type === 'outline' && Array.isArray(json.outline)) updated = json.outline
          else if (json.type === 'error') errMsg = json.error ?? 'Outline update failed'
        } catch { /* skip malformed event */ }
      }

      if (!updated) {
        setOutlineChatMessages((prev) => [...prev, { role: 'system' as const, text: errMsg ?? 'Could not update the outline. Please try again.' }].slice(-8))
        return
      }

      previousOutlineRef.current = currentOutline
      setCanUndoOutline(true)
      setOutline(updated)
      setOutlineChatMessages((prev) => [...prev, { role: 'system' as const, text: '✓ Outline updated' }].slice(-8))
      setOutlineToast(true)
      setTimeout(() => setOutlineToast(false), 2200)
    } catch {
      setOutlineChatMessages((prev) => [...prev, { role: 'system' as const, text: 'Something went wrong. Please try again.' }].slice(-8))
    } finally {
      setOutlineChatSending(false)
    }
  }

  function handleUndoOutline() {
    if (!previousOutlineRef.current) return
    setOutline(previousOutlineRef.current)
    previousOutlineRef.current = null
    setCanUndoOutline(false)
    setOutlineChatMessages((prev) => [...prev, { role: 'system' as const, text: '↩ Reverted to previous outline' }].slice(-8))
  }

  return (
    <div className="p-8 max-w-3xl">
      {/* Free tier upgrade modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[var(--ink)] rounded-2xl shadow-xl border border-[rgba(184,115,51,0.2)] p-8 max-w-sm w-full mx-4 text-center">
            <div className="w-12 h-12 rounded-full bg-[rgba(184,115,51,0.08)] flex items-center justify-center mx-auto mb-4">
              <FileText className="w-6 h-6 text-[var(--copper-lt)]" />
            </div>
            <h2 className="text-lg font-bold text-[var(--cream)] mb-2">Free article used</h2>
            <p className="text-sm text-[var(--cream-dim)] mb-6">
              You&apos;ve used your free article. Upgrade to write unlimited articles.
            </p>
            <div className="flex flex-col gap-2">
              <Link
                href="/pricing"
                className="w-full py-2.5 bg-[#B87333] text-white text-sm font-semibold rounded-lg hover:bg-[#A0622A] transition-colors"
              >
                View plans
              </Link>
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="w-full py-2.5 text-sm text-[var(--cream-dim)] hover:text-[var(--cream-dim)] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Outline-updated toast */}
      {outlineToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-[var(--ink)] border border-[rgba(184,115,51,0.3)] rounded-lg px-4 py-2.5 shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          <span className="text-sm font-medium text-[var(--cream)]">Outline updated</span>
        </div>
      )}

      <div className="flex items-center gap-2 mb-6">
        <Link href="/articles" className="flex items-center gap-1.5 text-sm text-[var(--cream-faint)] hover:text-[var(--cream-dim)] transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Articles
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-[var(--cream)] mb-6">New Article</h1>
      <StepIndicator current={step} />

      {error && (
        <div className="mb-6 flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* ─── Step 1: Pick project OR quick-write ─── */}
      {step === 1 && (
        <div>
          {/* Mode tabs */}
          <div className="flex gap-1 p-1 rounded-xl mb-5" style={{ background: 'var(--ink-card)', border: '1px solid var(--border)' }}>
            <button
              onClick={() => setWriteMode('quick')}
              className="flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors"
              style={writeMode === 'quick'
                ? { background: 'var(--copper)', color: '#F7F3EC' }
                : { color: 'var(--cream-dim)' }}
            >
              Quick Write
            </button>
            <button
              onClick={() => setWriteMode('project')}
              className="flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors"
              style={writeMode === 'project'
                ? { background: 'var(--ink-deep)', color: 'var(--cream)' }
                : { color: 'var(--cream-dim)' }}
            >
              From Research
            </button>
          </div>

          {/* Quick Write panel */}
          {writeMode === 'quick' && (
            <div>
              <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--cream)' }}>What do you want to write about?</h2>
              <p className="text-sm mb-5" style={{ color: 'var(--cream-dim)' }}>
                Enter a topic or keyword. Byline will automatically pull the most relevant search terms and generate a full content brief.
              </p>
              <form onSubmit={(e) => { e.preventDefault(); void handleQuickWriteBrief() }} className="space-y-3">
                <input
                  type="text"
                  autoFocus
                  value={quickWriteTopic}
                  onChange={(e) => setQuickWriteTopic(e.target.value)}
                  placeholder="e.g. what is SEO, how to do keyword research, best SEO tools"
                  className="w-full px-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-[var(--copper)]"
                  style={{ background: 'var(--ink-card)', color: 'var(--cream)', borderColor: 'var(--border)' }}
                />
                <button
                  type="submit"
                  disabled={!quickWriteTopic.trim() || !brandProfile || loading}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
                  style={{ background: 'var(--copper)', color: '#F7F3EC' }}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {loading ? 'Generating brief…' : 'Generate brief'}
                </button>
              </form>
              {!brandProfile && (
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
                  <span className="font-medium">Brand profile missing.</span>{' '}
                  <Link href="/brand" className="underline hover:text-amber-900">Set it up first →</Link>
                </div>
              )}
            </div>
          )}

          {/* From Research panel */}
          {writeMode === 'project' && (
            <div>
              <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--cream)' }}>Pick a keyword project</h2>
              <p className="text-sm mb-5" style={{ color: 'var(--cream-dim)' }}>Only projects with completed keyword research appear here.</p>

              {projectsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-5 h-5 animate-spin text-[var(--cream-faint)]" />
                </div>
              ) : projects.length === 0 ? (
                <div className="border-2 border-dashed rounded-xl p-10 text-center" style={{ borderColor: 'var(--border)' }}>
                  <p className="text-sm mb-3" style={{ color: 'var(--cream-dim)' }}>No completed keyword projects yet.</p>
                  <Link href="/keywords" className="text-sm font-medium" style={{ color: 'var(--copper)' }}>
                    Run keyword research first →
                  </Link>
                </div>
              ) : (
                <div className="rounded-xl overflow-hidden" style={{ background: 'var(--ink)', border: '1px solid var(--border)' }}>
                  {projects.map((p, i) => (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedProject(p); setStep(2) }}
                      className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-[rgba(184,115,51,0.08)] transition-colors"
                      style={i > 0 ? { borderTop: '1px solid var(--border)' } : undefined}
                    >
                      <div>
                        <div className="font-medium text-sm" style={{ color: 'var(--cream)' }}>{p.name}</div>
                        <div className="text-xs mt-0.5" style={{ color: 'var(--cream-faint)' }}>Seed: {p.seed_topic}</div>
                      </div>
                      <ArrowRight className="w-4 h-4" style={{ color: 'var(--cream-dim)' }} />
                    </button>
                  ))}
                </div>
              )}

              {!brandProfile && (
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
                  <span className="font-medium">Brand profile missing.</span>{' '}
                  <Link href="/brand" className="underline hover:text-amber-900">Set it up first →</Link>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── Step 2: Select keywords ─── */}
      {step === 2 && (
        <div>
          <div className="flex items-center gap-3 mb-1">
            <button onClick={() => setStep(1)} className="text-sm text-[var(--cream-faint)] hover:text-[var(--cream-dim)]">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h2 className="text-base font-semibold text-[var(--cream)]">Select target keywords</h2>
          </div>
          <p className="text-sm text-[var(--cream-dim)] mb-1 ml-7">
            Project: <span className="font-medium text-[var(--cream-dim)]">{selectedProject?.name}</span>
          </p>
          {brandProfile && (
            <div className="ml-7 mb-5 text-xs text-[var(--cream-faint)]">
              Brand: <span className="font-medium text-[var(--cream-dim)]">{brandProfile.brand_name}</span>
            </div>
          )}

          {kwLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-5 h-5 animate-spin text-[var(--cream-faint)]" />
            </div>
          ) : (
            <>
              <div className="bg-[var(--ink)] border border-[rgba(184,115,51,0.2)] rounded-xl overflow-hidden mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[rgba(184,115,51,0.15)] bg-[var(--ink-card)]">
                      <th className="px-3 py-2.5 w-10" />
                      <th className="px-3 py-2.5 text-left">
                        <SortBtn field="keyword" label="Keyword" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      </th>
                      <th className="px-3 py-2.5 text-left">
                        <SortBtn field="avg_monthly_searches" label="Volume" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      </th>
                      <th className="px-3 py-2.5 text-left">
                        <SortBtn field="keyword_difficulty" label="Difficulty" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {sortedKws.map((kw) => (
                      <tr
                        key={kw.id}
                        onClick={() => toggleKw(kw.keyword)}
                        className={`cursor-pointer transition-colors ${selectedKws.has(kw.keyword) ? 'bg-[rgba(184,115,51,0.08)]' : 'hover:bg-[var(--ink-card)]'}`}
                      >
                        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedKws.has(kw.keyword)}
                            onChange={() => toggleKw(kw.keyword)}
                            className="rounded border-[rgba(184,115,51,0.25)] text-[var(--copper)] focus:ring-[#B87333]"
                          />
                        </td>
                        <td className="px-3 py-2.5 font-medium text-[var(--cream)]">{kw.keyword}</td>
                        <td className="px-3 py-2.5 tabular-nums text-[var(--cream-dim)] text-xs">
                          {kw.avg_monthly_searches?.toLocaleString() ?? '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          <DifficultyBar value={kw.keyword_difficulty} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-3 py-2.5 border-t border-[rgba(184,115,51,0.15)] bg-[var(--ink-card)] flex items-center justify-between text-xs text-[var(--cream-faint)]">
                  <span>{keywords.length} keywords</span>
                  {selectedKws.size > 0 && <span className="text-[var(--copper)] font-medium">{selectedKws.size} selected</span>}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs text-[var(--cream-faint)]">Select 2-10 keywords to build the brief around.</p>
                <button
                  onClick={handleGenerateBrief}
                  disabled={selectedKws.size === 0 || !brandProfile || loading}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#B87333] text-white text-sm font-medium rounded-lg hover:bg-[#A0622A] disabled:opacity-50 transition-colors"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Generating brief…</>
                  ) : (
                    <><Sparkles className="w-4 h-4" /> Generate Brief</>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── Step 3: Brief review ─── */}
      {step === 3 && brief && (
        <div>
          <h2 className="text-base font-semibold text-[var(--cream)] mb-1">Review your brief</h2>
          <p className="text-sm text-[var(--cream-dim)] mb-5">GPT-4o analyzed your keywords and brand profile to build this content plan.</p>

          <div className="space-y-4">
            <div className="bg-[var(--ink)] border border-[rgba(184,115,51,0.2)] rounded-xl p-4">
              <div className="text-xs font-semibold text-[var(--cream-faint)] uppercase tracking-wide mb-2">Target Keyword</div>
              <div className="text-sm font-semibold text-[#A0622A]">{brief.target_keyword}</div>
              {brief.url_slug && <div className="text-xs text-[var(--cream-faint)] mt-1">/{brief.url_slug}</div>}
            </div>

            <div className="bg-[var(--ink)] border border-[rgba(184,115,51,0.2)] rounded-xl p-4">
              <div className="text-xs font-semibold text-[var(--cream-faint)] uppercase tracking-wide mb-2">H1 Options</div>
              <ul className="space-y-1.5">
                {(brief.h1_options as string[] ?? []).map((h: string, i: number) => (
                  <li key={i} className="text-sm text-[var(--cream-dim)] flex gap-2">
                    <span className="text-[var(--cream-dim)] shrink-0">{i + 1}.</span>
                    {h}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-[var(--ink)] border border-[rgba(184,115,51,0.2)] rounded-xl p-4">
              <div className="text-xs font-semibold text-[var(--cream-faint)] uppercase tracking-wide mb-2">
                Meta Description <span className="normal-case font-normal">({String(brief.meta_description ?? '').length} chars)</span>
              </div>
              <p className="text-sm text-[var(--cream-dim)]">{brief.meta_description}</p>
            </div>

            <div className="bg-[var(--ink)] border border-[rgba(184,115,51,0.2)] rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold text-[var(--cream-faint)] uppercase tracking-wide">Outline</div>
                <span className="text-[10px] text-[var(--cream-faint)]">Edit headings &amp; notes — changes feed the draft</span>
              </div>
              <div className="space-y-3">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(brief.outline as any[] ?? []).map((s: any, i: number) => (
                  <div key={i} className="rounded-lg border border-[rgba(184,115,51,0.15)] bg-[var(--ink-card)] p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        value={s.heading ?? ''}
                        onChange={(e) => updateOutlineField(i, 'heading', e.target.value)}
                        placeholder="Section heading"
                        className="flex-1 px-2.5 py-1.5 text-sm font-medium bg-[var(--ink)] border border-[rgba(184,115,51,0.2)] rounded-md text-[var(--cream)] placeholder:text-[var(--cream-faint)] focus:outline-none focus:border-[#B87333]"
                      />
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-xs text-[var(--cream-faint)]">~</span>
                        <input
                          type="number"
                          min={0}
                          step={50}
                          value={s.word_count_target ?? 0}
                          onChange={(e) => updateOutlineField(i, 'word_count_target', Number(e.target.value))}
                          className="w-16 px-2 py-1.5 text-xs tabular-nums bg-[var(--ink)] border border-[rgba(184,115,51,0.2)] rounded-md text-[var(--cream-dim)] focus:outline-none focus:border-[#B87333]"
                        />
                        <span className="text-xs text-[var(--cream-faint)]">w</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeOutlineSection(i)}
                        title="Remove section"
                        className="shrink-0 p-1.5 text-[var(--cream-faint)] hover:text-red-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <textarea
                      value={s.notes ?? ''}
                      onChange={(e) => updateOutlineField(i, 'notes', e.target.value)}
                      placeholder="Notes for this section (optional)"
                      rows={2}
                      className="w-full px-2.5 py-1.5 text-xs bg-[var(--ink)] border border-[rgba(184,115,51,0.2)] rounded-md text-[var(--cream-dim)] placeholder:text-[var(--cream-faint)] focus:outline-none focus:border-[#B87333] resize-y"
                    />
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addOutlineSection}
                className="mt-3 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--copper)] hover:text-[#A0622A] border border-dashed border-[rgba(184,115,51,0.3)] rounded-lg hover:border-[#B87333] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add section
              </button>

              <div className="mt-3 pt-3 border-t border-[rgba(184,115,51,0.15)] text-xs text-[var(--cream-faint)] flex justify-between">
                <span>Target total</span>
                <span className="font-medium text-[var(--cream-dim)]">{brief.word_count_target} words</span>
              </div>
            </div>

            {/* ─── Conversational outline editor ─── */}
            <div className="bg-[var(--ink)] border border-[rgba(184,115,51,0.2)] rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setOutlineChatOpen((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[var(--ink-card)] transition-colors"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-[var(--cream)]">
                  <MessageSquare className="w-4 h-4 text-[var(--copper-lt)]" />
                  Edit outline with AI
                </span>
                {outlineChatOpen
                  ? <ChevronUp className="w-4 h-4 text-[var(--cream-dim)]" />
                  : <ChevronDown className="w-4 h-4 text-[var(--cream-dim)]" />}
              </button>

              {outlineChatOpen && (
                <div className="border-t border-[rgba(184,115,51,0.15)] px-4 py-4">
                  <p className="text-xs text-[var(--cream-faint)] mb-3">
                    Ask in plain language — e.g. &ldquo;add a section about pricing models&rdquo;,
                    &ldquo;make section 2 more beginner-friendly&rdquo;, or &ldquo;swap sections 3 and 4&rdquo;.
                  </p>

                  {outlineChatMessages.length > 0 && (
                    <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                      {outlineChatMessages.map((m, i) => (
                        <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-xs rounded-xl px-3 py-1.5 text-xs leading-relaxed ${
                            m.role === 'user'
                              ? 'bg-[#B87333] text-white rounded-br-sm'
                              : 'bg-[var(--ink-card)] text-[var(--cream-dim)] rounded-bl-sm'
                          }`}>
                            {m.text}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={outlineChatInput}
                      onChange={(e) => setOutlineChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleOutlineChat()
                        }
                      }}
                      placeholder="Describe a change to the outline…"
                      disabled={outlineChatSending}
                      className="flex-1 px-3 py-2 text-sm bg-[var(--ink-card)] border border-[rgba(184,115,51,0.2)] rounded-lg text-[var(--cream)] placeholder:text-[var(--cream-faint)] focus:outline-none focus:border-[#B87333] disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={handleOutlineChat}
                      disabled={outlineChatSending || !outlineChatInput.trim()}
                      className="p-2 bg-[#B87333] text-white rounded-lg hover:bg-[#A0622A] disabled:opacity-50 transition-colors"
                    >
                      {outlineChatSending
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Send className="w-4 h-4" />}
                    </button>
                  </div>

                  {canUndoOutline && (
                    <button
                      type="button"
                      onClick={handleUndoOutline}
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--cream-dim)] hover:text-[var(--cream)] transition-colors"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      Undo last change
                    </button>
                  )}
                </div>
              )}
            </div>

            {(brief.competitor_gaps as string[] ?? []).length > 0 && (
              <div className="bg-[var(--ink)] border border-[rgba(184,115,51,0.2)] rounded-xl p-4">
                <div className="text-xs font-semibold text-[var(--cream-faint)] uppercase tracking-wide mb-2">Competitor Gaps</div>
                <ul className="space-y-1">
                  {(brief.competitor_gaps as string[]).map((g: string, i: number) => (
                    <li key={i} className="text-sm text-[var(--cream-dim)] flex gap-2">
                      <span className="text-[var(--copper-lt)]">→</span> {g}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Word count selector */}
          {(() => {
            const suggested = suggestWordCount(brief.target_keyword ?? '')
            return (
              <div className="bg-[var(--ink)] border border-[rgba(184,115,51,0.2)] rounded-xl p-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <div className="text-xs font-semibold text-[var(--cream-faint)] uppercase tracking-wide">Target Word Count</div>
                  <Info className="w-3.5 h-3.5 text-[var(--cream-dim)]" />
                </div>
                <p className="text-xs text-[var(--cream-dim)] mb-3">
                  Recommended:{' '}
                  <span className="font-semibold text-[var(--cream-dim)]">{suggested.toLocaleString()} words</span>
                  {' '}based on your keyword
                </p>
                <div className="flex gap-2">
                  {WORD_COUNT_OPTIONS.map((n) => {
                    const isSelected = targetWordCount === n
                    const isRecommended = n === suggested
                    return (
                      <button
                        key={n}
                        onClick={() => setTargetWordCount(n)}
                        className={`relative flex-1 py-2 rounded-lg text-sm font-medium transition-colors border ${
                          isSelected
                            ? 'bg-[#B87333] text-white border-[#B87333]'
                            : 'bg-[var(--ink)] text-[var(--cream-dim)] border-[rgba(184,115,51,0.2)] hover:border-[#B87333] hover:text-[var(--copper)]'
                        }`}
                      >
                        {n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : n}
                        {isRecommended && (
                          <span className={`absolute -top-2 left-1/2 -translate-x-1/2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                            isSelected ? 'bg-[rgba(184,115,51,0.12)] text-[#A0622A]' : 'bg-[rgba(184,115,51,0.08)] text-[var(--copper)]'
                          }`}>
                            rec
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          <div className="mt-6 flex items-center justify-between">
            <p className="text-xs text-[var(--cream-faint)]">SERP intent: <span className="font-medium text-[var(--cream-dim)]">{brief.serp_intent}</span></p>
            <button
              onClick={handleGenerateDraft}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#B87333] text-white text-sm font-medium rounded-lg hover:bg-[#A0622A] disabled:opacity-50 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              Generate Full Draft
            </button>
          </div>
        </div>
      )}

      {/* ─── Step 4: Generating ─── */}
      {step === 4 && (
        <div className="border-2 border-dashed border-[rgba(184,115,51,0.15)] rounded-2xl p-14 text-center">
          <Loader2 className="w-10 h-10 animate-spin text-[var(--copper-lt)] mx-auto mb-5" />
          {generatingStatus === 'expanding' ? (
            <>
              <h3 className="text-base font-semibold text-[var(--cream-dim)] mb-2">Article came in short — running a second research pass to fill it out…</h3>
              <p className="text-sm text-[var(--cream-faint)] max-w-xs mx-auto">Pulling related questions from DataForSEO and expanding with real substance.</p>
            </>
          ) : (
            <>
              <h3 className="text-base font-semibold text-[var(--cream-dim)] mb-2">Generating your article…</h3>
              <p className="text-sm text-[var(--cream-faint)] max-w-xs mx-auto">GPT-4o is generating a full draft in your brand voice. This takes 30–60 seconds.</p>
            </>
          )}
        </div>
      )}

      {/* ─── Step 5: Done ─── */}
      {step === 5 && articleId && (
        <div className="text-center">
          <div className="inline-flex p-4 bg-green-50 rounded-2xl mb-5">
            <CheckCircle2 className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-[var(--cream)] mb-2">
            {generatingStatus === 'expanded' ? 'Done — article expanded to target length' : 'Article generated and scored'}
          </h2>
          <p className="text-sm text-[var(--cream-dim)] mb-7 max-w-sm mx-auto">
            {generatingStatus === 'expanded'
              ? 'A second research pass added real substance to hit your target word count.'
              : 'Your article is ready. View the full content, SEO scores, and ranking predictions.'}
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/articles" className="px-4 py-2 text-sm text-[var(--cream-dim)] border border-[rgba(184,115,51,0.2)] rounded-lg hover:bg-[var(--ink-card)] transition-colors">
              Back to Articles
            </Link>
            <Link
              href={`/articles/${articleId}`}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#B87333] text-white text-sm font-medium rounded-lg hover:bg-[#A0622A] transition-colors"
            >
              <FileText className="w-4 h-4" />
              View Article &amp; Scores
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
