import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Building2, Search, FileText, ArrowRight } from 'lucide-react'

const cards = [
  {
    href: '/brand',
    icon: Building2,
    title: 'Brand Profile',
    description: 'Define your brand voice, audience, and core keywords. This powers all AI-generated content.',
    cta: 'Set up brand',
    color: 'bg-indigo-50 text-indigo-600',
  },
  {
    href: '/keywords',
    icon: Search,
    title: 'Keyword Research',
    description: 'Discover high-value keywords using Google Ads data. Select targets for your content plan.',
    cta: 'Research keywords',
    color: 'bg-violet-50 text-violet-600',
  },
  {
    href: '/articles',
    icon: FileText,
    title: 'Articles',
    description: 'Generate SEO-optimized article briefs and full drafts grounded in your brand profile.',
    cta: 'Create article',
    color: 'bg-sky-50 text-sky-600',
  },
]

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: brandProfile } = await (supabase as any)
    .from('brand_profiles')
    .select('brand_name')
    .eq('user_id', user!.id)
    .maybeSingle() as { data: { brand_name: string } | null }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {brandProfile?.brand_name ? `Welcome back, ${brandProfile.brand_name}` : 'Welcome to Byline'}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Your AI-powered SEO content workspace
        </p>
      </div>

      {!brandProfile && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <span className="text-amber-500 mt-0.5">!</span>
          <div className="text-sm text-amber-800">
            <span className="font-medium">Start with your brand profile.</span> Setting up your brand voice and keywords lets the AI generate content that actually sounds like you.{' '}
            <Link href="/brand" className="underline hover:text-amber-900">Set it up now →</Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map(({ href, icon: Icon, title, description, cta, color }) => (
          <Link
            key={href}
            href={href}
            className="bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 hover:shadow-sm transition-all group"
          >
            <div className={`inline-flex p-2 rounded-lg ${color} mb-4`}>
              <Icon className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
            <p className="text-sm text-gray-500 mb-4 leading-relaxed">{description}</p>
            <span className="text-sm font-medium text-indigo-600 flex items-center gap-1 group-hover:gap-2 transition-all">
              {cta} <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
