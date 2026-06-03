import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  PlusCircle, Search, Bot, Pencil, ChevronRight,
  FileText, Bookmark, Clock,
} from 'lucide-react'
import DashboardActions from './DashboardActions'

// ── helpers ─────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const STATUS_CONFIG: Record<string, { label: string; style: React.CSSProperties }> = {
  draft:       { label: 'Draft',       style: { color: '#7A6555', background: '#2A2420' } },
  brief_ready: { label: 'Brief Ready', style: { color: '#F59E0B', background: 'rgba(245,158,11,0.1)' } },
  generating:  { label: 'Generating',  style: { color: '#60A5FA', background: 'rgba(96,165,250,0.1)' } },
  complete:    { label: 'Complete',    style: { color: '#4ADE80', background: 'rgba(74,222,128,0.1)' } },
  published:   { label: 'Published',   style: { color: '#B87333', background: 'rgba(184,115,51,0.15)' } },
}

// ── page ────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  // Parallel data fetch
  const [brandRes, articlesRes, keywordsRes] = await Promise.all([
    sb.from('brand_profiles')
      .select('brand_name, company_name, industry')
      .eq('user_id', user!.id)
      .maybeSingle(),
    sb.from('articles')
      .select('id, title, target_keyword, status, word_count, updated_at, created_at')
      .eq('user_id', user!.id)
      .order('updated_at', { ascending: false })
      .limit(8),
    sb.from('saved_keywords')
      .select('id, keyword, volume, difficulty, folder, has_article')
      .eq('user_id', user!.id)
      .order('volume', { ascending: false })
      .limit(60),
  ])

  const brand = brandRes.data as { brand_name: string | null; company_name: string | null; industry: string | null } | null
  const articles = (articlesRes.data ?? []) as Array<{
    id: string; title: string | null; target_keyword: string | null;
    status: string; word_count: number | null; updated_at: string; created_at: string
  }>
  const allKeywords = (keywordsRes.data ?? []) as Array<{
    id: string; keyword: string; volume: number | null;
    difficulty: number | null; folder: string; has_article: boolean
  }>

  // Group keywords by folder, take top 3 per folder, max 4 folders
  const folderMap: Record<string, typeof allKeywords> = {}
  for (const kw of allKeywords) {
    if (!folderMap[kw.folder]) folderMap[kw.folder] = []
    if (folderMap[kw.folder].length < 3) folderMap[kw.folder].push(kw)
  }
  const folders = Object.entries(folderMap).slice(0, 4)

  const displayName = brand?.brand_name ?? brand?.company_name ?? null
  const hasBrand = !!brand

  return (
    <div className="p-6 md:p-8 max-w-6xl" style={{ minHeight: '100%' }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#F7F3EC' }}>
            {displayName ? `Welcome back, ${displayName}` : 'Welcome to Byline'}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#7A6555' }}>
            {brand?.industry ? brand.industry : 'Your AI-powered SEO workspace'}
          </p>
        </div>
        <Link
          href="/brand"
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors shrink-0 ml-4"
          style={{ color: '#A89070', borderColor: 'rgba(184,115,51,0.25)', background: 'transparent' }}
        >
          <Pencil className="w-3 h-3" />
          {hasBrand ? 'Update brand' : 'Set up brand'}
        </Link>
      </div>

      {/* ── No brand prompt ─────────────────────────────────────────────── */}
      {!hasBrand && (
        <div className="mb-6 rounded-xl px-4 py-3 flex items-start gap-3"
          style={{ background: 'rgba(184,115,51,0.08)', border: '1px solid rgba(184,115,51,0.25)' }}>
          <span style={{ color: '#B87333' }} className="mt-0.5 font-bold">!</span>
          <p className="text-sm" style={{ color: '#F7F3EC' }}>
            <span className="font-medium" style={{ color: '#B87333' }}>Set up your brand profile first.</span>{' '}
            It powers all AI-generated content.{' '}
            <Link href="/brand" className="underline hover:opacity-80" style={{ color: '#B87333' }}>
              Set it up now →
            </Link>
          </p>
        </div>
      )}

      {/* ── Quick Actions ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 mb-8">
        <Link
          href="/articles/new"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
          style={{ background: '#B87333', color: '#1C1917' }}
        >
          <PlusCircle className="w-4 h-4" />
          New Article
        </Link>
        <Link
          href="/keywords"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors"
          style={{ color: '#F7F3EC', borderColor: 'rgba(184,115,51,0.25)', background: '#231F1B' }}
        >
          <Search className="w-4 h-4" />
          Keyword Research
        </Link>
        {/* Client component — triggers the floating ChatWidget */}
        <DashboardActions />
      </div>

      {/* ── Main Grid ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Articles — wider column */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" style={{ color: '#B87333' }} />
              <h2 className="text-sm font-semibold" style={{ color: '#F7F3EC' }}>Articles</h2>
            </div>
            <Link
              href="/articles"
              className="flex items-center gap-1 text-xs font-medium transition-colors"
              style={{ color: '#7A6555' }}
            >
              View all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(184,115,51,0.15)', background: '#231F1B' }}>
            {articles.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <FileText className="w-8 h-8 mx-auto mb-3" style={{ color: '#3A342E' }} />
                <p className="text-sm mb-3" style={{ color: '#7A6555' }}>No articles yet</p>
                <Link
                  href="/articles/new"
                  className="text-sm font-medium transition-colors"
                  style={{ color: '#B87333' }}
                >
                  Create your first article →
                </Link>
              </div>
            ) : (
              <div>
                {articles.map((article, i) => {
                  const label = article.title ?? article.target_keyword ?? 'Untitled'
                  const statusCfg = STATUS_CONFIG[article.status] ?? STATUS_CONFIG.draft
                  return (
                    <Link
                      key={article.id}
                      href={`/articles/${article.id}`}
                      className="flex items-center gap-3 px-5 py-3.5 transition-colors group"
                      style={{
                        borderTop: i > 0 ? '1px solid rgba(184,115,51,0.1)' : undefined,
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(184,115,51,0.04)' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      {/* Status dot */}
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: statusCfg.style.color as string }} />

                      {/* Title */}
                      <span className="flex-1 text-sm font-medium truncate" style={{ color: '#F7F3EC' }}>{label}</span>

                      {/* Meta */}
                      <div className="flex items-center gap-3 shrink-0">
                        {article.word_count ? (
                          <span className="text-xs tabular-nums" style={{ color: '#7A6555' }}>
                            {article.word_count.toLocaleString()} w
                          </span>
                        ) : null}
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={statusCfg.style}
                        >
                          {statusCfg.label}
                        </span>
                        <span className="text-xs" style={{ color: '#4A3E35' }}>
                          {timeAgo(article.updated_at)}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#B87333' }} />
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Keywords / Folders — narrower column */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Bookmark className="w-4 h-4" style={{ color: '#B87333' }} />
              <h2 className="text-sm font-semibold" style={{ color: '#F7F3EC' }}>Saved Keywords</h2>
            </div>
            <Link
              href="/keywords/saved"
              className="flex items-center gap-1 text-xs font-medium"
              style={{ color: '#7A6555' }}
            >
              View all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(184,115,51,0.15)', background: '#231F1B' }}>
            {folders.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <Bookmark className="w-8 h-8 mx-auto mb-3" style={{ color: '#3A342E' }} />
                <p className="text-sm mb-3" style={{ color: '#7A6555' }}>No saved keywords yet</p>
                <Link href="/keywords" className="text-sm font-medium" style={{ color: '#B87333' }}>
                  Start researching →
                </Link>
              </div>
            ) : (
              <div>
                {folders.map(([folder, keywords], fi) => {
                  const total = allKeywords.filter(k => k.folder === folder).length
                  return (
                    <div
                      key={folder}
                      style={{ borderTop: fi > 0 ? '1px solid rgba(184,115,51,0.1)' : undefined }}
                    >
                      {/* Folder header */}
                      <Link
                        href="/keywords/saved"
                        className="flex items-center justify-between px-4 py-2.5 group"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base">📁</span>
                          <span className="text-xs font-semibold" style={{ color: '#D4954A' }}>{folder}</span>
                          <span
                            className="text-xs px-1.5 py-0.5 rounded-full tabular-nums"
                            style={{ color: '#7A6555', background: '#2A2420' }}
                          >
                            {total}
                          </span>
                        </div>
                        <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#B87333' }} />
                      </Link>

                      {/* Top keywords in folder */}
                      <div className="pb-1">
                        {keywords.map((kw) => (
                          <div
                            key={kw.id}
                            className="flex items-center justify-between px-4 py-1.5"
                          >
                            <span className="text-xs truncate mr-2" style={{ color: '#A89070' }}>{kw.keyword}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              {kw.volume !== null && (
                                <span className="text-xs tabular-nums" style={{ color: '#7A6555' }}>
                                  {kw.volume >= 1000 ? `${(kw.volume / 1000).toFixed(1)}k` : kw.volume}
                                </span>
                              )}
                              {kw.has_article && (
                                <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#4ADE80' }} title="Has article" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Quick stats */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div
              className="rounded-xl px-4 py-3"
              style={{ background: '#231F1B', border: '1px solid rgba(184,115,51,0.15)' }}
            >
              <p className="text-xs mb-1" style={{ color: '#7A6555' }}>Total keywords</p>
              <p className="text-xl font-bold tabular-nums" style={{ color: '#F7F3EC' }}>{allKeywords.length}</p>
            </div>
            <div
              className="rounded-xl px-4 py-3"
              style={{ background: '#231F1B', border: '1px solid rgba(184,115,51,0.15)' }}
            >
              <p className="text-xs mb-1" style={{ color: '#7A6555' }}>Articles</p>
              <p className="text-xl font-bold tabular-nums" style={{ color: '#F7F3EC' }}>{articles.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Recent activity footer ───────────────────────────────────────── */}
      {articles.length > 0 && (
        <div className="mt-6 flex items-center gap-2 text-xs" style={{ color: '#4A3E35' }}>
          <Clock className="w-3.5 h-3.5" />
          Last active {timeAgo(articles[0].updated_at)}
        </div>
      )}
    </div>
  )
}
