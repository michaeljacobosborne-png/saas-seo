import { describe, expect, it } from 'vitest'
import { assessAccess, summariseAccess, type AccessInput } from './access'
import { parseRobotsTxt, type RobotsFetchResult } from './robots'
import { capModelInput, MAX_FETCH_BYTES, MAX_MODEL_INPUT_CHARS, truncationDisclosure } from './limits'
import { fetchPage } from './fetch'

function robots(text: string): RobotsFetchResult {
  return {
    url: 'https://x.test/robots.txt',
    status: 200,
    text,
    parsed: parseRobotsTxt(text),
    state: 'present',
  }
}

function input(overrides: Partial<AccessInput> = {}): AccessInput {
  return {
    robots: robots('User-agent: *\nDisallow:'),
    llmsTxt: { url: 'https://x.test/llms.txt', present: false, status: 404, bytes: 0 },
    requestedUrl: 'https://x.test/',
    finalUrl: 'https://x.test/',
    httpStatus: 200,
    headers: {},
    metaRobots: null,
    canonical: null,
    jsOnlySuspected: false,
    ...overrides,
  }
}

describe('assessAccess — crawler classes', () => {
  it('scores AI search crawlers and reports the others unscored', () => {
    const report = assessAccess(input())
    const s = summariseAccess(report)

    expect(s.searchAllowed.length).toBeGreaterThan(0)
    expect(s.training.length).toBeGreaterThan(0)
    expect(s.userTriggered.length).toBeGreaterThan(0)
    for (const c of [...s.training, ...s.userTriggered]) expect(c.scored).toBe(false)
  })

  it('does not penalise a site for blocking a training crawler', () => {
    // The canonical false failure this taxonomy exists to prevent.
    const report = assessAccess(input({ robots: robots('User-agent: GPTBot\nDisallow: /') }))
    const s = summariseAccess(report)

    expect(s.searchBlocked).toHaveLength(0)
    const gptbot = report.crawlers.find((c) => c.token === 'GPTBot')!
    expect(gptbot.verdict).toBe('disallowed')
    expect(gptbot.scored).toBe(false)
  })

  it('flags a genuinely blocked AI search crawler, quoting the rule', () => {
    const report = assessAccess(input({ robots: robots('User-agent: OAI-SearchBot\nDisallow: /') }))
    const s = summariseAccess(report)

    expect(s.searchBlocked.map((c) => c.token)).toEqual(['OAI-SearchBot'])
    expect(s.searchBlocked[0].matchedRule?.line).toBe(2)
    expect(s.searchBlocked[0].reason).toContain('Line 2')
  })

  it('marks every crawler unknown when robots.txt could not be read', () => {
    const report = assessAccess(
      input({
        robots: {
          url: 'https://x.test/robots.txt',
          status: null,
          text: '',
          parsed: null,
          state: 'unknown',
          note: 'robots.txt did not respond in time, so crawler rules are unknown.',
        },
      }),
    )
    const s = summariseAccess(report)

    // Never silently treated as allowed or blocked.
    expect(s.searchUnknown.length).toBe(s.searchAllowed.length + s.searchBlocked.length + s.searchUnknown.length)
    expect(s.searchAllowed).toHaveLength(0)
    expect(s.searchBlocked).toHaveLength(0)
  })

  it('permits everything when robots.txt is absent', () => {
    const report = assessAccess(
      input({ robots: { url: '', status: 404, text: '', parsed: { groups: [], sitemaps: [], unparsed: [] }, state: 'missing' } }),
    )
    expect(summariseAccess(report).searchBlocked).toHaveLength(0)
  })
})

describe('assessAccess — indexing directives', () => {
  it('reads noindex from the meta tag', () => {
    const r = assessAccess(input({ metaRobots: 'noindex, follow' }))
    expect(r.directives.noindex).toBe(true)
    expect(r.directives.noindexSource).toBe('meta')
  })

  it('reads noindex from the X-Robots-Tag header', () => {
    const r = assessAccess(input({ headers: { 'x-robots-tag': 'noindex' } }))
    expect(r.directives.noindex).toBe(true)
    expect(r.directives.noindexSource).toBe('header')
  })

  it('reports no noindex when neither is present', () => {
    const r = assessAccess(input())
    expect(r.directives.noindex).toBe(false)
    expect(r.directives.noindexSource).toBeNull()
  })
})

describe('assessAccess — canonical and redirects', () => {
  it('flags a canonical pointing elsewhere', () => {
    const r = assessAccess(input({ canonical: 'https://other.test/page' }))
    expect(r.canonicalMismatch).toBe(true)
  })

  it('does not flag a canonical that differs only by trailing slash', () => {
    const r = assessAccess(input({ finalUrl: 'https://x.test/', canonical: 'https://x.test' }))
    expect(r.canonicalMismatch).toBe(false)
  })

  it('notices a redirect', () => {
    const r = assessAccess(input({ requestedUrl: 'https://x.test/', finalUrl: 'https://www.x.test/home' }))
    expect(r.redirected).toBe(true)
  })
})

