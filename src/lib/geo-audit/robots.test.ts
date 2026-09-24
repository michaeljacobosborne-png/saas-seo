import { describe, expect, it } from 'vitest'
import {
  CRAWLERS,
  fetchLlmsTxt,
  fetchRobotsTxt,
  groupForAgent,
  isAllowed,
  parseRobotsTxt,
} from './robots'

function res(body: string, status = 200, contentType = 'text/plain'): Response {
  return new Response(body, { status, headers: { 'content-type': contentType } })
}

describe('parseRobotsTxt', () => {
  it('groups consecutive user-agent lines into one rule set', () => {
    const parsed = parseRobotsTxt(`
User-agent: GPTBot
User-agent: CCBot
Disallow: /private

User-agent: *
Disallow:
`)
    expect(parsed.groups).toHaveLength(2)
    expect(parsed.groups[0].agents).toEqual(['gptbot', 'ccbot'])
    expect(parsed.groups[0].rules).toEqual([{ type: 'disallow', pattern: '/private', line: 4 }])
    expect(parsed.groups[1].agents).toEqual(['*'])
  })

  it('starts a new group when a user-agent follows a rule', () => {
    const parsed = parseRobotsTxt(`User-agent: A\nDisallow: /a\nUser-agent: B\nDisallow: /b`)
    expect(parsed.groups).toHaveLength(2)
    expect(parsed.groups[0].agents).toEqual(['a'])
    expect(parsed.groups[1].agents).toEqual(['b'])
  })

  it('collects sitemaps and ignores comments', () => {
    const parsed = parseRobotsTxt(`# a comment\nSitemap: https://x.test/sitemap.xml\nUser-agent: *\nDisallow: /x # trailing`)
    expect(parsed.sitemaps).toEqual(['https://x.test/sitemap.xml'])
    expect(parsed.groups[0].rules[0].pattern).toBe('/x')
  })

  it('records lines it cannot interpret instead of discarding them', () => {
    const parsed = parseRobotsTxt(`User-agent: *\nthis is not a directive\nDisallow: /x`)
    expect(parsed.unparsed).toEqual([{ line: 2, text: 'this is not a directive' }])
  })

  it('records rules that appear before any user-agent line', () => {
    const parsed = parseRobotsTxt(`Disallow: /orphan\nUser-agent: *\nDisallow: /x`)
    expect(parsed.unparsed.some((u) => u.text === 'Disallow: /orphan')).toBe(true)
  })
})

describe('groupForAgent', () => {
  const parsed = parseRobotsTxt(`
User-agent: *
Disallow: /everyone

User-agent: GPTBot
Disallow: /gptbot
`)

  it('prefers a specific group over the wildcard', () => {
    expect(groupForAgent(parsed, 'GPTBot')?.agents).toEqual(['gptbot'])
  })

  it('falls back to the wildcard group', () => {
    expect(groupForAgent(parsed, 'PerplexityBot')?.agents).toEqual(['*'])
  })

  it('matches case-insensitively', () => {
    expect(groupForAgent(parsed, 'gptbot')?.agents).toEqual(['gptbot'])
  })

  it('prefers the longest matching token', () => {
    const p = parseRobotsTxt(`User-agent: Claude\nDisallow: /a\nUser-agent: Claude-SearchBot\nDisallow: /b`)
    expect(groupForAgent(p, 'Claude-SearchBot')?.agents).toEqual(['claude-searchbot'])
  })
})

describe('isAllowed', () => {
  it('allows everything when Disallow is empty', () => {
    const p = parseRobotsTxt(`User-agent: *\nDisallow:`)
    expect(isAllowed(p, 'OAI-SearchBot', '/anything').verdict).toBe('allowed')
  })

  it('blocks a matching prefix', () => {
    const p = parseRobotsTxt(`User-agent: *\nDisallow: /private`)
    const d = isAllowed(p, 'OAI-SearchBot', '/private/thing')
    expect(d.verdict).toBe('disallowed')
    expect(d.matchedRule?.line).toBe(2)
  })

  it('lets the longest matching rule win', () => {
    const p = parseRobotsTxt(`User-agent: *\nDisallow: /\nAllow: /blog`)
    expect(isAllowed(p, 'OAI-SearchBot', '/blog/post').verdict).toBe('allowed')
    expect(isAllowed(p, 'OAI-SearchBot', '/other').verdict).toBe('disallowed')
  })

  it('breaks an equal-length tie in favour of Allow', () => {
    const p = parseRobotsTxt(`User-agent: *\nDisallow: /page\nAllow: /page`)
    expect(isAllowed(p, 'OAI-SearchBot', '/page').verdict).toBe('allowed')
  })

  it('honours the * wildcard inside a pattern', () => {
    const p = parseRobotsTxt(`User-agent: *\nDisallow: /*.pdf`)
    expect(isAllowed(p, 'OAI-SearchBot', '/docs/file.pdf').verdict).toBe('disallowed')
    expect(isAllowed(p, 'OAI-SearchBot', '/docs/file.html').verdict).toBe('allowed')
  })

  it('honours the $ end anchor', () => {
    const p = parseRobotsTxt(`User-agent: *\nDisallow: /page$`)
    expect(isAllowed(p, 'OAI-SearchBot', '/page').verdict).toBe('disallowed')
    expect(isAllowed(p, 'OAI-SearchBot', '/page/sub').verdict).toBe('allowed')
  })

  it('does not apply another agent’s rules', () => {
    // The single most consequential mistake a checker can make: reporting a site
    // as blocking a crawler because a *different* crawler is blocked.
    const p = parseRobotsTxt(`User-agent: GPTBot\nDisallow: /`)
    expect(isAllowed(p, 'OAI-SearchBot', '/page').verdict).toBe('allowed')
    expect(isAllowed(p, 'GPTBot', '/page').verdict).toBe('disallowed')
  })

  it('always explains itself', () => {
    const p = parseRobotsTxt(`User-agent: *\nDisallow: /x`)
    expect(isAllowed(p, 'OAI-SearchBot', '/x').reason).toContain('Line 2')
    expect(isAllowed(p, 'OAI-SearchBot', '/y').reason).toBeTruthy()
  })
})

