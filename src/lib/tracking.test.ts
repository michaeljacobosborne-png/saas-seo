import { describe, expect, it } from 'vitest'
import { runDuePages, snapshotRow, type TrackedPage, type TrackingStore } from './tracking'
import type { RecordedAudit } from '@/lib/geo-audit/history'
import { decodeSnapshot } from '@/lib/geo-audit/snapshot'

const page = (id: string, interval = 30): TrackedPage => ({ id, user_id: 'u', url: `https://${id}.test/`, tool: 'geo', interval_days: interval })
const NOW = new Date('2026-11-01T03:00:00Z')

function memoryStore(due: TrackedPage[], saved = new Map<string, string>()) {
  const log: string[] = []
  const store: TrackingStore = {
    due: async () => due,
    previousRun: async (p) => (saved.has(p.id) ? { snapshot: saved.get(p.id)!, retrievable_score: 80, score_withheld: false } : null),
    saveRun: async (p) => {
      log.push(`save ${p.id}`)
      saved.set(p.id, `run-of-${p.id}-${log.length}`)
    },
    markRan: async (p, next) => void log.push(`ran ${p.id} next ${next.toISOString().slice(0, 10)}`),
    markFailed: async (p, e, next) => void log.push(`failed ${p.id} (${e}) retry ${next.toISOString().slice(0, 10)}`),
  }
  return { store, log }
}

const fakeRun = {
  report: { url: 'https://a.test/', finalUrl: 'https://a.test/', scoreWithheld: false, retrievability: { score: 80 }, citability: { band: 'adequate' } },
  snapshot: { version: 1, recordedAt: NOW.toISOString(), engineVersion: '2026.14', url: 'https://a.test/', tool: 'geo', exchanges: [], bodies: {} },
  contentHash: 'abc',
} as unknown as RecordedAudit

describe('runDuePages', () => {
  it('records each due page and schedules the next run one interval later', async () => {
    const { store, log } = memoryStore([page('a', 30), page('b', 7)])
    const s = await runDuePages(store, async () => fakeRun, { now: NOW, clock: () => 0 })
    expect(s.ran).toEqual(['a', 'b'])
    expect(log).toEqual(['save a', 'ran a next 2026-12-01', 'save b', 'ran b next 2026-11-08'])
  })

  it('retries a failed page the next day and carries on with the rest', async () => {
    const { store, log } = memoryStore([page('down'), page('ok')])
    const s = await runDuePages(store, async (p) => {
      if (p.id === 'down') throw new Error('That domain could not be resolved.')
      return fakeRun
    }, { now: NOW, clock: () => 0 })
    expect(s.failed).toEqual([{ id: 'down', error: 'That domain could not be resolved.' }])
    expect(s.ran).toEqual(['ok'])
    expect(log[0]).toBe('failed down (That domain could not be resolved.) retry 2026-11-02')
  })

  it('tells the notifier about the PREVIOUS run, never the one just saved, and skips first runs', async () => {
    const saved = new Map([['old', 'last-month']])
    const { store } = memoryStore([page('old'), page('new')], saved)
    const told: string[] = []
    await runDuePages(store, async () => fakeRun, {
      now: NOW,
      clock: () => 0,
      notify: async (p, prev) => void told.push(`${p.id}:${prev.snapshot}`),
    })
    expect(told).toEqual(['old:last-month'])
  })

  it('never lets a failed email fail the run', async () => {
    const { store, log } = memoryStore([page('a')], new Map([['a', 'prev']]))
    const s = await runDuePages(store, async () => fakeRun, {
      now: NOW,
      clock: () => 0,
      notify: async () => {
        throw new Error('Resend down')
      },
    })
    expect(s.ran).toEqual(['a'])
    expect(s.failed).toEqual([])
    expect(log).toContain('ran a next 2026-12-01')
  })

  it('never starts a run it has no time to finish, and leaves the rest for next time', async () => {
    const { store } = memoryStore([page('a'), page('b'), page('c')])
    let t = 0
    const s = await runDuePages(store, async () => {
      t += 20_000
      return fakeRun
    }, { now: NOW, clock: () => t, budgetMs: 45_000, perRunMs: 20_000 })
    expect(s.ran).toEqual(['a', 'b'])
    expect(s.deferred).toBe(1)
  })
})

describe('snapshotRow', () => {
  it('stores the scores for listing and the snapshot for re-scoring', () => {
    const row = snapshotRow({ id: 'p', user_id: 'u', tool: 'geo' }, fakeRun)
    expect(row).toMatchObject({ tracked_page_id: 'p', retrievable_score: 80, citable_band: 'adequate', engine_version: '2026.14', content_hash: 'abc' })
    expect(decodeSnapshot(row.snapshot).url).toBe('https://a.test/')
  })
})
