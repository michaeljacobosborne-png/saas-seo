import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

export { metadata, viewport } from 'next-sanity/studio'

// The Studio is admin-only. Reading the Supabase session cookie makes this
// route dynamic, so it is never statically prerendered — every visit is
// auth-checked. Public /blog pages are unaffected (separate route subtree).
export default async function StudioLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return children
}
