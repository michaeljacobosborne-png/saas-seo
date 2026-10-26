import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  probeCrawlerAccess,
  summarise,
  isPolicyBlock,
  DEFAULT_PROBE_TOKENS,
  type CrawlerAccessReport,
} from './crawler-access'
import { parseRobotsTxt } from './robots'

/**
 * These pin the two things that make this feature honest rather than merely
 * impressive: a refusal is only called a block when the evidence supports it,
 * and training crawlers are never treated as a failure.
 *
 * Every test drives an injected fetch, so nothing here touches the network.
 */

const PAGE = '<html><body>' + 'x'.repeat(2000) + '</body></html>'
const CHALLENGE = '<html><head><title>Just a moment...</title></head><body>checking</body></html>'

interface FakeResponse {
  status: number
  body?: string
  headers?: Record<string, string>
  throws?: string
}

/** Route responses by the User-Agent the probe sends. */
function fakeFetch(route: (ua: string) => FakeResponse): typeof fetch {
  return (async (_url: string, init?: RequestInit) => {
    const ua = String((init?.headers as Record<string, string>)?.['User-Agent'] ?? '')
    const r = route(ua)
    if (r.throws) throw new Error(r.throws)

    const body = r.body ?? ''
    const bytes = new TextEncoder().encode(body)
    return {
      status: r.status,
      headers: new Headers(r.headers ?? {}),
      body: {
        getReader() {
          let done = false
          return {
            async read() {
              if (done) return { done: true, value: undefined }
              done = true
              return { done: false, value: bytes }
            },
            async cancel() {},
          }
        },
      },
    } as unknown as Response
  }) as unknown as typeof fetch
}

const NOW = new Date('2026-09-27T10:00:00.000Z')

const run = (route: (ua: string) => FakeResponse, robots?: string) =>
  probeCrawlerAccess('https://example.com/page', {
    fetchImpl: fakeFetch(route),
    robots: robots ? parseRobotsTxt(robots) : null,
    now: NOW,
  })

const byToken = (r: CrawlerAccessReport, token: string) =>
  r.probes.find((p) => p.token === token)!

describe('probeCrawlerAccess — everything served', () => {
  it('reports no blocks and marks results attributable', async () => {
    const r = await run(() => ({ status: 200, body: PAGE }))

    expect(r.baseline.contentServed).toBe(true)
    expect(r.baselineFailed).toBe(false)
    expect(r.probes).toHaveLength(DEFAULT_PROBE_TOKENS.length)
    for (const p of r.probes) {
      expect(p.contentServed).toBe(true)
      expect(p.blockKind).toBe('none')
      expect(p.attributable).toBe(true)
    }
  })

  it('records the exact user-agent sent, so a finding is reproducible', async () => {
    const r = await run(() => ({ status: 200, body: PAGE }))
    expect(byToken(r, 'GPTBot').userAgent).toContain('GPTBot/1.1')
    expect(byToken(r, 'CCBot').userAgent).toContain('CCBot/2.0')
  })
})

