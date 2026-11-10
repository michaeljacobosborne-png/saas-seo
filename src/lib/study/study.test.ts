import { describe, expect, it } from 'vitest'
import { classifyFailure, refineDnsFailure } from './audit-site'
import { deriveAccess } from './derive'
import { domainBudgetOk, resolveSite, type AttemptEvent, type Pacing } from './ledger'
import { evenSample, parseCsv, splitDuplicates, type LoadedPopulation, type Site } from './populations'
import { buildResults, summarise } from './report'
import type { CrawlerProbe } from '@/lib/geo-audit/crawler-access'

const probe = (o: Partial<CrawlerProbe>): CrawlerProbe => ({
  token: 'GPTBot', label: 'GPTBot', vendor: 'OpenAI', class: 'training', docs: '', userAgent: '',
  status: 200, contentServed: true, bytes: 1000, bytesTruncated: false, blockKind: 'none', evidence: '',
  edgeVendor: null, robotsVerdict: 'allowed', divergence: null, attributable: true, confirmed: true, ms: 10, ...o,
})
const report = (probes: CrawlerProbe[], baseline: { status: number | null; contentServed: boolean }) =>
  ({
    crawlerProbe: { url: 'https://x.com/', checkedAt: '', baseline: { ...baseline, bytes: 0, ms: 1 }, probes, baselineFailed: !baseline.contentServed, caveats: [] },
    access: { robots: { state: 'present', status: 200 } },
  }) as never

describe('deriveAccess', () => {
  it('counts a 200 that is a JavaScript challenge, and says so when the browser was served', () => {
    const a = deriveAccess(report([
      probe({ token: 'GPTBot', status: 200, contentServed: false, blockKind: 'bot-management', evidence: 'HTTP 200 but the body is a JavaScript challenge (a form the page fills in)' }),
      probe({ token: 'CCBot' }),
    ], { status: 200, contentServed: true }))
    expect(a.headline.challenge200Count).toBe(1)
    expect(a.probes[0]).toMatchObject({ challenge200: true, challengeKind: 'js-form' })
    expect(a.baselineRefused).toBe(false)
  })

  it('does not count an ordinary 403 as a challenge', () => {
    const a = deriveAccess(report([probe({ status: 403, contentServed: false, blockKind: 'edge-block' })], { status: 200, contentServed: true }))
    expect(a.headline.challenge200Count).toBe(0)
  })

  it('reports robots-permits-origin-refuses and per-vendor asymmetry from attributable rows', () => {
    const a = deriveAccess(report([
      probe({ token: 'GPTBot', vendor: 'OpenAI', status: 403, contentServed: false, blockKind: 'edge-block', divergence: 'robots-allows-origin-blocks' }),
      probe({ token: 'ClaudeBot', vendor: 'Anthropic' }),
    ], { status: 200, contentServed: true }))
    expect(a.headline.robotsPermitsOriginRefusesTokens).toEqual(['GPTBot'])
    expect(a.headline).toMatchObject({ vendorsServed: ['Anthropic'], vendorsRefused: ['OpenAI'], vendorAsymmetry: true })
  })

  it('when the browser baseline is refused, nothing is attributable and no asymmetry is claimed', () => {
    const a = deriveAccess(report([
      probe({ token: 'GPTBot', attributable: false, status: 403, contentServed: false, blockKind: 'edge-block' }),
      probe({ token: 'ClaudeBot', attributable: false }),
    ], { status: 403, contentServed: false }))
    expect(a.baselineRefused).toBe(true)
    expect(a.headline.nothingAttributable).toBe(true)
    expect(a.headline.vendorAsymmetry).toBe(false)
    expect(a.headline.robotsPermitsOriginRefusesCount).toBe(0)
  })

  it('flags a baseline that got a 200 and no content', () => {
    const a = deriveAccess(report([probe({ attributable: false })], { status: 200, contentServed: false }))
    expect(a).toMatchObject({ baselineRefused: true, baseline200NoContent: true })
  })
})

describe('classifyFailure', () => {
  it('names the three disqualifying kinds and keeps the rest distinct', () => {
    expect(classifyFailure(null, 'That domain could not be resolved. Check the spelling.').kind).toBe('dns')
    expect(classifyFailure(404, 'That page was not found (HTTP 404).').kind).toBe('http-404')
    expect(classifyFailure(503, 'The site returned a server error to our request (HTTP 503).').kind).toBe('http-5xx')
    expect(classifyFailure(null, 'The site did not respond in time.').kind).toBe('timeout')
    expect(classifyFailure(null, 'That site has an SSL certificate problem, which also blocks crawlers.').kind).toBe('tls')
  })
})

