import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, Globe } from 'lucide-react'
import ConnectionsSection from './connections-section'

export default async function ConnectionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="p-8 max-w-2xl">
      {/* Header */}
      <Link
        href="/settings"
        className="flex items-center gap-1.5 text-sm mb-4 transition-colors w-fit"
        style={{ color: 'var(--cream-faint)' }}
      >
        <ArrowLeft className="w-4 h-4" /> Settings
      </Link>
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 rounded-lg" style={{ background: 'rgba(184,115,51,0.1)' }}>
          <Globe className="w-5 h-5" style={{ color: '#B87333' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#F7F3EC' }}>Connections</h1>
          <p className="text-sm" style={{ color: 'var(--cream-faint)' }}>Publish your articles to external sites</p>
        </div>
      </div>

      <ConnectionsSection />
    </div>
  )
}
