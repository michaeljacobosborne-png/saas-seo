'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Article, ArticleScores } from '@/lib/supabase/types'
import {
  ArrowLeft, Copy, CheckCircle2, Loader2, Sparkles,
  TrendingUp, AlertCircle, BarChart2,
} from 'lucide-react'

const COPPER = '#B87333'

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

  async function handleCopy() {
    if (!article?.content) return
    await navigator.clipboard.writeText(article.content)
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

    // Refresh article
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

  return (
    <div className="p-8 max-w-4xl">
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
        </div>
      </div>

      {scoreError && (
        <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {scoreError}
        </div>
      )}

      {/* Meta bar */}
      {article.word_count && (
        <div className="flex items-center gap-4 mb-6 text-xs text-gray-400">
          <span>{article.word_count.toLocaleString()} words</span>
          <span>·</span>
          <span>~{Math.ceil(article.word_count / 200)} min read</span>
          <span>·</span>
          <span className="capitalize">{article.status}</span>
        </div>
      )}

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
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <pre className="p-5 text-sm text-gray-700 font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto max-h-[70vh] overflow-y-auto">
                {article.content}
              </pre>
            </div>
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
              {/* Score overview cards */}
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

              {/* Score bars */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="font-semibold text-gray-800 text-sm mb-4">Score Overview</h3>
                <div className="space-y-3">
                  <ScoreBar label="SEO" score={scores.seo.score} />
                  <ScoreBar label="Readability" score={scores.readability.score} />
                  <ScoreBar label="GEO (Generative Engine)" score={scores.geo.score} />
                  <ScoreBar label="AEO (Answer Engine)" score={scores.aeo.score} />
                </div>
              </div>

              {/* Detailed breakdowns */}
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

              {/* Ranking + Traffic */}
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
  )
}
