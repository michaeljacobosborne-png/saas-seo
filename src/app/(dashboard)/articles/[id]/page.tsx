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
} from 'lucide-react'

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

function ScoreBar({ label, score }: { label: string; score: number }) {
  const barColor = score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-sm font-bold tabular-nums" style={{ color: COPPER }}>{score}</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2.5">
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
      <div className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${passed ? 'bg-green-100' : 'bg-gray-100'}`}>
        <div className={`w-2 h-2 rounded-full ${passed ? 'bg-green-500' : 'bg-gray-300'}`} />
      </div>
      <span className={`text-xs flex-1 ${passed ? 'text-gray-700' : 'text-gray-400'}`}>{label}</span>
    </div>
  )
}

function SEOCriteriaRow({ label, passed, points, max }: { label: string; passed: boolean; points: number; max: number }) {
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <div className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${passed ? 'bg-green-100' : 'bg-gray-100'}`}>
        <div className={`w-2 h-2 rounded-full ${passed ? 'bg-green-500' : 'bg-gray-300'}`} />
      </div>
      <span className={`text-xs flex-1 ${passed ? 'text-gray-700' : 'text-gray-400'}`}>{label}</span>
      <span className="text-xs tabular-nums font-medium text-gray-500 shrink-0">{points}/{max}</span>
    </div>
  )
}

