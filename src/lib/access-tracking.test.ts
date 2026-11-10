import { describe, expect, it } from 'vitest'
import { buildAccessEmail, processCheck, runAccessChecks, type AccessStore, type MonitoredPage } from './access-tracking'
import type { AccessState, CrawlerObservation } from './geo-audit/access-monitor'

const row = (token: string, served: boolean): CrawlerObservation => ({
  token,
  label: token,
  userAgent: `Mozilla/5.0 (compatible; ${token}/1.0)`,
  served,
  blockKind: served ? 'none' : 'origin-block',
  status: served ? 200 : 403,
  robots: 'allowed',
  evidence: served ? 'HTTP 200.' : 'HTTP 403 with no CDN fingerprint.',
  edgeVendor: null,
})
const state = (claude: boolean, at = '2026-11-01T03:00:00Z', baselineServed = true): AccessState => ({
  checkedAt: at,
  url: 'https://www.example.co.uk/',
  baseline: { status: baselineServed ? 200 : 503, served: baselineServed },
  robots: { state: 'present', status: 200 },
  crawlers: [row('OAI-SearchBot', true), row('Claude-SearchBot', claude)],
  noindex: false,
})

describe('processCheck', () => {
  it('takes the first check as the starting point', () => {
    expect(processCheck(null, null, state(true))).toMatchObject({ pending: null, confirmed: [] })
  })

  it('holds a change seen once, keeping the old observation so the next check compares like with like', () => {
    const out = processCheck(state(true), null, state(false))
    expect(out.confirmed).toEqual([])
    expect(out.pending?.map((c) => c.key)).toEqual(['crawler-refused:Claude-SearchBot:origin-block'])
    expect(out.state.crawlers.find((c) => c.token === 'Claude-SearchBot')?.served).toBe(true)
  })

  it('confirms it when the next check sees the same, and moves the state on', () => {
    const first = processCheck(state(true), null, state(false))
    const second = processCheck(first.state, first.pending, state(false, '2026-11-02T03:00:00Z'))
    expect(second.confirmed.map((c) => c.kind)).toEqual(['crawler-refused'])
    expect(second.pending).toBeNull()
    expect(second.state.crawlers.find((c) => c.token === 'Claude-SearchBot')?.served).toBe(false)
  })

  it('drops a one-off: the next check is back to normal, so nothing is sent', () => {
    const first = processCheck(state(true), null, state(false))
    const second = processCheck(first.state, first.pending, state(true, '2026-11-02T03:00:00Z'))
    expect(second).toMatchObject({ pending: null, confirmed: [] })
  })

  it('changes nothing on a day the site is down for everyone', () => {
    const first = processCheck(state(true), null, state(false))
    const down = processCheck(first.state, first.pending, state(false, '2026-11-02T03:00:00Z', false))
    expect(down.state).toEqual(first.state)
    expect(down.pending).toEqual(first.pending)
    expect(down.confirmed).toEqual([])
  })

  it('keeps noindex from the last full run when a probe-only check cannot see it', () => {
    const probeOnly = { ...state(true), noindex: undefined }
    expect(processCheck({ ...state(true), noindex: true }, null, probeOnly).state.noindex).toBe(true)
  })
})

describe('runAccessChecks', () => {
  it('stores each outcome, notifies only on confirmed changes, and never lets one failure stop the rest', async () => {
    const first = processCheck(state(true), null, state(false))
    const pages: MonitoredPage[] = [
      { id: 'a', user_id: 'u', url: 'https://a.test/', access_state: first.state, access_pending: first.pending },
      { id: 'b', user_id: 'u', url: 'https://b.test/', access_state: state(true), access_pending: null },
      { id: 'c', user_id: 'u', url: 'https://c.test/', access_state: null, access_pending: null },
    ]
    const saved: string[] = []
    const store: AccessStore = { due: async () => pages, save: async (p) => void saved.push(p.id) }
    const told: string[] = []
    const summary = await runAccessChecks(
      store,
      async (url) => {
        if (url.startsWith('https://c')) throw new Error('timeout')
        return state(false, '2026-11-02T03:00:00Z')
      },
      { notify: async (p) => void told.push(p.id) },
    )
    expect(saved.sort()).toEqual(['a', 'b'])
    expect(told).toEqual(['a'])
    expect(summary).toMatchObject({ checked: 2, pending: 1, alerts: 1, failed: [{ id: 'c', error: 'timeout' }] })
  })
})

describe('buildAccessEmail', () => {
  it('leads with the change, gives the command to check it, and makes no claim about AI systems reading the page', () => {
    const first = processCheck(state(true), null, state(false))
    const { confirmed } = processCheck(first.state, first.pending, state(false))
    const { subject, text } = buildAccessEmail('p1', 'https://www.example.co.uk/', confirmed)
    expect(subject).toBe('Byline: crawler access changed on www.example.co.uk')
    expect(text).toContain('Your server now refuses requests that identify as Claude-SearchBot')
    expect(text).toContain('curl ')
    expect(text).toContain('not proof of what any AI system can or cannot read')
    expect(text).not.toMatch(/[—–]|AI visibility/)
  })
})