describe('probeCrawlerAccess — block classification', () => {
  it('distinguishes an edge block from an origin block by CDN fingerprint', async () => {
    const r = await run((ua) =>
      ua.includes('GPTBot')
        ? { status: 403, headers: { 'cf-ray': 'abc123-LHR', server: 'cloudflare' } }
        : ua.includes('CCBot')
          ? { status: 403 }
          : { status: 200, body: PAGE },
    )

    const gpt = byToken(r, 'GPTBot')
    expect(gpt.blockKind).toBe('edge-block')
    expect(gpt.edgeVendor).toBe('Cloudflare')
    expect(gpt.evidence).toMatch(/before reaching the origin/)

    const cc = byToken(r, 'CCBot')
    expect(cc.blockKind).toBe('origin-block')
    expect(cc.edgeVendor).toBeNull()
  })

  it('treats cf-mitigated as bot management, not a plain refusal', async () => {
    const r = await run((ua) =>
      ua.includes('OAI-SearchBot')
        ? { status: 403, headers: { 'cf-ray': 'x', 'cf-mitigated': 'challenge' } }
        : { status: 200, body: PAGE },
    )
    const p = byToken(r, 'OAI-SearchBot')
    expect(p.blockKind).toBe('bot-management')
    expect(p.evidence).toContain('cf-mitigated: challenge')
  })

  it('catches a challenge page served with HTTP 200', async () => {
    const r = await run((ua) =>
      ua.includes('PerplexityBot')
        ? { status: 200, body: CHALLENGE }
        : { status: 200, body: PAGE },
    )
    const p = byToken(r, 'PerplexityBot')
    expect(p.blockKind).toBe('bot-management')
    expect(p.contentServed).toBe(false)
  })

  it('does not call a full page with a reCAPTCHA contact form a challenge', async () => {
    // screamingfrog.co.uk, 2026-10-07: a 200 KB real page carrying a reCAPTCHA
    // script was reported as "a bot challenge, not the page" for every row.
    const big = '<html><head><script src="https://www.google.com/recaptcha/api.js"></script></head><body>' + 'x'.repeat(60_000) + '</body></html>'
    const r = await run(() => ({ status: 200, body: big }))
    expect(r.baselineFailed).toBe(false)
    for (const p of r.probes) {
      expect(p.blockKind).toBe('none')
      expect(p.contentServed).toBe(true)
    }
  })

  it('still catches a small Turnstile-only challenge page', async () => {
    const r = await run((ua) =>
      ua.includes('GPTBot')
        ? { status: 200, body: '<html><body><div class="cf-turnstile"></div><script src="https://challenges.example/turnstile/v0/api.js"></script></body></html>' }
        : { status: 200, body: PAGE },
    )
    expect(byToken(r, 'GPTBot').blockKind).toBe('bot-management')
  })

  it('does not report a divergence when the baseline was refused too', async () => {
    const r = await run(() => ({ status: 200, body: CHALLENGE }), 'User-agent: *\nAllow: /')
    expect(r.baselineFailed).toBe(true)
    for (const p of r.probes) expect(p.divergence).toBeNull()
  })

  it('does not call a rate limit a block', async () => {
    const r = await run((ua) =>
      ua.includes('ClaudeBot') ? { status: 429, headers: { 'retry-after': '60' } } : { status: 200, body: PAGE },
    )
    const p = byToken(r, 'ClaudeBot')
    expect(p.blockKind).toBe('rate-limited')
    expect(isPolicyBlock(p.blockKind)).toBe(false)
    expect(p.evidence).toMatch(/not a policy block/)
  })

  it('does not call a server error or a network failure a block', async () => {
    const r = await run((ua) =>
      ua.includes('GPTBot')
        ? { status: 503 }
        : ua.includes('CCBot')
          ? { status: 0, throws: 'ECONNRESET' }
          : { status: 200, body: PAGE },
    )
    expect(byToken(r, 'GPTBot').blockKind).toBe('server-error')
    expect(isPolicyBlock(byToken(r, 'GPTBot').blockKind)).toBe(false)

    const cc = byToken(r, 'CCBot')
    expect(cc.blockKind).toBe('network-error')
    expect(cc.status).toBeNull()
    expect(isPolicyBlock(cc.blockKind)).toBe(false)
  })

  it('does not treat a near-empty 200 as content', async () => {
    const r = await run((ua) =>
      ua.includes('GPTBot') ? { status: 200, body: 'ok' } : { status: 200, body: PAGE },
    )
    const p = byToken(r, 'GPTBot')
    expect(p.contentServed).toBe(false)
    expect(p.evidence).toMatch(/too little to be the page/)
  })
})

describe('probeCrawlerAccess — attribution', () => {
  it('marks every row unattributable when the baseline also fails', async () => {
    // An IP-level block, or the site being down: the crawler UA is not the cause.
    const r = await run(() => ({ status: 403, headers: { 'cf-ray': 'x' } }))

    expect(r.baselineFailed).toBe(true)
    for (const p of r.probes) expect(p.attributable).toBe(false)
    expect(r.caveats[0]).toMatch(/ordinary browser request also failed/i)
  })

  it('reports nothing as blocked in the summary when attribution is impossible', async () => {
    const r = await run(() => ({ status: 403, headers: { 'cf-ray': 'x' } }))
    const s = summarise(r)
    expect(s.retrievalBlocked).toHaveLength(0)
    expect(s.trainingBlocked).toHaveLength(0)
    expect(s.unknown).toHaveLength(r.probes.length)
    expect(s.asymmetry).toBeNull()
  })
})

