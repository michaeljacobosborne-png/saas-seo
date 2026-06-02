'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { BrandProfile } from '@/lib/supabase/types'
import {
  ArrowLeft, ArrowRight, Sparkles, Loader2, CheckCircle2,
  AlertCircle, ChevronUp, ChevronDown, FileText, Info,
  Lightbulb, Search, BookOpen, PenLine,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ResearchKeyword {
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

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS = [
  { label: 'Concept', icon: Lightbulb },
  { label: 'Keywords', icon: Search },
  { label: 'Outline', icon: BookOpen },
  { label: 'Write', icon: PenLine },
]

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1 mb-8">
      {STEPS.map(({ label, icon: Icon }, i) => {
        const n = i + 1
        const done = n < current
        const active = n === current
        return (
          <div key={label} className="flex items-center gap-1">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              done ? 'bg-[rgba(184,115,51,0.15)] text-[#D4954A]' :
              active ? 'bg-[#B87333] text-[#F7F3EC]' :
              'bg-[#2A2420] text-[#7A6555]'
            }`}>
              {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
              {label}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-6 h-px mx-0.5 ${done ? 'bg-[#B87333]' : 'bg-[#2A2420]'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function DifficultyBar({ value }: { value: number | null }) {
  if (value === null) return <span className="text-[#A89070]">—</span>
  const color = value < 30 ? 'bg-green-400' : value < 60 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-[#2A2420] rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-[#A89070] tabular-nums">{value}</span>
    </div>
  )
}

function SortBtn({ field, label, sortField, sortDir, onSort }: {
  field: SortField; label: string
  sortField: SortField; sortDir: SortDir
  onSort: (f: SortField) => void
}) {
  const active = sortField === field
  return (
    <button onClick={() => onSort(field)} className="flex items-center gap-1 font-medium text-[#A89070] hover:text-[#A89070] group">
      {label}
      <span className="flex flex-col -space-y-1">
        <ChevronUp className={`w-3 h-3 ${active && sortDir === 'asc' ? 'text-[#B87333]' : 'text-[#A89070]'}`} />
        <ChevronDown className={`w-3 h-3 ${active && sortDir === 'desc' ? 'text-[#B87333]' : 'text-[#A89070]'}`} />
      </span>
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewArticlePage() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [step, setStep] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [brandProfile, setBrandProfile] = useState<BrandProfile | null>(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  // Step 1 — Concept
  const [conceptTopic, setConceptTopic] = useState('')
  const [conceptAngle, setConceptAngle] = useState('')
  const conceptRef = useRef<HTMLTextAreaElement>(null)

  // Step 2 — Keywords
  const [researchLoading, setResearchLoading] = useState(false)
  const [researchKeywords, setResearchKeywords] = useState<ResearchKeyword[]>([])
  const [projectId, setProjectId] = useState<string | null>(null)
  const [selectedKws, setSelectedKws] = useState<Set<string>>(new Set())
  const [sortField, setSortField] = useState<SortField>('avg_monthly_searches')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [activeCluster, setActiveCluster] = useState<string>('All')

  // Step 3 — Outline
  const [articleId, setArticleId] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [brief, setBrief] = useState<Record<string, any> | null>(null)
  const [targetWordCount, setTargetWordCount] = useState<WordCountOption>(1200)

  // Step 4 — Writing
  const [generatingStatus, setGeneratingStatus] = useState<'generating' | 'expanding' | 'expanded' | null>(null)

  // Pre-fill from audit gap (?keyword=...&topic=...)
  const prefillDone = useRef(false)
  useEffect(() => {
    if (prefillDone.current) return
    const kw = searchParams.get('keyword')
    const topic = searchParams.get('topic')
    if (kw || topic) {
      prefillDone.current = true
      setConceptTopic(topic ?? kw ?? '')
      setConceptAngle(kw ? `Target keyword: ${kw}` : '')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load brand profile
  useEffect(() => {
    let active = true
    async function load() {
      const { data: brand } = await supabase.from('brand_profiles').select('*').eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '').maybeSingle()
      if (active) setBrandProfile(brand as BrandProfile | null)
    }
    load()
    return () => { active = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-focus concept input
  useEffect(() => {
    if (step === 1) conceptRef.current?.focus()
  }, [step])

  function handleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  const clusters = ['All', ...Array.from(new Set(researchKeywords.map((k) => k.cluster ?? 'Other'))).sort()]
  const filtered = researchKeywords.filter((k) => activeCluster === 'All' || k.cluster === activeCluster)
  const sortedKws = [...filtered].sort((a, b) => {
    const av = a[sortField] ?? (sortDir === 'asc' ? Infinity : -Infinity)
    const bv = b[sortField] ?? (sortDir === 'asc' ? Infinity : -Infinity)
    if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv as string) : (bv as string).localeCompare(av)
    return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number)
  })

  function toggleKw(kw: string) {
    setSelectedKws((prev) => {
      const next = new Set(prev)
      if (next.has(kw)) next.delete(kw)
      else next.add(kw)
      return next
    })
  }

  // ── Step 1 → 2: Create project + run keyword research ────────────────────────
  async function handleConceptSubmit() {
    if (!conceptTopic.trim()) return
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Session expired — please sign in again.'); setLoading(false); return }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any

    // Create a keyword project for this concept
    const { data: proj, error: projErr } = await sb
      .from('keyword_projects')
      .insert({ user_id: user.id, name: conceptTopic.trim(), seed_topic: conceptTopic.trim(), status: 'pending' })
      .select('id')
      .single()

    if (projErr) { setError(projErr.message); setLoading(false); return }
    setProjectId(proj.id)
    setStep(2)
    setLoading(false)

    // Run keyword research in the background
    setResearchLoading(true)
    const resBody: Record<string, unknown> = {
      project_id: proj.id,
      seed_topic: conceptTopic.trim(),
    }
    if (conceptAngle.trim()) resBody.context = conceptAngle.trim()

    const res = await fetch('/api/keywords/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resBody),
    })

    if (!res.ok) {
      const json = await res.json()
      setError(json.error ?? 'Keyword research failed. Try again or continue without keywords.')
    } else {
      // Load results from DB
      const { data: kws } = await sb
        .from('keywords')
        .select('id, keyword, avg_monthly_searches, keyword_difficulty, cpc, competition, cluster')
        .eq('project_id', proj.id)
        .order('avg_monthly_searches', { ascending: false })
      setResearchKeywords((kws as ResearchKeyword[]) ?? [])
    }
    setResearchLoading(false)
  }

  // ── Step 2 → 3: Generate outline/brief ───────────────────────────────────────
  async function handleKeywordsSubmit() {
    if (selectedKws.size === 0 || !brandProfile || !projectId) return
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Session expired.'); setLoading(false); return }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any

    // Free tier check
    const { data: userProfile } = await sb.from('profiles').select('account_type').eq('user_id', user.id).maybeSingle()
    if (userProfile?.account_type === 'free') {
      const { count } = await sb.from('articles').select('*', { count: 'exact', head: true }).eq('user_id', user.id)
      if ((count ?? 0) >= 1) { setShowUpgradeModal(true); setLoading(false); return }
    }

    // Create the article record
    const { data: newArticle, error: insertErr } = await sb
      .from('articles')
      .insert({
        user_id: user.id,
        brand_profile_id: brandProfile.id,
        keyword_project_id: projectId,
        status: 'draft',
        creation_stage: 'keywords',
        concept_topic: conceptTopic.trim(),
        concept_angle: conceptAngle.trim() || null,
      })
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
        keywordProjectId: projectId,
        selectedKeywords: Array.from(selectedKws),
        brandProfileId: brandProfile.id,
      }),
    })

    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Outline generation failed'); setLoading(false); return }

    setBrief(json.brief)
    setTargetWordCount(suggestWordCount(json.brief?.target_keyword ?? ''))
    // Update stage
    await sb.from('articles').update({ creation_stage: 'outline' }).eq('id', newId)
    setStep(3)
    setLoading(false)
  }

  // ── Step 3 → 4: Generate draft ────────────────────────────────────────────────
  async function handleGenerateDraft() {
    if (!articleId) return
    setLoading(true)
    setError(null)
    setStep(4)
    setGeneratingStatus('generating')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any

    // Poll for status
    const pollId = setInterval(async () => {
      try {
        const { data } = await sb.from('articles').select('status').eq('id', articleId).single()
        if (data?.status === 'expanding') setGeneratingStatus('expanding')
      } catch { /* ignore */ }
    }, 2000)

    await sb.from('articles').update({ creation_stage: 'write' }).eq('id', articleId)

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

    // Auto-score
    await fetch('/api/articles/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleId }),
    })

    await sb.from('articles').update({ creation_stage: 'complete' }).eq('id', articleId)
    setStep(5)
    setLoading(false)
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-8 max-w-3xl">
      {/* Upgrade modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[#1C1917] rounded-2xl shadow-xl border border-[rgba(184,115,51,0.2)] p-8 max-w-sm w-full mx-4 text-center">
            <div className="w-12 h-12 rounded-full bg-[rgba(184,115,51,0.08)] flex items-center justify-center mx-auto mb-4">
              <FileText className="w-6 h-6 text-[#D4954A]" />
            </div>
            <h2 className="text-lg font-bold text-[#F7F3EC] mb-2">Free article used</h2>
            <p className="text-sm text-[#A89070] mb-6">
              You&apos;ve used your free article. Upgrade to write unlimited articles.
            </p>
            <div className="flex flex-col gap-2">
              <Link href="/pricing" className="w-full py-2.5 bg-[#B87333] text-[#F7F3EC] text-sm font-semibold rounded-lg hover:bg-[#A0622A] transition-colors">
                View plans
              </Link>
              <button onClick={() => setShowUpgradeModal(false)} className="w-full py-2.5 text-sm text-[#A89070] hover:text-[#A89070] transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Back nav */}
      <div className="flex items-center gap-2 mb-6">
        <Link href="/articles" className="flex items-center gap-1.5 text-sm text-[#7A6555] hover:text-[#A89070] transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Articles
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-[#F7F3EC] mb-6">New Article</h1>
      {step < 5 && <StepIndicator current={step} />}

      {error && (
        <div className="mb-6 flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* ─── Step 1: Concept ─── */}
      {step === 1 && (
        <div>
          <h2 className="text-base font-semibold text-[#F7F3EC] mb-1">What do you want to write about?</h2>
          <p className="text-sm text-[#A89070] mb-5">
            Enter a topic or idea — Byline will research the best keywords and build a full outline before writing.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#A89070] mb-1.5">Topic or idea</label>
              <textarea
                ref={conceptRef}
                value={conceptTopic}
                onChange={(e) => setConceptTopic(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && conceptTopic.trim()) { e.preventDefault(); handleConceptSubmit() } }}
                placeholder="e.g. How to use AI for SEO content, Best email marketing tools for small businesses, What is technical SEO…"
                rows={3}
                className="w-full px-3 py-2.5 text-sm rounded-xl outline-none focus:ring-1 focus:ring-[#B87333] resize-none"
                style={{ background: '#231F1B', border: '1px solid rgba(184,115,51,0.25)', color: '#F7F3EC' }}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#A89070] mb-1.5">
                Angle or audience <span className="text-[#7A6555]">(optional)</span>
              </label>
              <input
                type="text"
                value={conceptAngle}
                onChange={(e) => setConceptAngle(e.target.value)}
                placeholder="e.g. Target beginners, focus on ROI, local businesses in Chicago…"
                className="w-full px-3 py-2.5 text-sm rounded-xl outline-none focus:ring-1 focus:ring-[#B87333]"
                style={{ background: '#231F1B', border: '1px solid rgba(184,115,51,0.25)', color: '#F7F3EC' }}
              />
            </div>
          </div>

          {!brandProfile && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
              <span className="font-medium">Brand profile missing.</span>{' '}
              <Link href="/brand" className="underline hover:text-amber-900">Set it up first →</Link>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between">
            <p className="text-xs text-[#7A6555]">Press Enter or click to research keywords for your concept.</p>
            <button
              onClick={handleConceptSubmit}
              disabled={!conceptTopic.trim() || !brandProfile || loading}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#B87333] text-[#F7F3EC] text-sm font-medium rounded-lg hover:bg-[#A0622A] disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Starting…</>
              ) : (
                <>Research Keywords <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ─── Step 2: Keywords ─── */}
      {step === 2 && (
        <div>
          <div className="flex items-center gap-3 mb-1">
            <button onClick={() => setStep(1)} className="text-sm text-[#7A6555] hover:text-[#A89070] flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h2 className="text-base font-semibold text-[#F7F3EC]">Pick your target keywords</h2>
          </div>
          <p className="text-sm text-[#A89070] mb-5 ml-7">
            Topic: <span className="font-medium text-[#A89070]">{conceptTopic}</span>
            {conceptAngle && <span className="text-[#7A6555]"> · {conceptAngle}</span>}
          </p>

          {researchLoading ? (
            <div className="bg-[#231F1B] rounded-2xl p-12 text-center border border-[rgba(184,115,51,0.2)]">
              <Loader2 className="w-6 h-6 animate-spin text-[#D4954A] mx-auto mb-3" />
              <p className="text-sm text-[#A89070] font-medium">Researching keywords for your topic…</p>
              <p className="text-xs text-[#7A6555] mt-1">Fetching 50 keyword ideas + clustering. Takes ~10 seconds.</p>
            </div>
          ) : researchKeywords.length === 0 ? (
            <div className="bg-[#231F1B] rounded-2xl p-10 text-center border border-[rgba(184,115,51,0.2)]">
              <p className="text-sm text-[#A89070] mb-3">Keyword research returned no results.</p>
              <button onClick={() => setStep(1)} className="text-sm text-[#B87333] hover:text-[#A0622A] font-medium">
                ← Go back and try a different topic
              </button>
            </div>
          ) : (
            <>
              {/* Cluster tabs */}
              {clusters.length > 2 && (
                <div className="flex gap-1 mb-3 flex-wrap">
                  {clusters.map((c) => (
                    <button
                      key={c}
                      onClick={() => setActiveCluster(c)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                        activeCluster === c ? 'bg-[#B87333] text-[#F7F3EC]' : 'bg-[#2A2420] text-[#A89070] hover:bg-[#2A2420]'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}

              <div className="bg-[#1C1917] border border-[rgba(184,115,51,0.2)] rounded-xl overflow-hidden mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[rgba(184,115,51,0.15)] bg-[#231F1B]">
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
                        className={`cursor-pointer transition-colors ${selectedKws.has(kw.keyword) ? 'bg-[rgba(184,115,51,0.08)]' : 'hover:bg-[#231F1B]'}`}
                      >
                        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedKws.has(kw.keyword)}
                            onChange={() => toggleKw(kw.keyword)}
                            className="rounded border-[rgba(184,115,51,0.25)] text-[#B87333] focus:ring-[#B87333]"
                          />
                        </td>
                        <td className="px-3 py-2.5 font-medium text-[#F7F3EC]">{kw.keyword}</td>
                        <td className="px-3 py-2.5 tabular-nums text-[#A89070] text-xs">
                          {kw.avg_monthly_searches?.toLocaleString() ?? '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          <DifficultyBar value={kw.keyword_difficulty} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-3 py-2.5 border-t border-[rgba(184,115,51,0.15)] bg-[#231F1B] flex items-center justify-between text-xs text-[#7A6555]">
                  <span>{researchKeywords.length} keywords found</span>
                  {selectedKws.size > 0 && <span className="text-[#B87333] font-medium">{selectedKws.size} selected</span>}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs text-[#7A6555]">Select 1–8 keywords. The first selected becomes the primary keyword.</p>
                <button
                  onClick={handleKeywordsSubmit}
                  disabled={selectedKws.size === 0 || !brandProfile || loading}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#B87333] text-[#F7F3EC] text-sm font-medium rounded-lg hover:bg-[#A0622A] disabled:opacity-50 transition-colors"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Building outline…</>
                  ) : (
                    <>Build Outline <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── Step 3: Outline ─── */}
      {step === 3 && brief && (
        <div>
          <div className="flex items-center gap-3 mb-1">
            <button onClick={() => setStep(2)} className="text-sm text-[#7A6555] hover:text-[#A89070] flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h2 className="text-base font-semibold text-[#F7F3EC]">Review your outline</h2>
          </div>
          <p className="text-sm text-[#A89070] mb-5 ml-7">
            Approve the outline below before Byline writes the full article.
          </p>

          <div className="space-y-4">
            <div className="bg-[#1C1917] border border-[rgba(184,115,51,0.2)] rounded-xl p-4">
              <div className="text-xs font-semibold text-[#7A6555] uppercase tracking-wide mb-2">Target Keyword</div>
              <div className="text-sm font-semibold text-[#A0622A]">{brief.target_keyword}</div>
              {brief.url_slug && <div className="text-xs text-[#7A6555] mt-1">/{brief.url_slug}</div>}
            </div>

            <div className="bg-[#1C1917] border border-[rgba(184,115,51,0.2)] rounded-xl p-4">
              <div className="text-xs font-semibold text-[#7A6555] uppercase tracking-wide mb-2">H1 Options</div>
              <ul className="space-y-1.5">
                {(brief.h1_options as string[] ?? []).map((h: string, i: number) => (
                  <li key={i} className="text-sm text-[#A89070] flex gap-2">
                    <span className="text-[#A89070] shrink-0">{i + 1}.</span>
                    {h}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-[#1C1917] border border-[rgba(184,115,51,0.2)] rounded-xl p-4">
              <div className="text-xs font-semibold text-[#7A6555] uppercase tracking-wide mb-2">
                Meta Description <span className="normal-case font-normal">({String(brief.meta_description ?? '').length} chars)</span>
              </div>
              <p className="text-sm text-[#A89070]">{brief.meta_description}</p>
            </div>

            <div className="bg-[#1C1917] border border-[rgba(184,115,51,0.2)] rounded-xl p-4">
              <div className="text-xs font-semibold text-[#7A6555] uppercase tracking-wide mb-3">Outline</div>
              <div className="space-y-2">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(brief.outline as any[] ?? []).map((s: any, i: number) => (
                  <div key={i} className={`flex items-start gap-2 ${s.heading_level === 'H3' ? 'pl-5' : ''}`}>
                    <span className="text-xs text-[#7A6555] shrink-0 mt-0.5 tabular-nums w-6">{s.heading_level}</span>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-[#F7F3EC]">{s.heading}</div>
                      {s.notes && <div className="text-xs text-[#7A6555] mt-0.5">{s.notes}</div>}
                    </div>
                    <span className="text-xs text-[#A89070] shrink-0">~{s.word_count_target}w</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-[rgba(184,115,51,0.15)] text-xs text-[#7A6555] flex justify-between">
                <span>Target total</span>
                <span className="font-medium text-[#A89070]">{brief.word_count_target} words</span>
              </div>
            </div>

            {(brief.competitor_gaps as string[] ?? []).length > 0 && (
              <div className="bg-[#1C1917] border border-[rgba(184,115,51,0.2)] rounded-xl p-4">
                <div className="text-xs font-semibold text-[#7A6555] uppercase tracking-wide mb-2">Angles to cover</div>
                <ul className="space-y-1">
                  {(brief.competitor_gaps as string[]).map((g: string, i: number) => (
                    <li key={i} className="text-sm text-[#A89070] flex gap-2">
                      <span className="text-[#D4954A]">→</span> {g}
                    </li>
                  ))}
                </ul>
              </div>

            )}

            {/* Word count */}
            {(() => {
              const suggested = suggestWordCount(brief.target_keyword ?? '')
              return (
                <div className="bg-[#1C1917] border border-[rgba(184,115,51,0.2)] rounded-xl p-4">
                  <div className="flex items-center gap-1.5 mb-3">
                    <div className="text-xs font-semibold text-[#7A6555] uppercase tracking-wide">Target Word Count</div>
                    <Info className="w-3.5 h-3.5 text-[#A89070]" />
                  </div>
                  <p className="text-xs text-[#A89070] mb-3">
                    Recommended: <span className="font-semibold text-[#A89070]">{suggested.toLocaleString()} words</span> based on your keyword
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
                              ? 'bg-[#B87333] text-[#F7F3EC] border-[#B87333]'
                              : 'bg-[#1C1917] text-[#A89070] border-[rgba(184,115,51,0.2)] hover:border-[#B87333] hover:text-[#B87333]'
                          }`}
                        >
                          {n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : n}
                          {isRecommended && (
                            <span className={`absolute -top-2 left-1/2 -translate-x-1/2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                              isSelected ? 'bg-[rgba(184,115,51,0.12)] text-[#A0622A]' : 'bg-[rgba(184,115,51,0.08)] text-[#B87333]'
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
          </div>

          <div className="mt-6 flex items-center justify-between">
            <p className="text-xs text-[#7A6555]">SERP intent: <span className="font-medium text-[#A89070]">{brief.serp_intent}</span></p>
            <button
              onClick={handleGenerateDraft}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#B87333] text-[#F7F3EC] text-sm font-medium rounded-lg hover:bg-[#A0622A] disabled:opacity-50 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              Write Article
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Writing */}
      {step === 4 && (
        <div className="border-2 border-dashed border-[rgba(184,115,51,0.15)] rounded-2xl p-14 text-center">
          <Loader2 className="w-10 h-10 animate-spin text-[#D4954A] mx-auto mb-5" />
          {generatingStatus === 'expanding' ? (
            <>
              <h3 className="text-base font-semibold text-[#A89070] mb-2">Running a second pass to hit your target length</h3>
              <p className="text-sm text-[#7A6555] max-w-xs mx-auto">Pulling related questions from DataForSEO and expanding with real substance.</p>
            </>
          ) : (
            <>
              <h3 className="text-base font-semibold text-[#A89070] mb-2">Writing your article</h3>
              <p className="text-sm text-[#7A6555] max-w-xs mx-auto">Generating a full draft in your brand voice. This takes 30 to 60 seconds.</p>
            </>
          )}
        </div>
      )}

      {/* Step 5: Done */}
      {step === 5 && articleId && (
        <div className="text-center py-8">
          <div className="inline-flex p-4 bg-green-50 rounded-2xl mb-5">
            <CheckCircle2 className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-[#F7F3EC] mb-2">
            {generatingStatus === 'expanded' ? 'Done - expanded to target length' : 'Article generated and scored'}
          </h2>
          <p className="text-sm text-[#A89070] mb-7 max-w-sm mx-auto">
            {generatingStatus === 'expanded'
              ? 'A second research pass added real substance to hit your target word count.'
              : 'Your article is ready. View the full content, SEO scores, and ranking predictions.'}
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => {
                setStep(1); setConceptTopic(''); setConceptAngle('')
                setResearchKeywords([]); setSelectedKws(new Set())
                setBrief(null); setArticleId(null); setProjectId(null)
                setError(null); router.push('/articles/new')
              }}
              className="px-4 py-2 text-sm text-[#A89070] border border-[rgba(184,115,51,0.2)] rounded-lg hover:bg-[#231F1B] transition-colors"
            >
              Write another
            </button>
            <Link
              href={`/articles/${articleId}`}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#B87333] text-[#F7F3EC] text-sm font-medium rounded-lg hover:bg-[#A0622A] transition-colors"
            >
              <FileText className="w-4 h-4" />
              View Article and Scores
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
