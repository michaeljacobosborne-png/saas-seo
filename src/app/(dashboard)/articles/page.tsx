import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { FileText, Plus, CheckCircle2, Clock, Loader2, BookOpen, Globe } from 'lucide-react'
import type { Article } from '@/lib/supabase/types'

const STATUS_CONFIG: Record<Article['status'], { label: string; className: string; icon: React.ElementType; spin?: boolean }> = {
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-600', icon: Clock },
  brief_ready: { label: 'Brief Ready', className: 'bg-blue-50 text-blue-600', icon: BookOpen },
  generating: { label: 'Generating…', className: 'bg-amber-50 text-amber-600', icon: Loader2, spin: true },
  complete: { label: 'Complete', className: 'bg-green-50 text-green-700', icon: CheckCircle2 },
  published: { label: 'Published', className: 'bg-purple-50 text-purple-700', icon: Globe },
}

function ScorePill({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-green-50 text-green-700' : score >= 60 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600'
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full tabular-nums ${color}`}>
      {score}
    </span>
  )
}

export default async function ArticlesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: articles } = await (supabase as any)
    .from('articles')
    .select('id, title, target_keyword, status, word_count, scores, created_at')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false }) as { data: Article[] | null }

  const list = articles ?? []

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Articles</h1>
          <p className="mt-1 text-sm text-gray-500">
            AI-generated SEO articles grounded in your brand profile and keyword research.
          </p>
        </div>
        <Link
          href="/articles/new"
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Article
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center">
          <div className="inline-flex p-3 bg-indigo-50 rounded-xl mb-4">
            <FileText className="w-6 h-6 text-indigo-500" />
          </div>
          <h3 className="text-base font-semibold text-gray-700 mb-2">No articles yet</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto mb-5">
            Select keywords from a research project, generate a brief, then produce a full SEO-optimized draft — all in your brand voice.
          </p>
          <Link
            href="/articles/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create your first article
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-500">Article</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Words</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Scores</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {list.map((article) => {
                const statusCfg = STATUS_CONFIG[article.status] ?? STATUS_CONFIG.draft
                const StatusIcon = statusCfg.icon
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const scores = article.scores as any

                return (
                  <tr key={article.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/articles/${article.id}`} className="group">
                        <div className="font-medium text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                          {article.title ?? article.target_keyword ?? 'Untitled draft'}
                        </div>
                        {article.target_keyword && article.title && (
                          <div className="text-xs text-gray-400 mt-0.5">{article.target_keyword}</div>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusCfg.className}`}>
                        <StatusIcon className={`w-3 h-3 ${statusCfg.spin ? 'animate-spin' : ''}`} />
                        {statusCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-gray-500 text-xs">
                      {article.word_count ? article.word_count.toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {scores ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-400">SEO</span>
                          <ScorePill score={scores.seo?.score ?? 0} />
                          <span className="text-xs text-gray-400">AEO</span>
                          <ScorePill score={scores.aeo?.score ?? 0} />
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">Not scored</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {new Date(article.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
