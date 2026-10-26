import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase/service'
import type { QueuePart } from '@/lib/outreach-queue/parse'
import { CAPS, TIME_ZONE, dayKey, selectToday, type QueueRow } from '@/lib/outreach-queue/today'
import TodayList, { type Item } from './TodayList'

// Always live: the list changes every time an item is marked done.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = { title: 'Today', robots: { index: false, follow: false } }

type Row = QueueRow & {
  target: string | null
  parts: QueuePart[]
  warning: string | null
  note: string | null
  needs_rerun: boolean
  /** Present once migration 20261026_outreach_queue_blocked.sql has run. */
  blocked_reason?: string | null
  blocked_at?: string | null
}

const DAY = 86_400_000

const toItem = (r: Row, waitingFor: string[] = [], idleDays?: number): Item => ({
  id: r.id,
  type: r.type,
  account: r.account,
  platform: r.platform,
  target: r.target,
  parts: r.parts ?? [],
  warning: r.warning,
  note: r.note,
  needsRerun: r.needs_rerun,
  closesOn: r.closes_on,
  waitingFor,
  idleDays,
  blockedReason: r.blocked_reason ?? null,
})

export default async function TodayPage() {
  const { data, error } = await createServiceClient()
    .from('outreach_queue')
    // All columns, so the page keeps working whether or not the blocked
    // columns exist yet.
    .select('*')

  if (error) {
    return <p className="p-4 text-[var(--cream)]">Could not load the queue: {error.message}</p>
  }

  const rows = (data ?? []) as Row[]
  const now = new Date()
  const { today, blocked, held, stale } = selectToday(rows, now)
  const todayKey = dayKey(now)
  const doneToday = rows
    .filter((r) => r.status === 'done' && r.completed_at && dayKey(new Date(r.completed_at)) === todayKey)
    .sort((a, b) => (a.completed_at! < b.completed_at! ? 1 : -1))
  const pendingCount = rows.filter((r) => r.status === 'pending').length - stale.length
  // Waiting on someone else: never in today's slots, never stale.
  const waitingOnOthers = rows
    .filter((r) => r.status === 'blocked')
    .map((r) => {
      const since = r.blocked_at ?? r.updated_at ?? r.created_at
      return toItem(r, [], Math.max(0, Math.floor((now.getTime() - Date.parse(since)) / DAY)))
    })

  const used = (type: string) => doneToday.filter((r) => r.type === type).length
  const dateLabel = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, weekday: 'long', day: 'numeric', month: 'long' }).format(now)

  return (
    <TodayList
      dateLabel={dateLabel}
      today={(today as Row[]).map((r) => toItem(r))}
      held={(held as Row[]).map((r) => toItem(r))}
      blocked={blocked.map((b) => toItem(b.row as Row, b.waitingFor))}
      stale={stale.map((s) => toItem(s.row as Row, [], s.idleDays))}
      waitingOnOthers={waitingOnOthers}
      doneToday={doneToday.map((r) => toItem(r))}
      pendingCount={pendingCount}
      caps={{
        comments: `${used('comment')}/${CAPS.commentsPerDay}`,
        outbound: `${used('outbound message')}/${CAPS.outboundPerDay}`,
      }}
    />
  )
}