describe('probeCrawlerAccess — reddit.com, as captured 2026-10-26', () => {
  // The real body reddit.com served to the browser baseline and to OAI-SearchBot,
  // Claude-SearchBot and PerplexityBot: 8,406 bytes, a hidden form filled in and
  // submitted by script, no Reddit content. It was reported as "bytes served".
  const REDDIT_CHALLENGE = readFileSync(join(__dirname, '__fixtures__', 'reddit-js-challenge.html'), 'utf8')
  // The real headers on reddit.com's 429 to ClaudeBot and CCBot (cookies left out).
  const ZERO_ALLOWANCE = {
    'x-ratelimit-remaining': '0.0',
    'x-ratelimit-reset': '0',
    'x-ratelimit-used': '0',
    via: '1.1 varnish',
    server: 'snooserv',
  }

  it('does not call the JavaScript challenge page "served"', async () => {
    const r = await run((ua) => (ua.includes('Chrome') ? { status: 200, body: PAGE } : { status: 200, body: REDDIT_CHALLENGE }))
    for (const p of r.probes) {
      expect(p.contentServed).toBe(false)
      expect(p.blockKind).toBe('bot-management')
      expect(p.evidence).toMatch(/JavaScript challenge/)
    }
  })

  it('treats the baseline getting the same challenge as a failed baseline, so every row is unknown', async () => {
    const r = await run(() => ({ status: 200, body: REDDIT_CHALLENGE }))
    expect(r.baselineFailed).toBe(true)
    for (const p of r.probes) expect(p.attributable).toBe(false)
  })

  it('labels a 429 with x-ratelimit-used: 0 a refusal, not rate limiting', async () => {
    const r = await run((ua) =>
      ua.includes('ClaudeBot') || ua.includes('CCBot') ? { status: 429, headers: ZERO_ALLOWANCE } : { status: 200, body: PAGE },
    )
    for (const token of ['ClaudeBot', 'CCBot']) {
      const p = byToken(r, token)
      expect(p.blockKind).toBe('origin-block')
      expect(isPolicyBlock(p.blockKind)).toBe(true)
      expect(p.evidence).toMatch(/A refusal, not rate limiting/)
    }
    expect(r.caveats.join(' ')).not.toMatch(/rate limited/)
  })

  it('still calls a 429 that has used some allowance a rate limit', async () => {
    const r = await run((ua) =>
      ua.includes('ClaudeBot') ? { status: 429, headers: { 'x-ratelimit-used': '600', 'x-ratelimit-remaining': '0' } } : { status: 200, body: PAGE },
    )
    expect(byToken(r, 'ClaudeBot').blockKind).toBe('rate-limited')
  })

  it('does not mistake a real page with a search form for a challenge', async () => {
    const page = '<html><body><form action="/search"><input name="q"></form><script>document.forms[0].submit()</script><main>' +
      'Real article text. '.repeat(40) + '</main></body></html>'
    const r = await run(() => ({ status: 200, body: page }))
    for (const p of r.probes) expect(p.contentServed).toBe(true)
  })
})

