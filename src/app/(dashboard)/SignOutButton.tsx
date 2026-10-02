'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function SignOutButton() {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <button
      onClick={handleSignOut}
      className="flex items-center gap-3 w-full px-3 py-2 text-sm text-[var(--cream-faint)] rounded-lg hover:bg-[var(--hover)] hover:text-[var(--cream-dim)] transition-colors"
    >
      <LogOut className="w-4 h-4" />
      Sign out
    </button>
  )
}
