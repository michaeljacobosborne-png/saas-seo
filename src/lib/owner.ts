// Owner-only gate for admin/outreach server routes. Mirrors the hardcoded
// OWNER_EMAIL check used by the /admin dashboard layout.
import { createClient } from '@/lib/supabase/server'

const OWNER_EMAIL = 'michaeljacobosborne@gmail.com'

/** Returns true if the current session belongs to the owner. */
export async function isOwner(): Promise<boolean> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user?.email?.toLowerCase() === OWNER_EMAIL
  } catch {
    return false
  }
}
