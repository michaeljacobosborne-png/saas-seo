import { describe, expect, it } from 'vitest'
import { arrangeColumns, messageCaveat, profileLink, requestCaveat, SHOWN_PER_COLUMN } from './columns'
import { selectToday, type QueueRow } from './today'

let seq = 0
const row = (over: Partial<QueueRow> & { id: string; blocked_at?: string | null; blocked_reason?: string | null }) => ({
  type: 'social post',
  account: 'Founder, Michael Jacobs',
  platform: 'X',
  status: 'pending',
  priority: 3,
  closes_on: null,
  due_date: null,
  after_ids: [] as string[],
  sort_order: null,
  created_at: new Date(Date.UTC(2026, 10, 5, 6) + seq++ * 1000).toISOString(),
  completed_at: null,
  blocked_at: null,
  blocked_reason: null,
  ...over,
})
// Thursday 5 November 2026, 14:00 in Israel.
const NOW = new Date('2026-11-05T12:00:00Z')
const layout = (rows: ReturnType<typeof row>[]) => arrangeColumns(rows, selectToday(rows, NOW), NOW)

describe('arrangeColumns', () => {
  it('never lets a busy comment day bury the social posts (5 Nov: F-X15, F-L14, B-X11, B-F8 sat behind "See all")', () => {
    const rows = [
      ...['CM-11', 'CM-12', 'CM-13', 'CM-14'].map((id) => row({ id, type: 'comment', closes_on: '2026-11-06' })),
      row({ id: 'OB-05', type: 'outbound message' }),
      row({ id: 'F-X15' }),
      row({ id: 'F-L14', platform: 'LinkedIn' }),
      row({ id: 'B-X11', account: 'Brand, Byline' }),
      row({ id: 'B-F8', account: 'Brand, Byline', platform: 'Facebook' }),
    ]
    const l = layout(rows)
    expect(l.social.due.map((r) => r.id)).toEqual(['F-X15', 'F-L14', 'B-X11', 'B-F8'])
    expect(l.social.shown).toHaveLength(SHOWN_PER_COLUMN)
    expect(l.social.more.map((r) => r.id)).toEqual(['B-F8'])
    expect(l.comments.shown).toHaveLength(3)
    expect(l.comments.more).toHaveLength(1)
    expect(l.outreach.shown.map((c) => c.key)).toEqual(['OB-05'])
  })

  it('keeps the column sort: closing window first, then priority', () => {
    const l = layout([
      row({ id: 'CM-20', type: 'comment', priority: 1 }),
      row({ id: 'CM-21', type: 'comment', priority: 3, closes_on: '2026-11-06' }),
    ])
    expect(l.comments.due.map((r) => r.id)).toEqual(['CM-21', 'CM-20'])
  })

  it('puts replies above the columns and never inside one', () => {
    const l = layout([row({ id: 'RE-04', type: 'reply' }), row({ id: 'CM-30', type: 'comment' })])
    expect(l.replies.map((r) => r.id)).toEqual(['RE-04'])
    expect(l.comments.due.map((r) => r.id)).toEqual(['CM-30'])
  })

  it('shows a request and its message as one card, and the message nowhere else', () => {
    const l = layout([
      row({ id: 'RQ-27', type: 'outbound message' }),
      row({ id: 'OB-27', type: 'outbound message', status: 'blocked', after_ids: ['RQ-27'], blocked_reason: 'Waiting for Joey Balazs to accept the connection request (RQ-27).' }),
    ])
    expect(l.outreach.due).toEqual([expect.objectContaining({ key: 'RQ-27', stage: 'request', message: expect.objectContaining({ id: 'OB-27' }) })])
    expect(l.outreach.awaiting).toEqual([])
    expect(l.outreach.waiting).toEqual([])
  })

  it('moves the card to "waiting to accept" once the request is sent, with the message still attached', () => {
    const l = layout([
      row({ id: 'RQ-15', type: 'outbound message', status: 'done', completed_at: '2026-11-02T11:53:00Z' }),
      row({ id: 'OB-15', type: 'outbound message', status: 'blocked', after_ids: ['RQ-15'], blocked_at: '2026-11-02T08:00:00Z' }),
    ])
    expect(l.outreach.due).toEqual([])
    expect(l.outreach.awaiting).toEqual([expect.objectContaining({ key: 'RQ-15', stage: 'accept', days: 3, decide: false, message: expect.objectContaining({ id: 'OB-15' }) })])
  })

  it('shows a released message live, with the sent request beside it', () => {
    const l = layout([
      row({ id: 'RQ-05', type: 'outbound message', status: 'done', completed_at: '2026-11-02T08:00:00Z' }),
      row({ id: 'OB-05', type: 'outbound message', after_ids: ['RQ-05'] }),
    ])
    expect(l.outreach.due).toEqual([expect.objectContaining({ key: 'OB-05', stage: 'message', request: expect.objectContaining({ id: 'RQ-05' }) })])
  })

  it('keeps a message waiting on someone with no request in the queue (OB-02) as one waiting card with its reason', () => {
    const l = layout([row({ id: 'OB-02', type: 'outbound message', status: 'blocked', blocked_reason: 'Connection request sent to Joshua George.' })])
    expect(l.outreach.awaiting).toEqual([expect.objectContaining({ key: 'OB-02', request: null, waitingReason: 'Connection request sent to Joshua George.' })])
  })

  it('names the cap that holds an item, once per distinct cap', () => {
    const l = layout([...['B-X1', 'B-X2', 'B-X3', 'B-X4'].map((id) => row({ id, account: 'Brand, Byline' }))])
    expect(l.social.due).toHaveLength(2)
    expect(l.social.held).toEqual(["2 for Brand on X, at today's cap of 2"])
  })

  it('says why a column is empty, so it reads as finished', () => {
    const doneComments = ['CM-1', 'CM-2', 'CM-3', 'CM-4'].map((id) => row({ id, type: 'comment', status: 'done', completed_at: '2026-11-05T08:00:00Z' }))
    const capped = layout([...doneComments, row({ id: 'CM-5', type: 'comment' })])
    expect(capped.comments.due).toEqual([])
    expect(capped.comments.empty).toBe('You have done 4 of 4 comments today. The next ones unlock tomorrow.')
    expect(capped.comments.held).toEqual(["1 over today's cap of 4"])
    expect(layout([]).social.empty).toBe('No posts queued.')
    expect(layout([row({ id: 'F-X1', status: 'done', completed_at: '2026-11-05T08:00:00Z' })]).social.empty).toBe('You have done 1 post today.')
  })

  it('lists posts waiting on a blog article at the foot of their column', () => {
    const l = layout([row({ id: 'F-L13', platform: 'LinkedIn', after_ids: ['blog:ai-search-cited'] }), row({ id: 'B-X10', account: 'Brand, Byline', after_ids: ['blog:ai-search-cited'] })])
    expect(l.social.waiting).toEqual(['2 until the blog post "ai-search-cited" is published'])
    expect(l.social.empty).toBe('Everything queued here is waiting on something, below.')
  })

  it('passes stale items through to be shown apart', () => {
    const l = layout([row({ id: 'OB-19', type: 'outbound message', created_at: '2026-10-20T08:00:00Z' })])
    expect(l.stale.map((s) => s.row.id)).toEqual(['OB-19'])
    expect(l.outreach.due).toEqual([])
  })
})

