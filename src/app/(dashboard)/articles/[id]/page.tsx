'use client'

import { use, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { marked } from 'marked'
import { createClient } from '@/lib/supabase/client'
import type { Article, ArticleScores } from '@/lib/supabase/types'
import {
  ArrowLeft, Copy, CheckCircle2, Loader2, Sparkles,
  TrendingUp, AlertCircle, BarChart2, Bot, X, Send,
  Wand2, Pencil, Eye, Lock, Globe, History, GitFork, RotateCcw, Clock,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { track } from '@/components/PostHogProvider'

const ArticleEditor = dynamic(() => import('./ArticleEditor'), { ssr: false })

const COPPER = '#B87333'

type AgentMessage = { role: 'user' | 'assistant'; content: string }

function extractApplicableContent(content: string): string | null {
  const codeMatch = content.match(/```[\w]*\n?([\s\S]+?)```/)
  if (codeMatch) return codeMatch[1].trim()
  const bqLines = content.split('\n').filter((l) => l.startsWith('> '))
  if (bqLines.length >= 2) return bqLines.map((l) => l.replace(/^>\s?/, '')).join('\n')
  return null
}

function mapToFixInstruction(label: string, keyword: string): string | null {
  const l = label.toLowerCase()
  if (l.startsWith('target keyword in h1'))
    return `Rewrite the H1 to naturally include the primary keyword "${keyword}"`
  if (l.startsWith('target keyword in first 100'))
    return `Rewrite the introduction paragraph to include the primary keyword "${keyword}" in the first two sentences`
  if (l.startsWith('target keyword in meta'))
    return `Write a meta description that naturally includes "${keyword}", between 120-155 characters`
  if (l.startsWith('meta description length'))
    return `Rewrite the meta description to be between 120-155 characters while including "${keyword}"`
  if (l.startsWith('h2 headings'))
    return `Add or restructure H2 headings so the article has 2-4 major sections`
  if (l.startsWith('word count') && l.includes('1800'))
    return `Add a detailed 'Key Takeaways' section with 4-5 bullet points to extend the article`
  if (l.startsWith('faq section'))
    return `Add a ## Frequently Asked Questions section with 4-5 ### H3 questions and answers about "${keyword}"`
  if (l.startsWith('definitional'))
    return `Add a clear one-sentence definition of "${keyword}" near the start of the introduction`
  if (l.startsWith('structured h2'))
    return `Add an additional H2 section to give the article at least 3 major sections`
  if (l.startsWith('data/stat'))
    return `Add a data point, statistic, or research finding to each major section`
  if (l.startsWith('faq h3'))
    return `Add a ## Frequently Asked Questions section with at least 3 ### H3 questions and answers about "${keyword}"`
  if (l.startsWith('direct-answer'))
    return `Add a short direct-answer paragraph (40-80 words) near the top that directly answers what "${keyword}" means or how it works`
  if (l.startsWith('lists or numbered'))
    return `Add a bulleted list or numbered steps in one of the main sections`
  if (l.startsWith('key takeaways') || l.startsWith('total word count'))
    return `Add a ## Key Takeaways section at the end with 4-5 bullet points summarizing the main points`
  return null
}

function getScoreFailures(scores: ArticleScores, keyword: string): Array<{ label: string; instruction: string }> {
  type Item = { label: string; instruction: string; priority: number }
  const items: Item[] = []

  for (const c of Object.values(scores.seo.breakdown)) {
    if (!c.passed) {
      const instruction = mapToFixInstruction(c.label, keyword)
      if (instruction) items.push({ label: c.label, instruction, priority: c.max })
    }
  }
  for (const c of Object.values(scores.aeo.breakdown)) {
    if (!c.passed) {
      const instruction = mapToFixInstruction(c.label, keyword)
      if (instruction) items.push({ label: c.label, instruction, priority: 8 })
    }
  }
  for (const c of Object.values(scores.geo.breakdown)) {
    if (!c.passed) {
      const instruction = mapToFixInstruction(c.label, keyword)
      if (instruction) items.push({ label: c.label, instruction, priority: 7 })
    }
  }

  return items
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 3)
    .map(({ label, instruction }) => ({ label, instruction }))
}

type ActionItem = { label: string; action: string }

function getActionItemsPerCategory(scores: ArticleScores, keyword: string): {
  seo: ActionItem[]
  geo: ActionItem[]
  aeo: ActionItem[]
  readability: ActionItem[]
} {
  const seo: ActionItem[] = []
  const geo: ActionItem[] = []
  const aeo: ActionItem[] = []
  const readability: ActionItem[] = []

  for (const c of Object.values(scores.seo.breakdown)) {
    if (!c.passed) {
      const action = mapToFixInstruction(c.label, keyword)
      if (action) seo.push({ label: c.label, action })
    }
  }

  for (const c of Object.values(scores.geo.breakdown)) {
    if (!c.passed) {
      const action = mapToFixInstruction(c.label, keyword)
      if (action) geo.push({ label: c.label, action })
    }
  }

  for (const c of Object.values(scores.aeo.breakdown)) {
    if (!c.passed) {
      const action = mapToFixInstruction(c.label, keyword)
      if (action) aeo.push({ label: c.label, action })
    }
  }

  // Readability: convert breakdown values into actionable text
  const rb = scores.readability.breakdown as Record<string, { label: string; value: number }>
  if (rb.avg_sentence_len) {
    const v = rb.avg_sentence_len.value
    if (v > 20) readability.push({
      label: rb.avg_sentence_len.label,
      action: `Average sentence length is ${v.toFixed(1)} words — aim for under 20. Break long sentences into two shorter ones.`,
    })
  }
  if (rb.passive_voice) {
    const v = rb.passive_voice.value
    if (v > 5) readability.push({
      label: rb.passive_voice.label,
      action: `${v} passive-voice instances found — rewrite to active voice (e.g. "Google rewards…" not "It is rewarded by Google…").`,
    })
  }
  if (rb.para_density) {
    const v = rb.para_density.value
    if (v > 120) readability.push({
      label: rb.para_density.label,
      action: `Paragraphs average ${Math.round(v)} words — break dense blocks into shorter paragraphs of ~100 words or add bullet lists.`,
    })
  }

  return { seo, geo, aeo, readability }
}

function ActionItemsList({ items, category }: { items: ActionItem[]; category: string }) {
  if (items.length === 0) {
    return (
      <p className="text-xs text-green-400 flex items-center gap-1.5 py-1">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        All {category} criteria passed — no action needed.
      </p>
    )
  }
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5">
          <div className="mt-0.5 w-4 h-4 rounded-full border border-[rgba(184,115,51,0.4)] bg-[rgba(184,115,51,0.08)] flex items-center justify-center shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-[#B87333]" />
          </div>
          <span className="text-xs text-[#A89070] leading-snug">{item.action}</span>
        </li>
      ))}
    </ul>
  )
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const barColor = score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-[#A89070]">{label}</span>
        <span className="text-sm font-bold tabular-nums" style={{ color: COPPER }}>{score}</span>
      </div>
      <div className="w-full bg-[#2A2420] rounded-full h-2.5">
        <div className={`h-2.5 rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  )
}

function ConfidenceChip({ confidence }: { confidence: 'low' | 'medium' | 'high' }) {
  const cfg = { high: 'bg-green-50 text-green-700', medium: 'bg-amber-50 text-amber-700', low: 'bg-red-50 text-red-600' }
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cfg[confidence]}`}>
      {confidence.charAt(0).toUpperCase() + confidence.slice(1)} confidence
    </span>
  )
}

