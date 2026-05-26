'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { KeywordProject, BrandProfile } from '@/lib/supabase/types'
import {
  ArrowLeft, ArrowRight, Sparkles, Loader2, CheckCircle2,
  AlertCircle, ChevronUp, ChevronDown, FileText,
} from 'lucide-react'

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
              done ? 'bg-indigo-600 text-white' :
              active ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-600' :
              'bg-gray-100 text-gray-400'
            }`}>
              {done ? <CheckCircle2 className="w-4 h-4" /> : n}
            </div>
            <span className={`text-xs font-medium ${active ? 'text-indigo-700' : done ? 'text-gray-500' : 'text-gray-400'}`}>
              {label}
            </span>
            {i < steps.length - 1 && (
              <div className={`w-8 h-px mx-1 ${done ? 'bg-indigo-300' : 'bg-gray-200'}`} />
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
    <button onClick={() => onSort(field)} className="flex items-center gap-1 font-medium text-gray-500 hover:text-gray-700 group">
      {label}
      <span className="flex flex-col -space-y-1">
        <ChevronUp className={`w-3 h-3 ${active && sortDir === 'asc' ? 'text-indigo-600' : 'text-gray-300 group-hover:text-gray-400'}`} />
        <ChevronDown className={`w-3 h-3 ${active && sortDir === 'desc' ? 'text-indigo-600' : 'text-gray-300 group-hover:text-gray-400'}`} />
      </span>
    </button>
  )
}

export default function NewArticlePage() {
  const supabase = createClient()

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
    const { data: newArticle, error: insertErr } = await (supabase as any)
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
    setStep(3)
    setLoading(false)
  }

  async function handleGenerateDraft() {
    if (!articleId) return
    setLoading(true)
    setError(null)
    setStep(4)

    const res = await fetch('/api/articles/generate-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleId }),
    })

    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'Draft generation failed')
      setStep(3)
      setLoading(false)
      return
    }

    // Auto-score (non-blocking — best effort)
    await fetch('/api/articles/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleId }),
    })

    setStep(5)
    setLoading(false)
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/articles" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Articles
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">New Article</h1>
      <StepIndicator current={step} />

      {error && (
        <div className="mb-6 flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* ─── Step 1: Pick project ─── */}
      {step === 1 && (
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-1">Pick a keyword project</h2>
          <p className="text-sm text-gray-500 mb-5">Only projects with completed keyword research appear here.</p>

          {projectsLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : projects.length === 0 ? (
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center">
              <p className="text-sm text-gray-500 mb-3">No completed keyword projects yet.</p>
              <Link href="/keywords" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                Run keyword research first →
              </Link>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {projects.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => { setSelectedProject(p); setStep(2) }}
                  className={`w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-indigo-50 transition-colors ${i > 0 ? 'border-t border-gray-100' : ''}`}
                >
                  <div>
                    <div className="font-medium text-gray-900 text-sm">{p.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">Seed: {p.seed_topic}</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-300" />
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

      {/* ─── Step 2: Select keywords ─── */}
      {step === 2 && (
        <div>
          <div className="flex items-center gap-3 mb-1">
            <button onClick={() => setStep(1)} className="text-sm text-gray-400 hover:text-gray-600">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h2 className="text-base font-semibold text-gray-900">Select target keywords</h2>
          </div>
          <p className="text-sm text-gray-500 mb-1 ml-7">
            Project: <span className="font-medium text-gray-700">{selectedProject?.name}</span>
          </p>
          {brandProfile && (
            <div className="ml-7 mb-5 text-xs text-gray-400">
              Brand: <span className="font-medium text-gray-600">{brandProfile.brand_name}</span>
            </div>
          )}

          {kwLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
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
                        className={`cursor-pointer transition-colors ${selectedKws.has(kw.keyword) ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
                      >
                        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedKws.has(kw.keyword)}
                            onChange={() => toggleKw(kw.keyword)}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="px-3 py-2.5 font-medium text-gray-800">{kw.keyword}</td>
                        <td className="px-3 py-2.5 tabular-nums text-gray-600 text-xs">
                          {kw.avg_monthly_searches?.toLocaleString() ?? '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          <DifficultyBar value={kw.keyword_difficulty} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-3 py-2.5 border-t border-gray-100 bg-gray-50 flex items-center justify-between text-xs text-gray-400">
                  <span>{keywords.length} keywords</span>
                  {selectedKws.size > 0 && <span className="text-indigo-600 font-medium">{selectedKws.size} selected</span>}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">Select 2-10 keywords to build the brief around.</p>
                <button
                  onClick={handleGenerateBrief}
                  disabled={selectedKws.size === 0 || !brandProfile || loading}
                  className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
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
          <h2 className="text-base font-semibold text-gray-900 mb-1">Review your brief</h2>
          <p className="text-sm text-gray-500 mb-5">GPT-4o analyzed your keywords and brand profile to build this content plan.</p>

          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Target Keyword</div>
              <div className="text-sm font-semibold text-indigo-700">{brief.target_keyword}</div>
              {brief.url_slug && <div className="text-xs text-gray-400 mt-1">/{brief.url_slug}</div>}
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">H1 Options</div>
              <ul className="space-y-1.5">
                {(brief.h1_options as string[] ?? []).map((h: string, i: number) => (
                  <li key={i} className="text-sm text-gray-700 flex gap-2">
                    <span className="text-gray-300 shrink-0">{i + 1}.</span>
                    {h}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Meta Description <span className="normal-case font-normal">({String(brief.meta_description ?? '').length} chars)</span>
              </div>
              <p className="text-sm text-gray-700">{brief.meta_description}</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Outline</div>
              <div className="space-y-2">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(brief.outline as any[] ?? []).map((s: any, i: number) => (
                  <div key={i} className={`flex items-start gap-2 ${s.heading_level === 'H3' ? 'pl-5' : ''}`}>
                    <span className="text-xs text-gray-400 shrink-0 mt-0.5 tabular-nums w-6">{s.heading_level}</span>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-800">{s.heading}</div>
                      {s.notes && <div className="text-xs text-gray-400 mt-0.5">{s.notes}</div>}
                    </div>
                    <span className="text-xs text-gray-300 shrink-0">~{s.word_count_target}w</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400 flex justify-between">
                <span>Target total</span>
                <span className="font-medium text-gray-600">{brief.word_count_target} words</span>
              </div>
            </div>

            {(brief.competitor_gaps as string[] ?? []).length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Competitor Gaps</div>
                <ul className="space-y-1">
                  {(brief.competitor_gaps as string[]).map((g: string, i: number) => (
                    <li key={i} className="text-sm text-gray-700 flex gap-2">
                      <span className="text-indigo-400">→</span> {g}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <p className="text-xs text-gray-400">SERP intent: <span className="font-medium text-gray-600">{brief.serp_intent}</span></p>
            <button
              onClick={handleGenerateDraft}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              Generate Full Draft
            </button>
          </div>
        </div>
      )}

      {/* ─── Step 4: Generating ─── */}
      {step === 4 && (
        <div className="border-2 border-dashed border-indigo-100 rounded-2xl p-14 text-center">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-400 mx-auto mb-5" />
          <h3 className="text-base font-semibold text-gray-700 mb-2">Writing your article…</h3>
          <p className="text-sm text-gray-400 max-w-xs mx-auto">GPT-4o is generating a full draft in your brand voice. This takes 30–60 seconds.</p>
        </div>
      )}

      {/* ─── Step 5: Done ─── */}
      {step === 5 && articleId && (
        <div className="text-center">
          <div className="inline-flex p-4 bg-green-50 rounded-2xl mb-5">
            <CheckCircle2 className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Article generated and scored</h2>
          <p className="text-sm text-gray-500 mb-7 max-w-sm mx-auto">
            Your article is ready. View the full content, SEO scores, and ranking predictions.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/articles" className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              Back to Articles
            </Link>
            <Link
              href={`/articles/${articleId}`}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
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
