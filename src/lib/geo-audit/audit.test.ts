import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AuditError, runAudit } from './index'
import { findScoreInconsistencies, computeTotals, deriveStatus } from './scoring'
import type { AuditReport } from './types'

const COMMA_HTML = readFileSync(join(__dirname, '__fixtures__', 'comma-home.html'), 'utf8')
const COMMA_URL = 'https://commadigitalconsultancy.com/'
const NOW = new Date('2026-09-14T12:00:00Z')

/** Serves fixture HTML for known paths and 404s for everything else. */
function stubFetch(pages: Record<string, string>, opts: { failWith?: number } = {}): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    if (opts.failWith) {
      return new Response('', { status: opts.failWith, headers: { 'content-type': 'text/html' } })
    }
    // Exact match only — a prefix match would serve the homepage for /about-us/.
    const html = pages[url] ?? pages[url.replace(/\/$/, '')] ?? pages[`${url}/`]
    if (html === undefined) {
      return new Response('Not found', { status: 404, headers: { 'content-type': 'text/html' } })
    }
    return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } })
  }) as typeof fetch
}

const BASE_OPTIONS = { now: NOW, useModel: false as const }

/** Assertions that must hold for every report the engine produces. */
function expectInternallyConsistent(report: AuditReport) {
  const totals = {
    rawScore: report.rawScore,
    assessedMaxScore: report.assessedMaxScore,
    totalMaxScore: report.totalMaxScore,
    score: report.score,
    grade: report.grade,
    scoreWithheld: report.scoreWithheld,
    withheldReason: report.withheldReason,
    confidence: report.confidence,
  }
  expect(findScoreInconsistencies(report.breakdown, totals)).toEqual([])

  for (const f of report.breakdown) {
    expect(f.score).toBeLessThanOrEqual(f.maxScore)
    expect(f.score).toBeGreaterThanOrEqual(0)
    // A full-marks factor can never read "Needs work" or "Missing".
    if (f.scored && f.score === f.maxScore) expect(f.status).toBe('good')
    if (!f.scored) expect(f.status).toBe('unverified')
  }
}