describe('probeCrawlerAccess — answers that depend on our request shape', () => {
  // aira.net and zelst.co.uk, 2026-10-07: the same crawler user-agent got 200
  // with Accept and Accept-Language headers and 403 without them. Routed here by
  // whether the probe sent an Accept header.
  const byShape = (withHeaders: FakeResponse, bare: FakeResponse, only?: string): typeof fetch =>
    (async (_url: string, init?: RequestInit) => {
      const h = (init?.headers ?? {}) as Record<string, string>
      const ua = String(h['User-Agent'] ?? '')
      const r = ua.includes('Chrome') || (only && !ua.includes(only)) ? { status: 200, body: PAGE } : h.Accept ? withHeaders : bare
      return fakeFetch(() => r)(_url, init)
    }) as unknown as typeof fetch

  const AIRA_PAGE = '<html><body>' + 'x'.repeat(128_000) + '</body></html>'

  it('reports a crawler served with headers and refused without as unconfirmed, not served and not blocked', async () => {
    const r = await probeCrawlerAccess('https://aira.net/', {
      fetchImpl: byShape({ status: 200, body: AIRA_PAGE }, { status: 403, body: '' }, 'Claude-SearchBot'),
      robots: parseRobotsTxt('User-agent: *\nDisallow:\n'),
      now: NOW,
    })
    const p = byToken(r, 'Claude-SearchBot')
    expect(p.confirmed).toBe(false)
    expect(p.attributable).toBe(false)
    expect(p.divergence).toBeNull()
    expect(p.evidence).toMatch(/HTTP 200 with browser-style Accept headers, HTTP 403 with the user-agent alone/)
    expect(r.caveats.join(' ')).toMatch(/unconfirmed/)
    // Rows where both shapes agree are reported as before.
    expect(byToken(r, 'OAI-SearchBot').confirmed).toBe(true)
    expect(byToken(r, 'OAI-SearchBot').attributable).toBe(true)
  })

  it('does not count an unconfirmed row in the summary as blocked', async () => {
    const r = await probeCrawlerAccess('https://www.zelst.co.uk/', {
      fetchImpl: byShape({ status: 403, body: '' }, { status: 200, body: AIRA_PAGE }),
      now: NOW,
    })
    const s = summarise(r)
    expect(s.retrievalBlocked).toHaveLength(0)
    for (const p of r.probes) expect(p.confirmed).toBe(false)
  })

  it('confirms a row when both shapes agree', async () => {
    const r = await run((ua) => (ua.includes('GPTBot') ? { status: 403 } : { status: 200, body: PAGE }))
    expect(byToken(r, 'GPTBot').confirmed).toBe(true)
    expect(byToken(r, 'GPTBot').blockKind).toBe('origin-block')
  })
})

describe('probeCrawlerAccess — robots.txt divergence', () => {
  const ALLOW_ALL = 'User-agent: *\nDisallow:\n'
  const BLOCK_AI = 'User-agent: GPTBot\nDisallow: /\n\nUser-agent: OAI-SearchBot\nDisallow: /\n'

  it('flags robots-allows-origin-blocks — the Cloudflare-default case', async () => {
    const r = await run(
      (ua) => (ua.includes('OAI-SearchBot') ? { status: 403, headers: { 'cf-ray': 'x' } } : { status: 200, body: PAGE }),
      ALLOW_ALL,
    )
    const p = byToken(r, 'OAI-SearchBot')
    expect(p.robotsVerdict).toBe('allowed')
    expect(p.divergence).toBe('robots-allows-origin-blocks')
  })

  it('flags robots-blocks-origin-serves', async () => {
    const r = await run(() => ({ status: 200, body: PAGE }), BLOCK_AI)
    expect(byToken(r, 'GPTBot').robotsVerdict).toBe('disallowed')
    expect(byToken(r, 'GPTBot').divergence).toBe('robots-blocks-origin-serves')
    // A crawler with no rule against it is allowed by default and not divergent.
    expect(byToken(r, 'CCBot').robotsVerdict).toBe('allowed')
    expect(byToken(r, 'CCBot').divergence).toBeNull()
  })

  it('does not invent a divergence when robots.txt could not be read', async () => {
    const r = await run((ua) =>
      ua.includes('GPTBot') ? { status: 403, headers: { 'cf-ray': 'x' } } : { status: 200, body: PAGE },
    )
    const p = byToken(r, 'GPTBot')
    expect(p.robotsVerdict).toBe('unknown')
    expect(p.divergence).toBeNull()
  })

  it('does not call a rate limit a divergence', async () => {
    const r = await run(
      (ua) => (ua.includes('OAI-SearchBot') ? { status: 429 } : { status: 200, body: PAGE }),
      ALLOW_ALL,
    )
    expect(byToken(r, 'OAI-SearchBot').divergence).toBeNull()
  })
})

