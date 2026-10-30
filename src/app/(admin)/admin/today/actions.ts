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

export type ActionResult = { ok: true } | { ok: false; message: string }

/**
 * Production hides thrown server-action errors behind a generic message, so
 * these return the reason instead. A missing column or a refused status means
 * migration 20261026_outreach_queue_blocked.sql has not been run yet.
 */
function explain(message: string): string {
  if (/column|schema cache|check constraint|violates/i.test(message)) {
    return 'The database needs a one-time update before items can wait on others. The SQL is with Michael (migration 20261026_outreach_queue_blocked.sql).'
  }
  return `Could not save: ${message}`
}

/** Waiting on someone else: off today's list, shown under "Waiting on others". */
export async function blockItem(id: string, reason: string): Promise<ActionResult> {
  await assertOwner()
  if (typeof id !== 'string' || !/^[A-Z]{1,3}-[A-Z]?\d{1,3}$/.test(id)) return { ok: false, message: 'Bad id.' }
  const why = String(reason ?? '').trim().slice(0, 300)
  if (!why) return { ok: false, message: 'Say what you are waiting for.' }
  const now = new Date().toISOString()
  const { data, error } = await createServiceClient()
    .from('outreach_queue')
    .update({ status: 'blocked', blocked_reason: why, blocked_at: now, updated_at: now })
    .eq('id', id)
    .eq('status', 'pending')
    .select('id')
  if (error) return { ok: false, message: explain(error.message) }
  if (!data?.length) return { ok: false, message: `${id} is no longer pending, so it was not moved.` }
  revalidatePath('/admin/today')
  return { ok: true }
}

/** The wait is over: back into the live queue, counted as fresh activity. */
export async function unblockItem(id: string): Promise<ActionResult> {
  await assertOwner()
  if (typeof id !== 'string' || !/^[A-Z]{1,3}-[A-Z]?\d{1,3}$/.test(id)) return { ok: false, message: 'Bad id.' }
  const { error } = await createServiceClient()
    .from('outreach_queue')
    .update({ status: 'pending', blocked_reason: null, blocked_at: null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'blocked')
  if (error) return { ok: false, message: explain(error.message) }
  revalidatePath('/admin/today')
  return { ok: true }
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
