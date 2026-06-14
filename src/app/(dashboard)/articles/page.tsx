import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { FileText, Plus, CheckCircle2, Clock, Loader2, BookOpen, Globe } from 'lucide-react'
import type { Article } from '@/lib/supabase/types'
import DuplicateArticleButton from './DuplicateArticleButton'
import PublishButton from './PublishButton'
import QuickWrite from '../QuickWrite'

const STATUS_CONFIG: Record<Article['status'], { label: string; className: string; icon: React.ElementType; spin?: boolean }> = {
  draft: { label: 'Draft', className: 'bg-[var(--ink-card)] text-[var(--cream-dim)]', icon: Clock },
  brief_ready: { label: 'Brief Ready', className: 'bg-[rgba(184,115,51,0.08)] text-[var(--copper)]', icon: BookOpen },
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
          <h1 className="text-2xl font-bold" style={{ color: 'var(--cream)' }}>Articles</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--cream-dim)' }}>
            AI-generated SEO articles grounded in your brand profile and keyword research.
          </p>
        </div>
        <Link
          href="/articles/new"
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors"
          style={{ background: 'var(--copper)', color: '#F7F3EC' }}
        >
          <Plus className="w-4 h-4" />
          New Article
        </Link>
      </div>

      <div className="mb-8">
        <QuickWrite />
      </div>

      {list.length === 0 ? (
        <div className="border-2 border-dashed rounded-2xl p-12 text-center" style={{ borderColor: 'var(--border)' }}>
          <div className="inline-flex p-3 rounded-xl mb-4" style={{ background: 'rgba(184,115,51,0.08)' }}>
            <FileText className="w-6 h-6" style={{ color: 'var(--copper-lt)' }} />
          </div>
          <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--cream-dim)' }}>No articles yet</h3>
          <p className="text-sm max-w-sm mx-auto mb-5" style={{ color: 'var(--cream-dim)' }}>
            Select keywords from a research project, generate a brief, then produce a full SEO-optimized draft — all in your brand voice.
          </p>
          <Link
            href="/articles/new"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors"
            style={{ background: 'var(--copper)', color: '#F7F3EC' }}
          >
            <Plus className="w-4 h-4" />
            Create your first article
          </Link>
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden" style={{ background: 'var(--ink)', borderColor: 'var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border)', background: 'var(--ink-card)' }}>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--cream-dim)' }}>Article</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--cream-dim)' }}>Status</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--cream-dim)' }}>Words</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--cream-dim)' }}>Scores</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--cream-dim)' }}>Created</th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--cream-dim)' }}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {list.map((article) => {
                const statusCfg = STATUS_CONFIG[article.status] ?? STATUS_CONFIG.draft
                const StatusIcon = statusCfg.icon
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const scores = article.scores as any

                return (
                  <tr
                    key={article.id}
                    className="transition-colors hover:bg-[var(--ink-card)]"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <td className="px-4 py-3">
                      <Link href={`/articles/${article.id}`} className="group">
                        <div className="font-medium group-hover:text-[var(--copper)] transition-colors line-clamp-1" style={{ color: 'var(--cream)' }}>
                          {article.title ?? article.target_keyword ?? 'Untitled draft'}
                        </div>
                        {article.target_keyword && article.title && (
                          <div className="text-xs mt-0.5" style={{ color: 'var(--cream-faint)' }}>{article.target_keyword}</div>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusCfg.className}`}>
                          <StatusIcon className={`w-3 h-3 ${statusCfg.spin ? 'animate-spin' : ''}`} />
                          {statusCfg.label}
                        </span>
                        <PublishButton articleId={article.id} initialStatus={article.status} />
                      </div>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-xs" style={{ color: 'var(--cream-dim)' }}>
                      {article.word_count ? article.word_count.toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {scores ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs" style={{ color: 'var(--cream-faint)' }}>SEO</span>
                          <ScorePill score={scores.seo?.score ?? 0} />
                          <span className="text-xs" style={{ color: 'var(--cream-faint)' }}>AEO</span>
                          <ScorePill score={scores.aeo?.score ?? 0} />
                        </div>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--cream-dim)' }}>Not scored</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--cream-faint)' }}>
                      {new Date(article.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DuplicateArticleButton articleId={article.id} />
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