describe('runAudit — real page, GEO', () => {
  it('produces a consistent, evidence-backed report', async () => {
    const report = await runAudit(COMMA_URL, 'geo', {
      ...BASE_OPTIONS,
      crawl: false,
      fetchImpl: stubFetch({ [COMMA_URL]: COMMA_HTML }),
    })

    expectInternallyConsistent(report)
    expect(report.scoreWithheld).toBe(false)
    expect(report.breakdown).toHaveLength(7)
    expect(report.rawScore).toBe(report.breakdown.reduce((s, f) => s + f.score, 0))
  })

  it('detects the content the previous engine reported as missing', async () => {
    const report = await runAudit(COMMA_URL, 'geo', {
      ...BASE_OPTIONS,
      crawl: false,
      fetchImpl: stubFetch({ [COMMA_URL]: COMMA_HTML }),
    })

    const structure = report.breakdown.find((f) => f.id === 'structure')!
    expect(structure.state).toBe('present')
    // Previously: "actual content structure not visible in provided HTML".
    expect(structure.detail).toMatch(/H2 sections/)
    expect(structure.detail).toMatch(/numbered sequence/)
    expect(structure.evidence.length).toBeGreaterThan(0)

    const brand = report.breakdown.find((f) => f.id === 'brand')!
    expect(brand.evidence.map((e) => e.snippet).join(' ')).toContain('connect@commadigitalconsultancy.com')

    const claims = report.breakdown.find((f) => f.id === 'citable-claims')!
    expect(claims.detail).toMatch(/client feedback/i)
  })

  it('treats January and April dates as past when run in September of the same year', async () => {
    const report = await runAudit(COMMA_URL, 'geo', {
      ...BASE_OPTIONS,
      crawl: false,
      fetchImpl: stubFetch({ [COMMA_URL]: COMMA_HTML }),
    })

    const freshness = report.breakdown.find((f) => f.id === 'freshness')!
    expect(freshness.detail).not.toMatch(/future/i)
    expect(freshness.detail).toContain('2026-04-12')
    expect(freshness.score).toBeLessThanOrEqual(freshness.maxScore)
    expect(freshness.status).toBe(deriveStatus(freshness.score, freshness.maxScore))
  })

  it('grounds every scored factor in evidence naming the URL inspected', async () => {
    const report = await runAudit(COMMA_URL, 'geo', {
      ...BASE_OPTIONS,
      crawl: false,
      fetchImpl: stubFetch({ [COMMA_URL]: COMMA_HTML }),
    })

    const present = report.breakdown.filter((f) => f.state === 'present')
    expect(present.length).toBeGreaterThan(0)
    for (const f of present) {
      expect(f.evidence.length).toBeGreaterThan(0)
      for (const e of f.evidence) {
        expect(e.url).toMatch(/^https?:\/\//)
        expect(e.snippet.length).toBeGreaterThan(0)
      }
    }
  })
})

describe('runAudit — following internal links before making sitewide claims', () => {
  const ABOUT_HTML = `
    <html><head><title>About Us — Comma</title></head><body><main>
      <h1>About Us</h1>
      <p>My name is Sadia and I founded Comma Digital Consultancy after working across
      different industries for more than eight years of experience in search. I help
      service businesses fix the structural problems that hold their websites back,
      and I stay close to the work rather than handing over a document and leaving.</p>
    </main></body></html>`

  it('counts an About page it successfully followed', async () => {
    const report = await runAudit(COMMA_URL, 'geo', {
      ...BASE_OPTIONS,
      crawl: true,
      fetchImpl: stubFetch({
        'https://commadigitalconsultancy.com/about-us/': ABOUT_HTML,
        [COMMA_URL]: COMMA_HTML,
      }),
    })

    const author = report.breakdown.find((f) => f.id === 'author')!
    expect(author.detail).toMatch(/About page is published/)
    expect(report.pagesInspected.map((p) => p.url)).toContain('https://commadigitalconsultancy.com/about-us/')
  })

  it('never claims an About page is absent when one is linked but unreachable', async () => {
    const report = await runAudit(COMMA_URL, 'geo', {
      ...BASE_OPTIONS,
      crawl: true,
      // Only the homepage resolves; /about-us/ 404s.
      fetchImpl: stubFetch({ [COMMA_URL]: COMMA_HTML }),
    })

    const author = report.breakdown.find((f) => f.id === 'author')!
    expect(author.detail).toMatch(/could not be fetched/)
    expect(author.detail).not.toMatch(/No About or team page/)
    expect(report.notes.join(' ')).toMatch(/Could not inspect the about page/)
  })

  it('only reports an About page absent when none is linked at all', async () => {
    const html = `<html><body><main><h1>Home</h1><p>${'word '.repeat(120)}</p></main></body></html>`
    const report = await runAudit('https://example.com/', 'geo', {
      ...BASE_OPTIONS,
      crawl: true,
      fetchImpl: stubFetch({ 'https://example.com/': html }),
    })

    const author = report.breakdown.find((f) => f.id === 'author')!
    expect(author.detail).toMatch(/No About or team page was linked/)
  })
})

describe('runAudit — incomplete extraction', () => {
  const SHELL = `<html><head><title>App</title></head><body><div id="root"></div><script>boot()</script></body></html>`

  it('withholds the score for a JavaScript-only shell instead of guessing one', async () => {
    const report = await runAudit('https://example.com/', 'geo', {
      ...BASE_OPTIONS,
      fetchImpl: stubFetch({ 'https://example.com/': SHELL }),
    })

    expect(report.scoreWithheld).toBe(true)
    expect(report.grade).toBe('N/A')
    expect(report.incomplete).toBe(true)
    expect(report.confidence).toBe('low')
    expect(report.withheldReason).toBeTruthy()
    expectInternallyConsistent(report)
  })

  it('marks every factor unable-to-assess rather than missing', async () => {
    const report = await runAudit('https://example.com/', 'geo', {
      ...BASE_OPTIONS,
      fetchImpl: stubFetch({ 'https://example.com/': SHELL }),
    })

    expect(report.breakdown).toHaveLength(7)
    for (const f of report.breakdown) {
      expect(f.state).toBe('unverified')
      expect(f.scored).toBe(false)
      expect(f.status).toBe('unverified')
      expect(f.label).toBe('Unable to assess')
      // The critical distinction: not "missing", which would read as a real fault.
      expect(f.status).not.toBe('missing')
    }
  })

  it('applies the same handling to the AO analyzer', async () => {
    const report = await runAudit('https://example.com/', 'ao', {
      ...BASE_OPTIONS,
      fetchImpl: stubFetch({ 'https://example.com/': SHELL }),
    })

    expect(report.breakdown).toHaveLength(6)
    expect(report.scoreWithheld).toBe(true)
    expect(report.breakdown.every((f) => f.state === 'unverified')).toBe(true)
  })
})

describe('runAudit — failed scraping', () => {
  it('raises a clear error for a 403', async () => {
    await expect(
      runAudit('https://blocked.example/', 'geo', {
        ...BASE_OPTIONS,
        fetchImpl: stubFetch({}, { failWith: 403 }),
      }),
    ).rejects.toThrow(/blocking automated requests/i)
  })

  it('raises a clear error for a 404', async () => {
    await expect(
      runAudit('https://example.com/missing', 'geo', {
        ...BASE_OPTIONS,
        fetchImpl: stubFetch({}, { failWith: 404 }),
      }),
    ).rejects.toThrow(/not found/i)
  })

  it('raises a clear error when the host is unreachable', async () => {
    const boom = (async () => {
      throw new Error('getaddrinfo ENOTFOUND nope.invalid')
    }) as typeof fetch

    const error = await runAudit('https://nope.invalid/', 'geo', { ...BASE_OPTIONS, fetchImpl: boom }).catch((e) => e)
    expect(error).toBeInstanceOf(AuditError)
    expect(String(error.message)).toMatch(/could not reach/i)
  })

  it('does not produce a report object at all when the fetch fails', async () => {
    const result = await runAudit('https://blocked.example/', 'geo', {
      ...BASE_OPTIONS,
      fetchImpl: stubFetch({}, { failWith: 500 }),
    }).catch(() => null)
    expect(result).toBeNull()
  })
})

describe('runAudit — AO on a real page', () => {
  it('scores the six AO factors consistently', async () => {
    const report = await runAudit(COMMA_URL, 'ao', {
      ...BASE_OPTIONS,
      crawl: false,
      fetchImpl: stubFetch({ [COMMA_URL]: COMMA_HTML }),
    })

    expectInternallyConsistent(report)
    expect(report.breakdown).toHaveLength(6)
    expect(report.tool).toBe('ao')

    // Previously reported as "No H2/H3 headings detected in provided HTML".
    const headings = report.breakdown.find((f) => f.id === 'question-headings')!
    expect(headings.detail).not.toMatch(/no H2 or H3 headings/i)

    const scannable = report.breakdown.find((f) => f.id === 'scannable')!
    expect(scannable.detail).not.toMatch(/only contains head metadata/i)
    expect(scannable.state).toBe('present')
  })
})

describe('runAudit — recommendations stay factual', () => {
  it('never promises a measurable visibility gain', async () => {
    const report = await runAudit(COMMA_URL, 'geo', {
      ...BASE_OPTIONS,
      crawl: false,
      fetchImpl: stubFetch({ [COMMA_URL]: COMMA_HTML }),
    })

    for (const rec of report.recommendations) {
      expect(rec.impact).not.toMatch(/\d+\s*%|\bby \d+|guarantee/i)
    }
  })
})

describe('totals contract', () => {
  it('keeps the sum of factor scores equal to rawScore for both tools', async () => {
    for (const type of ['geo', 'ao'] as const) {
      const report = await runAudit(COMMA_URL, type, {
        ...BASE_OPTIONS,
        crawl: false,
        fetchImpl: stubFetch({ [COMMA_URL]: COMMA_HTML }),
      })
      const sum = report.breakdown.filter((f) => f.scored).reduce((s, f) => s + f.score, 0)
      expect(sum).toBe(report.rawScore)
      expect(computeTotals(report.breakdown).score).toBe(report.score)
    }
  })
})
