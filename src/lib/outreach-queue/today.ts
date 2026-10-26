/**
 * Which queue items Michael sees today. Pure, so the rules are tested.
 *
 * Rules, in order (agreed 2026-10-21):
 *   1. Items with a closing window (closes_on) come first, soonest first.
 *   2. At most 4 comments a day.
 *   3. At most 1 social post per account per day, and 2 per account per week.
 *      An account is one profile on one platform, so Founder on LinkedIn and
 *      Founder on X are separate accounts.
 *   4. An item stays hidden until every id in after_ids is done.
 *   5. At most 3 outbound messages a day.
 *   6. 3 to 5 items shown; the rest are held.
 * Items already completed today or this week count against the caps, so the
 * list shrinks as he works rather than refilling.
 * A pending item with no activity (created or updated) for more than 7 days is
 * stale: it never reaches today's list and is shown apart, so the page shows
 * what is live rather than everything once written (added 2026-10-26).
 * Days and weeks are in Michael's time zone; weeks start on Monday.
 */

export interface QueueRow {
  id: string
  type: string
  account: string
  platform: string
  status: string
  priority: number
  closes_on: string | null
  due_date: string | null
  after_ids: string[]
  sort_order: number | null
  created_at: string
  updated_at?: string | null
  completed_at: string | null
}

export const TIME_ZONE = 'Asia/Jerusalem'
export const MAX_SHOWN = 5
export const STALE_AFTER_DAYS = 7

/** Whole days since the item was last created or updated. */
export function idleDays(r: QueueRow, now: Date): number {
  const last = Math.max(Date.parse(r.created_at), r.updated_at ? Date.parse(r.updated_at) : 0)
  return Math.floor((now.getTime() - last) / 86_400_000)
}
export const CAPS = { commentsPerDay: 4, socialPerAccountPerDay: 1, socialPerAccountPerWeek: 2, outboundPerDay: 3 }

/** YYYY-MM-DD in the given time zone. */
export function dayKey(d: Date, tz = TIME_ZONE): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

/** The Monday (YYYY-MM-DD) of the week containing d, in the given time zone. */
export function weekKey(d: Date, tz = TIME_ZONE): string {
  const day = dayKey(d, tz)
  const [y, m, dd] = day.split('-').map(Number)
  const utc = new Date(Date.UTC(y, m - 1, dd))
  const dow = (utc.getUTCDay() + 6) % 7 // Monday = 0
  utc.setUTCDate(utc.getUTCDate() - dow)
  return utc.toISOString().slice(0, 10)
}

export interface TodayResult {
  today: QueueRow[]
  /** Pending items whose prerequisites are not done yet, with what they wait for. */
  blocked: { row: QueueRow; waitingFor: string[] }[]
  /** Eligible but held back by a cap or the 5-item limit. */
  held: QueueRow[]
  /** Pending, but untouched for more than STALE_AFTER_DAYS. Never shown as today. */
  stale: { row: QueueRow; idleDays: number }[]
}

export function selectToday(rows: QueueRow[], now: Date): TodayResult {
  const done = new Set(rows.filter((r) => r.status === 'done').map((r) => r.id))
  const today = dayKey(now)
  const week = weekKey(now)

  // What has already been completed counts against today's and this week's caps.
  const doneToday = rows.filter((r) => r.status === 'done' && r.completed_at && dayKey(new Date(r.completed_at)) === today)
  const doneWeek = rows.filter((r) => r.status === 'done' && r.completed_at && weekKey(new Date(r.completed_at)) === week)
  let comments = doneToday.filter((r) => r.type === 'comment').length
  let outbound = doneToday.filter((r) => r.type === 'outbound message').length
  const socialDay = new Map<string, number>()
  const socialWeek = new Map<string, number>()
  const acct = (r: QueueRow) => `${r.account} on ${r.platform}`
  for (const r of doneToday) if (r.type === 'social post') socialDay.set(acct(r), (socialDay.get(acct(r)) ?? 0) + 1)
  for (const r of doneWeek) if (r.type === 'social post') socialWeek.set(acct(r), (socialWeek.get(acct(r)) ?? 0) + 1)

  const pending = rows.filter((r) => r.status === 'pending')
  const blocked: TodayResult['blocked'] = []
  const eligible: QueueRow[] = []
  const stale: TodayResult['stale'] = []
  for (const r of pending) {
    const idle = idleDays(r, now)
    if (idle > STALE_AFTER_DAYS) {
      stale.push({ row: r, idleDays: idle })
      continue
    }
    const waitingFor = (r.after_ids ?? []).filter((id) => !done.has(id))
    if (waitingFor.length) blocked.push({ row: r, waitingFor })
    else eligible.push(r)
  }

  eligible.sort((a, b) => {
    if (a.closes_on && b.closes_on && a.closes_on !== b.closes_on) return a.closes_on < b.closes_on ? -1 : 1
    if (a.closes_on && !b.closes_on) return -1
    if (!a.closes_on && b.closes_on) return 1
    if (a.priority !== b.priority) return a.priority - b.priority
    if (a.due_date && b.due_date && a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1
    if (a.due_date && !b.due_date) return -1
    if (!a.due_date && b.due_date) return 1
    if (a.sort_order != null && b.sort_order != null && a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
    return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0
  })

  const chosen: QueueRow[] = []
  const held: QueueRow[] = []
  for (const r of eligible) {
    if (chosen.length >= MAX_SHOWN) {
      held.push(r)
      continue
    }
    if (r.type === 'comment') {
      if (comments >= CAPS.commentsPerDay) { held.push(r); continue }
      comments++
    } else if (r.type === 'outbound message') {
      if (outbound >= CAPS.outboundPerDay) { held.push(r); continue }
      outbound++
    } else if (r.type === 'social post') {
      const d = socialDay.get(acct(r)) ?? 0
      const w = socialWeek.get(acct(r)) ?? 0
      if (d >= CAPS.socialPerAccountPerDay || w >= CAPS.socialPerAccountPerWeek) { held.push(r); continue }
      socialDay.set(acct(r), d + 1)
      socialWeek.set(acct(r), w + 1)
    }
    chosen.push(r)
  }

  return { today: chosen, blocked, held, stale }
}
