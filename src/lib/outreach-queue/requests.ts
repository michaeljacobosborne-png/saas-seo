/**
 * Connection requests that have been sent and are waiting to be accepted.
 *
 * A request (RQ-) is marked done when Michael sends it. Its follow-up message
 * (OB-) waits as blocked, with the request in after_ids, until he says the
 * person accepted. This lists those pairs so the page can show one "they
 * accepted" button per request, and asks once, after three weeks without an
 * answer, whether to keep waiting or give up.
 */
import { isRequest, type QueueRow } from './today'

export const DECIDE_AFTER_DAYS = 21
const DAY = 86_400_000

type Row = QueueRow & { blocked_at?: string | null }

export interface AwaitingRequest<T extends Row = Row> {
  request: T
  /** The held follow-ups this request releases. */
  messages: T[]
  /** Whole days since the request was sent. */
  days: number
  /** Three weeks without an answer since it was sent, or since he last chose to keep waiting. */
  decide: boolean
}

export function awaitingAcceptance<T extends Row>(rows: T[], now: Date): AwaitingRequest<T>[] {
  const out: AwaitingRequest<T>[] = []
  for (const request of rows) {
    if (!isRequest(request) || request.status !== 'done' || !request.completed_at) continue
    const messages = rows.filter((r) => r.status === 'blocked' && (r.after_ids ?? []).includes(request.id))
    if (!messages.length) continue
    const sent = Date.parse(request.completed_at)
    // "Keep waiting" moves blocked_at forward, which restarts the three weeks.
    const since = Math.max(sent, ...messages.map((m) => (m.blocked_at ? Date.parse(m.blocked_at) : 0)))
    out.push({
      request,
      messages,
      days: Math.max(0, Math.floor((now.getTime() - sent) / DAY)),
      decide: now.getTime() - since >= DECIDE_AFTER_DAYS * DAY,
    })
  }
  // Decisions first, then the longest waiting.
  return out.sort((a, b) => Number(b.decide) - Number(a.decide) || b.days - a.days || a.request.id.localeCompare(b.request.id))
}
