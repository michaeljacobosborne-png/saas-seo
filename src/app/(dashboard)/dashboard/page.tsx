import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  FileText, Globe, Search, Bookmark, Plus, ArrowRight, ArrowUpRight,
  Sparkles, BarChart2, Clock,
} from 'lucide-react'

// The DB lifecycle is broader than the (stale) Article TS union, so we key off
// raw status strings: draft -> brief_ready -> generating -> expanding ->
// polishing -> ready, then complete/published via the publish flow.
const IN_PROGRESS = new Set(['draft', 'brief_ready', 'generating', 'expanding', 'polishing', 'ready'])

const ARTICLE_STATUS: Record<string, { label: string; className: string; pulse?: boolean }> = {
  draft: { label: 'Draft', className: 'bg-[#2A2420] text-[#A89070]' },
  brief_ready: { label: 'Brief Ready', className: 'bg-amber-500/15 text-amber-400' },
  generating: { label: 'Generating', className: 'bg-blue-500/15 text-blue-400', pulse: true },
  expanding: { label: 'Expanding', className: 'bg-blue-500/15 text-blue-400', pulse: true },
  polishing: { label: 'Polishing', className: 'bg-blue-500/15 text-blue-400', pulse: true },
  ready: { label: 'Ready', className: 'bg-green-500/15 text-green-400' },
  complete: { label: 'Complete', className: 'bg-green-500/15 text-green-400' },
  published: { label: 'Published', className: 'bg-purple-500/15 text-purple-400' },
}

function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

interface ArticleRow {
  id: string
  title: string | null
  target_keyword: string | null
  status: string
  keyword_project_id: string | null
  updated_at: string | null
}

interface ProjectRow {
  id: string
  name: string
  status: string
  created_at: string
}

function StatCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="rounded-xl p-5" style={{ background: '#231F1B', border: '1px solid rgba(184,115,51,0.18)' }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-wider text-[#7A6555]">{label}</span>
        <span className="inline-flex p-1.5 rounded-lg" style={{ background: 'rgba(184,115,51,0.12)' }}>
          <Icon className="w-4 h-4" style={{ color: '#B87333' }} />
        </span>
      </div>
      <div className="text-3xl font-bold text-[#F7F3EC] tabular-nums">{value.toLocaleString()}</div>
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user!.id

  // Fetch the three independent datasets in parallel.
  const [articlesRes, projectsRes, savedRes, brandRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('articles')
      .select('id, title, target_keyword, status, keyword_project_id, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('keyword_projects')
      .select('id, name, status, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('saved_keywords')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('brand_profiles')
      .select('brand_name')
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  const articles: ArticleRow[] = articlesRes.data ?? []
  const projects: ProjectRow[] = projectsRes.data ?? []
  const savedCount: number = savedRes.count ?? 0
  const brandName: string | undefined = brandRes.data?.brand_name

  const totalArticles = articles.length
  const publishedArticles = articles.filter((a) => a.status === 'published').length
  const inProgress = articles.filter((a) => IN_PROGRESS.has(a.status)).slice(0, 5)

  const projectNameById = new Map(projects.map((p) => [p.id, p.name]))
  const topProjects = projects.slice(0, 6)

  // Keyword counts per displayed project (the keywords table is project-scoped).
  const displayedIds = topProjects.map((p) => p.id)
  const countByProject = new Map<string, number>()
  if (displayedIds.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: kwRows } = await (supabase as any)
      .from('keywords')
      .select('project_id')
      .in('project_id', displayedIds)
    for (const row of (kwRows ?? []) as { project_id: string }[]) {
      countByProject.set(row.project_id, (countByProject.get(row.project_id) ?? 0) + 1)
    }
  }

  return (
    <div className="p-8 max-w-6xl" style={{ background: '#1C1917', minHeight: '100%' }}>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#F7F3EC]">
          {brandName ? `Welcome back, ${brandName}` : 'Welcome to Byline'}
        </h1>
        <p className="mt-1 text-sm text-[#A89070]">Here&apos;s what&apos;s happening across your workspace.</p>
      </div>

      {/* Row 1 — stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={FileText} label="Total articles" value={totalArticles} />
        <StatCard icon={Globe} label="Published" value={publishedArticles} />
        <StatCard icon={Search} label="Keyword projects" value={projects.length} />
        <StatCard icon={Bookmark} label="Keywords saved" value={savedCount} />
      </div>

      {/* Row 2 — recent activity + keyword projects */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Left — in-progress articles */}
        <div className="lg:col-span-2">
          <div className="rounded-xl overflow-hidden" style={{ background: '#231F1B', border: '1px solid rgba(184,115,51,0.18)' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(184,115,51,0.15)' }}>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#B87333]" />
                <h2 className="text-sm font-semibold text-[#F7F3EC]">In progress</h2>
              </div>
              <Link href="/articles" className="text-xs font-medium text-[#A89070] hover:text-[#B87333] transition-colors flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {inProgress.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <div className="inline-flex p-3 rounded-xl mb-3" style={{ background: 'rgba(184,115,51,0.08)' }}>
                  <FileText className="w-5 h-5 text-[#D4954A]" />
                </div>
                <p className="text-sm text-[#A89070]">No articles in progress.</p>
                <Link href="/articles/new" className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-[#B87333] hover:text-[#A0622A] transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Create an article
                </Link>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'rgba(184,115,51,0.1)' }}>
                {inProgress.map((article) => {
                  const cfg = ARTICLE_STATUS[article.status] ?? ARTICLE_STATUS.draft
                  const projectName = article.keyword_project_id
                    ? projectNameById.get(article.keyword_project_id)
                    : null
                  return (
                    <Link
                      key={article.id}
                      href={`/articles/${article.id}`}
                      className="flex items-center gap-4 px-5 py-3.5 hover:bg-[#2A2420] transition-colors group"
                      style={{ borderColor: 'rgba(184,115,51,0.1)' }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm text-[#F7F3EC] group-hover:text-[#B87333] transition-colors line-clamp-1">
                          {article.title || article.target_keyword || 'Untitled draft'}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-[#7A6555]">
                          {projectName && (
                            <>
                              <span className="truncate max-w-[14rem]">{projectName}</span>
                              <span>·</span>
                            </>
                          )}
                          <span>{timeAgo(article.updated_at)}</span>
                        </div>
                      </div>
                      <span className={`inline-flex items-center shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.className}`}>
                        {cfg.pulse && <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 animate-pulse" />}
                        {cfg.label}
                      </span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right — keyword projects */}
        <div className="lg:col-span-1">
          <div className="rounded-xl overflow-hidden" style={{ background: '#231F1B', border: '1px solid rgba(184,115,51,0.18)' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(184,115,51,0.15)' }}>
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-[#B87333]" />
                <h2 className="text-sm font-semibold text-[#F7F3EC]">Keyword projects</h2>
              </div>
              <Link href="/keywords" title="New keyword research" className="inline-flex items-center justify-center w-6 h-6 rounded-lg text-[#F7F3EC] bg-[#B87333] hover:bg-[#A0622A] transition-colors">
                <Plus className="w-3.5 h-3.5" />
              </Link>
            </div>

            {topProjects.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <div className="inline-flex p-3 rounded-xl mb-3" style={{ background: 'rgba(184,115,51,0.08)' }}>
                  <Search className="w-5 h-5 text-[#D4954A]" />
                </div>
                <p className="text-sm text-[#A89070]">No projects yet.</p>
                <Link href="/keywords" className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-[#B87333] hover:text-[#A0622A] transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Start research
                </Link>
              </div>
            ) : (
              <>
                <div className="divide-y" style={{ borderColor: 'rgba(184,115,51,0.1)' }}>
                  {topProjects.map((p) => {
                    const count = countByProject.get(p.id) ?? 0
                    return (
                      <Link
                        key={p.id}
                        href={`/keywords/${p.id}`}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-[#2A2420] transition-colors group"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm text-[#F7F3EC] group-hover:text-[#B87333] transition-colors line-clamp-1">{p.name}</div>
                          <div className="text-xs text-[#7A6555] mt-0.5">
                            {count} {count === 1 ? 'keyword' : 'keywords'}
                          </div>
                        </div>
                        <ArrowUpRight className="w-4 h-4 text-[#7A6555] group-hover:text-[#B87333] transition-colors shrink-0" />
                      </Link>
                    )
                  })}
                </div>
                <div className="px-5 py-3" style={{ borderTop: '1px solid rgba(184,115,51,0.1)' }}>
                  <Link href="/keywords" className="text-xs font-medium text-[#A89070] hover:text-[#B87333] transition-colors flex items-center gap-1">
                    View all projects <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Row 3 — quick actions (only when nothing is in progress) */}
      {inProgress.length === 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#7A6555] mb-3">Quick actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { href: '/keywords', icon: Search, title: 'Start keyword research', desc: 'Discover high-value keywords to target.' },
              { href: '/articles/new', icon: Sparkles, title: 'Create article', desc: 'Generate an SEO-optimized draft.' },
              { href: '/content-audit', icon: BarChart2, title: 'Run content audit', desc: 'Score and improve existing content.' },
            ].map(({ href, icon: Icon, title, desc }) => (
              <Link
                key={href}
                href={href}
                className="rounded-xl p-5 transition-all group"
                style={{ background: '#231F1B', border: '1px solid rgba(184,115,51,0.18)' }}
              >
                <div className="inline-flex p-2 rounded-lg mb-4" style={{ background: 'rgba(184,115,51,0.12)' }}>
                  <Icon className="w-5 h-5" style={{ color: '#B87333' }} />
                </div>
                <h3 className="font-semibold text-[#F7F3EC] mb-1 text-sm">{title}</h3>
                <p className="text-sm text-[#A89070] leading-relaxed">{desc}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
