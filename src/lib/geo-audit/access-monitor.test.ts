import { describe, expect, it } from 'vitest'
import { accessChanges, accessState, confirmChanges, type AccessState } from './access-monitor'
import type { CrawlerAccessReport, CrawlerProbe } from './crawler-access'

// Rows as recorded for clickslice.co.uk on 2026-10-27 (Documents\byline-audits):
// OpenAI's and Perplexity's search crawlers served, Claude's refused by the site.
const UA = {
  'OAI-SearchBot': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot',
  'Claude-SearchBot': 'Mozilla/5.0 (compatible; Claude-SearchBot/1.0; +claudebot@anthropic.com)',
  PerplexityBot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot',
}
const served = (token: keyof typeof UA): CrawlerProbe => ({
  token, label: token, vendor: '', class: 'ai-search', docs: '', userAgent: UA[token],
  status: 200, contentServed: true, bytes: 818_094, bytesTruncated: true, blockKind: 'none',
  evidence: 'HTTP 200, at least 818,094 bytes served.', edgeVendor: null, robotsVerdict: 'allowed',
  divergence: null, attributable: true, confirmed: true, ms: 500,
})
const refused = (token: keyof typeof UA): CrawlerProbe => ({
  ...served(token), status: 403, contentServed: false, bytes: 0, bytesTruncated: false, blockKind: 'origin-block',
  evidence: 'HTTP 403 with no CDN fingerprint — refused by the application itself.', divergence: 'robots-allows-origin-blocks',
})
const report = (probes: CrawlerProbe[], baseline = { status: 200, contentServed: true }): CrawlerAccessReport => ({
  url: 'https://clickslice.co.uk/', checkedAt: '2026-10-27T05:21:55Z',
  baseline: { ...baseline, bytes: 818_094, ms: 566 }, probes, baselineFailed: !baseline.contentServed, caveats: [],
})
const ROBOTS = { state: 'present' as const, status: 200 }
const state = (probes: CrawlerProbe[], robots: AccessState['robots'] = ROBOTS, baseline?: { status: number; contentServed: boolean }) =>
  accessState(report(probes, baseline), robots)

const allServed = () => state([served('OAI-SearchBot'), served('Claude-SearchBot'), served('PerplexityBot')])
const claudeRefused = () => state([served('OAI-SearchBot'), refused('Claude-SearchBot'), served('PerplexityBot')])

describe('accessChanges', () => {
  it('flags a search crawler that was served and is now refused, with a command to check it', () => {
    const [c, ...rest] = accessChanges(allServed(), claudeRefused())
    expect(rest).toHaveLength(0)
    expect(c).toMatchObject({ kind: 'crawler-refused', token: 'Claude-SearchBot', good: false })
    expect(c.headline).toBe('Your server now refuses requests that identify as Claude-SearchBot (Claude-SearchBot).')
    expect(c.detail).toContain('robots.txt still allows this crawler')
    expect(c.reproduce).toContain(UA['Claude-SearchBot'])
    expect(`${c.headline} ${c.detail}`).not.toMatch(/[—–]/)
  })

  it('reports a recovery as good news', () => {
    const [c] = accessChanges(claudeRefused(), allServed())
    expect(c).toMatchObject({ kind: 'crawler-restored', token: 'Claude-SearchBot', good: true })
  })

  it('says nothing when nothing changed', () => {
    expect(accessChanges(claudeRefused(), claudeRefused())).toEqual([])
  })

  it('ignores rate limiting, network errors and server errors on a crawler', () => {
    for (const blockKind of ['rate-limited', 'network-error', 'server-error'] as const) {
      const flaky = { ...refused('Claude-SearchBot'), blockKind, status: blockKind === 'network-error' ? null : 503 }
      expect(accessChanges(allServed(), state([served('OAI-SearchBot'), flaky, served('PerplexityBot')]))).toEqual([])
    }
  })

  it('ignores training crawlers and rows that could not be attributed or confirmed', () => {
    const training = { ...refused('Claude-SearchBot'), class: 'training' as const }
    const unconfirmed = { ...refused('Claude-SearchBot'), confirmed: false }
    const unattributable = { ...refused('Claude-SearchBot'), attributable: false }
    for (const row of [training, unconfirmed, unattributable]) {
      expect(accessChanges(allServed(), state([served('OAI-SearchBot'), row, served('PerplexityBot')]))).toEqual([])
    }
  })

  it('says nothing about crawlers when the site is down for everyone', () => {
    const down = state([refused('OAI-SearchBot'), refused('Claude-SearchBot'), refused('PerplexityBot')], ROBOTS, { status: 503, contentServed: false })
    expect(accessChanges(allServed(), down)).toEqual([])
  })

  it('reports a page that now 404s once, instead of one alert per crawler', () => {
    const gone = state([], ROBOTS, { status: 404, contentServed: false })
    const out = accessChanges(allServed(), gone)
    expect(out.map((c) => c.kind)).toEqual(['page-gone'])
  })

  it('flags robots.txt newly disallowing a search crawler', () => {
    const disallowed = state([served('OAI-SearchBot'), { ...served('Claude-SearchBot'), robotsVerdict: 'disallowed' }, served('PerplexityBot')])
    expect(accessChanges(allServed(), disallowed).map((c) => c.key)).toEqual(['robots-disallowed:Claude-SearchBot'])
  })

  it('does not read a robots.txt timeout as a change', () => {
    const timedOut = state([served('OAI-SearchBot'), { ...served('Claude-SearchBot'), robotsVerdict: 'unknown' }, served('PerplexityBot')], { state: 'unknown', status: null })
    expect(accessChanges(allServed(), timedOut)).toEqual([])
  })

  it('flags robots.txt that starts returning a server error', () => {
    const broken = state([served('OAI-SearchBot'), served('Claude-SearchBot'), served('PerplexityBot')], { state: 'unknown', status: 500 })
    expect(accessChanges(allServed(), broken).map((c) => c.kind)).toEqual(['robots-unreadable'])
  })

  it('flags noindex appearing, when both runs read the page', () => {
    const a = accessState(report([served('OAI-SearchBot')]), ROBOTS, { noindex: false })
    const b = accessState(report([served('OAI-SearchBot')]), ROBOTS, { noindex: true })
    expect(accessChanges(a, b).map((c) => c.kind)).toEqual(['noindex-added'])
    // A probe-only check does not read the page, so it cannot say noindex went away.
    expect(accessChanges(b, allServed())).toEqual([])
  })
})

describe('confirmChanges', () => {
  it('keeps only what the second check also saw', () => {
    const first = accessChanges(allServed(), claudeRefused())
    expect(confirmChanges(first, accessChanges(allServed(), claudeRefused())).map((c) => c.kind)).toEqual(['crawler-refused'])
    expect(confirmChanges(first, accessChanges(allServed(), allServed()))).toEqual([])
  })
})
