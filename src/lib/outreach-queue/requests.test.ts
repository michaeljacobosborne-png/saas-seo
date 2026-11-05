import { describe, expect, it } from 'vitest'
import { awaitingAcceptance } from './requests'
import type { QueueRow } from './today'

const base = (over: Partial<QueueRow> & { id: string; blocked_at?: string | null }) => ({
  type: 'outbound message',
  account: 'Founder',
  platform: 'LinkedIn',
  status: 'pending',
  priority: 2,
  closes_on: null,
  due_date: null,
  after_ids: [] as string[],
  sort_order: null,
  created_at: '2026-11-02T08:00:00Z',
  completed_at: null,
  blocked_at: null,
  ...over,
})
const NOW = new Date('2026-11-03T09:00:00Z')

describe('awaitingAcceptance', () => {
  it('lists a sent request with its held follow-up, and nothing that is not sent yet', () => {
    const rows = [
      base({ id: 'RQ-15', status: 'done', completed_at: '2026-11-02T11:53:00Z' }),
      base({ id: 'OB-15', status: 'blocked', after_ids: ['RQ-15'], blocked_at: '2026-11-02T08:00:00Z' }),
      base({ id: 'RQ-16', status: 'pending' }),
      base({ id: 'OB-16', status: 'blocked', after_ids: ['RQ-16'] }),
    ]
    const out = awaitingAcceptance(rows, NOW)
    expect(out.map((a) => [a.request.id, a.messages.map((m) => m.id), a.days, a.decide])).toEqual([['RQ-15', ['OB-15'], 0, false]])
  })

  it('drops a request once its follow-up is released', () => {
    const rows = [
      base({ id: 'RQ-15', status: 'done', completed_at: '2026-11-02T11:53:00Z' }),
      base({ id: 'OB-15', status: 'pending', after_ids: ['RQ-15'] }),
    ]
    expect(awaitingAcceptance(rows, NOW)).toEqual([])
  })

  it('asks for a decision after three weeks, and again three weeks after "keep waiting"', () => {
    const sent = '2026-10-10T09:00:00Z'
    const asked = awaitingAcceptance([
      base({ id: 'RQ-01', status: 'done', completed_at: sent }),
      base({ id: 'OB-01', status: 'blocked', after_ids: ['RQ-01'], blocked_at: '2026-10-09T09:00:00Z' }),
    ], NOW)
    expect(asked[0]).toMatchObject({ days: 24, decide: true })
    const kept = awaitingAcceptance([
      base({ id: 'RQ-01', status: 'done', completed_at: sent }),
      base({ id: 'OB-01', status: 'blocked', after_ids: ['RQ-01'], blocked_at: '2026-11-01T09:00:00Z' }),
    ], NOW)
    expect(kept[0]).toMatchObject({ days: 24, decide: false })
  })

  it('ignores anything that is not a plain request', () => {
    const rows = [
      base({ id: 'OB-02', status: 'done', completed_at: '2026-11-01T09:00:00Z' }),
      base({ id: 'OB-30', status: 'blocked', after_ids: ['OB-02'] }),
    ]
    expect(awaitingAcceptance(rows, NOW)).toEqual([])
  })
})