describe('summarise — the taxonomy is respected', () => {
  it('separates retrieval from training and never scores training', async () => {
    const r = await run((ua) =>
      /GPTBot|CCBot|ClaudeBot/.test(ua) ? { status: 403, headers: { 'cf-ray': 'x' } } : { status: 200, body: PAGE },
    )
    const s = summarise(r)

    expect(s.retrievalAllowed.map((p) => p.token).sort()).toEqual(['Claude-SearchBot', 'OAI-SearchBot', 'PerplexityBot'])
    expect(s.trainingBlocked.map((p) => p.token).sort()).toEqual(['CCBot', 'ClaudeBot', 'GPTBot'])
    expect(s.retrievalBlocked).toHaveLength(0)
    // Training blocked while retrieval is served is a legitimate editorial
    // choice, so it is reported as an asymmetry, never as a failure.
    expect(s.asymmetry).toBe('training-blocked-retrieval-allowed')
  })

  it('flags the costly asymmetry: retrieval blocked, training allowed', async () => {
    const r = await run((ua) =>
      /OAI-SearchBot|PerplexityBot|Claude-SearchBot/.test(ua)
        ? { status: 403, headers: { 'cf-ray': 'x' } }
        : { status: 200, body: PAGE },
    )
    const s = summarise(r)
    expect(s.asymmetry).toBe('retrieval-blocked-training-allowed')
    expect(s.retrievalBlocked).toHaveLength(3)
    expect(s.trainingAllowed).toHaveLength(3)
  })
})

describe('byte accounting', () => {
  it('prefers Content-Length over what we chose to read', async () => {
    const r = await run(() => ({
      status: 200,
      body: PAGE,
      headers: { 'content-length': '987654' },
    }))
    expect(byToken(r, 'GPTBot').bytes).toBe(987654)
    expect(byToken(r, 'GPTBot').bytesTruncated).toBe(false)
  })
})

describe('output discipline', () => {
  it('never claims anything about retrieval, citation or indexing', async () => {
    const r = await run((ua) =>
      ua.includes('OAI-SearchBot') ? { status: 403, headers: { 'cf-ray': 'x' } } : { status: 200, body: PAGE },
    )
    const text = [...r.caveats, ...r.probes.map((p) => p.evidence)].join(' ')

    expect(text).not.toMatch(/\bis being cited\b|\bwill be cited\b|\bguarantee/i)
    expect(text).not.toMatch(/not (?:indexed|retrieved) by/i)
    // It must say what it actually measured.
    expect(r.caveats.join(' ')).toMatch(/evidence about fetchability/i)
  })

  it('states the IP-verification caveat whenever it reports a block', async () => {
    const r = await run((ua) =>
      ua.includes('GPTBot') ? { status: 403, headers: { 'cf-ray': 'x' } } : { status: 200, body: PAGE },
    )
    expect(r.caveats.join(' ')).toMatch(/verify themselves by IP range/i)
  })

  it('stamps the check time from the injected clock', async () => {
    const r = await run(() => ({ status: 200, body: PAGE }))
    expect(r.checkedAt).toBe('2026-09-27T10:00:00.000Z')
  })
})

// ── Integration with the Access group ─────────────────────────────────────────

import { scoreRetrievability } from './score-retrievability'
import type { AccessReport } from './access'
import type { ExtractedPage } from './extract'

/**
 * These pin the two things that must not drift when the probe feeds the score:
 * the Access group still totals 30 (so scores stay comparable to runs made
 * before the probe existed), and training crawlers contribute nothing.
 */

const fakeAccess = (robotsText: string): AccessReport =>
  ({
    crawlers: [],
    robots: { url: 'https://example.com/robots.txt', state: 'present', status: 200, text: robotsText, sitemaps: ['https://example.com/sitemap.xml'] },
    llmsTxt: { state: 'missing', url: '', status: null, text: '', copy: '' },
    directives: { noindex: false, noindexSource: null, metaRobots: null, xRobotsTag: null },
    httpStatus: 200,
    finalUrl: 'https://example.com/page',
    redirected: false,
    canonical: 'https://example.com/page',
    canonicalMismatch: false,
  }) as unknown as AccessReport

/** Enough of an ExtractedPage for all four groups to run; only Access is asserted. */
const fakePage = () =>
  ({
    url: 'https://example.com/page',
    title: 'T',
    metaDescription: '',
    lang: 'en',
    canonical: 'https://example.com/page',
    headings: [],
    mainText: '',
    bodyText: '',
    wordCount: 0,
    paragraphs: [],
    links: [],
    lists: [],
    tables: [],
    structuredData: [],
    structuredDataTypes: [],
    jsonLdBlocks: [],
    metaRobots: null,
    dates: [],
    emails: [],
    phones: [],
    socialLinks: [],
    boldTerms: [],
    images: [],
    testimonials: [],
    blocks: [],
    statistics: [],
    outboundCitations: [],
    hasMeaningfulContent: true,
  }) as unknown as ExtractedPage