describe('assessAccess — llms.txt', () => {
  it('is reported, never scored, with the standing disclaimer', () => {
    const r = assessAccess(input())
    expect(r.llmsTxt.copy).toMatch(/does not affect your score/i)
    // No scored crawler or directive derives from llms.txt at all.
    expect(summariseAccess(r).searchBlocked).toHaveLength(0)
  })
})

describe('assessAccess — JS-only content', () => {
  it('reports JS-only content as a finding', () => {
    const r = assessAccess(input({ jsOnlySuspected: true }))
    expect(r.jsOnlyContent).toBe(true)
  })
})

describe('cost guards', () => {
  it('caps fetched HTML at 2MB', () => {
    expect(MAX_FETCH_BYTES).toBe(2_000_000)
  })

  it('discloses truncation in the user’s own units', () => {
    const t = truncationDisclosure('page HTML', 50_000_000, MAX_FETCH_BYTES)
    expect(t.disclosure).toMatch(/47\.7 MB/)
    expect(t.disclosure).toMatch(/1\.9 MB/)
    expect(t.disclosure).toMatch(/not assessed/i)
  })

  it('caps model input and discloses it without implying the score changed', () => {
    const { text, truncation } = capModelInput('x'.repeat(MAX_MODEL_INPUT_CHARS + 5_000))
    expect(text).toHaveLength(MAX_MODEL_INPUT_CHARS)
    expect(truncation).not.toBeNull()
    // Scores are computed in code from the whole page, so the disclosure must
    // not suggest the number was affected.
    expect(truncation!.disclosure).toMatch(/Scores are unaffected/i)
  })

  it('does not truncate ordinary input', () => {
    const { text, truncation } = capModelInput('short findings summary')
    expect(truncation).toBeNull()
    expect(text).toBe('short findings summary')
  })
})

describe('fetchPage — transient connection failures', () => {
  function socketError(code: string): Error {
    const e = new Error('fetch failed')
    ;(e as unknown as { cause: { code: string } }).cause = { code }
    return e
  }

  it('retries once when the connection pool hands back a dead socket', async () => {
    // UND_ERR_SOCKET is what Node throws when a pooled keep-alive socket was
    // already closed by the server. Reproduced live: 2 failures in 24 concurrent
    // requests to a healthy site.
    let calls = 0
    const flaky = (async () => {
      calls++
      if (calls === 1) throw socketError('UND_ERR_SOCKET')
      return new Response('<html><body><main><p>' + 'word '.repeat(80) + '</p></main></body></html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      })
    }) as typeof fetch

    const r = await fetchPage('https://x.test/', { fetchImpl: flaky })
    expect(calls).toBe(2)
    expect(r.ok).toBe(true)
  })

  it('retries an ECONNRESET', async () => {
    let calls = 0
    const flaky = (async () => {
      calls++
      if (calls === 1) throw socketError('ECONNRESET')
      return new Response('<html><body><p>ok</p></body></html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      })
    }) as typeof fetch

    const r = await fetchPage('https://x.test/', { fetchImpl: flaky })
    expect(calls).toBe(2)
    expect(r.ok).toBe(true)
  })

  it('gives up after one retry rather than looping', async () => {
    let calls = 0
    const dead = (async () => {
      calls++
      throw socketError('ECONNRESET')
    }) as typeof fetch

    const r = await fetchPage('https://x.test/', { fetchImpl: dead })
    // 2 for the original host, 2 more for the www. fallback.
    expect(calls).toBe(4)
    expect(r.ok).toBe(false)
  })

  it('does not retry a genuine HTTP error', async () => {
    let calls = 0
    const notFound = (async () => {
      calls++
      return new Response('', { status: 404, headers: { 'content-type': 'text/html' } })
    }) as typeof fetch

    const r = await fetchPage('https://x.test/', { fetchImpl: notFound })
    // One per host (original + www.), no retries.
    expect(calls).toBe(2)
    expect(r.ok).toBe(false)
    expect(r.note).toMatch(/not found/i)
  })

  it('does not retry a timeout', async () => {
    let calls = 0
    const slow = (async () => {
      calls++
      const e = new Error('The operation was aborted due to timeout')
      throw e
    }) as typeof fetch

    const r = await fetchPage('https://x.test/', { fetchImpl: slow })
    expect(calls).toBe(2)
    expect(r.note).toMatch(/did not respond in time/i)
  })
})
