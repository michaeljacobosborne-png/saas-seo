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
 * A due date in the future holds an item until that day, and an after_ids entry
 * "blog:<slug>" holds it until that blog post is published (added 2026-10-27).
 * Replies sort above everything else and are never held by a cap or by the
 * 5-item limit, because a reply loses most of its value by the next day
 * (added 2026-10-30).
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

/**
 * Whole days since the item last had activity: created, updated, its scheduled
 * day arriving, or the blog post it promotes going live (`releasedAt`).
 */
export function idleDays(r: QueueRow, now: Date, releasedAt = 0): number {
  const last = Math.max(
    Date.parse(r.created_at),
    r.updated_at ? Date.parse(r.updated_at) : 0,
    r.due_date ? Date.parse(`${r.due_date}T00:00:00Z`) : 0,
    releasedAt,
  )
  return Math.max(0, Math.floor((now.getTime() - last) / 86_400_000))
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

export interface SelectOptions {
  /**
   * Blog posts that are live, slug to publishedAt (ISO). An after_ids entry
   * "blog:<slug>" holds an item (a post promoting that article) until the
   * article is published.
   */
  published?: ReadonlyMap<string, string>
}

/** after_ids entries that are conditions outside the queue rather than queue ids. */
export const BLOG_GATE = 'blog:'

export function selectToday(rows: QueueRow[], now: Date, opts: SelectOptions = {}): TodayResult {
  const done = new Set(rows.filter((r) => r.status === 'done').map((r) => r.id))
  for (const slug of opts.published?.keys() ?? []) done.add(`${BLOG_GATE}${slug}`)
  // When the article an item waits on went live: that counts as activity.
  const releasedAt = (r: QueueRow) =>
    Math.max(0, ...(r.after_ids ?? []).filter((a) => a.startsWith(BLOG_GATE)).map((a) => Date.parse(opts.published?.get(a.slice(BLOG_GATE.length)) ?? '') || 0))
  // Waiting on something outside the queue is not idleness.
  const externallyHeld = (r: QueueRow) =>
    (r.due_date !== null && r.due_date > dayKey(now)) ||
    (r.after_ids ?? []).some((a) => a.startsWith(BLOG_GATE) && !done.has(a))
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
    const idle = idleDays(r, now, releasedAt(r))
    if (idle > STALE_AFTER_DAYS && !externallyHeld(r)) {
      stale.push({ row: r, idleDays: idle })
      continue
    }
    const waitingFor = (r.after_ids ?? []).filter((id) => !done.has(id))
    // A due date in the future means "not before": spacing two messages that
    // must not land in the same week, for instance.
    if (r.due_date && r.due_date > today) waitingFor.push(`date:${r.due_date}`)
    if (waitingFor.length) blocked.push({ row: r, waitingFor })
    else eligible.push(r)
  }

  eligible.sort((a, b) => {
    // Replies first: a reply a day late is worth far less than one the same day.
    if (a.type === 'reply' && b.type !== 'reply') return -1
    if (a.type !== 'reply' && b.type === 'reply') return 1
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
    // Replies are never held by a cap and do not take one of the MAX_SHOWN slots.
    if (r.type === 'reply') {
      chosen.push(r)
      continue
    }
    if (chosen.filter((c) => c.type !== 'reply').length >= MAX_SHOWN) {
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