function CriteriaRow({ label, passed }: { label: string; passed: boolean }) {
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <div className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${passed ? 'bg-green-100' : 'bg-[#2A2420]'}`}>
        <div className={`w-2 h-2 rounded-full ${passed ? 'bg-green-500' : 'bg-gray-300'}`} />
      </div>
      <span className={`text-xs flex-1 ${passed ? 'text-[#A89070]' : 'text-[#7A6555]'}`}>{label}</span>
    </div>
  )
}

function SEOCriteriaRow({ label, passed, points, max }: { label: string; passed: boolean; points: number; max: number }) {
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <div className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${passed ? 'bg-green-100' : 'bg-[#2A2420]'}`}>
        <div className={`w-2 h-2 rounded-full ${passed ? 'bg-green-500' : 'bg-gray-300'}`} />
      </div>
      <span className={`text-xs flex-1 ${passed ? 'text-[#A89070]' : 'text-[#7A6555]'}`}>{label}</span>
      <span className="text-xs tabular-nums font-medium text-[#A89070] shrink-0">{points}/{max}</span>
    </div>
  )
}

export default function ArticleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const supabase = createClient()
  const router = useRouter()

  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)
  const [scoring, setScoring] = useState(false)
  const [scoreError, setScoreError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'content' | 'scores'>('content')
  const getEditorTextRef = useRef<(() => string) | null>(null)
  const getEditorWordCountRef = useRef<(() => number) | null>(null)
  const replaceContentRef = useRef<((markdown: string) => void) | null>(null)
  const applyContentRef = useRef<((markdown: string) => void) | null>(null)
  const applyAtRangeRef = useRef<((from: number, to: number, html: string) => void) | null>(null)
  const [metaDesc, setMetaDesc] = useState('')
  const [metaSaving, setMetaSaving] = useState(false)
  const [metaGenerating, setMetaGenerating] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const metaInitialized = useRef(false)

  // Agent state
  const [agentOpen, setAgentOpen] = useState(false)
  const [agentMode, setAgentMode] = useState<'review' | 'assist' | 'auto'>('review')
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([])
  const [agentInput, setAgentInput] = useState('')
  const [agentStreaming, setAgentStreaming] = useState(false)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const initialSentRef = useRef(false)

  // Assist mode state
  const [selectedText, setSelectedText] = useState('')
  const [selectionRange, setSelectionRange] = useState<{ from: number; to: number } | null>(null)
  const [assistInput, setAssistInput] = useState('')
  const [assistApplied, setAssistApplied] = useState(false)
  const agentModeRef = useRef<'review' | 'assist' | 'auto'>('review')

  // Auto mode state
  const [autoInstruction, setAutoInstruction] = useState('')
  const [autoResult, setAutoResult] = useState('')
  const [autoApplied, setAutoApplied] = useState(false)
  const autoStreamRef = useRef<HTMLDivElement>(null)

  // Plan state
  const [userPlan, setUserPlan] = useState<string>('starter')
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false)

  // Keyword retargeting state
  const [kwStats, setKwStats] = useState<{ volume: number | null; difficulty: number | null; cpc: number | null; intent: string | null } | null>(null)
  const [kwEditMode, setKwEditMode] = useState(false)
  const [kwSearch, setKwSearch] = useState('')
  const [kwResults, setKwResults] = useState<Array<{ id: string; keyword: string; volume: number | null; difficulty: number | null }>>([])
  const [kwSearching, setKwSearching] = useState(false)
  const [kwRetargeting, setKwRetargeting] = useState(false)
  const [kwSuggestions, setKwSuggestions] = useState<Array<{ keyword: string; volume: number | null; difficulty: number | null; cpc: number | null; reason: string }>>([])
  const [kwSuggestionsLoading, setKwSuggestionsLoading] = useState(false)
  const [kwSuggestionsLoaded, setKwSuggestionsLoaded] = useState(false)
  const kwCardRef = useRef<HTMLDivElement>(null)

  // History panel state
  const [historyOpen, setHistoryOpen] = useState(false)
  const [versions, setVersions] = useState<Array<{ id: string; label: string | null; trigger: string | null; word_count: number | null; created_at: string }>>([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [previewVersion, setPreviewVersion] = useState<{ id: string; content: string; label: string | null; created_at: string } | null>(null)
  const [restoring, setRestoring] = useState(false)

  // Fork state
  const [forkOpen, setForkOpen] = useState(false)
  const [forkKeyword, setForkKeyword] = useState('')
  const [forking, setForking] = useState(false)

  useEffect(() => { agentModeRef.current = agentMode }, [agentMode])

  useEffect(() => {
    let active = true
    async function load() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any).from('articles').select('*').eq('id', id).single()
      if (!active) return
      setArticle(data as Article | null)
      setLoading(false)
    }
    load()
    return () => { active = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    if (article && !metaInitialized.current) {
      setMetaDesc(article.meta_description ?? '')
      metaInitialized.current = true
    }
  }, [article])

  useEffect(() => {
    fetch('/api/billing/subscription-info')
      .then((r) => r.json())
      .then((data) => { if (data?.plan_name) setUserPlan(data.plan_name) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const el = messagesContainerRef.current
    if (!el) return
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100
    if (isNearBottom) el.scrollTop = el.scrollHeight
  }, [agentMessages])

  // Auto-scroll live auto mode output
  useEffect(() => {
    if (autoStreamRef.current) {
      autoStreamRef.current.scrollTop = autoStreamRef.current.scrollHeight
    }
  }, [agentMessages])

  // Load keyword stats from saved_keywords when article loads
  useEffect(() => {
    if (!article?.target_keyword) return
    let active = true
    async function loadStats() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('saved_keywords')
        .select('volume, difficulty, cpc, intent')
        .ilike('keyword', article!.target_keyword!)
        .limit(1)
        .maybeSingle()
      if (active && data) setKwStats(data)
    }
    loadStats()
    return () => { active = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article?.target_keyword])

  // Live search saved keywords as user types in retarget mode
  useEffect(() => {
    if (!kwSearch.trim()) { setKwResults([]); return }
    const timer = setTimeout(async () => {
      setKwSearching(true)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('saved_keywords')
        .select('id, keyword, volume, difficulty')
        .ilike('keyword', `%${kwSearch.trim()}%`)
        .limit(8)
      setKwResults(data ?? [])
      setKwSearching(false)
    }, 300)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kwSearch])

  // Pre-fill assist input when a new selection is made
  useEffect(() => {
    if (selectedText && agentModeRef.current === 'assist') {
      setAssistInput('Rewrite this to be more specific and include the primary keyword')
    }
  }, [selectedText])

  // Clear messages when switching into Assist or Auto mode
  useEffect(() => {
    if (agentMode === 'assist' || agentMode === 'auto') {
      setAgentMessages([])
      setAssistApplied(false)
      setAutoResult('')
      setAutoApplied(false)
    }
  }, [agentMode])

  const handleSelectionChange = useCallback((text: string, from: number, to: number) => {
    setSelectedText(text)
    setSelectionRange(text ? { from, to } : null)
  }, [])

  const sendAgentMessage = useCallback(async (
    content: string,
    history: AgentMessage[],
    assist?: {
      selectedText?: string
      fixInstruction: string
      selectionRange?: { from: number; to: number } | null
    },
  ) => {
    const isAssist = !!assist
    const lastResponseRef = { current: '' }

    const newMessages: AgentMessage[] = isAssist
      ? [{ role: 'user', content: assist.fixInstruction }]
      : [...history, { role: 'user', content }]

    setAgentMessages(newMessages)
    if (!isAssist) setAgentInput('')
    setAgentStreaming(true)

    const body: Record<string, unknown> = { messages: newMessages, articleId: id }
    if (isAssist) {
      body.mode = 'assist'
      body.selectedText = assist.selectedText
      body.fixInstruction = assist.fixInstruction
    }

    const res = await fetch(`/api/articles/${id}/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      const errorMsg = (errorData as { error?: string }).error ?? 'Something went wrong. Please try again.'
      setAgentMessages((prev) => [...prev, { role: 'assistant', content: errorMsg }])
      setAgentStreaming(false)
      return
    }
    if (!res.body) {
      setAgentMessages((prev) => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }])
      setAgentStreaming(false)
      return
    }

    setAgentMessages((prev) => [...prev, { role: 'assistant', content: '' }])

    const reader = res.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const text = decoder.decode(value)
      lastResponseRef.current += text
      setAgentMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content: updated[updated.length - 1].content + text,
        }
        return updated
      })
    }

    setAgentStreaming(false)

    if (isAssist && lastResponseRef.current) {
      // Snapshot before applying assist edit
      await saveSnapshot('Before Assist edit', 'agent_assist')
      const html = marked.parse(lastResponseRef.current) as string
      if (assist.selectionRange) {
        applyAtRangeRef.current?.(assist.selectionRange.from, assist.selectionRange.to, html)
      } else {
        applyContentRef.current?.(lastResponseRef.current)
      }
      setAssistApplied(true)
      setTimeout(() => setAssistApplied(false), 2500)
      setSelectionRange(null)
      setSelectedText('')
      setAssistInput('')
    }
  }, [id])

  const sendAutoMode = useCallback(async (instruction?: string) => {
    setAgentMessages([])
    setAutoResult('')
    setAutoApplied(false)
    setAgentStreaming(true)
    // Auto-snapshot before overwriting — versioning means no confirmation needed
    await saveSnapshot('Before Auto mode', 'agent_auto')

    const res = await fetch(`/api/articles/${id}/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [], mode: 'auto', userInstruction: instruction?.trim() || undefined }),
    })

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      const errorMsg = (errorData as { error?: string }).error ?? 'Something went wrong. Please try again.'
      setAgentMessages([{ role: 'assistant', content: errorMsg }])
      setAgentStreaming(false)
      return
    }
    if (!res.body) {
      setAgentMessages([{ role: 'assistant', content: 'Something went wrong. Please try again.' }])
      setAgentStreaming(false)
      return
    }

    setAgentMessages([{ role: 'assistant', content: '' }])
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let fullResult = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const text = decoder.decode(value)
      fullResult += text
      setAgentMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = { ...updated[updated.length - 1], content: updated[updated.length - 1].content + text }
        return updated
      })
    }

    setAgentStreaming(false)
    if (fullResult) {
      replaceContentRef.current?.(fullResult)
      setAutoResult(fullResult)
      setAutoApplied(true)
      track('auto_mode_completed', { had_instruction: !!(instruction?.trim()), word_count: fullResult.trim().split(/\s+/).length })
    }
  }, [id])

  function openAgent(currentArticle: Article) {
    setAgentOpen(true)
    track('agent_opened', { mode: agentMode, keyword: currentArticle.target_keyword, has_scores: !!currentArticle.scores })
    const hasScores = !!currentArticle.scores
    if (hasScores && !initialSentRef.current) {
      initialSentRef.current = true
      sendAgentMessage('Review this article and tell me the most important things to fix first.', [])
    }
  }

  async function handleMetaDescBlur() {
    if (!article) return
    if (metaDesc === (article.meta_description ?? '')) return
    setMetaSaving(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('articles').update({ meta_description: metaDesc || null }).eq('id', id)
    if (error) console.error('[meta-description] Save failed:', error)
    setMetaSaving(false)
  }

  async function handleGenerateMeta() {
    if (!article?.content) return
    setMetaGenerating(true)
    try {
      const res = await fetch(`/api/articles/${id}/meta-description`, { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.meta_description) {
        setMetaDesc(data.meta_description)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('articles').update({ meta_description: data.meta_description }).eq('id', id)
      }
    } catch {
      // silent fail — user can type manually
    }
    setMetaGenerating(false)
  }

  async function loadKwSuggestions() {
    if (kwSuggestionsLoading) return
    setKwSuggestionsLoading(true)
    setKwSuggestionsLoaded(false)
    try {
      const res = await fetch(`/api/articles/${id}/keyword-suggestions`, { method: 'POST' })
      const data = await res.json()
      setKwSuggestions(data.suggestions ?? [])
    } catch {
      setKwSuggestions([])
    }
    setKwSuggestionsLoading(false)
    setKwSuggestionsLoaded(true)
    // Scroll keyword card into view
    setTimeout(() => kwCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }

  async function openHistory() {
    setHistoryOpen(true)
    setAgentOpen(false)
    setVersionsLoading(true)
    const res = await fetch(`/api/articles/${id}/versions`)
    const data = await res.json()
    setVersions(data.versions ?? [])
    setVersionsLoading(false)
  }

  async function saveSnapshot(label: string, trigger: string) {
    await fetch(`/api/articles/${id}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, trigger }),
    })
  }

  async function previewVersionContent(vid: string) {
    const res = await fetch(`/api/articles/${id}/versions/${vid}`)
    const data = await res.json()
    if (data.version) setPreviewVersion(data.version)
  }

  async function restoreVersion(vid: string) {
    setRestoring(true)
    const res = await fetch(`/api/articles/${id}/versions/${vid}`, { method: 'POST' })
    const data = await res.json()
    if (res.ok && data.content) {
      replaceContentRef.current?.(data.content)
      setArticle((prev) => prev ? { ...prev, content: data.content, word_count: data.word_count } : prev)
      setPreviewVersion(null)
      setHistoryOpen(false)
      // Reload versions list
      const r2 = await fetch(`/api/articles/${id}/versions`)
      const d2 = await r2.json()
      setVersions(d2.versions ?? [])
    }
    setRestoring(false)
  }

  async function handleFork() {
    setForking(true)
    const res = await fetch(`/api/articles/${id}/fork`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_keyword: forkKeyword.trim() || undefined }),
    })
    const data = await res.json()
    if (res.ok && data.articleId) {
      router.push(`/articles/${data.articleId}`)
    }
    setForking(false)
  }

  async function handleRetarget(newKeyword: string) {
    if (!article || !newKeyword.trim()) return
    setKwRetargeting(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('articles').update({ target_keyword: newKeyword.trim() }).eq('id', id)
    setArticle({ ...article, target_keyword: newKeyword.trim(), scores: null })
    setKwStats(null)
    setKwEditMode(false)
    setKwSearch('')
    setKwResults([])
    setKwSuggestions([])
    setKwSuggestionsLoaded(false)
    setKwRetargeting(false)
    setActiveTab('scores')
    setScoreError(null)
  }

  async function handlePublish() {
    if (!article) return
    const newStatus = article.status === 'published' ? 'complete' : 'published'
    setPublishing(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('articles')
      .update({ status: newStatus })
      .eq('id', id)
    if (!error) {
      setArticle({ ...article, status: newStatus })
      if (newStatus === 'published') track('article_published', { keyword: article.target_keyword, word_count: article.word_count })
    }
    setPublishing(false)
  }

  async function handleCopy() {
    if (!article?.content) return
    const text = getEditorTextRef.current ? getEditorTextRef.current() : article.content
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleScore() {
    setScoring(true)
    setScoreError(null)
    const res = await fetch('/api/articles/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleId: id }),
    })
    const json = await res.json()
    if (!res.ok) { setScoreError(json.error ?? 'Scoring failed'); setScoring(false); return }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any).from('articles').select('*').eq('id', id).single()
    setArticle(data as Article | null)
    setScoring(false)
    setActiveTab('scores')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    track('article_scored', { keyword: article?.target_keyword, seo: ((data as any)?.scores as any)?.seo?.score ?? null })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 animate-spin text-[#7A6555]" />
      </div>
    )
  }

  if (!article) {
    return (
      <div className="p-8">
        <Link href="/articles" className="flex items-center gap-1.5 text-sm text-[#7A6555] hover:text-[#A89070] mb-4">
          <ArrowLeft className="w-4 h-4" /> Articles
        </Link>
        <p className="text-[#A89070]">Article not found.</p>
      </div>
    )
  }

  const scores = article.scores as ArticleScores | null
  const scoreFailures = scores ? getScoreFailures(scores, article.target_keyword ?? '') : []
  const actionItems = scores ? getActionItemsPerCategory(scores, article.target_keyword ?? '') : null

  return (
    <div className={`flex gap-0 h-full min-h-screen ${agentOpen ? 'pr-0' : ''}`}>
      {/* Main content */}
      <div className={`flex-1 min-w-0 p-8 transition-all duration-300 ${agentOpen ? 'max-w-none' : 'max-w-4xl'}`}>
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="min-w-0 flex-1">
            <Link href="/articles" className="flex items-center gap-1.5 text-sm text-[#7A6555] hover:text-[#A89070] mb-3 transition-colors w-fit">
              <ArrowLeft className="w-4 h-4" />
              Articles
            </Link>
            <h1 className="text-xl font-bold text-[#F7F3EC] leading-snug">
              {article.title ?? article.target_keyword ?? 'Untitled'}
            </h1>
            {article.target_keyword && article.title && (
              <p className="text-sm text-[#7A6555] mt-0.5">Target: <span className="font-medium text-[#A89070]">{article.target_keyword}</span></p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-4 flex-wrap justify-end">
            {article.content && (
              <button
                onClick={() => { setForkOpen(true) }}
                className="flex items-center gap-2 px-3 py-2 text-sm border border-[rgba(184,115,51,0.2)] rounded-lg hover:bg-[#231F1B] text-[#A89070] transition-colors"
              >
                <GitFork className="w-4 h-4" /> Fork
              </button>
            )}
            {article.content && (
              <button
                onClick={openHistory}
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${
                  historyOpen ? 'bg-[rgba(184,115,51,0.08)] border-[rgba(184,115,51,0.25)] text-[#A0622A]' : 'border-[rgba(184,115,51,0.2)] text-[#A89070] hover:bg-[#231F1B]'
                }`}
              >
                <History className="w-4 h-4" /> History
              </button>
            )}
            {article.content && (
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 px-3 py-2 text-sm border border-[rgba(184,115,51,0.2)] rounded-lg hover:bg-[#231F1B] text-[#A89070] transition-colors"
              >
                {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy Markdown'}
              </button>
            )}
            {article.content && (
              <button
                onClick={handleScore}
                disabled={scoring}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-[#B87333] text-[#F7F3EC] rounded-lg hover:bg-[#A0622A] disabled:opacity-50 transition-colors"
              >
                {scoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {scores ? 'Re-score' : 'Score Article'}
              </button>
            )}
            {article.content && (
              <button
                onClick={handlePublish}
                disabled={publishing}
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${
                  article.status === 'published'
                    ? 'border-[rgba(184,115,51,0.4)] text-[#B87333] bg-[rgba(184,115,51,0.08)]'
                    : 'border-[rgba(184,115,51,0.2)] text-[#A89070] hover:bg-[#231F1B]'
                }`}
              >
                {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                {article.status === 'published' ? 'Published' : 'Publish'}
              </button>
            )}
            {article.content && (
              <button
                onClick={() => agentOpen ? setAgentOpen(false) : openAgent(article)}
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${
                  agentOpen
                    ? 'bg-[rgba(184,115,51,0.08)] border-[rgba(184,115,51,0.25)] text-[#A0622A]'
                    : 'border-[rgba(184,115,51,0.2)] text-[#A89070] hover:bg-[#231F1B]'
                }`}
              >
                <Bot className="w-4 h-4" />
                Agent
              </button>
            )}
          </div>
        </div>

        {scoreError && (
          <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {scoreError}
          </div>
        )}

        <div className="flex items-center gap-4 mb-4 text-xs text-[#7A6555]">
          <span className="capitalize">{article.status}</span>
        </div>

        {/* Meta description */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-medium text-[#A89070]">Meta Description</label>
            {article.content && (
              <button
                onClick={handleGenerateMeta}
                disabled={metaGenerating}
                className="flex items-center gap-1 text-xs font-medium transition-colors disabled:opacity-50"
                style={{ color: '#B87333' }}
              >
                {metaGenerating
                  ? <><Loader2 className="w-3 h-3 animate-spin" /> Generating…</>
                  : <><Wand2 className="w-3 h-3" /> Auto-generate</>}
              </button>
            )}
          </div>
          <textarea
            value={metaDesc}
            onChange={(e) => setMetaDesc(e.target.value)}
            onBlur={handleMetaDescBlur}
            placeholder="Write a compelling meta description (150–160 characters)…"
            rows={2}
            className="w-full text-sm border border-[rgba(184,115,51,0.2)] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#B87333] focus:border-transparent resize-none text-[#A89070] placeholder-gray-400"
            style={{ background: '#1C1917' }}
          />
          <div className="flex items-center justify-between mt-1">
            <span className={`text-xs tabular-nums ${metaDesc.length > 160 ? 'text-red-500' : 'text-[#7A6555]'}`}>
              {metaDesc.length}/160
            </span>
            {metaSaving && <span className="text-xs text-[#7A6555]">Saving…</span>}
          </div>
        </div>

        {/* Tabs */}
        {article.content && (
          <div className="flex gap-1 mb-5 border-b border-[rgba(184,115,51,0.2)]">
            {(['content', 'scores'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                  activeTab === tab ? 'border-[#B87333] text-[#B87333]' : 'border-transparent text-[#A89070] hover:text-[#A89070]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        )}

        {/* Content tab */}
        {(activeTab === 'content' || !article.content) && (
          <div>
            {article.content ? (
              <ArticleEditor
                articleId={id}
                initialContent={article.content}
                getTextRef={getEditorTextRef}
                getWordCountRef={getEditorWordCountRef}
                replaceContentRef={replaceContentRef}
                applyContentRef={applyContentRef}
                applyAtRangeRef={applyAtRangeRef}
                onSelectionChange={handleSelectionChange}
              />
            ) : (
              <div className="border-2 border-dashed border-[rgba(184,115,51,0.2)] rounded-xl p-10 text-center">
                <p className="text-sm text-[#A89070] mb-3">No content yet.</p>
                {article.status === 'brief_ready' && (
                  <Link href="/articles/new" className="text-sm text-[#B87333] hover:text-[#A0622A] font-medium">
                    Continue in article wizard →
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {/* Scores tab */}
        {activeTab === 'scores' && article.content && (
          <div>
            {!scores ? (
              <div className="border-2 border-dashed border-[rgba(184,115,51,0.2)] rounded-xl p-10 text-center">
                <BarChart2 className="w-8 h-8 text-[#A89070] mx-auto mb-3" />
                <p className="text-sm text-[#A89070] mb-4">No scores yet. Click &quot;Score Article&quot; to analyze this content.</p>
                <button
                  onClick={handleScore}
                  disabled={scoring}
                  className="flex items-center gap-2 mx-auto px-4 py-2 bg-[#B87333] text-[#F7F3EC] text-sm font-medium rounded-lg hover:bg-[#A0622A] disabled:opacity-50 transition-colors"
                >
                  {scoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Score Article
                </button>
              </div>
            ) : (
              <div className="space-y-5">

                {/* ── Target keyword card ─────────────────────────────── */}
                <div ref={kwCardRef} className="bg-[#1C1917] border border-[rgba(184,115,51,0.2)] rounded-xl p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[#F7F3EC]">Target Keyword</span>
                      {kwStats?.intent && (
                        <span className="text-xs px-2 py-0.5 rounded-full capitalize" style={{ background: 'rgba(184,115,51,0.1)', color: '#B87333' }}>
                          {kwStats.intent}
                        </span>
                      )}
                    </div>
                    {!kwEditMode && (
                      <button
                        onClick={() => { setKwEditMode(true); setKwSearch(article.target_keyword ?? '') }}
                        className="text-xs font-medium transition-colors flex items-center gap-1"
                        style={{ color: '#7A6555' }}
                      >
                        <Pencil className="w-3 h-3" /> Retarget
                      </button>
                    )}
                  </div>

                  {kwEditMode ? (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          autoFocus
                          value={kwSearch}
                          onChange={(e) => setKwSearch(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter' && kwSearch.trim()) handleRetarget(kwSearch) }}
                          placeholder="Type a keyword or search saved…"
                          className="flex-1 text-sm border border-[rgba(184,115,51,0.25)] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#B87333]"
                          style={{ background: '#231F1B', color: '#F7F3EC' }}
                        />
                        <button
                          onClick={() => handleRetarget(kwSearch)}
                          disabled={!kwSearch.trim() || kwRetargeting}
                          className="px-3 py-2 text-xs font-medium rounded-lg disabled:opacity-40 transition-colors"
                          style={{ background: '#B87333', color: '#F7F3EC' }}
                        >
                          {kwRetargeting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Apply'}
                        </button>
                        <button
                          onClick={() => { setKwEditMode(false); setKwSearch(''); setKwResults([]) }}
                          className="text-xs transition-colors"
                          style={{ color: '#7A6555' }}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      {kwSearching && <p className="text-xs py-1" style={{ color: '#7A6555' }}>Searching…</p>}
                      {kwResults.length > 0 && (
                        <div className="rounded-lg overflow-hidden border border-[rgba(184,115,51,0.15)] mt-1">
                          {kwResults.map((kw) => (
                            <button
                              key={kw.id}
                              onClick={() => handleRetarget(kw.keyword)}
                              className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-[#2A2420] transition-colors border-t border-[rgba(184,115,51,0.08)] first:border-t-0"
                            >
                              <span className="text-sm" style={{ color: '#F7F3EC' }}>{kw.keyword}</span>
                              <div className="flex items-center gap-3 text-xs shrink-0 ml-3" style={{ color: '#7A6555' }}>
                                {kw.volume !== null && <span>{kw.volume >= 1000 ? `${(kw.volume/1000).toFixed(1)}k` : kw.volume} vol</span>}
                                {kw.difficulty !== null && <span>KD {kw.difficulty}</span>}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {kwSearch.trim() && kwResults.length === 0 && !kwSearching && (
                        <p className="text-xs mt-1" style={{ color: '#7A6555' }}>
                          No saved keyword matches — press Enter or Apply to use &ldquo;{kwSearch}&rdquo; directly.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p className="text-base font-semibold mb-3" style={{ color: '#B87333' }}>
                        {article.target_keyword ?? '—'}
                      </p>
                      {kwStats ? (
                        <div className="flex flex-wrap gap-4">
                          {kwStats.volume !== null && (
                            <div>
                              <p className="text-xs mb-0.5" style={{ color: '#7A6555' }}>Monthly searches</p>
                              <p className="text-sm font-semibold tabular-nums" style={{ color: '#F7F3EC' }}>
                                {kwStats.volume >= 1000 ? `${(kwStats.volume / 1000).toFixed(1)}k` : kwStats.volume}
                              </p>
                            </div>
                          )}
                          {kwStats.difficulty !== null && (
                            <div>
                              <p className="text-xs mb-0.5" style={{ color: '#7A6555' }}>Keyword difficulty</p>
                              <p className={`text-sm font-semibold tabular-nums ${kwStats.difficulty < 30 ? 'text-green-400' : kwStats.difficulty < 60 ? 'text-amber-400' : 'text-red-400'}`}>
                                {kwStats.difficulty} / 100
                              </p>
                            </div>
                          )}
                          {kwStats.cpc !== null && (
                            <div>
                              <p className="text-xs mb-0.5" style={{ color: '#7A6555' }}>CPC</p>
                              <p className="text-sm font-semibold tabular-nums" style={{ color: '#F7F3EC' }}>
                                ${Number(kwStats.cpc).toFixed(2)}
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs" style={{ color: '#7A6555' }}>
                          No stats — save this keyword in{' '}
                          <a href="/keywords" style={{ color: '#B87333' }} className="hover:underline">Keyword Research</a> to see volume and difficulty.
                        </p>
                      )}

                      {/* Suggestions section */}
                      {!kwEditMode && (
                        <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(184,115,51,0.1)' }}>
                          {!kwSuggestionsLoaded && (
                            <button
                              onClick={loadKwSuggestions}
                              disabled={kwSuggestionsLoading}
                              className="flex items-center gap-2 text-xs font-medium transition-colors disabled:opacity-50"
                              style={{ color: '#B87333' }}
                            >
                              {kwSuggestionsLoading
                                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Agent is analyzing alternatives…</>
                                : <><Sparkles className="w-3.5 h-3.5" /> Find better keywords</>}
                            </button>
                          )}
                          {kwSuggestionsLoaded && kwSuggestions.length === 0 && (
                            <p className="text-xs" style={{ color: '#7A6555' }}>No saved keywords make a clearly better target. Research more keywords first.</p>
                          )}
                          {kwSuggestions.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold mb-2" style={{ color: '#A89070' }}>Agent suggestions</p>
                              <div className="space-y-2">
                                {kwSuggestions.map((s) => (
                                  <button
                                    key={s.keyword}
                                    onClick={() => handleRetarget(s.keyword)}
                                    disabled={kwRetargeting}
                                    className="w-full text-left rounded-lg px-3 py-2.5 transition-colors group"
                                    style={{ background: 'rgba(184,115,51,0.06)', border: '1px solid rgba(184,115,51,0.15)' }}
                                  >
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-sm font-medium group-hover:text-[#B87333] transition-colors" style={{ color: '#F7F3EC' }}>{s.keyword}</span>
                                      <div className="flex items-center gap-2 text-xs shrink-0 ml-2" style={{ color: '#7A6555' }}>
                                        {s.volume !== null && <span>{s.volume >= 1000 ? `${(s.volume/1000).toFixed(1)}k` : s.volume} vol</span>}
                                        {s.difficulty !== null && (
                                          <span className={s.difficulty < 30 ? 'text-green-400' : s.difficulty < 60 ? 'text-amber-400' : 'text-red-400'}>
                                            KD {s.difficulty}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <p className="text-xs" style={{ color: '#7A6555' }}>{s.reason}</p>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {[
                    { label: 'SEO', score: scores.seo.score },
                    { label: 'Readability', score: scores.readability.score },
                    { label: 'GEO', score: scores.geo.score },
                    { label: 'AEO', score: scores.aeo.score },
                  ].map(({ label, score }) => (
                    <div key={label} className="bg-[#1C1917] border border-[rgba(184,115,51,0.2)] rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold mb-1" style={{ color: COPPER }}>{score}</div>
                      <div className="text-xs font-semibold text-[#7A6555] uppercase tracking-wide">{label}</div>
                      <div className="mt-2 w-full bg-[#2A2420] rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-amber-400' : 'bg-red-400'}`}
                          style={{ width: `${score}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-[#1C1917] border border-[rgba(184,115,51,0.2)] rounded-xl p-5">
                  <h3 className="font-semibold text-[#F7F3EC] text-sm mb-4">Score Overview</h3>
                  <div className="space-y-3">
                    <ScoreBar label="SEO" score={scores.seo.score} />
                    <ScoreBar label="Readability" score={scores.readability.score} />
                    <ScoreBar label="GEO (Generative Engine)" score={scores.geo.score} />
                    <ScoreBar label="AEO (Answer Engine)" score={scores.aeo.score} />
                  </div>
                </div>

                {/* Action Items */}
                {actionItems && (
                  <div className="bg-[#1C1917] border border-[rgba(184,115,51,0.2)] rounded-xl p-5">
                    <h3 className="font-semibold text-[#F7F3EC] text-sm mb-4">Action Items</h3>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      {(
                        [
                          { key: 'seo', label: 'SEO', items: actionItems.seo },
                          { key: 'geo', label: 'GEO', items: actionItems.geo },
                          { key: 'aeo', label: 'AEO', items: actionItems.aeo },
                          { key: 'readability', label: 'Readability', items: actionItems.readability },
                        ] as const
                      ).map(({ key, label, items }) => (
                        <div key={key}>
                          <p className="text-xs font-semibold text-[#D4954A] uppercase tracking-wide mb-2">{label}</p>
                          <ActionItemsList items={items} category={label} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="bg-[#1C1917] border border-[rgba(184,115,51,0.2)] rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-[#F7F3EC] text-sm">SEO Breakdown</h3>
                      <span className="font-bold text-base" style={{ color: COPPER }}>{scores.seo.score}/100</span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {Object.values(scores.seo.breakdown).map((c, i) => (
                        <SEOCriteriaRow key={i} label={c.label} passed={c.passed} points={c.points} max={c.max} />
                      ))}
                    </div>
                  </div>

                  <div className="bg-[#1C1917] border border-[rgba(184,115,51,0.2)] rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-[#F7F3EC] text-sm">AEO Breakdown</h3>
                      <span className="font-bold text-base" style={{ color: COPPER }}>{scores.aeo.score}/100</span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {Object.values(scores.aeo.breakdown).map((c, i) => (
                        <CriteriaRow key={i} label={c.label} passed={c.passed} />
                      ))}
                    </div>
                  </div>

                  <div className="bg-[#1C1917] border border-[rgba(184,115,51,0.2)] rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-[#F7F3EC] text-sm">GEO Breakdown</h3>
                      <span className="font-bold text-base" style={{ color: COPPER }}>{scores.geo.score}/100</span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {Object.values(scores.geo.breakdown).map((c, i) => (
                        <CriteriaRow key={i} label={c.label} passed={c.passed} />
                      ))}
                    </div>
                  </div>

                  <div className="bg-[#1C1917] border border-[rgba(184,115,51,0.2)] rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-[#F7F3EC] text-sm">Readability</h3>
                      <span className="font-bold text-base" style={{ color: COPPER }}>{scores.readability.score}/100</span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {Object.values(scores.readability.breakdown).map((c, i) => (
                        <div key={i} className="py-1.5 text-xs text-[#A89070]">{c.label}</div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="bg-[#1C1917] border border-[rgba(184,115,51,0.2)] rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="w-4 h-4 text-[#D4954A]" />
                      <h3 className="font-semibold text-[#F7F3EC] text-sm">Ranking Prediction</h3>
                    </div>
                    <p className="text-sm text-[#A89070] mb-3 leading-relaxed">{scores.ranking_prediction.timeline}</p>
                    <div className="flex items-center gap-3 flex-wrap">
                      <ConfidenceChip confidence={scores.ranking_prediction.confidence} />
                      {/keyword|competitive|different|difficult/i.test(scores.ranking_prediction.timeline) && (
                        <button
                          onClick={() => { loadKwSuggestions() }}
                          disabled={kwSuggestionsLoading}
                          className="flex items-center gap-1.5 text-xs font-medium transition-colors disabled:opacity-50"
                          style={{ color: '#B87333' }}
                        >
                          {kwSuggestionsLoading
                            ? <><Loader2 className="w-3 h-3 animate-spin" /> Finding alternatives…</>
                            : <><Sparkles className="w-3 h-3" /> Suggest better keywords</>}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="bg-[#1C1917] border border-[rgba(184,115,51,0.2)] rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <BarChart2 className="w-4 h-4 text-[#D4954A]" />
                      <h3 className="font-semibold text-[#F7F3EC] text-sm">Traffic Prediction (monthly)</h3>
                    </div>
                    <table className="w-full text-xs">
                      <tbody className="divide-y divide-gray-50">
                        {([
                          { rank: 1, visits: scores.traffic_prediction.at_rank_1, ctr: '28%' },
                          { rank: 3, visits: scores.traffic_prediction.at_rank_3, ctr: '11%' },
                          { rank: 5, visits: scores.traffic_prediction.at_rank_5, ctr: '6%' },
                          { rank: 10, visits: scores.traffic_prediction.at_rank_10, ctr: '2%' },
                        ]).map(({ rank, visits, ctr }) => (
                          <tr key={rank}>
                            <td className="py-1.5 text-[#A89070]">Position {rank}</td>
                            <td className="py-1.5 text-[#7A6555] text-right">{ctr} CTR</td>
                            <td className="py-1.5 font-semibold text-[#A89070] text-right tabular-nums">
                              {visits.toLocaleString()} <span className="font-normal text-[#7A6555]">visits</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Agent panel */}
      {agentOpen && (
        <div className="w-96 shrink-0 border-l border-[rgba(184,115,51,0.2)] bg-[#1C1917] flex flex-col" style={{ height: '100vh', position: 'sticky', top: 0 }}>
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(184,115,51,0.15)] shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 animate-pulse" />
              <span className="font-semibold text-[#F7F3EC] text-sm">Byline Agent</span>
            </div>
            <button
              onClick={() => setAgentOpen(false)}
              className="text-[#7A6555] hover:text-[#A89070] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Mode selector */}
          {(() => {
            const canAssist = userPlan === 'pro' || userPlan === 'team' || userPlan === 'agency'
            const canAuto = userPlan === 'team' || userPlan === 'agency'
            return (
              <div className="shrink-0 px-3 py-2.5 border-b border-[rgba(184,115,51,0.15)]">
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => { if (canAuto) { setShowUpgradePrompt(false); setAgentMode('auto') } }}
                    disabled={!canAuto}
                    title={canAuto ? undefined : 'Team plan required'}
                    className={`relative flex flex-col items-start px-2.5 py-2 rounded-lg border text-left transition-colors ${
                      !canAuto ? 'opacity-40 cursor-not-allowed border-[rgba(184,115,51,0.15)] text-[#7A6555]'
                      : agentMode === 'auto'
                        ? 'bg-[#B87333] border-[#B87333] text-[#F7F3EC]'
                        : 'border-[rgba(184,115,51,0.2)] text-[#A89070] hover:bg-[#231F1B]'
                    }`}
                  >
                    {canAuto ? <Wand2 className="w-3.5 h-3.5 mb-1" /> : <Lock className="w-3.5 h-3.5 mb-1" />}
                    <span className="text-xs font-semibold leading-none">Auto</span>
                    <span className={`text-[10px] leading-tight mt-1 ${agentMode === 'auto' && canAuto ? 'text-[#F7F3EC]/70' : 'text-[#7A6555]'}`}>{canAuto ? 'Fix everything' : 'Team only'}</span>
                  </button>
                  <button
                    onClick={() => { if (canAssist) { setShowUpgradePrompt(false); setAgentMode('assist') } }}
                    disabled={!canAssist}
                    title={canAssist ? undefined : 'Pro plan required'}
                    className={`relative flex flex-col items-start px-2.5 py-2 rounded-lg border text-left transition-colors ${
                      !canAssist ? 'opacity-40 cursor-not-allowed border-[rgba(184,115,51,0.15)] text-[#7A6555]'
                      : agentMode === 'assist'
                        ? 'bg-[#231F1B] border-[rgba(184,115,51,0.5)] text-[#F7F3EC]'
                        : 'border-[rgba(184,115,51,0.2)] text-[#A89070] hover:bg-[#231F1B]'
                    }`}
                  >
                    {canAssist ? <Pencil className="w-3.5 h-3.5 mb-1" /> : <Lock className="w-3.5 h-3.5 mb-1" />}
                    <span className="text-xs font-semibold leading-none">Assist</span>
                    <span className={`text-[10px] leading-tight mt-1 ${agentMode === 'assist' && canAssist ? 'text-[#F7F3EC]/70' : 'text-[#7A6555]'}`}>{canAssist ? 'Fix one thing' : 'Pro only'}</span>
                  </button>
                  <button
                    onClick={() => { setShowUpgradePrompt(false); setAgentMode('review') }}
                    className={`relative flex flex-col items-start px-2.5 py-2 rounded-lg border text-left transition-colors ${
                      agentMode === 'review'
                        ? 'bg-[#231F1B] border-[rgba(184,115,51,0.5)] text-[#F7F3EC]'
                        : 'border-[rgba(184,115,51,0.2)] text-[#A89070] hover:bg-[#231F1B]'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5 mb-1" />
                    <span className="text-xs font-semibold leading-none">Review</span>
                    <span className={`text-[10px] leading-tight mt-1 ${agentMode === 'review' ? 'text-[#F7F3EC]/70' : 'text-[#7A6555]'}`}>Second opinion</span>
                  </button>
                </div>
              </div>
            )
          })()}

          {/* Upgrade prompt for free users */}
          {!scores ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <Bot className="w-10 h-10 text-[#A89070] mb-3" />
              <p className="text-sm text-[#A89070] mb-4">Score the article first to unlock the agent.</p>
              <button
                onClick={handleScore}
                disabled={scoring}
                className="flex items-center gap-2 px-4 py-2 bg-[#B87333] text-[#F7F3EC] text-sm font-medium rounded-lg hover:bg-[#A0622A] disabled:opacity-50 transition-colors"
              >
                {scoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Score Article
              </button>
            </div>
          ) : (
            <>
              {/* Auto mode panel */}
              {agentMode === 'auto' && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  {agentStreaming ? (
                    /* Live streaming output */
                    <div className="flex-1 flex flex-col min-h-0">
                      <div className="shrink-0 flex items-center gap-2.5 px-4 py-2.5 border-b border-[rgba(184,115,51,0.1)]">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: '#B87333' }} />
                        <span className="text-xs" style={{ color: '#A89070' }}>Rewriting…</span>
                        <span className="text-xs tabular-nums ml-auto" style={{ color: '#4A3E35' }}>
                          {(agentMessages[0]?.content.length ?? 0).toLocaleString()} chars
                        </span>
                      </div>
                      <div ref={autoStreamRef} className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
                        <pre className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: '#7A6555', fontFamily: 'inherit' }}>
                          {agentMessages[0]?.content}
                        </pre>
                      </div>
                    </div>
                  ) : autoApplied ? (
                    /* Applied — show success + revert option */
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                      <CheckCircle2 className="w-8 h-8 text-green-500 mb-3" />
                      <p className="text-sm font-semibold mb-1" style={{ color: '#F7F3EC' }}>Article rewritten</p>
                      <p className="text-xs mb-6" style={{ color: '#A89070' }}>
                        Applied to editor · saving automatically
                      </p>
                      <button
                        onClick={() => openHistory()}
                        className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border transition-colors mb-2"
                        style={{ color: '#A89070', borderColor: 'rgba(184,115,51,0.25)' }}
                      >
                        <History className="w-3.5 h-3.5" /> View history to revert
                      </button>
                      <button
                        onClick={() => { setAutoResult(''); setAutoApplied(false); setAgentMessages([]) }}
                        className="text-xs transition-colors mt-1"
                        style={{ color: '#4A3E35' }}
                      >
                        Run again
                      </button>
                    </div>
                  ) : agentMessages.length > 0 ? (
                    /* Error state */
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                      <AlertCircle className="w-6 h-6 text-red-400 mb-3" />
                      <p className="text-xs leading-relaxed" style={{ color: '#A89070' }}>{agentMessages[0]?.content}</p>
                      <button
                        onClick={() => setAgentMessages([])}
                        className="mt-4 text-xs transition-colors"
                        style={{ color: '#7A6555' }}
                      >
                        Dismiss
                      </button>
                    </div>
                  ) : (
                    /* Ready state — instruction input + run button */
                    <div className="flex-1 flex flex-col p-4 gap-4">
                      <p className="text-xs leading-relaxed" style={{ color: '#7A6555' }}>
                        Reads your article, audit scores, and brand profile — then applies every failing criterion in one pass. Previous version saved automatically so you can revert anytime.
                      </p>
                      <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: '#A89070' }}>
                          Focus instructions <span style={{ color: '#4A3E35' }}>(optional)</span>
                        </label>
                        <textarea
                          value={autoInstruction}
                          onChange={(e) => setAutoInstruction(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.metaKey) sendAutoMode(autoInstruction)
                          }}
                          placeholder={'e.g. "strengthen the intro" · "add more data points" · "don\'t change the conclusion"'}
                          rows={3}
                          className="w-full text-sm border border-[rgba(184,115,51,0.2)] rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-[#B87333] focus:border-transparent placeholder-gray-600"
                          style={{ background: '#1C1917', color: '#F7F3EC' }}
                        />
                      </div>
                      <button
                        onClick={() => sendAutoMode(autoInstruction)}
                        disabled={agentStreaming}
                        className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
                        style={{ background: '#B87333', color: '#F7F3EC' }}
                      >
                        <Wand2 className="w-4 h-4" />
                        Rewrite Article
                      </button>
                      <p className="text-xs text-center" style={{ color: '#3A342E' }}>⌘ + Enter to run</p>
                    </div>
                  )}
                </div>
              )}

              {/* Assist mode context bar */}
              {agentMode === 'assist' && (
                <div className="shrink-0 border-b border-[rgba(184,115,51,0.15)] px-4 py-3">
                  {selectedText ? (
                    <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(184,115,51,0.08)', border: '1px solid rgba(184,115,51,0.2)' }}>
                      <p className="text-xs font-semibold mb-1" style={{ color: '#D4954A' }}>Selected text</p>
                      <p className="text-xs truncate" style={{ color: '#A89070' }}>{selectedText.slice(0, 80)}{selectedText.length > 80 ? '…' : ''}</p>
                    </div>
                  ) : (
                    <p className="text-xs" style={{ color: '#7A6555' }}>Select text in the article to use Assist mode, or describe what to fix below.</p>
                  )}
                </div>
              )}

              {/* Message thread — Review + Assist */}
              {(agentMode === 'review' || agentMode === 'assist') && (
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0" ref={messagesContainerRef}>
                  {agentMessages.map((msg, i) => {
                    const applicable = msg.role === 'assistant' ? extractApplicableContent(msg.content) : null
                    return (
                      <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className="rounded-xl px-3 py-2.5 text-sm max-w-[85%] whitespace-pre-wrap leading-relaxed"
                          style={msg.role === 'user'
                            ? { background: 'rgba(184,115,51,0.15)', color: '#F7F3EC' }
                            : { background: '#2A2520', color: '#E8E0D5' }}
                        >
                          {msg.content}
                          {applicable && (
                            <button
                              onClick={() => applyContentRef.current?.(applicable)}
                              className="mt-2 block text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors"
                              style={{ background: 'rgba(184,115,51,0.08)', color: '#B87333', borderColor: 'rgba(184,115,51,0.25)' }}
                            >
                              Apply to article
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {assistApplied && (
                    <div className="flex justify-center">
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                        <span className="text-xs font-medium text-green-700">Applied ✓</span>
                      </div>
                    </div>
                  )}
                  <div />
                </div>
              )}

              {/* Input — Review mode */}
              {agentMode === 'review' && (
                <div className="shrink-0 border-t border-[rgba(184,115,51,0.15)] px-3 py-3">
                  <div className="flex items-end gap-2">
                    <textarea
                      value={agentInput}
                      onChange={(e) => setAgentInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          const trimmed = agentInput.trim()
                          if (trimmed && !agentStreaming) sendAgentMessage(trimmed, agentMessages)
                        }
                      }}
                      placeholder="Ask for specific fixes, examples, or ideas…"
                      disabled={agentStreaming}
                      rows={1}
                      className="flex-1 resize-none text-sm border border-[rgba(184,115,51,0.2)] rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#B87333] focus:border-transparent disabled:opacity-50 placeholder-gray-400"
                      style={{ maxHeight: '120px', overflowY: 'auto', background: '#1C1917', color: '#F7F3EC' }}
                    />
                    <button
                      onClick={() => { const t = agentInput.trim(); if (t && !agentStreaming) sendAgentMessage(t, agentMessages) }}
                      disabled={!agentInput.trim() || agentStreaming}
                      className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl hover:bg-[#A0622A] disabled:opacity-40 transition-colors"
                      style={{ background: '#B87333', color: '#F7F3EC' }}
                    >
                      {agentStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs mt-1.5 px-1" style={{ color: '#7A6555' }}>Enter to send · Shift+Enter for newline</p>
                </div>
              )}

              {/* Input — Assist mode */}
              {agentMode === 'assist' && (
                <div className="shrink-0 border-t border-[rgba(184,115,51,0.15)] px-3 py-3">
                  <div className="flex items-end gap-2">
                    <textarea
                      value={assistInput}
                      onChange={(e) => setAssistInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          const trimmed = assistInput.trim()
                          if (trimmed && !agentStreaming) sendAgentMessage('', [], { selectedText, fixInstruction: trimmed, selectionRange })
                        }
                      }}
                      placeholder={selectedText ? 'Rewrite this to be more specific and include the primary keyword' : 'Describe what to fix or improve…'}
                      disabled={agentStreaming}
                      rows={2}
                      className="flex-1 resize-none text-sm border border-[rgba(184,115,51,0.2)] rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#B87333] focus:border-transparent disabled:opacity-50 placeholder-gray-400"
                      style={{ background: '#1C1917', color: '#F7F3EC' }}
                    />
                    <button
                      onClick={() => { const t = assistInput.trim(); if (t && !agentStreaming) sendAgentMessage('', [], { selectedText, fixInstruction: t, selectionRange }) }}
                      disabled={!assistInput.trim() || agentStreaming}
                      className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl hover:bg-[#A0622A] disabled:opacity-40 transition-colors"
                      style={{ background: '#B87333', color: '#F7F3EC' }}
                    >
                      {agentStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs mt-1.5 px-1" style={{ color: '#7A6555' }}>Enter to send · Shift+Enter for newline</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── History panel ─────────────────────────────────────────────── */}
      {historyOpen && (
        <div className="w-80 shrink-0 border-l border-[rgba(184,115,51,0.2)] bg-[#1C1917] flex flex-col" style={{ height: '100vh', position: 'sticky', top: 0 }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(184,115,51,0.15)] shrink-0">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4" style={{ color: '#B87333' }} />
              <span className="font-semibold text-[#F7F3EC] text-sm">Version History</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => saveSnapshot('Manual save', 'manual').then(openHistory)}
                className="text-xs font-medium transition-colors px-2 py-1 rounded"
                style={{ color: '#B87333', background: 'rgba(184,115,51,0.08)' }}
                title="Save current version"
              >
                Save now
              </button>
              <button onClick={() => { setHistoryOpen(false); setPreviewVersion(null) }} className="text-[#7A6555] hover:text-[#A89070]">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {previewVersion ? (
            /* Version preview */
            <div className="flex-1 flex flex-col min-h-0">
              <div className="px-4 py-3 border-b border-[rgba(184,115,51,0.1)] shrink-0">
                <button onClick={() => setPreviewVersion(null)} className="flex items-center gap-1.5 text-xs mb-2" style={{ color: '#7A6555' }}>
                  <ArrowLeft className="w-3 h-3" /> Back to list
                </button>
                <p className="text-sm font-semibold text-[#F7F3EC]">{previewVersion.label ?? 'Saved version'}</p>
                <p className="text-xs mt-0.5" style={{ color: '#7A6555' }}>
                  {new Date(previewVersion.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </p>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
                <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: '#A89070' }}>
                  {previewVersion.content.slice(0, 1200)}{previewVersion.content.length > 1200 ? '…' : ''}
                </p>
              </div>
              <div className="shrink-0 px-4 py-3 border-t border-[rgba(184,115,51,0.1)]">
                <button
                  onClick={() => restoreVersion(previewVersion.id)}
                  disabled={restoring}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  style={{ background: '#B87333', color: '#F7F3EC' }}
                >
                  {restoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                  Restore this version
                </button>
              </div>
            </div>
          ) : (
            /* Version list */
            <div className="flex-1 overflow-y-auto min-h-0">
              {versionsLoading ? (
                <div className="flex items-center justify-center h-24 gap-2" style={{ color: '#7A6555' }}>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Loading…</span>
                </div>
              ) : versions.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Clock className="w-8 h-8 mx-auto mb-2" style={{ color: '#3A342E' }} />
                  <p className="text-sm" style={{ color: '#7A6555' }}>No saved versions yet.</p>
                  <p className="text-xs mt-1" style={{ color: '#4A3E35' }}>Versions are saved automatically before agent edits.</p>
                </div>
              ) : (
                <div>
                  {versions.map((v, i) => (
                    <button
                      key={v.id}
                      onClick={() => previewVersionContent(v.id)}
                      className="w-full text-left px-4 py-3 hover:bg-[#231F1B] transition-colors"
                      style={{ borderTop: i > 0 ? '1px solid rgba(184,115,51,0.08)' : undefined }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#F7F3EC] leading-snug">{v.label ?? 'Saved version'}</p>
                          <p className="text-xs mt-0.5" style={{ color: '#7A6555' }}>
                            {new Date(v.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </p>
                        </div>
                        <div className="shrink-0 flex flex-col items-end gap-1">
                          {v.word_count && (
                            <span className="text-xs tabular-nums" style={{ color: '#4A3E35' }}>{v.word_count.toLocaleString()} w</span>
                          )}
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                            v.trigger === 'agent_auto' ? 'text-blue-400 bg-blue-900/20'
                            : v.trigger === 'agent_assist' ? 'text-amber-400 bg-amber-900/20'
                            : 'text-[#7A6555] bg-[#2A2420]'
                          }`}>
                            {v.trigger === 'agent_auto' ? 'Auto' : v.trigger === 'agent_assist' ? 'Assist' : 'Manual'}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Fork dialog ───────────────────────────────────────────────── */}
      {forkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="w-full max-w-md mx-4 rounded-2xl p-6" style={{ background: '#231F1B', border: '1px solid rgba(184,115,51,0.25)' }}>
            <div className="flex items-center gap-3 mb-4">
              <GitFork className="w-5 h-5" style={{ color: '#B87333' }} />
              <h2 className="text-base font-semibold text-[#F7F3EC]">Fork this article</h2>
            </div>
            <p className="text-sm mb-4" style={{ color: '#A89070' }}>
              Creates a copy of the full content and brief so you can explore a different keyword angle without losing the original.
            </p>
            <div className="mb-5">
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#A89070' }}>New target keyword <span style={{ color: '#4A3E35' }}>(optional — leave blank to keep current)</span></label>
              <input
                autoFocus
                value={forkKeyword}
                onChange={(e) => setForkKeyword(e.target.value)}
                placeholder={article?.target_keyword ?? 'Enter a keyword…'}
                className="w-full text-sm border border-[rgba(184,115,51,0.25)] rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#B87333]"
                style={{ background: '#1C1917', color: '#F7F3EC' }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleFork() }}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setForkOpen(false); setForkKeyword('') }}
                className="flex-1 px-4 py-2.5 text-sm rounded-lg border transition-colors"
                style={{ color: '#A89070', borderColor: 'rgba(184,115,51,0.2)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleFork}
                disabled={forking}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                style={{ background: '#B87333', color: '#F7F3EC' }}
              >
                {forking ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitFork className="w-4 h-4" />}
                {forking ? 'Forking…' : 'Fork article'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}