describe('requestCaveat', () => {
  it('drops the shared no-note rule in both wordings the queue uses, keeping anything specific', () => {
    expect(requestCaveat('No note. The free account has used its custom notes for the month.')).toBeNull()
    expect(requestCaveat('No note. The free account has used its custom notes for the month, and the finding goes in the message after he accepts.')).toBeNull()
    expect(requestCaveat('No note. The free account has used its custom notes for the month. Confirm Dana is still at Kanopy first.')).toBe('Confirm Dana is still at Kanopy first.')
    expect(requestCaveat('Check he is still at the company.')).toBe('Check he is still at the company.')
    expect(requestCaveat(null)).toBeNull()
  })
})

describe('profileLink', () => {
  it('uses a LinkedIn profile URL on the row when there is one', () => {
    expect(profileLink({ target: 'Ross Tavendale, Managing Director, Type A Media (typeamedia.net)', note: 'Profile: https://www.linkedin.com/in/rosstavendale/' })).toEqual({ url: 'https://www.linkedin.com/in/rosstavendale/', direct: true })
    expect(profileLink({ target: 'Aia Laser', note: 'Profile: https://il.linkedin.com/in/aialaser' })).toEqual({ url: 'https://il.linkedin.com/in/aialaser', direct: true })
  })

  it('otherwise searches LinkedIn for the name and company from the target', () => {
    expect(profileLink({ target: 'Nate Turner, Co-Founder and CEO, Ten Speed (tenspeed.io)' })).toEqual({
      url: 'https://www.linkedin.com/search/results/people/?keywords=Nate%20Turner%20Ten%20Speed',
      direct: false,
    })
    expect(profileLink({ target: 'Ihsan Haider' })?.url).toBe('https://www.linkedin.com/search/results/people/?keywords=Ihsan%20Haider')
    expect(profileLink({ target: null })).toBeNull()
  })
})

describe('messageCaveat', () => {
  it('drops "Send only after X accepts RQ-nn", which the card already shows, keeping the rest', () => {
    expect(messageCaveat('Send only after James Brockbank accepts RQ-12.')).toBeNull()
    expect(messageCaveat('Send only after Peter Van Zelst accepts RQ-13. This is our request being refused, not a crawler block.')).toBe('This is our request being refused, not a crawler block.')
    expect(messageCaveat('Re-run before sending.')).toBe('Re-run before sending.')
  })
})
