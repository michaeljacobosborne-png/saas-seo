/**
 * The action page's layout: replies across the top, then three columns
 * (social posts, comments, outreach), each with its own limit of items shown.
 * Pure, so the rules are tested.
 *
 * Until 2026-11-06 one MAX_SHOWN of 5 was shared across every type. On 5 Nov
 * four comments and one message filled it and all four of the day's social
 * posts (F-X15, F-L14, B-X11, B-F8) sat unseen behind "See all". A busy day in
 * one type must never bury another, so each column now has its own limit.
 *
 * This decides only how much is shown and where. What is due, held, waiting or
 * stale is decided by selectToday (today.ts) and is not changed here.
 *
 * Outreach is one card per person with two stages: the plain connection request
 * (RQ-) and the finding message that follows it (OB-, after_ids: [RQ-]). Neither
 * row ever appears anywhere else.
 */
import { awaitingAcceptance } from './requests'
import { CAPS, dayKey, isRequest, BLOG_GATE, type QueueRow, type TodayResult } from './today'

export const SHOWN_PER_COLUMN = 3

/**
 * The rule every plain request carries, shown once at the top of the Outreach
 * column instead of on each card (on 6 Nov it repeated on 15 cards and filled
 * a phone screen). Each card keeps only what is specific to it.
 */
export const REQUEST_RULE = 'Send every request plain, with no note: the free account has used its custom notes for the month.'
const RULE_SENTENCE = /^\s*No note\.\s*The free account has used its custom notes for the month[^.]*\.\s*/i

/** A request's warning with the shared no-note rule removed; null when nothing specific is left. */
export function requestCaveat(warning: string | null | undefined): string | null {
  const rest = (warning ?? '').replace(RULE_SENTENCE, '').trim()
  return rest || null
}

/**
 * A follow-up message's warning without "Send only after X accepts RQ-nn.",
 * which the card's two stages already show; null when nothing specific is left.
 */
export function messageCaveat(warning: string | null | undefined): string | null {
  const rest = (warning ?? '').replace(/^\s*Send only after [^.]*? accepts? (?:the connection request )?\(?RQ-\d+\)?\.\s*/i, '').trim()
  return rest || null
}

/**
 * Where to reach the person: a LinkedIn profile URL on the row if there is one,
 * otherwise a LinkedIn people search for "Name Company", built from targets
 * written "Name, Role, Company (domain)". Opens the LinkedIn app on a phone.
 */
