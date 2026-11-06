import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase/service'
import type { QueuePart } from '@/lib/outreach-queue/parse'
import { CAPS, TIME_ZONE, dayKey, isRequest, selectToday, type QueueRow } from '@/lib/outreach-queue/today'
import { client as sanity } from '@/sanity/lib/client'
import { isSanityConfigured } from '@/sanity/env'
import { arrangeColumns, SHOWN_PER_COLUMN, type OutreachCard } from '@/lib/outreach-queue/columns'
import TodayList, { type ColumnView, type Item, type OutreachCardView } from './TodayList'

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

/**
 * Live blog posts, slug to publishedAt. Read without a token, so only published
 * posts come back; that is exactly the gate for posts promoting an article. A
 * failure here holds those posts back rather than breaking the page.
 */
async function publishedPosts(): Promise<Map<string, string>> {
  if (!isSanityConfigured) return new Map()
  try {
    const rows = await sanity.fetch<{ slug: string; publishedAt: string | null }[]>(
      `*[_type == "post" && defined(slug.current)]{"slug": slug.current, publishedAt}`,
      {},
      { cache: 'no-store' },
    )
    return new Map(rows.map((r) => [r.slug, r.publishedAt ?? new Date(0).toISOString()]))
  } catch {
    return new Map()
  }
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
  const result = selectToday(rows, now, { published: await publishedPosts() })
  const layout = arrangeColumns(rows, result, now)
  const todayKey = dayKey(now)
  const doneToday = rows
    .filter((r) => r.status === 'done' && r.completed_at && dayKey(new Date(r.completed_at)) === todayKey)
    .sort((a, b) => (a.completed_at! < b.completed_at! ? 1 : -1))
  // Waiting on someone else, outside outreach (which shows its own on each card).
  const waitingOnOthers = rows
    .filter((r) => r.status === 'blocked' && r.type !== 'outbound message')
    .map((r) => {
      const since = r.blocked_at ?? r.updated_at ?? r.created_at
      return toItem(r, [], Math.max(0, Math.floor((now.getTime() - Date.parse(since)) / DAY)))
    })

  const used = (type: string) => doneToday.filter((r) => r.type === type).length
  const dateLabel = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, weekday: 'long', day: 'numeric', month: 'long' }).format(now)
  const column = <I, O>(c: { key: ColumnView<O>['key']; label: string; due: I[]; held: string[]; waiting: string[]; empty: string | null }, map: (i: I) => O): ColumnView<O> => ({
    key: c.key,
    label: c.label,
    due: c.due.map(map),
    held: c.held,
    waiting: c.waiting,
    empty: c.empty,
  })
  const card = (c: OutreachCard<Row>): OutreachCardView => ({
    key: c.key,
    stage: c.stage,
    request: c.request ? toItem(c.request) : null,
    message: c.message ? toItem(c.message) : null,
    waitingReason: c.waitingReason ?? null,
    days: c.days,
    decide: c.decide,
  })

  return (
    <TodayList
      dateLabel={dateLabel}
      replies={layout.replies.map((r) => toItem(r))}
      social={column(layout.social, (r: Row) => toItem(r))}
      comments={column(layout.comments, (r: Row) => toItem(r))}
      outreach={{ ...column(layout.outreach, card), awaiting: layout.outreach.awaiting.map(card) }}
      stale={layout.stale.map((s) => toItem(s.row as Row, [], s.idleDays))}
      waitingOnOthers={waitingOnOthers}
      doneToday={doneToday.map((r) => toItem(r))}
      shownPerColumn={SHOWN_PER_COLUMN}
      caps={{
        comments: `${used('comment')}/${CAPS.commentsPerDay}`,
        outbound: `${doneToday.filter((r) => r.type === 'outbound message' && !isRequest(r)).length}/${CAPS.outboundPerDay}`,
        requests: `${doneToday.filter(isRequest).length}/${CAPS.requestsPerDay}`,
      }}
    />
  )
}
