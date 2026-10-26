'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const OWNER_EMAIL = 'michaeljacobosborne@gmail.com'

// The layout already gates the page, but a server action is its own endpoint,
// so it checks the owner again before touching the table.
async function assertOwner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email?.toLowerCase() !== OWNER_EMAIL) throw new Error('Not allowed')
}

async function setStatus(id: string, status: 'done' | 'pending') {
  await assertOwner()
  if (typeof id !== 'string' || !/^[A-Z]{1,3}-[A-Z]?\d{1,3}$/.test(id)) throw new Error('Bad id')
  const now = new Date().toISOString()
  const { error } = await createServiceClient()
    .from('outreach_queue')
    .update({ status, completed_at: status === 'done' ? now : null, updated_at: now })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/today')
}

export async function markDone(id: string) {
  await setStatus(id, 'done')
}

export async function undoDone(id: string) {
  await setStatus(id, 'pending')
}

/** Counts as activity, so a stale item returns to the live queue for 7 more days. */
export async function keepLive(id: string) {
  await assertOwner()
  if (typeof id !== 'string' || !/^[A-Z]{1,3}-[A-Z]?\d{1,3}$/.test(id)) throw new Error('Bad id')
  const { error } = await createServiceClient()
    .from('outreach_queue')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending')
  if (error) throw new Error(error.message)
  revalidatePath('/admin/today')
}
