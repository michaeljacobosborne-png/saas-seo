import { readFileSync, existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseQueue, xLength } from './parse'
import { dayKey, selectToday, weekKey, type QueueRow } from './today'

const SAMPLE = [
  '# Byline action queue',
  '## Format contract',
  '- type: not an item',
  '## OB-01',
  '- type: outbound message',
  '- account: Founder, Michael Jacobs',
  '- platform: LinkedIn',
  '- target: Dan Taylor',
  '- chars: n/a',
  '- warning: none',
  '- note: A note.',
  '- rests-on: none',
  '- engine: 2026.12',
  '- status: pending',
  '### text',
  '```text',
  'Line one',
  '',
  'Line three',
  '```',
  '### text, connection note version',
  '```text',
  'Short version',
  '```',
  '## F-X4',
  '- type: social post',
  '- account: Founder, Michael Jacobs',
  '- platform: X',
  '- target: none',
  '- chars: 146 and 213',
  '- warning: Check the link.',
  '- note: none',
  '- rests-on: none',
  '- engine: n/a',
  '- status: pending',
  '### text 1/2 (146 chars)',
  '```text',
  'Part one',
  '```',
  '### text 2/2 (213 chars)',
  '```text',
  'Part two https://example.com/a/very/long/link/that/is/counted/as/twenty/three',
  '```',
].join('\n')

describe('parseQueue', () => {
  const items = parseQueue(SAMPLE)

  it('skips the preamble sections and reads every item', () => {
    expect(items.map((i) => i.id)).toEqual(['OB-01', 'F-X4'])
  })

  it('keeps the exact text inside each fence, blank lines included', () => {
    expect(items[0].parts[0].text).toBe('Line one\n\nLine three')
    expect(items[0].parts[1].alt).toBe('connection note version')
  })

  it('reads thread parts and stated counts', () => {
    expect(items[1].parts.map((p) => p.part)).toEqual(['1/2', '2/2'])
    expect(items[1].parts[1].statedChars).toBe(213)
  })

  it('turns "none" into null', () => {
    expect(items[0].warning).toBeNull()
    expect(items[1].target).toBeNull()
    expect(items[1].warning).toBe('Check the link.')
  })
})

describe('xLength', () => {
  it('counts any link as 23 characters', () => {
    expect(xLength('see https://bylineseo.com/geo-analyzer now')).toBe(4 + 23 + 4)
  })
})

// created_at increases with each row made, so ties break in the order written.
let seq = 0
const row = (over: Partial<QueueRow> & { id: string }): QueueRow => ({
  type: 'social post',
  account: 'Founder',
  platform: 'X',
  status: 'pending',
  priority: 3,
  closes_on: null,
  due_date: null,
  after_ids: [],
  sort_order: null,
  created_at: new Date(Date.UTC(2026, 9, 20) + seq++ * 1000).toISOString(),
  completed_at: null,
  ...over,
})

// Wednesday 21 October 2026, 10:00 in Israel.
const NOW = new Date('2026-10-21T07:00:00Z')