describe('crawler taxonomy', () => {
  it('scores AI search crawlers and never scores training crawlers', () => {
    const scored = CRAWLERS.filter((c) => c.scored).map((c) => c.token)
    expect(scored).toContain('OAI-SearchBot')
    expect(scored).toContain('PerplexityBot')

    // The distinction the category gets wrong: blocking a training crawler is a
    // publisher's choice, not a defect, so it must never cost points.
    for (const token of ['GPTBot', 'ClaudeBot', 'CCBot', 'Bytespider', 'Applebot-Extended']) {
      const spec = CRAWLERS.find((c) => c.token === token)!
      expect(spec.class).toBe('training')
      expect(spec.scored).toBe(false)
    }
  })

  it('never scores user-triggered fetchers', () => {
    for (const token of ['ChatGPT-User', 'Claude-User', 'Perplexity-User']) {
      const spec = CRAWLERS.find((c) => c.token === token)!
      expect(spec.class).toBe('user-triggered')
      expect(spec.scored).toBe(false)
    }
  })

  it('links every crawler to first-party documentation', () => {
    for (const c of CRAWLERS) {
      expect(c.docs).toMatch(/^https:\/\//)
      expect(c.note.length).toBeGreaterThan(20)
    }
  })
})

describe('fetchRobotsTxt', () => {
  it('treats 404 as "missing", which permits everything', async () => {
    const r = await fetchRobotsTxt('https://x.test/page', {
      fetchImpl: (async () => res('', 404)) as typeof fetch,
    })
    expect(r.state).toBe('missing')
    expect(r.note).toMatch(/permitted by default/i)
  })

  it('treats a 5xx as unknown and explains the consequence', async () => {
    const r = await fetchRobotsTxt('https://x.test/page', {
      fetchImpl: (async () => res('', 503)) as typeof fetch,
    })
    expect(r.state).toBe('unknown')
    expect(r.note).toMatch(/disallow everything/i)
  })

  it('treats a timeout as unknown, never as allowed or blocked', async () => {
    const r = await fetchRobotsTxt('https://x.test/page', {
      fetchImpl: (async () => {
        throw new Error('The operation was aborted due to timeout')
      }) as typeof fetch,
    })
    expect(r.state).toBe('unknown')
    expect(r.parsed).toBeNull()
  })

  it('parses a present file and keeps the text verbatim', async () => {
    const body = 'User-agent: *\nDisallow: /admin\n'
    const r = await fetchRobotsTxt('https://x.test/page', {
      fetchImpl: (async () => res(body)) as typeof fetch,
    })
    expect(r.state).toBe('present')
    expect(r.text).toBe(body)
    expect(r.parsed?.groups[0].rules[0].pattern).toBe('/admin')
  })
})

describe('fetchLlmsTxt', () => {
  it('reports presence', async () => {
    const r = await fetchLlmsTxt('https://x.test/', {
      fetchImpl: (async () => res('# My site\nSome overview.')) as typeof fetch,
    })
    expect(r.present).toBe(true)
  })

  it('does not count an HTML 404 page served with status 200', async () => {
    const r = await fetchLlmsTxt('https://x.test/', {
      fetchImpl: (async () => res('<!doctype html><html><body>Not found</body></html>')) as typeof fetch,
    })
    expect(r.present).toBe(false)
  })

  it('reports absence on 404', async () => {
    const r = await fetchLlmsTxt('https://x.test/', {
      fetchImpl: (async () => res('', 404)) as typeof fetch,
    })
    expect(r.present).toBe(false)
  })
})