describe('refineDnsFailure', () => {
  const dns = classifyFailure(null, 'That domain could not be resolved. Check the spelling.')
  it('keeps "dns" only when an independent lookup agrees there is no such domain', async () => {
    const r = await refineDnsFailure(dns, 'https://gone.example/', async () => { throw Object.assign(new Error('x'), { code: 'ENOTFOUND' }) })
    expect(r.kind).toBe('dns')
    expect(r.message).toContain('ENOTFOUND')
  })
  it('calls it transient when the name resolves, or the lookup itself fails', async () => {
    expect((await refineDnsFailure(dns, 'https://up.example/', async () => [{ address: '1.1.1.1' }])).kind).toBe('dns-transient')
    expect((await refineDnsFailure(dns, 'https://x.example/', async () => { throw Object.assign(new Error('x'), { code: 'EAI_AGAIN' }) })).kind).toBe('dns-transient')
  })
  it('leaves other failures alone', async () => {
    const f = classifyFailure(404, 'That page was not found (HTTP 404).')
    expect(await refineDnsFailure(f, 'https://x.example/')).toEqual(f)
  })
})

const pacing: Pacing = { siteGapSeconds: 30, jitter: 0, perDomainMax: 6, perDomainWindowMs: 600_000, retryMinGapHours: 6, maxAttempts: 3, minSpanHours: 12, siteTimeoutMs: 1000 }
const H = 3_600_000
const t0 = Date.parse('2026-11-10T00:00:00Z')
const attempt = (n: number, hoursIn: number, o: Partial<AttemptEvent> = {}): AttemptEvent => ({
  type: 'attempt', key: 'A:x.com', population: 'A', rank: 1, name: 'X', domain: 'x.com', url: 'https://x.com/', attempt: n,
  at: new Date(t0 + hoursIn * H).toISOString(), durationMs: 1, engineVersion: '2026.15',
  vantage: { mode: 'remote', platformRegion: 'iad1', requestId: null, egressIp: '1.1.1.1', egressCountry: 'US', egressRegion: 'VA', egressOrg: 'AS16509', lookedUpAt: '', lookupError: null },
  outcome: 'failed', failure: { kind: 'dns', httpStatus: null, message: 'x' }, ...o,
})

describe('resolveSite', () => {
  const now = (h: number) => new Date(t0 + h * H)
  it('is pending with no attempts', () => expect(resolveSite([], pacing, now(0)).status).toBe('pending'))

  it('is done once audited, and a second audited attempt is never counted', () => {
    const s = resolveSite([attempt(1, 0, { outcome: 'audited' }), attempt(2, 1, { outcome: 'audited' })], pacing, now(2))
    expect(s.status).toBe('audited')
    expect(s.status === 'audited' && s.attempt.attempt).toBe(1)
  })

  it('does not drop after one failure, and waits out the retry gap', () => {
    expect(resolveSite([attempt(1, 0)], pacing, now(1))).toMatchObject({ status: 'retry-wait' })
    expect(resolveSite([attempt(1, 0)], pacing, now(7))).toMatchObject({ status: 'retry-due' })
  })

  it('drops only after three attempts spanning the window, for a reason the rule names', () => {
    const three = [attempt(1, 0), attempt(2, 6), attempt(3, 12)]
    expect(resolveSite(three, pacing, now(13))).toMatchObject({ status: 'dropped', reason: 'dns' })
    expect(resolveSite([attempt(1, 0), attempt(2, 1), attempt(3, 2)], pacing, now(3))).toMatchObject({ status: 'retry-wait' })
  })

  it('never drops for a reason the rule does not name: it is unresolved and surfaced', () => {
    const timeouts = [0, 6, 12].map((h, i) => attempt(i + 1, h, { failure: { kind: 'timeout', httpStatus: null, message: 'slow' } }))
    expect(resolveSite(timeouts, pacing, now(13))).toMatchObject({ status: 'unresolved', reason: 'timeout' })
  })

  it('a site that failed twice and then loaded is audited, not dropped', () => {
    expect(resolveSite([attempt(1, 0), attempt(2, 6), attempt(3, 12, { outcome: 'audited' })], pacing, now(13)).status).toBe('audited')
  })
})

