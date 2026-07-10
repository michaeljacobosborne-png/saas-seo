import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/service'
import type { Metadata } from 'next'

interface Factor {
  name: string
  score: number
  maxScore: number
  status: 'good' | 'needs-work' | 'missing'
  detail: string
}

interface Recommendation {
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  impact: string
}

interface AuditResult {
  score: number
  grade: string
  breakdown: Factor[]
  recommendations: Recommendation[]
  quickWins: string[]
}

interface AuditRecord {
  id: string
  email: string
  domain: string | null
  result: AuditResult
  created_at: string
}

export const metadata: Metadata = {
  title: 'Your GEO Analysis Report — Byline',
  description: 'View your full GEO (Generative Engine Optimization) analysis report from Byline.',
  robots: { index: false, follow: false },
}

export default async function AuditResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('audit_results')
    .select('id, email, domain, result, created_at')
    .eq('id', id)
    .single()

  if (error || !data) {
    notFound()
  }

  const record = data as AuditRecord
  const result = record.result
  const scoreColor = result.score >= 70 ? '#16a34a' : result.score >= 40 ? '#d97706' : '#dc2626'
  const statusMap = {
    good: 'bg-green-100 text-green-700',
    'needs-work': 'bg-amber-100 text-amber-700',
    missing: 'bg-red-100 text-red-700',
  }
  const statusLabel = { good: 'Good', 'needs-work': 'Needs work', missing: 'Missing' }
  const priorityMap = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-gray-100 text-gray-600',
  }

  return (
    <main className="min-h-screen bg-[#F7F3EC] py-12 px-4">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="text-[#B87333] font-semibold text-lg" style={{ fontFamily: 'var(--font-playfair, Georgia, serif)' }}>
            Byline
          </Link>
          <span className="text-sm text-[#998876]">GEO Analysis Report</span>
        </div>

        {/* Score card */}
        <div className="bg-white rounded-2xl border border-[rgba(184,115,51,0.15)] p-8 mb-6">
          <h1 className="text-2xl font-bold text-[#1c1917] mb-2" style={{ fontFamily: 'var(--font-playfair, Georgia, serif)' }}>
            GEO Score for <span style={{ color: '#B87333' }}>{record.domain || 'your site'}</span>
          </h1>
          <p className="text-sm text-[#998876] mb-6">
            Analyzed {new Date(record.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>

          <div className="flex items-center gap-6 mb-6">
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center border-4 shrink-0"
              style={{ borderColor: scoreColor }}
            >
              <span className="text-3xl font-bold" style={{ color: scoreColor }}>{result.score}</span>
            </div>
            <div>
              <div
                className="inline-flex items-center justify-center w-14 h-14 rounded-xl text-2xl font-bold mb-1"
                style={{ backgroundColor: scoreColor + '22', color: scoreColor }}
              >
                {result.grade}
              </div>
              <p className="text-sm text-[#57534E]">GEO Score</p>
              <p className="text-xs text-[#998876]">out of 100</p>
            </div>
          </div>

          {/* Breakdown */}
          <div className="space-y-3">
            {result.breakdown?.map((factor) => (
              <div key={factor.name} className="flex items-start justify-between gap-4 py-3 border-b border-[#F0ECE4] last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm text-[#1c1917]">{factor.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusMap[factor.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {statusLabel[factor.status] ?? factor.status}
                    </span>
                  </div>
                  <p className="text-xs text-[#998876]">{factor.detail}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-sm font-semibold text-[#1c1917]">{factor.score}</span>
                  <span className="text-xs text-[#998876]">/{factor.maxScore}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recommendations */}
        {result.recommendations?.length > 0 && (
          <div className="bg-white rounded-2xl border border-[rgba(184,115,51,0.15)] p-8 mb-6">
            <h2 className="text-lg font-bold text-[#1c1917] mb-4" style={{ fontFamily: 'var(--font-playfair, Georgia, serif)' }}>
              Recommendations
            </h2>
            <div className="space-y-4">
              {result.recommendations.map((rec, i) => (
                <div key={i} className="flex gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium h-fit mt-0.5 shrink-0 ${priorityMap[rec.priority] ?? 'bg-gray-100 text-gray-600'}`}>
                    {rec.priority}
                  </span>
                  <div>
                    <p className="font-medium text-sm text-[#1c1917] mb-1">{rec.title}</p>
                    <p className="text-xs text-[#57534E]">{rec.description}</p>
                    {rec.impact && <p className="text-xs text-[#B87333] mt-1">Impact: {rec.impact}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick wins */}
        {result.quickWins?.length > 0 && (
          <div className="bg-white rounded-2xl border border-[rgba(184,115,51,0.15)] p-8 mb-6">
            <h2 className="text-lg font-bold text-[#1c1917] mb-4" style={{ fontFamily: 'var(--font-playfair, Georgia, serif)' }}>
              Quick Wins
            </h2>
            <ul className="space-y-2">
              {result.quickWins.map((win, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-[#57534E]">
                  <span className="text-green-600 mt-0.5 shrink-0">✓</span>
                  {win}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* CTA */}
        <div className="bg-[#1c1917] rounded-2xl p-8 text-center">
          <h2 className="text-xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-playfair, Georgia, serif)' }}>
            Ready to fix these issues?
          </h2>
          <p className="text-[#a8a29e] text-sm mb-6">
            Byline generates AI content that scores well on both Google and AI engines like ChatGPT, Gemini, and Perplexity.
          </p>
          <Link
            href="/pricing"
            className="inline-block bg-[#B87333] text-white font-semibold px-8 py-3.5 rounded-lg hover:bg-[#A0622A] transition-colors"
          >
            Start with Byline →
          </Link>
          <p className="text-[#57534e] text-xs mt-4">
            Starter plan from $49/mo · No long-term contract
          </p>
        </div>

      </div>
    </main>
  )
}