export default function ArticleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const supabase = createClient()

  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)
  const [scoring, setScoring] = useState(false)
  const [scoreError, setScoreError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'content' | 'scores'>('content')
  const getEditorTextRef = useRef<(() => string) | null>(null)
  const applyContentRef = useRef<((markdown: string) => void) | null>(null)
  const applyAtRangeRef = useRef<((from: number, to: number, html: string) => void) | null>(null)
  const [metaDesc, setMetaDesc] = useState('')
  const [metaSaving, setMetaSaving] = useState(false)
  const metaInitialized = useRef(false)

  // Agent state
  const [agentOpen, setAgentOpen] = useState(false)
  const [agentMode, setAgentMode] = useState<'review' | 'assist'>('review')
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
  const agentModeRef = useRef<'review' | 'assist'>('review')

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

  // Clear messages when entering Assist mode
  useEffect(() => {
    if (agentMode === 'assist') {
      setAgentMessages([])
      setAssistApplied(false)
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

    if (!res.ok || !res.body) {
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
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!article) {
    return (
      <div className="p-8">
        <Link href="/articles" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-4">
          <ArrowLeft className="w-4 h-4" /> Articles
        </Link>
        <p className="text-gray-500">Article not found.</p>
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
            <Link href="/articles" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-3 transition-colors w-fit">
              <ArrowLeft className="w-4 h-4" />
              Articles
            </Link>
            <h1 className="text-xl font-bold text-gray-900 leading-snug">
              {article.title ?? article.target_keyword ?? 'Untitled'}
            </h1>
            {article.target_keyword && article.title && (
              <p className="text-sm text-gray-400 mt-0.5">Target: <span className="font-medium text-gray-600">{article.target_keyword}</span></p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            {article.content && (
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
              >
                {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy Markdown'}
              </button>
            )}
            {article.content && (
              <button
                onClick={handleScore}
                disabled={scoring}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {scoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {scores ? 'Re-score' : 'Score Article'}
              </button>
            )}
            {article.content && (
              <button
                onClick={() => agentOpen ? setAgentOpen(false) : openAgent(article)}
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${
                  agentOpen
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
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

        <div className="flex items-center gap-4 mb-4 text-xs text-gray-400">
          <span className="capitalize">{article.status}</span>
        </div>

        {/* Meta description */}
        <div className="mb-6">
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Meta Description</label>
          <textarea
            value={metaDesc}
            onChange={(e) => setMetaDesc(e.target.value)}
            onBlur={handleMetaDescBlur}
            placeholder="Write a compelling meta description (150–160 characters)…"
            rows={2}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none text-gray-700 placeholder-gray-400"
          />
          <div className="flex items-center justify-between mt-1">
            <span className={`text-xs tabular-nums ${metaDesc.length > 160 ? 'text-red-500' : 'text-gray-400'}`}>
              {metaDesc.length}/160
            </span>
            {metaSaving && <span className="text-xs text-gray-400">Saving…</span>}
          </div>
        </div>

        {/* Tabs */}
        {article.content && (
          <div className="flex gap-1 mb-5 border-b border-gray-200">
            {(['content', 'scores'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                  activeTab === tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
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
                applyContentRef={applyContentRef}
                applyAtRangeRef={applyAtRangeRef}
                onSelectionChange={handleSelectionChange}
              />
            ) : (
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center">
                <p className="text-sm text-gray-500 mb-3">No content yet.</p>
                {article.status === 'brief_ready' && (
                  <Link href="/articles/new" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
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
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center">
                <BarChart2 className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500 mb-4">No scores yet. Click &quot;Score Article&quot; to analyze this content.</p>
                <button
                  onClick={handleScore}
                  disabled={scoring}
                  className="flex items-center gap-2 mx-auto px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
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
                    <div key={label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold mb-1" style={{ color: COPPER }}>{score}</div>
                      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</div>
                      <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-amber-400' : 'bg-red-400'}`}
                          style={{ width: `${score}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <h3 className="font-semibold text-gray-800 text-sm mb-4">Score Overview</h3>
                  <div className="space-y-3">
                    <ScoreBar label="SEO" score={scores.seo.score} />
                    <ScoreBar label="Readability" score={scores.readability.score} />
                    <ScoreBar label="GEO (Generative Engine)" score={scores.geo.score} />
                    <ScoreBar label="AEO (Answer Engine)" score={scores.aeo.score} />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-800 text-sm">SEO Breakdown</h3>
                      <span className="font-bold text-base" style={{ color: COPPER }}>{scores.seo.score}/100</span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {Object.values(scores.seo.breakdown).map((c, i) => (
                        <SEOCriteriaRow key={i} label={c.label} passed={c.passed} points={c.points} max={c.max} />
                      ))}
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-800 text-sm">AEO Breakdown</h3>
                      <span className="font-bold text-base" style={{ color: COPPER }}>{scores.aeo.score}/100</span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {Object.values(scores.aeo.breakdown).map((c, i) => (
                        <CriteriaRow key={i} label={c.label} passed={c.passed} />
                      ))}
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-800 text-sm">GEO Breakdown</h3>
                      <span className="font-bold text-base" style={{ color: COPPER }}>{scores.geo.score}/100</span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {Object.values(scores.geo.breakdown).map((c, i) => (
                        <CriteriaRow key={i} label={c.label} passed={c.passed} />
                      ))}
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-800 text-sm">Readability</h3>
                      <span className="font-bold text-base" style={{ color: COPPER }}>{scores.readability.score}/100</span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {Object.values(scores.readability.breakdown).map((c, i) => (
                        <div key={i} className="py-1.5 text-xs text-gray-600">{c.label}</div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="w-4 h-4 text-indigo-500" />
                      <h3 className="font-semibold text-gray-800 text-sm">Ranking Prediction</h3>
                    </div>
                    <p className="text-sm text-gray-700 mb-3 leading-relaxed">{scores.ranking_prediction.timeline}</p>
                    <ConfidenceChip confidence={scores.ranking_prediction.confidence} />
                  </div>

                  <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <BarChart2 className="w-4 h-4 text-indigo-500" />
                      <h3 className="font-semibold text-gray-800 text-sm">Traffic Prediction (monthly)</h3>
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
                            <td className="py-1.5 text-gray-500">Position {rank}</td>
                            <td className="py-1.5 text-gray-400 text-right">{ctr} CTR</td>
                            <td className="py-1.5 font-semibold text-gray-700 text-right tabular-nums">
                              {visits.toLocaleString()} <span className="font-normal text-gray-400">visits</span>
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
        <div className="w-96 shrink-0 border-l border-gray-200 bg-white flex flex-col" style={{ height: '100vh', position: 'sticky', top: 0 }}>
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 animate-pulse" />
              <span className="font-semibold text-gray-800 text-sm">Byline Agent</span>
              <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
                {(['review', 'assist'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setAgentMode(m)}
                    className={`px-2.5 py-0.5 text-xs font-medium rounded-md transition-colors ${
                      agentMode === m
                        ? 'bg-white text-gray-800 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {m === 'review' ? 'Review' : 'Assist'}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => setAgentOpen(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* No scores gate */}
          {!scores ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <Bot className="w-10 h-10 text-gray-300 mb-3" />
              <p className="text-sm text-gray-500 mb-4">Score the article first to unlock the agent.</p>
              <button
                onClick={handleScore}
                disabled={scoring}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {scoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Score Article
              </button>
            </div>
          ) : (
            <>
              {/* Assist mode context bar */}
              {agentMode === 'assist' && (
                <div className="shrink-0 border-b border-gray-100 px-4 py-3">
                  {selectedText ? (
                    <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                      <p className="text-xs font-semibold text-amber-700 mb-1">&#9999;&#65039; Selected</p>
                      <p className="text-xs text-gray-600 line-clamp-2">
                        &ldquo;{selectedText.slice(0, 80)}{selectedText.length > 80 ? '…' : ''}&rdquo;
                      </p>
                    </div>
                  ) : scoreFailures.length > 0 ? (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-2">Top issues to fix</p>
                      <div className="space-y-2">
                        {scoreFailures.map((f, i) => (
                          <div key={i} className="flex items-start justify-between gap-3">
                            <span className="text-xs text-gray-600 flex-1 leading-snug">{f.label}</span>
                            <button
                              onClick={() => {
                                if (!agentStreaming) {
                                  sendAgentMessage('', [], { fixInstruction: f.instruction, selectionRange: null })
                                }
                              }}
                              disabled={agentStreaming}
                              className="shrink-0 text-xs font-semibold text-indigo-600 hover:text-indigo-800 disabled:opacity-40 whitespace-nowrap"
                            >
                              Fix with Agent &rarr;
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 text-center py-1">
                      Select text in the editor to rewrite it, or pick a score issue to fix.
                    </p>
                  )}
                </div>
              )}

              {/* Messages */}
              <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {agentMessages.length === 0 && !agentStreaming && agentMode === 'review' && (
                  <div className="text-center text-xs text-gray-400 py-8">Starting review&hellip;</div>
                )}
                {agentMessages.length === 0 && !agentStreaming && agentMode === 'assist' && (
                  <div className="text-center text-xs text-gray-400 py-8">
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
                        <div className="max-w-[85%] px-3.5 py-2.5 bg-indigo-600 text-white text-sm rounded-2xl rounded-tr-sm leading-relaxed">
                          {msg.content}
                        </div>
                      ) : (
                        <div className="max-w-[92%] px-3.5 py-2.5 bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-2xl rounded-tl-sm leading-relaxed whitespace-pre-wrap">
                          {msg.content}
                          {isStreamingThis && (
                            <span className="inline-block w-0.5 h-3.5 bg-indigo-500 ml-0.5 animate-pulse align-middle" />
                          )}
                        </div>
                      )}
                      {/* TODO: gate Apply button behind premium check */}
                      {applicable && (
                        <button
                          onClick={() => applyContentRef.current?.(applicable)}
                          className="mt-1 text-xs font-medium px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors border border-indigo-200"
                        >
                          Apply to article
                        </button>
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
                <div className="shrink-0 border-t border-gray-100 px-3 py-3">
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
                      className="flex-1 resize-none text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 placeholder-gray-400"
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
                      className="shrink-0 w-9 h-9 flex items-center justify-center bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                    >
                      {agentStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5 px-1">Enter to send &middot; Shift+Enter for newline</p>
                </div>
              )}

              {/* Input — Assist mode with selected text */}
              {agentMode === 'assist' && selectedText && (
                <div className="shrink-0 border-t border-gray-100 px-3 py-3">
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
                      className="flex-1 resize-none text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 placeholder-gray-400"
                    />
                    <button
                      onClick={() => {
                        const trimmed = assistInput.trim()
                        if (trimmed && !agentStreaming) {
                          sendAgentMessage('', [], { selectedText, fixInstruction: trimmed, selectionRange })
                        }
                      }}
                      disabled={!assistInput.trim() || agentStreaming}
                      className="shrink-0 w-9 h-9 flex items-center justify-center bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                    >
                      {agentStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5 px-1">Enter to send &middot; Shift+Enter for newline</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