describe('domainBudgetOk', () => {
  it('holds at six calls to one domain in ten minutes', () => {
    const many = Array.from({ length: 6 }, (_, i) => attempt(i + 1, 0, { at: new Date(t0 + i * 1000).toISOString() }))
    expect(domainBudgetOk(many, 'x.com', pacing, new Date(t0 + 60_000))).toBe(false)
    expect(domainBudgetOk(many, 'x.com', pacing, new Date(t0 + 11 * 60_000))).toBe(true)
    expect(domainBudgetOk(many, 'other.com', pacing, new Date(t0 + 60_000))).toBe(true)
  })
})

describe('populations', () => {
  it('parses quoted fields, doubled quotes and embedded commas', () => {
    expect(parseCsv('a,b\r\n1,"x, ""y"""\r\n')).toEqual([['a', 'b'], ['1', 'x, "y"']])
  })

  it('marks the later site on a registrable domain as a duplicate, in population order', () => {
    const site = (population: string, domain: string, rank: number): Site => ({ key: `${population}:${domain}`, population, rank, name: domain, url: `https://${domain}/`, domain })
    const pop = (id: string, sites: Site[]): LoadedPopulation => ({ config: { id, label: id, file: '', nameColumn: '', urlColumn: '', include: true }, sites, fileSha256: '', rows: sites.length })
    const { unique, duplicates } = splitDuplicates([pop('A', [site('A', 'a.com', 1), site('A', 'b.com', 2)]), pop('B', [site('B', 'b.com', 1), site('B', 'c.com', 2)])])
    expect(unique.map((s) => s.key)).toEqual(['A:a.com', 'A:b.com', 'B:c.com'])
    expect(duplicates.map((d) => [d.site.key, d.duplicateOf.key])).toEqual([['B:b.com', 'A:b.com']])
  })

  it('samples evenly and deterministically', () => {
    expect(evenSample([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5)).toEqual([1, 3, 5, 7, 9])
  })
})

describe('report: every site ends in exactly one state', () => {
  it('counts audited, dropped, unresolved, duplicate and outstanding with nothing missing', () => {
    const sites: Site[] = ['a', 'b', 'c', 'd', 'e'].map((d, i) => ({ key: `A:${d}.com`, population: 'A', rank: i + 1, name: d, url: `https://${d}.com/`, domain: `${d}.com` }))
    const row = { access: { probeRan: true, baselineRefused: false, baseline200NoContent: false, probes: [], headline: { challenge200Count: 1, robotsPermitsOriginRefusesCount: 0, vendorAsymmetry: false } }, scoreWithheld: false, htmlLang: 'en', redirectedToLocalePath: false, redirectedToOtherHost: false } as never
    const events = [
      { type: 'run-start', at: '', mode: 'study', runId: '', vantage: attempt(1, 0).vantage, config: { sites } },
      { type: 'duplicate', key: 'A:e.com', population: 'A', rank: 5, name: 'e', domain: 'e.com', url: '', duplicateOf: 'A:a.com', at: '' },
      attempt(1, 0, { key: 'A:a.com', domain: 'a.com', outcome: 'audited', failure: undefined, row }),
      ...[0, 6, 12].map((h, i) => attempt(i + 1, h, { key: 'A:b.com', domain: 'b.com' })),
      ...[0, 6, 12].map((h, i) => attempt(i + 1, h, { key: 'A:c.com', domain: 'c.com', failure: { kind: 'timeout', httpStatus: null, message: '' } })),
    ] as never
    const results = buildResults(events, pacing, new Date(t0 + 13 * H))
    expect(Object.fromEntries(results.map((r) => [r.key, r.status]))).toEqual({
      'A:a.com': 'audited', 'A:b.com': 'dropped', 'A:c.com': 'unresolved', 'A:d.com': 'pending', 'A:e.com': 'duplicate',
    })
    const sum = summarise(results, new Date(t0))
    expect(sum.populations.A).toMatchObject({ sites: 5, duplicates: 1, audited: 1, outstanding: 1, dropped: { dns: 1 }, unresolved: { timeout: 1 } })
    expect(sum.tally.A.challenge200).toBe(1)
    // The fixtures were audited from US, so a US-only audited set is consistent; an IL row is not.
    expect(sum.consistent).toBe(true)
    const il = results.map((r) => (r.vantage ? { ...r, vantage: { ...r.vantage, egressCountry: 'IL' } } : r))
    expect(summarise(il, new Date(t0)).consistent).toBe(false)
  })
})
