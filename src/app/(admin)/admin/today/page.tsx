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
}

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
})

export default async function TodayPage() {
  const { data, error } = await createServiceClient()
    .from('outreach_queue')
    .select('id, type, account, platform, target, parts, warning, note, needs_rerun, status, priority, closes_on, due_date, after_ids, sort_order, created_at, updated_at, completed_at')

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

  const used = (type: string) => doneToday.filter((r) => r.type === type).length
  const dateLabel = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, weekday: 'long', day: 'numeric', month: 'long' }).format(now)

  return (
    <TodayList
      dateLabel={dateLabel}
      today={(today as Row[]).map((r) => toItem(r))}
      held={(held as Row[]).map((r) => toItem(r))}
      blocked={blocked.map((b) => toItem(b.row as Row, b.waitingFor))}
      stale={stale.map((s) => toItem(s.row as Row, [], s.idleDays))}
      doneToday={doneToday.map((r) => toItem(r))}
      pendingCount={pendingCount}
      caps={{
        comments: `${used('comment')}/${CAPS.commentsPerDay}`,
        outbound: `${used('outbound message')}/${CAPS.outboundPerDay}`,
      }}
    />
  )
}