export function profileLink(row: { target: string | null; note?: string | null; warning?: string | null }): { url: string; direct: boolean } | null {
  const text = [row.target, row.note, row.warning].filter(Boolean).join(' ')
  const direct = /https?:\/\/(?:[a-z]{2,3}\.)?(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9_%-]+\/?/.exec(text)
  if (direct) return { url: direct[0], direct: true }
  const parts = (row.target ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  if (!parts.length) return null
  const name = parts[0]
  const company = (parts.length > 2 ? parts[parts.length - 1] : '').replace(/\s*\(.*$/, '').trim()
  const keywords = [name, company].filter(Boolean).join(' ')
  return { url: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}`, direct: false }
}

export type ColumnKey = 'social' | 'comments' | 'outreach'

type Row = QueueRow & { blocked_at?: string | null; blocked_reason?: string | null }

/** One person in the outreach column: their request and the message behind it. */
export interface OutreachCard<T extends Row = Row> {
  key: string
  request: T | null
  message: T | null
  /**
   * request: send the request now; the message waits.
   * accept: the request is sent; waiting for them to accept.
   * message: the message is ready to send.
   */
  stage: 'request' | 'accept' | 'message'
  /** For a message waiting on someone with no request in the queue (OB-02). */
  waitingReason?: string | null
  /** Days since the request was sent, on accept cards. */
  days?: number
  /** Three weeks without an answer: ask once whether to keep waiting. */
  decide?: boolean
}

export interface Column<I> {
  key: ColumnKey
  label: string
  /** Everything due today in this column, in order. */
  due: I[]
  /** The first SHOWN_PER_COLUMN of `due`. */
  shown: I[]
  /** The rest of `due`, behind "N more". */
  more: I[]
  /** "2 for Brand on X, at today's cap of 2": one line per distinct cap, after "Held: ". */
  held: string[]
  /** "1 until the blog post 'x' is published": items waiting on a prerequisite. */
  waiting: string[]
  /** When nothing is due: why, so an empty column reads as finished rather than broken. */
  empty: string | null
}

export interface Layout<T extends Row = Row> {
  /** Never capped, never held, never in a column. */
  replies: T[]
  social: Column<T>
  comments: Column<T>
  outreach: Column<OutreachCard<T>> & {
    /** Requests sent and waiting to be accepted, each with its held message. */
    awaiting: OutreachCard<T>[]
  }
  /** Idle more than seven days: shown apart, to be re-run or dropped. */
  stale: TodayResult['stale']
}

const columnOf = (r: QueueRow): ColumnKey | 'reply' | null =>
  r.type === 'reply' ? 'reply' : r.type === 'social post' ? 'social' : r.type === 'comment' ? 'comments' : r.type === 'outbound message' ? 'outreach' : null

function split<I>(due: I[], limit: number) {
  return { shown: due.slice(0, limit), more: due.slice(limit) }
}

/** "2 for Brand on X, at today's cap of 2", one per distinct reason, in first-seen order. */
function heldLines(result: TodayResult, key: ColumnKey): string[] {
  const counts = new Map<string, number>()
  for (const h of result.holds) if (columnOf(h.row) === key) counts.set(h.reason, (counts.get(h.reason) ?? 0) + 1)
  return [...counts].map(([reason, n]) => `${n} ${reason}`)
}

function waitingLines(entries: TodayResult['blocked']): string[] {
  const counts = new Map<string, number>()
  for (const { waitingFor } of entries) {
    const w = waitingFor[0]
    const why = w.startsWith(BLOG_GATE)
      ? `until the blog post "${w.slice(BLOG_GATE.length)}" is published`
      : w.startsWith('date:')
        ? `scheduled for ${w.slice(5)}`
        : `until ${waitingFor.join(', ')} ${waitingFor.length === 1 ? 'is' : 'are'} done`
    counts.set(why, (counts.get(why) ?? 0) + 1)
  }
  return [...counts].map(([why, n]) => `${n} ${why}`)
}

function emptyNote(key: ColumnKey, held: string[], waiting: string[], doneToday: number): string {
  const noun = key === 'social' ? 'posts' : key === 'comments' ? 'comments' : 'outreach items'
  const one = key === 'social' ? 'post' : key === 'comments' ? 'comment' : 'outreach item'
  if (held.length) {
    const week = held.some((h) => h.includes("this week's cap"))
    const capped = key === 'comments' ? `You have done ${doneToday} of ${CAPS.commentsPerDay} comments today.` : `Today's cap is reached.`
    return `${capped} The next ones unlock ${week ? 'on Monday' : 'tomorrow'}.`
  }
  if (doneToday) return `You have done ${doneToday} ${doneToday === 1 ? one : noun} today.${waiting.length ? ' The rest are waiting, below.' : ''}`
  if (waiting.length) return 'Everything queued here is waiting on something, below.'
  return `No ${noun} queued.`
}

export function arrangeColumns<T extends Row>(rows: T[], result: TodayResult, now: Date, limit = SHOWN_PER_COLUMN): Layout<T> {
  const byId = new Map(rows.map((r) => [r.id, r]))
  const today = dayKey(now)
  const doneToday = (key: ColumnKey) =>
    rows.filter((r) => r.status === 'done' && r.completed_at && dayKey(new Date(r.completed_at)) === today && columnOf(r) === key).length

  const due = result.today as T[]
  const replies = due.filter((r) => r.type === 'reply')

  const plain = (key: 'social' | 'comments', label: string): Column<T> => {
    const items = due.filter((r) => columnOf(r) === key)
    const held = heldLines(result, key)
    const waiting = waitingLines(result.blocked.filter((b) => columnOf(b.row) === key))
    return { key, label, due: items, ...split(items, limit), held, waiting, empty: items.length ? null : emptyNote(key, held, waiting, doneToday(key)) }
  }

  // Outreach: pair each request with the message that waits on it.
  const followUp = (rq: QueueRow) => rows.find((r) => r.type === 'outbound message' && !isRequest(r) && (r.after_ids ?? []).includes(rq.id) && !['done', 'withdrawn', 'superseded'].includes(r.status)) ?? null
  const requestOf = (ob: QueueRow) => {
    const id = (ob.after_ids ?? []).find((a) => a.startsWith('RQ-'))
    return id ? (byId.get(id) ?? null) : null
  }
  const outDue: OutreachCard<T>[] = []
  for (const r of due) {
    if (columnOf(r) !== 'outreach') continue
    if (isRequest(r)) outDue.push({ key: r.id, request: r, message: followUp(r) as T | null, stage: 'request' })
    else outDue.push({ key: r.id, request: requestOf(r) as T | null, message: r, stage: 'message' })
  }

  const awaiting: OutreachCard<T>[] = awaitingAcceptance(rows, now).map((a) => ({
    key: a.request.id,
    request: a.request,
    message: a.messages[0] ?? null,
    stage: 'accept',
    days: a.days,
    decide: a.decide,
  }))
  const inAwaiting = new Set(awaiting.map((a) => a.message?.id))
  // A message waiting on someone with no request in the queue (sent outside it, OB-02).
  for (const r of rows) {
    if (r.type !== 'outbound message' || isRequest(r) || r.status !== 'blocked' || inAwaiting.has(r.id)) continue
    if ((r.after_ids ?? []).some((a) => a.startsWith('RQ-') && byId.get(a)?.status !== 'done')) continue
    awaiting.push({ key: r.id, request: null, message: r, stage: 'accept', waitingReason: r.blocked_reason ?? null })
  }

  const outHeld = heldLines(result, 'outreach')
  // A message waiting on its own request is shown on the request's card, not as waiting.
  const outWaiting = waitingLines(
    result.blocked.filter((b) => columnOf(b.row) === 'outreach' && !(b.waitingFor.length > 0 && b.waitingFor.every((w) => w.startsWith('RQ-')))),
  )

  return {
    replies,
    social: plain('social', 'Social posts'),
    comments: plain('comments', 'Comments'),
    outreach: {
      key: 'outreach',
      label: 'Outreach',
      due: outDue,
      ...split(outDue, limit),
      held: outHeld,
      waiting: outWaiting,
      empty: outDue.length ? null : emptyNote('outreach', outHeld, outWaiting, doneToday('outreach')),
      awaiting,
    },
    stale: result.stale,
  }
}
