'use client'

import { use, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { marked } from 'marked'
import { createClient } from '@/lib/supabase/client'
import type { Article, ArticleScores } from '@/lib/supabase/types'
import {
  ArrowLeft, Copy, CopyPlus, CheckCircle2, Loader2, Sparkles,
  TrendingUp, AlertCircle, BarChart2, Bot, X, Send, Lock, Wand2,
  Image as ImageIcon, RefreshCw, ChevronRight, Globe,
} from 'lucide-react'

const ArticleEditor = dynamic(() => import('./ArticleEditor'), { ssr: false })

const COPPER = '#B87333'

type AgentMessage = { role: 'user' | 'assistant'; content: string }

type ImageConcept = {
  headline: string
  prompt: string
  style: string
  alt_text: string
  rationale: string
}

const STYLE_BADGES: Record<string, string> = {
  photorealistic: 'bg-blue-50 text-blue-700',
  illustration: 'bg-purple-50 text-purple-700',
  abstract: 'bg-pink-50 text-pink-700',
  '3d-render': 'bg-emerald-50 text-emerald-700',
  'flat-design': 'bg-amber-50 text-amber-700',
}

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

function ScoreBar({ label, score }: { label: string; score: number }) {
  const barColor = score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-[var(--cream-dim)]">{label}</span>
        <span className="text-sm font-bold tabular-nums" style={{ color: COPPER }}>{score}</span>
      </div>
      <div className="w-full bg-[var(--ink-deep)] rounded-full h-2.5">
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
      <div className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${passed ? 'bg-green-100' : 'bg-[var(--ink-deep)]'}`}>
        <div className={`w-2 h-2 rounded-full ${passed ? 'bg-green-500' : 'bg-gray-300'}`} />
      </div>
      <span className={`text-xs flex-1 ${passed ? 'text-[var(--cream-dim)]' : 'text-[var(--cream-faint)]'}`}>{label}</span>
    </div>
  )
}

function SEOCriteriaRow({ label, passed, points, max }: { label: string; passed: boolean; points: number; max: number }) {
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <div className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${passed ? 'bg-green-100' : 'bg-[var(--ink-deep)]'}`}>
        <div className={`w-2 h-2 rounded-full ${passed ? 'bg-green-500' : 'bg-gray-300'}`} />
      </div>
      <span className={`text-xs flex-1 ${passed ? 'text-[var(--cream-dim)]' : 'text-[var(--cream-faint)]'}`}>{label}</span>
      <span className="text-xs tabular-nums font-medium text-[var(--cream-dim)] shrink-0">{points}/{max}</span>
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
  const [duplicating, setDuplicating] = useState(false)
  const [duplicateError, setDuplicateError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'content' | 'scores'>('content')
  const getEditorTextRef = useRef<(() => string) | null>(null)
  const replaceContentRef = useRef<((markdown: string) => void) | null>(null)
  const getWordCountRef = useRef<(() => number) | null>(null)
  const applyContentRef = useRef<((markdown: string) => void) | null>(null)
  const applyAtRangeRef = useRef<((from: number, to: number, html: string) => void) | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [metaDesc, setMetaDesc] = useState('')
  const [metaSaving, setMetaSaving] = useState(false)
  const [generatingMeta, setGeneratingMeta] = useState(false)
  const [metaError, setMetaError] = useState<string | null>(null)
  const metaInitialized = useRef(false)

  // Featured image prompt state (kept in component state across the session)
  const [imageConcepts, setImageConcepts] = useState<ImageConcept[] | null>(null)
  const [generatingImages, setGeneratingImages] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const [copiedPromptIndex, setCopiedPromptIndex] = useState<number | null>(null)
  const [copiedAltIndex, setCopiedAltIndex] = useState<number | null>(null)
  const [expandedRationale, setExpandedRationale] = useState<number | null>(null)

  // Agent state
  const [agentOpen, setAgentOpen] = useState(false)
  const [agentMode, setAgentMode] = useState<'review' | 'assist' | 'auto'>('review')
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([])
  const [agentInput, setAgentInput] = useState('')
  const [agentStreaming, setAgentStreaming] = useState(false)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const initialSentRef = useRef(false)

  // Auto mode state
  const [autoInstruction, setAutoInstruction] = useState('')
  const [autoApplied, setAutoApplied] = useState(false)
  // Buffered full-article rewrite awaiting the user's accept/reject decision.
  // Nothing touches the editor until the user explicitly applies it.
  const [autoProposal, setAutoProposal] = useState<string | null>(null)
  const autoStreamRef = useRef<HTMLDivElement>(null)

  // Assist mode state
  const [selectedText, setSelectedText] = useState('')
  const [selectionRange, setSelectionRange] = useState<{ from: number; to: number } | null>(null)
  const [assistInput, setAssistInput] = useState('')
  const [assistApplied, setAssistApplied] = useState(false)
  const agentModeRef = useRef<'review' | 'assist' | 'auto'>('review')

  // Free tier state
  const [accountType, setAccountType] = useState<string | null>(null)
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false)

  // Brand switcher state (Multi-Brand plan)
  const [brandProfiles, setBrandProfiles] = useState<Array<{ id: string; brand_name: string }>>([])
  const [switchingBrand, setSwitchingBrand] = useState(false)
  const [brandSwitchError, setBrandSwitchError] = useState<string | null>(null)

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
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('profiles')
        .select('account_type')
        .eq('user_id', user.id)
        .maybeSingle()
      setAccountType(data?.account_type ?? null)
    }
    loadProfile()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    async function loadBrandProfiles() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('brand_profiles')
        .select('id, brand_name')
        .eq('user_id', user.id)
        .order('brand_name', { ascending: true })
      setBrandProfiles((data as Array<{ id: string; brand_name: string }>) ?? [])
    }
    loadBrandProfiles()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const el = messagesContainerRef.current
    if (!el) return
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100
    if (isNearBottom) el.scrollTop = el.scrollHeight
  }, [agentMessages])

  // Pre-fill assist input when a new selection is made
  useEffect(() => {
    if (selectedText && agentModeRef.current === 'assist') {
      setAssistInput('Rewrite this to be more specific and include the primary keyword')
    }
  }, [selectedText])

  // Clear messages when entering Assist or Auto mode
  useEffect(() => {
    if (agentMode === 'assist' || agentMode === 'auto') {
      setAgentMessages([])
      setAssistApplied(false)
      setAutoApplied(false)
      setAutoProposal(null)
    }
  }, [agentMode])

  // Auto-scroll live auto mode output as it streams
  useEffect(() => {
    if (autoStreamRef.current) {
      autoStreamRef.current.scrollTop = autoStreamRef.current.scrollHeight
    }
  }, [agentMessages])

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

    try {
      const res = await fetch(`/api/articles/${id}/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        const errorMsg = (errorData as { error?: string }).error ?? 'Something went wrong. Please try again.'
        setAgentMessages((prev) => [...prev, { role: 'assistant', content: errorMsg }])
        return
      }
      if (!res.body) {
        setAgentMessages((prev) => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }])
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

      if (isAssist && lastResponseRef.current) {
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
    } catch (err) {
      // Network drop / aborted stream / parse failure — surface gracefully instead of
      // letting the rejection bubble up and crash the page via the Next.js error overlay.
      console.error('[agent] Stream failed:', err)
      setAgentMessages((prev) => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }])
    } finally {
      setAgentStreaming(false)
    }
  }, [id])

  const sendAutoMode = useCallback(async (instruction?: string) => {
    setAgentMessages([])
    setAutoApplied(false)
    setAutoProposal(null)
    setAgentStreaming(true)

    // Watchdog: if the stream stalls (serverless timeout severs the connection
    // without a clean close), reader.read() would hang forever and freeze the
    // spinner. Abort on inactivity so the catch/finally always runs.
    const controller = new AbortController()
    let watchdog: ReturnType<typeof setTimeout> | undefined
    const resetWatchdog = () => {
      if (watchdog) clearTimeout(watchdog)
      watchdog = setTimeout(() => controller.abort(), 90_000)
    }

    try {
      resetWatchdog()
      const res = await fetch(`/api/articles/${id}/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [], mode: 'auto', userInstruction: instruction?.trim() || undefined }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        const errorMsg = (errorData as { error?: string }).error ?? 'Something went wrong. Please try again.'
        setAgentMessages([{ role: 'assistant', content: errorMsg }])
        return
      }
      if (!res.body) {
        setAgentMessages([{ role: 'assistant', content: 'Something went wrong. Please try again.' }])
        return
      }

      setAgentMessages([{ role: 'assistant', content: '' }])
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullResult = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        resetWatchdog()
        const text = decoder.decode(value)
        fullResult += text
        setAgentMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = { ...updated[updated.length - 1], content: updated[updated.length - 1].content + text }
          return updated
        })
      }

      if (fullResult.trim()) {
        // Buffer the rewrite for review — do NOT auto-apply. The user accepts or
        // dismisses it with a single click before anything touches the editor.
        setAutoProposal(fullResult)
      } else {
        setAgentMessages([{ role: 'assistant', content: 'The rewrite came back empty. Please try again.' }])
      }
    } catch (err) {
      // Network drop / aborted stream / parse failure — surface gracefully instead of
      // letting the rejection bubble up and crash the page via the Next.js error overlay.
      console.error('[auto-mode] Rewrite failed:', err)
      const aborted = err instanceof DOMException && err.name === 'AbortError'
      setAgentMessages([{
        role: 'assistant',
        content: aborted
          ? 'The rewrite timed out. Please try again.'
          : 'The rewrite was interrupted. Please try again.',
      }])
    } finally {
      if (watchdog) clearTimeout(watchdog)
      setAgentStreaming(false)
    }
  }, [id])

  const applyAutoProposal = useCallback(() => {
    setAutoProposal((proposal) => {
      if (proposal) {
        // Full replacement via replaceContentRef (setContent, not insertContent at cursor).
        // Autosave persists it; the editor's undo (⌘/Ctrl+Z) reverts.
        replaceContentRef.current?.(proposal)
        setAutoApplied(true)
      }
      return null
    })
  }, [])

  const dismissAutoProposal = useCallback(() => {
    setAutoProposal(null)
    setAgentMessages([])
  }, [])

  function openAgent(currentArticle: Article) {
    setAgentOpen(true)
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
    if (!article?.content || generatingMeta) return
    setGeneratingMeta(true)
    setMetaError(null)
    try {
      const res = await fetch(`/api/articles/${id}/meta-description`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        setMetaError(json.error ?? 'Failed to generate meta description')
        return
      }
      const generated = (json.meta_description ?? '').trim()
      if (!generated) {
        setMetaError('No meta description was returned')
        return
      }
      setMetaDesc(generated)
      setMetaSaving(true)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('articles').update({ meta_description: generated }).eq('id', id)
      if (error) {
        console.error('[meta-description] Save failed:', error)
        setMetaError('Generated but failed to save')
      }
      setMetaSaving(false)
    } catch (err) {
      console.error('[meta-description] Generate failed:', err)
      setMetaError('Failed to generate meta description')
    } finally {
      setGeneratingMeta(false)
    }
  }

  async function handleCopy() {
    if (!article?.content) return
    const text = getEditorTextRef.current ? getEditorTextRef.current() : article.content
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleGenerateImagePrompts() {
    if (!article?.content || generatingImages) return
    setGeneratingImages(true)
    setImageError(null)
    try {
      const res = await fetch(`/api/articles/${id}/image-prompts`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        setImageError(json.error ?? 'Failed to generate image concepts')
        return
      }
      if (!Array.isArray(json.concepts) || json.concepts.length === 0) {
        setImageError('No concepts were returned')
        return
      }
      setImageConcepts(json.concepts as ImageConcept[])
    } catch (err) {
      console.error('[image-prompts] Generate failed:', err)
      setImageError('Failed to generate image concepts')
    } finally {
      setGeneratingImages(false)
    }
  }

  async function handleCopyPrompt(prompt: string, index: number) {
    await navigator.clipboard.writeText(prompt)
    setCopiedPromptIndex(index)
    setTimeout(() => setCopiedPromptIndex((cur) => (cur === index ? null : cur)), 2000)
  }

  async function handleCopyAlt(altText: string, index: number) {
    await navigator.clipboard.writeText(altText)
    setCopiedAltIndex(index)
    setTimeout(() => setCopiedAltIndex((cur) => (cur === index ? null : cur)), 2000)
  }

  async function handleDuplicate() {
    if (duplicating) return
    setDuplicating(true)
    setDuplicateError(null)
    try {
      const res = await fetch(`/api/articles/${id}/fork`, { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.id) {
        setDuplicateError(json.error ?? 'Failed to duplicate article')
        setDuplicating(false)
        return
      }
      router.push(`/articles/${json.id}`)
    } catch {
      setDuplicateError('Failed to duplicate article')
      setDuplicating(false)
    }
  }

  async function handleSwitchBrand(newBrandId: string) {
    if (!article || switchingBrand) return
    if (newBrandId === (article.brand_profile_id ?? '')) return
    setSwitchingBrand(true)
    setBrandSwitchError(null)
    try {
      const res = await fetch(`/api/articles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_profile_id: newBrandId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.article) {
        setBrandSwitchError(json.error ?? 'Failed to switch brand')
        return
      }
      // Re-fetch the article so the new brand context flows into subsequent agent calls.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any).from('articles').select('*').eq('id', id).single()
      setArticle(data as Article | null)
    } catch {
      setBrandSwitchError('Failed to switch brand')
    } finally {
      setSwitchingBrand(false)
    }
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
    if (!error) setArticle({ ...article, status: newStatus })
    setPublishing(false)
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
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 animate-spin text-[var(--cream-faint)]" />
      </div>
    )
  }

  if (!article) {
    return (
      <div className="p-8">
        <Link href="/articles" className="flex items-center gap-1.5 text-sm text-[var(--cream-faint)] hover:text-[var(--cream-dim)] mb-4">
          <ArrowLeft className="w-4 h-4" /> Articles
        </Link>
        <p className="text-[var(--cream-dim)]">Article not found.</p>
      </div>
    )
  }

  const scores = article.scores as ArticleScores | null
  const scoreFailures = scores ? getScoreFailures(scores, article.target_keyword ?? '') : []

  return (
    <div className={`flex gap-0 h-full min-h-screen ${agentOpen ? 'pr-0' : ''}`}>
      {/* Main content */}
      <div className={`flex-1 min-w-0 p-8 transition-all duration-300 ${agentOpen ? 'max-w-none' : 'max-w-4xl'}`}>
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="min-w-0 flex-1">
            <Link href="/articles" className="flex items-center gap-1.5 text-sm text-[var(--cream-faint)] hover:text-[var(--cream-dim)] mb-3 transition-colors w-fit">
              <ArrowLeft className="w-4 h-4" />
              Articles
            </Link>
            <h1 className="text-xl font-bold text-[var(--cream)] leading-snug">
              {article.title ?? article.target_keyword ?? 'Untitled'}
            </h1>
            {article.target_keyword && article.title && (
              <p className="text-sm text-[var(--cream-faint)] mt-0.5">Target: <span className="font-medium text-[var(--cream-dim)]">{article.target_keyword}</span></p>
            )}
            {brandProfiles.length > 1 && (
              <div className="flex items-center gap-2 mt-2">
                <label htmlFor="brand-switch" className="text-xs font-medium text-[var(--cream-faint)] shrink-0">Brand:</label>
                <div className="relative inline-flex items-center">
                  <select
                    id="brand-switch"
                    value={article.brand_profile_id ?? ''}
                    onChange={(e) => handleSwitchBrand(e.target.value)}
                    disabled={switchingBrand}
                    className="text-xs text-[var(--cream-dim)] bg-[var(--ink-card)] border border-[rgba(184,115,51,0.2)] rounded-lg pl-2.5 pr-7 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#B87333] focus:border-transparent disabled:opacity-50 appearance-none cursor-pointer"
                  >
                    {!article.brand_profile_id && <option value="">No brand</option>}
                    {brandProfiles.map((b) => (
                      <option key={b.id} value={b.id}>{b.brand_name}</option>
                    ))}
                  </select>
                  <ChevronRight className="w-3.5 h-3.5 text-[var(--cream-faint)] absolute right-2 rotate-90 pointer-events-none" />
                </div>
                {switchingBrand && <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--cream-faint)]" />}
                {brandSwitchError && <span className="text-xs text-red-500">{brandSwitchError}</span>}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            <button
              onClick={handleDuplicate}
              disabled={duplicating}
              title="Duplicate article"
              className="flex items-center gap-2 px-3 py-2 text-sm border border-[rgba(184,115,51,0.2)] rounded-lg hover:bg-[var(--ink-card)] text-[var(--cream-dim)] disabled:opacity-50 transition-colors"
            >
              {duplicating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CopyPlus className="w-4 h-4" />}
              {duplicating ? 'Duplicating…' : 'Duplicate'}
            </button>
            {article.content && (
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 px-3 py-2 text-sm border border-[rgba(184,115,51,0.2)] rounded-lg hover:bg-[var(--ink-card)] text-[var(--cream-dim)] transition-colors"
              >
                {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy Markdown'}
              </button>
            )}
            {article.content && (
              <button
                onClick={handleScore}
                disabled={scoring}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-[#B87333] text-white rounded-lg hover:bg-[#A0622A] disabled:opacity-50 transition-colors"
              >
                {scoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {scores ? 'Re-score' : 'Score Article'}
              </button>
            )}
            {article.content && (
              <button
                onClick={handlePublish}
                disabled={publishing}
                title={article.status === 'published' ? 'Mark as Complete (unpublish)' : 'Mark as Published'}
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors disabled:opacity-50 ${
                  article.status === 'published'
                    ? 'border-[rgba(184,115,51,0.4)] text-[var(--copper)] bg-[rgba(184,115,51,0.08)]'
                    : 'border-[rgba(184,115,51,0.2)] text-[var(--cream-dim)] hover:bg-[var(--ink-card)]'
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
                    : 'border-[rgba(184,115,51,0.2)] text-[var(--cream-dim)] hover:bg-[var(--ink-card)]'
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

        {duplicateError && (
          <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {duplicateError}
          </div>
        )}

        <div className="flex items-center gap-4 mb-4 text-xs text-[var(--cream-faint)]">
          <span className="capitalize">{article.status}</span>
        </div>

        {/* Meta description */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-medium text-[var(--cream-dim)]">Meta Description</label>
            {article.content && (
              <button
                onClick={handleGenerateMeta}
                disabled={generatingMeta}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs border border-[rgba(184,115,51,0.2)] rounded-lg hover:bg-[var(--ink-card)] text-[var(--cream-dim)] disabled:opacity-50 transition-colors"
              >
                {generatingMeta ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                {generatingMeta ? 'Generating…' : 'Auto-generate'}
              </button>
            )}
          </div>
          <textarea
            value={metaDesc}
            onChange={(e) => setMetaDesc(e.target.value)}
            onBlur={handleMetaDescBlur}
            placeholder="Write a compelling meta description (150–160 characters)…"
            rows={2}
            className="w-full text-sm border border-[rgba(184,115,51,0.2)] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#B87333] focus:border-transparent resize-none text-[var(--cream-dim)] placeholder-gray-400"
          />
          <div className="flex items-center justify-between mt-1">
            <span className={`text-xs tabular-nums ${metaDesc.length > 160 ? 'text-red-500' : 'text-[var(--cream-faint)]'}`}>
              {metaDesc.length}/160
            </span>
            {metaError ? (
              <span className="text-xs text-red-500">{metaError}</span>
            ) : metaSaving ? (
              <span className="text-xs text-[var(--cream-faint)]">Saving…</span>
            ) : null}
          </div>
        </div>

        {/* Featured image */}
        {article.content && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[var(--copper-lt)]" />
                <h3 className="text-sm font-semibold text-[var(--cream)]">Featured Image</h3>
              </div>
              <button
                onClick={handleGenerateImagePrompts}
                disabled={generatingImages}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#B87333] text-white rounded-lg hover:bg-[#A0622A] disabled:opacity-50 transition-colors"
              >
                {generatingImages ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : imageConcepts ? (
                  <RefreshCw className="w-3.5 h-3.5" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                {generatingImages ? 'Generating concepts…' : imageConcepts ? 'Regenerate' : 'Generate concepts'}
              </button>
            </div>
            <div className="border-b border-[rgba(184,115,51,0.2)] mb-4" />

            {imageError && (
              <div className="mb-4 flex items-center justify-between gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                <span className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {imageError}
                </span>
                <button
                  onClick={handleGenerateImagePrompts}
                  disabled={generatingImages}
                  className="shrink-0 text-xs font-semibold text-red-700 hover:text-red-900 disabled:opacity-50"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Skeletons on first generation */}
            {generatingImages && !imageConcepts && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="bg-[var(--ink)] border border-[rgba(184,115,51,0.2)] rounded-xl p-4 animate-pulse">
                    <div className="h-4 w-2/3 bg-[var(--ink-deep)] rounded mb-3" />
                    <div className="h-5 w-20 bg-[var(--ink-deep)] rounded-full mb-3" />
                    <div className="h-24 w-full bg-[var(--ink-deep)] rounded mb-3" />
                    <div className="h-3 w-full bg-[var(--ink-deep)] rounded mb-2" />
                    <div className="h-3 w-1/2 bg-[var(--ink-deep)] rounded" />
                  </div>
                ))}
              </div>
            )}

            {/* Concept cards */}
            {imageConcepts && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {imageConcepts.map((concept, i) => (
                  <div key={i} className="bg-[var(--ink)] border border-[rgba(184,115,51,0.2)] rounded-xl p-4 flex flex-col">
                    <h4 className="text-sm font-bold text-[var(--cream)] leading-snug">{concept.headline}</h4>
                    <span
                      className={`mt-2 self-start text-xs font-medium px-2.5 py-1 rounded-full ${
                        STYLE_BADGES[concept.style] ?? 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {concept.style}
                    </span>
                    <pre className="mt-3 text-xs font-mono text-[var(--cream-dim)] whitespace-pre-wrap break-words bg-[var(--ink-card)] border border-[rgba(184,115,51,0.15)] rounded-lg p-3 select-text max-h-44 overflow-y-auto">
                      {concept.prompt}
                    </pre>
                    <button
                      onClick={() => handleCopyPrompt(concept.prompt, i)}
                      className="mt-2 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[rgba(184,115,51,0.25)] rounded-lg hover:bg-[var(--ink-card)] text-[var(--cream-dim)] transition-colors"
                    >
                      {copiedPromptIndex === i ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      {copiedPromptIndex === i ? 'Copied!' : 'Copy prompt'}
                    </button>
                    {concept.alt_text && (
                      <div className="mt-2.5 bg-[var(--ink-card)] border border-[rgba(184,115,51,0.15)] rounded-lg p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--cream-faint)]">
                            Alt text
                          </span>
                          <button
                            onClick={() => handleCopyAlt(concept.alt_text, i)}
                            className="flex items-center gap-1 text-[10px] font-medium text-[var(--cream-dim)] hover:text-[var(--cream)] transition-colors"
                          >
                            {copiedAltIndex === i ? (
                              <CheckCircle2 className="w-3 h-3 text-green-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            {copiedAltIndex === i ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                        <p className="mt-1 text-xs text-[var(--cream-dim)] leading-relaxed">{concept.alt_text}</p>
                      </div>
                    )}
                    <button
                      onClick={() => setExpandedRationale((cur) => (cur === i ? null : i))}
                      className="mt-2.5 flex items-center gap-1 text-xs font-medium text-[var(--copper)] hover:text-[#A0622A] transition-colors"
                    >
                      <ChevronRight
                        className={`w-3.5 h-3.5 transition-transform ${expandedRationale === i ? 'rotate-90' : ''}`}
                      />
                      Why this works
                    </button>
                    {expandedRationale === i && (
                      <p className="mt-1.5 text-xs text-[var(--cream-dim)] leading-relaxed">{concept.rationale}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        {article.content && (
          <div className="flex gap-1 mb-5 border-b border-[rgba(184,115,51,0.2)]">
            {(['content', 'scores'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                  activeTab === tab ? 'border-[#B87333] text-[var(--copper)]' : 'border-transparent text-[var(--cream-dim)] hover:text-[var(--cream-dim)]'
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
                getWordCountRef={getWordCountRef}
                replaceContentRef={replaceContentRef}
                applyContentRef={applyContentRef}
                applyAtRangeRef={applyAtRangeRef}
                onSelectionChange={handleSelectionChange}
              />
            ) : (
              <div className="border-2 border-dashed border-[rgba(184,115,51,0.2)] rounded-xl p-10 text-center">
                <p className="text-sm text-[var(--cream-dim)] mb-3">No content yet.</p>
                {article.status === 'brief_ready' && (
                  <Link href="/articles/new" className="text-sm text-[var(--copper)] hover:text-[#A0622A] font-medium">
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
                <BarChart2 className="w-8 h-8 text-[var(--cream-dim)] mx-auto mb-3" />
                <p className="text-sm text-[var(--cream-dim)] mb-4">No scores yet. Click &quot;Score Article&quot; to analyze this content.</p>
                <button
                  onClick={handleScore}
                  disabled={scoring}
                  className="flex items-center gap-2 mx-auto px-4 py-2 bg-[#B87333] text-white text-sm font-medium rounded-lg hover:bg-[#A0622A] disabled:opacity-50 transition-colors"
                >
                  {scoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Score Article
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {[
                    { label: 'SEO', score: scores.seo.score },
                    { label: 'Readability', score: scores.readability.score },
                    { label: 'GEO', score: scores.geo.score },
                    { label: 'AEO', score: scores.aeo.score },
                  ].map(({ label, score }) => (
                    <div key={label} className="bg-[var(--ink)] border border-[rgba(184,115,51,0.2)] rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold mb-1" style={{ color: COPPER }}>{score}</div>
                      <div className="text-xs font-semibold text-[var(--cream-faint)] uppercase tracking-wide">{label}</div>
                      <div className="mt-2 w-full bg-[var(--ink-deep)] rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-amber-400' : 'bg-red-400'}`}
                          style={{ width: `${score}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-[var(--ink)] border border-[rgba(184,115,51,0.2)] rounded-xl p-5">
                  <h3 className="font-semibold text-[var(--cream)] text-sm mb-4">Score Overview</h3>
                  <div className="space-y-3">
                    <ScoreBar label="SEO" score={scores.seo.score} />
                    <ScoreBar label="Readability" score={scores.readability.score} />
                    <ScoreBar label="GEO (Generative Engine)" score={scores.geo.score} />
                    <ScoreBar label="AEO (Answer Engine)" score={scores.aeo.score} />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="bg-[var(--ink)] border border-[rgba(184,115,51,0.2)] rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-[var(--cream)] text-sm">SEO Breakdown</h3>
                      <span className="font-bold text-base" style={{ color: COPPER }}>{scores.seo.score}/100</span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {Object.values(scores.seo.breakdown).map((c, i) => (
                        <SEOCriteriaRow key={i} label={c.label} passed={c.passed} points={c.points} max={c.max} />
                      ))}
                    </div>
                  </div>

                  <div className="bg-[var(--ink)] border border-[rgba(184,115,51,0.2)] rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-[var(--cream)] text-sm">AEO Breakdown</h3>
                      <span className="font-bold text-base" style={{ color: COPPER }}>{scores.aeo.score}/100</span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {Object.values(scores.aeo.breakdown).map((c, i) => (
                        <CriteriaRow key={i} label={c.label} passed={c.passed} />
                      ))}
                    </div>
                  </div>

                  <div className="bg-[var(--ink)] border border-[rgba(184,115,51,0.2)] rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-[var(--cream)] text-sm">GEO Breakdown</h3>
                      <span className="font-bold text-base" style={{ color: COPPER }}>{scores.geo.score}/100</span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {Object.values(scores.geo.breakdown).map((c, i) => (
                        <CriteriaRow key={i} label={c.label} passed={c.passed} />
                      ))}
                    </div>
                  </div>

                  <div className="bg-[var(--ink)] border border-[rgba(184,115,51,0.2)] rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-[var(--cream)] text-sm">Readability</h3>
                      <span className="font-bold text-base" style={{ color: COPPER }}>{scores.readability.score}/100</span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {Object.values(scores.readability.breakdown).map((c, i) => (
                        <div key={i} className="py-1.5 text-xs text-[var(--cream-dim)]">{c.label}</div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="bg-[var(--ink)] border border-[rgba(184,115,51,0.2)] rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="w-4 h-4 text-[var(--copper-lt)]" />
                      <h3 className="font-semibold text-[var(--cream)] text-sm">Ranking Prediction</h3>
                    </div>
                    <p className="text-sm text-[var(--cream-dim)] mb-3 leading-relaxed">{scores.ranking_prediction.timeline}</p>
                    <ConfidenceChip confidence={scores.ranking_prediction.confidence} />
                  </div>

                  <div className="bg-[var(--ink)] border border-[rgba(184,115,51,0.2)] rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <BarChart2 className="w-4 h-4 text-[var(--copper-lt)]" />
                      <h3 className="font-semibold text-[var(--cream)] text-sm">Traffic Prediction (monthly)</h3>
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
                            <td className="py-1.5 text-[var(--cream-dim)]">Position {rank}</td>
                            <td className="py-1.5 text-[var(--cream-faint)] text-right">{ctr} CTR</td>
                            <td className="py-1.5 font-semibold text-[var(--cream-dim)] text-right tabular-nums">
                              {visits.toLocaleString()} <span className="font-normal text-[var(--cream-faint)]">visits</span>
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
        <div className="w-96 shrink-0 border-l border-[rgba(184,115,51,0.2)] bg-[var(--ink)] flex flex-col" style={{ height: '100vh', position: 'sticky', top: 0 }}>
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(184,115,51,0.15)] shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 animate-pulse" />
              <span className="font-semibold text-[var(--cream)] text-sm">Byline Agent</span>
              <div className="flex gap-0.5 bg-[var(--ink-deep)] rounded-lg p-0.5">
                {(['review', 'assist', 'auto'] as const).map((m) => {
                  const locked = m !== 'review' && accountType === 'free'
                  return (
                    <button
                      key={m}
                      onClick={() => {
                        if (locked) {
                          setShowUpgradePrompt(true)
                          return
                        }
                        setShowUpgradePrompt(false)
                        setAgentMode(m)
                      }}
                      className={`px-2.5 py-0.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1 capitalize ${
                        (agentMode === m && !showUpgradePrompt) || (m === 'review' && showUpgradePrompt)
                          ? 'bg-[var(--ink)] text-[var(--cream)] shadow-sm'
                          : 'text-[var(--cream-dim)] hover:text-[var(--cream-dim)]'
                      }`}
                    >
                      {m}
                      {locked && <Lock className="w-2.5 h-2.5" />}
                    </button>
                  )
                })}
              </div>
            </div>
            <button
              onClick={() => setAgentOpen(false)}
              className="text-[var(--cream-faint)] hover:text-[var(--cream-dim)] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Upgrade prompt for free users (Assist + Auto) */}
          {showUpgradePrompt ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-[var(--ink-deep)] flex items-center justify-center mb-3">
                <Lock className="w-5 h-5 text-[var(--cream-faint)]" />
              </div>
              <h3 className="font-semibold text-[var(--cream)] text-sm mb-2">Assist &amp; Auto are paid features</h3>
              <p className="text-sm text-[var(--cream-dim)] mb-5 leading-relaxed">
                Upgrade to let the agent rewrite sections directly — or rewrite your entire article automatically.
              </p>
              <Link
                href="/pricing"
                className="px-4 py-2 bg-[#B87333] text-white text-sm font-medium rounded-lg hover:bg-[#A0622A] transition-colors"
              >
                View plans
              </Link>
            </div>
          ) : !scores ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <Bot className="w-10 h-10 text-[var(--cream-dim)] mb-3" />
              <p className="text-sm text-[var(--cream-dim)] mb-4">Score the article first to unlock the agent.</p>
              <button
                onClick={handleScore}
                disabled={scoring}
                className="flex items-center gap-2 px-4 py-2 bg-[#B87333] text-white text-sm font-medium rounded-lg hover:bg-[#A0622A] disabled:opacity-50 transition-colors"
              >
                {scoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Score Article
              </button>
            </div>
          ) : agentMode === 'auto' ? (
            /* Auto mode — full-article rewrite */
            <div className="flex-1 flex flex-col overflow-hidden">
              {agentStreaming ? (
                /* Live streaming output */
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="shrink-0 flex items-center gap-2.5 px-4 py-2.5 border-b border-[rgba(184,115,51,0.1)]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--copper)]" />
                    <span className="text-xs text-[var(--cream-dim)]">Rewriting…</span>
                    <span className="text-xs tabular-nums ml-auto text-[#4A3E35]">
                      {(agentMessages[0]?.content.length ?? 0).toLocaleString()} chars
                    </span>
                  </div>
                  <div ref={autoStreamRef} className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
                    <pre className="text-xs leading-relaxed whitespace-pre-wrap text-[var(--cream-faint)]" style={{ fontFamily: 'inherit' }}>
                      {agentMessages[0]?.content}
                    </pre>
                  </div>
                </div>
              ) : autoProposal ? (
                /* Review step — proposed rewrite awaiting accept/reject */
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="shrink-0 flex items-center gap-2.5 px-4 py-2.5 border-b border-[rgba(184,115,51,0.1)]">
                    <Sparkles className="w-3.5 h-3.5 text-[var(--copper)]" />
                    <span className="text-xs font-semibold text-[var(--cream)]">Proposed rewrite</span>
                    <span className="text-xs tabular-nums ml-auto text-[#4A3E35]">
                      {autoProposal.length.toLocaleString()} chars
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
                    <pre className="text-xs leading-relaxed whitespace-pre-wrap text-[var(--cream-dim)]" style={{ fontFamily: 'inherit' }}>
                      {autoProposal}
                    </pre>
                  </div>
                  <div className="shrink-0 border-t border-[rgba(184,115,51,0.15)] px-4 py-3">
                    <p className="text-xs text-[var(--cream-faint)] mb-2.5 leading-relaxed">
                      Review the rewrite above. Nothing changes until you apply it — then it saves automatically and you can undo (⌘/Ctrl+Z) in the editor.
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={applyAutoProposal}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl bg-[#B87333] text-white hover:bg-[#A0622A] transition-colors"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Apply changes
                      </button>
                      <button
                        onClick={dismissAutoProposal}
                        className="px-4 py-2.5 text-sm font-medium rounded-xl border border-[rgba(184,115,51,0.25)] text-[var(--cream-dim)] hover:bg-[var(--ink-card)] transition-colors"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              ) : autoApplied ? (
                /* Applied — success state */
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                  <CheckCircle2 className="w-8 h-8 text-green-500 mb-3" />
                  <p className="text-sm font-semibold mb-1 text-[var(--cream)]">Article rewritten</p>
                  <p className="text-xs mb-6 text-[var(--cream-dim)]">
                    Applied to the editor · saving automatically. Use the editor&apos;s undo (⌘/Ctrl+Z) to revert.
                  </p>
                  <button
                    onClick={() => { setAutoApplied(false); setAgentMessages([]) }}
                    className="text-xs text-[var(--cream-faint)] hover:text-[var(--cream-dim)] transition-colors"
                  >
                    Run again
                  </button>
                </div>
              ) : agentMessages.length > 0 ? (
                /* Error state */
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                  <AlertCircle className="w-6 h-6 text-red-400 mb-3" />
                  <p className="text-xs leading-relaxed text-[var(--cream-dim)]">{agentMessages[0]?.content}</p>
                  <button
                    onClick={() => setAgentMessages([])}
                    className="mt-4 text-xs text-[var(--cream-faint)] hover:text-[var(--cream-dim)] transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              ) : (
                /* Ready state — focus instructions + run */
                <div className="flex-1 flex flex-col p-4 gap-4">
                  <p className="text-xs leading-relaxed text-[var(--cream-faint)]">
                    Reads your article, audit scores, and brand profile — then applies every failing criterion in one pass. The rewrite saves automatically; undo in the editor to revert.
                  </p>
                  <div>
                    <label className="block text-xs font-medium mb-1.5 text-[var(--cream-dim)]">
                      Focus instructions <span className="text-[#4A3E35]">(optional)</span>
                    </label>
                    <textarea
                      value={autoInstruction}
                      onChange={(e) => setAutoInstruction(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.metaKey && !agentStreaming) sendAutoMode(autoInstruction)
                      }}
                      placeholder={'e.g. "strengthen the intro" · "add more data points" · "don\'t change the conclusion"'}
                      rows={3}
                      className="w-full text-sm border border-[rgba(184,115,51,0.2)] rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-[#B87333] focus:border-transparent placeholder-gray-600 bg-[var(--ink)] text-[var(--cream)]"
                    />
                  </div>
                  <button
                    onClick={() => sendAutoMode(autoInstruction)}
                    disabled={agentStreaming}
                    className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 bg-[#B87333] text-white hover:bg-[#A0622A]"
                  >
                    <Wand2 className="w-4 h-4" />
                    Rewrite Article
                  </button>
                  <p className="text-xs text-center text-[#3A342E]">⌘ + Enter to run</p>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Assist mode context bar */}
              {agentMode === 'assist' && (
                <div className="shrink-0 border-b border-[rgba(184,115,51,0.15)] px-4 py-3">
                  {selectedText ? (
                    <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                      <p className="text-xs font-semibold text-amber-700 mb-1">&#9999;&#65039; Selected</p>
                      <p className="text-xs text-[var(--cream-dim)] line-clamp-2">
                        &ldquo;{selectedText.slice(0, 80)}{selectedText.length > 80 ? '…' : ''}&rdquo;
                      </p>
                    </div>
                  ) : scoreFailures.length > 0 ? (
                    <div>
                      <p className="text-xs font-semibold text-[var(--cream-dim)] mb-2">Top issues to fix</p>
                      <div className="space-y-2">
                        {scoreFailures.map((f, i) => (
                          <div key={i} className="flex items-start justify-between gap-3">
                            <span className="text-xs text-[var(--cream-dim)] flex-1 leading-snug">{f.label}</span>
                            <button
                              onClick={() => {
                                if (!agentStreaming) {
                                  sendAgentMessage('', [], { fixInstruction: f.instruction, selectionRange: null })
                                }
                              }}
                              disabled={agentStreaming}
                              className="shrink-0 text-xs font-semibold text-[var(--copper)] hover:text-indigo-800 disabled:opacity-40 whitespace-nowrap"
                            >
                              Fix with Agent &rarr;
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--cream-faint)] text-center py-1">
                      Select text in the editor to rewrite it, or pick a score issue to fix.
                    </p>
                  )}
                </div>
              )}

              {/* Messages */}
              <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {agentMessages.length === 0 && !agentStreaming && agentMode === 'review' && (
                  <div className="text-center text-xs text-[var(--cream-faint)] py-8">Starting review&hellip;</div>
                )}
                {agentMessages.length === 0 && !agentStreaming && agentMode === 'assist' && (
                  <div className="text-center text-xs text-[var(--cream-faint)] py-8">
                    {selectedText ? 'Edit the instruction below, then send.' : 'Use the controls above to pick a fix.'}
                  </div>
                )}
                {agentMessages.map((msg, i) => {
                  const isStreamingThis = agentStreaming && i === agentMessages.length - 1
                  const applicable = !isStreamingThis && msg.role === 'assistant' && agentMode === 'review'
                    ? extractApplicableContent(msg.content)
                    : null
                  return (
                    <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                      {msg.role === 'user' ? (
                        <div className="max-w-[85%] px-3.5 py-2.5 bg-[#B87333] text-white text-sm rounded-2xl rounded-tr-sm leading-relaxed">
                          {msg.content}
                        </div>
                      ) : (
                        <div className="max-w-[92%] px-3.5 py-2.5 bg-[var(--ink-card)] border border-[rgba(184,115,51,0.2)] text-[var(--cream)] text-sm rounded-2xl rounded-tl-sm leading-relaxed whitespace-pre-wrap">
                          {msg.content}
                          {isStreamingThis && (
                            <span className="inline-block w-0.5 h-3.5 bg-[rgba(184,115,51,0.08)]0 ml-0.5 animate-pulse align-middle" />
                          )}
                        </div>
                      )}
                      {applicable && (
                        accountType === 'free' ? (
                          <Link
                            href="/pricing"
                            title="Upgrade to apply agent suggestions"
                            className="mt-1 flex items-center gap-1 text-xs font-medium px-2.5 py-1 bg-[rgba(184,115,51,0.05)] text-[var(--cream-faint)] rounded-lg hover:text-[var(--copper)] hover:bg-[rgba(184,115,51,0.1)] transition-colors border border-[rgba(184,115,51,0.2)]"
                          >
                            <Lock className="w-2.5 h-2.5" />
                            Apply to article
                          </Link>
                        ) : (
                          <button
                            onClick={() => applyContentRef.current?.(applicable)}
                            className="mt-1 text-xs font-medium px-2.5 py-1 bg-[rgba(184,115,51,0.08)] text-[var(--copper)] rounded-lg hover:bg-[rgba(184,115,51,0.12)] transition-colors border border-[rgba(184,115,51,0.25)]"
                          >
                            Apply to article
                          </button>
                        )
                      )}
                    </div>
                  )
                })}
                {assistApplied && (
                  <div className="flex justify-center">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                      <span className="text-xs font-medium text-green-700">Applied &#10003;</span>
                    </div>
                  </div>
                )}
                <div />
              </div>

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
                          if (trimmed && !agentStreaming) {
                            sendAgentMessage(trimmed, agentMessages)
                          }
                        }
                      }}
                      placeholder="Ask for specific fixes, examples, or ideas…"
                      disabled={agentStreaming}
                      rows={1}
                      className="flex-1 resize-none text-sm border border-[rgba(184,115,51,0.2)] rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#B87333] focus:border-transparent disabled:opacity-50 placeholder-gray-400"
                      style={{ maxHeight: '120px', overflowY: 'auto' }}
                    />
                    <button
                      onClick={() => {
                        const trimmed = agentInput.trim()
                        if (trimmed && !agentStreaming) {
                          sendAgentMessage(trimmed, agentMessages)
                        }
                      }}
                      disabled={!agentInput.trim() || agentStreaming}
                      className="shrink-0 w-9 h-9 flex items-center justify-center bg-[#B87333] text-white rounded-xl hover:bg-[#A0622A] disabled:opacity-40 transition-colors"
                    >
                      {agentStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-[var(--cream-faint)] mt-1.5 px-1">Enter to send &middot; Shift+Enter for newline</p>
                </div>
              )}

              {/* Input — Assist mode with selected text */}
              {agentMode === 'assist' && selectedText && (
                <div className="shrink-0 border-t border-[rgba(184,115,51,0.15)] px-3 py-3">
                  <div className="flex items-end gap-2">
                    <textarea
                      value={assistInput}
                      onChange={(e) => setAssistInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          const trimmed = assistInput.trim()
                          if (trimmed && !agentStreaming) {
                            sendAgentMessage('', [], { selectedText, fixInstruction: trimmed, selectionRange })
                          }
                        }
                      }}
                      placeholder="Rewrite this to be more specific and include the primary keyword"
                      disabled={agentStreaming}
                      rows={2}
                      className="flex-1 resize-none text-sm border border-[rgba(184,115,51,0.2)] rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#B87333] focus:border-transparent disabled:opacity-50 placeholder-gray-400"
                    />
                    <button
                      onClick={() => {
                        const trimmed = assistInput.trim()
                        if (trimmed && !agentStreaming) {
                          sendAgentMessage('', [], { selectedText, fixInstruction: trimmed, selectionRange })
                        }
                      }}
                      disabled={!assistInput.trim() || agentStreaming}
                      className="shrink-0 w-9 h-9 flex items-center justify-center bg-[#B87333] text-white rounded-xl hover:bg-[#A0622A] disabled:opacity-40 transition-colors"
                    >
                      {agentStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-[var(--cream-faint)] mt-1.5 px-1">Enter to send &middot; Shift+Enter for newline</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