const accessGroup = (r: ReturnType<typeof scoreRetrievability>) =>
  r.groups.find((g) => g.id === 'access')!

describe('Access group integration', () => {
  it('still totals 30 with the probe present, so scores stay comparable', async () => {
    const probe = await run((ua) =>
      /GPTBot|CCBot/.test(ua) ? { status: 403, headers: { 'cf-ray': 'x' } } : { status: 200, body: PAGE },
    )
    const withProbe = scoreRetrievability({
      home: fakePage(),
      access: fakeAccess('User-agent: *\nDisallow:\n'),
      now: NOW,
      crawlerAccess: probe,
    })
    const without = scoreRetrievability({
      home: fakePage(),
      access: fakeAccess('User-agent: *\nDisallow:\n'),
      now: NOW,
    })

    expect(accessGroup(withProbe).maxScore).toBe(30)
    expect(accessGroup(without).maxScore).toBe(30)
  })

  it('reports training crawlers as unverified and excludes them from the score', async () => {
    const probe = await run((ua) =>
      /GPTBot|CCBot|ClaudeBot/.test(ua) ? { status: 403, headers: { 'cf-ray': 'x' } } : { status: 200, body: PAGE },
    )
    const r = scoreRetrievability({
      home: fakePage(),
      access: fakeAccess('User-agent: *\nDisallow:\n'),
      now: NOW,
      crawlerAccess: probe,
    })
    const g = accessGroup(r)
    const training = g.checks.find((c) => c.id === 'access-training-crawlers')!

    expect(training).toBeDefined()
    expect(training.scored).toBe(false)
    expect(training.status).toBe('unverified')
    expect(training.maxScore).toBe(0)
    expect(training.detail).toMatch(/not scored/i)

    // All three retrieval crawlers were served, so the crawler check is full marks
    // despite every training crawler being refused.
    const crawlers = g.checks.find((c) => c.id === 'access-crawlers')!
    expect(crawlers.score).toBe(14)
  })

  it('lets an edge block override a permissive robots.txt', async () => {
    const probe = await run(
      // Every probeable retrieval crawler refused, so the check floors at 0
      // even though robots.txt permits all of them.
      (ua) =>
        /OAI-SearchBot|PerplexityBot|Claude-SearchBot/.test(ua)
          ? { status: 403, headers: { 'cf-ray': 'x' } }
          : { status: 200, body: PAGE },
      'User-agent: *\nDisallow:\n',
    )
    const r = scoreRetrievability({
      home: fakePage(),
      access: fakeAccess('User-agent: *\nDisallow:\n'),
      now: NOW,
      crawlerAccess: probe,
    })
    const crawlers = accessGroup(r).checks.find((c) => c.id === 'access-crawlers')!

    expect(crawlers.score).toBe(0)
    expect(crawlers.detail).toMatch(/robots\.txt permits/i)
    expect(crawlers.detail).toMatch(/refused/i)
    // No positive claim about what any model did — and the disclaimer stating
    // so is required, which is why this checks claim shapes rather than words.
    expect(crawlers.detail).not.toMatch(/\bis (?:being )?(?:cited|indexed|retrieved)\b/i)
    expect(crawlers.detail).not.toMatch(/\bwill (?:be )?(?:cited|indexed|retrieved)\b/i)
    expect(crawlers.detail).not.toMatch(/guarantee/i)
    expect(crawlers.detail).toMatch(/not whether any AI system has retrieved or cited/i)
    expect(crawlers.evidence?.length).toBeGreaterThan(0)
  })

  it('falls back to robots.txt scoring when the baseline failed', async () => {
    const probe = await run(() => ({ status: 403, headers: { 'cf-ray': 'x' } }))
    const r = scoreRetrievability({
      home: fakePage(),
      access: fakeAccess('User-agent: *\nDisallow:\n'),
      now: NOW,
      crawlerAccess: probe,
    })
    const g = accessGroup(r)
    expect(g.maxScore).toBe(30)
    // No training factor is added when nothing is attributable.
    expect(g.checks.find((c) => c.id === 'access-training-crawlers')).toBeUndefined()
  })
})