describe('selectToday', () => {
  it('puts a closing window first, whatever its priority', () => {
    const r = selectToday([row({ id: 'A', priority: 1 }), row({ id: 'CM-06', type: 'comment', priority: 5, closes_on: '2026-10-28' })], NOW)
    expect(r.today[0].id).toBe('CM-06')
  })

  it('shows at most 4 comments a day, counting ones already done today', () => {
    const rows = [
      row({ id: 'done1', type: 'comment', status: 'done', completed_at: '2026-10-21T06:00:00Z' }),
      ...['c1', 'c2', 'c3', 'c4'].map((id) => row({ id, type: 'comment' })),
    ]
    const r = selectToday(rows, NOW)
    expect(r.today.filter((x) => x.type === 'comment')).toHaveLength(3)
  })

  it('shows at most 1 social post per account per day', () => {
    const r = selectToday([row({ id: 'p1' }), row({ id: 'p2' }), row({ id: 'b1', account: 'Brand' })], NOW)
    expect(r.today.map((x) => x.id).sort()).toEqual(['b1', 'p1'])
    expect(r.held.map((x) => x.id)).toEqual(['p2'])
  })

  it('treats the same person on another platform as another account', () => {
    const r = selectToday([row({ id: 'x1' }), row({ id: 'li1', platform: 'LinkedIn' })], NOW)
    expect(r.today).toHaveLength(2)
  })

  it('stops a third social post for an account in the same week', () => {
    const rows = [
      row({ id: 'mon', status: 'done', completed_at: '2026-10-19T08:00:00Z' }),
      row({ id: 'tue', status: 'done', completed_at: '2026-10-20T08:00:00Z' }),
      row({ id: 'next' }),
    ]
    expect(selectToday(rows, NOW).today).toHaveLength(0)
  })

  it('hides a sequenced item until its prerequisite is done', () => {
    const r = selectToday([row({ id: 'F-X9', after_ids: ['F-X5'] }), row({ id: 'F-X5', account: 'X' })], NOW)
    expect(r.today.map((x) => x.id)).toEqual(['F-X5'])
    expect(r.blocked[0]).toMatchObject({ row: { id: 'F-X9' }, waitingFor: ['F-X5'] })
  })

  it('shows at most 3 outbound messages a day', () => {
    const rows = ['o1', 'o2', 'o3', 'o4'].map((id) => row({ id, type: 'outbound message' }))
    expect(selectToday(rows, NOW).today).toHaveLength(3)
  })

  it('never shows more than 5', () => {
    const rows = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id, i) => row({ id, account: String(i) }))
    expect(selectToday(rows, NOW).today).toHaveLength(5)
  })

  it('puts replies first, above a closing window and a higher priority', () => {
    const r = selectToday([
      row({ id: 'CM-06', type: 'comment', priority: 1, closes_on: '2026-10-22' }),
      row({ id: 'RE-01', type: 'reply', priority: 5 }),
    ], NOW)
    expect(r.today.map((x) => x.id)).toEqual(['RE-01', 'CM-06'])
  })

  it('never holds a reply, and replies do not take one of the 5 slots', () => {
    const rows = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) => row({ id, account: String(i) }))
    rows.push(row({ id: 'x', type: 'reply' }), row({ id: 'y', type: 'reply' }))
    const r = selectToday(rows, NOW)
    expect(r.today.filter((t) => t.type === 'reply').map((t) => t.id)).toEqual(['x', 'y'])
    expect(r.today.filter((t) => t.type !== 'reply')).toHaveLength(5)
  })

  it('never gives a slot to an item waiting on someone else, and fills it with one he can do', () => {
    const r = selectToday([
      row({ id: 'OB-02', type: 'outbound message', status: 'blocked', priority: 1 }),
      row({ id: 'CM-08', type: 'comment', priority: 3 }),
    ], NOW)
    expect(r.today.map((x) => x.id)).toEqual(['CM-08'])
    expect(r.stale).toHaveLength(0)
  })

  it('holds a post about a blog article until the article is published', () => {
    const rows = [row({ id: 'F-L11', after_ids: ['blog:which-ai-crawlers-your-site-actually-serves'] })]
    expect(selectToday(rows, NOW).blocked[0].waitingFor).toEqual(['blog:which-ai-crawlers-your-site-actually-serves'])
    const live = selectToday(rows, NOW, { published: new Map([['which-ai-crawlers-your-site-actually-serves', '2026-10-21T09:00:00Z']]) })
    expect(live.today.map((x) => x.id)).toEqual(['F-L11'])
  })

  it('does not let a post go stale while its article waits to be published, and counts publishing as activity', () => {
    const rows = [row({ id: 'F-L11', created_at: '2026-10-01T06:00:00Z', after_ids: ['blog:slug'] })]
    expect(selectToday(rows, NOW).stale).toHaveLength(0)
    const live = selectToday(rows, NOW, { published: new Map([['slug', '2026-10-20T09:00:00Z']]) })
    expect(live.today.map((x) => x.id)).toEqual(['F-L11'])
  })

  it('holds an item with a future due date until that day', () => {
    const rows = [row({ id: 'OB-03', type: 'outbound message', due_date: '2026-11-02' })]
    expect(selectToday(rows, NOW).blocked[0].waitingFor).toEqual(['date:2026-11-02'])
    expect(selectToday(rows, new Date('2026-11-02T07:00:00Z')).today.map((x) => x.id)).toEqual(['OB-03'])
  })

  it('ignores items that are not pending', () => {
    const r = selectToday([row({ id: 'gone', status: 'withdrawn' }), row({ id: 'old', status: 'superseded' })], NOW)
    expect(r.today).toHaveLength(0)
  })

  it('drops an item idle for more than 7 days off today and marks it stale', () => {
    const r = selectToday([
      row({ id: 'old', created_at: '2026-10-13T06:00:00Z' }),
      row({ id: 'fresh', account: 'Brand', created_at: '2026-10-15T06:00:00Z' }),
    ], NOW)
    expect(r.today.map((x) => x.id)).toEqual(['fresh'])
    expect(r.stale).toMatchObject([{ row: { id: 'old' }, idleDays: 8 }])
  })

  it('counts an update as activity, so a touched item stays live', () => {
    const r = selectToday([row({ id: 'kept', created_at: '2026-10-01T06:00:00Z', updated_at: '2026-10-20T06:00:00Z' })], NOW)
    expect(r.today.map((x) => x.id)).toEqual(['kept'])
    expect(r.stale).toHaveLength(0)
  })

  it('marks a stale item stale even when it is also waiting on a prerequisite', () => {
    const r = selectToday([row({ id: 'seq', after_ids: ['X'], created_at: '2026-10-01T06:00:00Z' })], NOW)
    expect(r.blocked).toHaveLength(0)
    expect(r.stale.map((s) => s.row.id)).toEqual(['seq'])
  })

  it('uses Israel time and Monday weeks', () => {
    expect(dayKey(new Date('2026-10-20T22:30:00Z'))).toBe('2026-10-21')
    expect(weekKey(NOW)).toBe('2026-10-19')
  })
})

describe('the real queue file parses as expected', () => {
  const path = 'C:/Users/ozzy5/Documents/byline-queue.md'
  it.skipIf(!existsSync(path))('has no retracted or withdrawn items in it', () => {
    const items = parseQueue(readFileSync(path, 'utf8'))
    const ids = items.map((i) => i.id)
    expect(ids).not.toContain('F-L8')
    expect(ids).not.toContain('F-X10')
    expect(ids).not.toContain('CM-05')
    expect(items.every((i) => i.parts.length > 0)).toBe(true)
  })
})
