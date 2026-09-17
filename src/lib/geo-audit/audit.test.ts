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
    // 7 content factors + AI crawler access.
    // Phase B: breakdown is the flattened retrievability checks, 3 per group.
    expect(report.breakdown).toHaveLength(12)
    expect(report.retrievability.groups.map((g) => g.id)).toEqual([
      'access',
      'parseability',
      'chunkability',
      'extractability',
    ])
    expect(report.rawScore).toBe(report.breakdown.reduce((s, f) => s + f.score, 0))
    // The legacy `score` mirrors Retrievability and never blends in Citability.
    expect(report.score).toBe(report.retrievability.score)
    expect(report.citability.signals).toHaveLength(6)
  })

  it('detects the content the previous engine reported as missing', async () => {
    const report = await runAudit(COMMA_URL, 'geo', {
      ...BASE_OPTIONS,
      crawl: false,
      fetchImpl: stubFetch({ [COMMA_URL]: COMMA_HTML }),
    })

    const structure = report.breakdown.find((f) => f.id === 'chunk-hierarchy')!
    expect(structure.state).toBe('present')
    // Previously: "actual content structure not visible in provided HTML".
    expect(structure.detail).toMatch(/H2 sections/)
    expect(structure.detail).toMatch(/numbered sequence/)
    expect(structure.evidence.length).toBeGreaterThan(0)

    // Contact details are a citability signal now, not a retrievability check.
    const entity = report.citability.signals.find((x) => x.id === 'entity-resolution')!
    expect(entity.evidence.map((e) => e.snippet).join(' ')).toContain('connect@commadigitalconsultancy.com')

    // The attributed testimonial is first-hand evidence — a citability signal.
    const evidence = report.citability.signals.find((x) => x.id === 'original-evidence')!
    expect(evidence.detail).toMatch(/client feedback/i)
  })

  it('treats January and April dates as past when run in September of the same year', async () => {
    const report = await runAudit(COMMA_URL, 'geo', {
      ...BASE_OPTIONS,
      crawl: false,
      fetchImpl: stubFetch({ [COMMA_URL]: COMMA_HTML }),
    })

    const freshness = report.citability.signals.find((x) => x.id === 'freshness-provenance')!
    expect(freshness.detail).not.toMatch(/future/i)
    expect(freshness.detail).toContain('2026-04-12')
    expect(freshness.band).not.toBe('unverified')
    expect(freshness.evidence.length).toBeGreaterThan(0)
  })

  it('grounds every scored factor in evidence naming the URL inspected', async () => {
    const report = await runAudit(COMMA_URL, 'geo', {
      ...BASE_OPTIONS,
      crawl: false,
      fetchImpl: stubFetch({ [COMMA_URL]: COMMA_HTML }),
    })

    // A purely negative finding ("no noindex directive") has no artefact to
    // quote, so the rule is: evidence must be URL-attributed wherever it exists,
    // and most checks must carry some.
    const withEvidence = report.breakdown.filter((f) => f.evidence.length > 0)
    expect(withEvidence.length).toBeGreaterThanOrEqual(7)
    for (const f of report.breakdown) {
      for (const e of f.evidence) {
        expect(e.url).toMatch(/^https?:\/\//)
        expect(e.snippet.length).toBeGreaterThan(0)
      }
    }
    // Every positively-banded citability signal must point at something.
    for (const sig of report.citability.signals) {
      if (sig.band === 'strong' || sig.band === 'adequate') {
        expect(sig.evidence.length).toBeGreaterThan(0)
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

    const author = report.citability.signals.find((x) => x.id === 'named-authorship')!
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

    const author = report.citability.signals.find((x) => x.id === 'named-authorship')!
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

    const author = report.citability.signals.find((x) => x.id === 'named-authorship')!
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

  it('marks every content factor unable-to-assess rather than missing', async () => {
    const report = await runAudit('https://example.com/', 'geo', {
      ...BASE_OPTIONS,
      fetchImpl: stubFetch({ 'https://example.com/': SHELL }),
    })

    expect(report.breakdown).toHaveLength(12)

    // Access and Parseability describe the RAW HTML, so they stay assessable on
    // a JS-only shell — and there they are the most useful findings in the
    // report. Only the content-dependent groups go unverified.
    const contentGroups = report.retrievability.groups.filter(
      (g) => g.id === 'chunkability' || g.id === 'extractability',
    )
    const contentChecks = contentGroups.flatMap((g) => g.checks)
    expect(contentChecks).toHaveLength(6)
    for (const f of contentChecks) {
      expect(f.state).toBe('unverified')
      expect(f.scored).toBe(false)
      expect(f.status).toBe('unverified')
      expect(f.label).toBe('Unable to assess')
      // The critical distinction: not "missing", which would read as a real fault.
      expect(f.status).not.toBe('missing')
      expect(f.detail).toMatch(/not a fault in the page/i)
    }

    // Access is still scored, because robots.txt does not depend on page content.
    const access = report.retrievability.groups.find((g) => g.id === 'access')!
    expect(access.scored).toBe(true)

    // The overall score is still withheld — too little was assessable to mean anything.
    expect(report.scoreWithheld).toBe(true)
  })

  it('applies the same handling to the AO analyzer', async () => {
    const report = await runAudit('https://example.com/', 'ao', {
      ...BASE_OPTIONS,
      fetchImpl: stubFetch({ 'https://example.com/': SHELL }),
    })

    // AO runs the same core, so it degrades identically.
    expect(report.breakdown).toHaveLength(12)
    expect(report.scoreWithheld).toBe(true)
    const contentChecks = report.retrievability.groups
      .filter((g) => g.id === 'chunkability' || g.id === 'extractability')
      .flatMap((g) => g.checks)
    expect(contentChecks.every((f) => f.state === 'unverified')).toBe(true)
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
    // The fetch layer now names the actual failure rather than saying 'could not reach'.
    expect(String(error.message)).toMatch(/could not be resolved/i)
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
  it('scores AO through the same shared core', async () => {
    const report = await runAudit(COMMA_URL, 'ao', {
      ...BASE_OPTIONS,
      crawl: false,
      fetchImpl: stubFetch({ [COMMA_URL]: COMMA_HTML }),
    })

    expectInternallyConsistent(report)
    expect(report.breakdown).toHaveLength(12)
    expect(report.tool).toBe('ao')

    // Previously reported as "No H2/H3 headings detected in provided HTML".
    const hierarchy = report.breakdown.find((f) => f.id === 'chunk-hierarchy')!
    expect(hierarchy.detail).toMatch(/H2 sections/)
    expect(hierarchy.state).toBe('present')

    const questions = report.breakdown.find((f) => f.id === 'extract-questions')!
    expect(questions.detail).not.toMatch(/only contains head metadata/i)

    // GEO and AO must produce identical numbers — the tool only changes framing.
    const geo = await runAudit(COMMA_URL, 'geo', {
      ...BASE_OPTIONS,
      crawl: false,
      fetchImpl: stubFetch({ [COMMA_URL]: COMMA_HTML }),
    })
    expect(report.retrievability.score).toBe(geo.retrievability.score)
    expect(report.citability.band).toBe(geo.citability.band)
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

describe('runAudit — chain of custody and access', () => {
  const ROBOTS = 'User-agent: *\nDisallow: /admin\n\nUser-agent: GPTBot\nDisallow: /\n'

  function stubWithRobots() {
    return (async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      if (url.endsWith('/robots.txt')) {
        return new Response(ROBOTS, { status: 200, headers: { 'content-type': 'text/plain' } })
      }
      if (url.endsWith('/llms.txt')) return new Response('', { status: 404 })
      if (url === COMMA_URL) {
        return new Response(COMMA_HTML, { status: 200, headers: { 'content-type': 'text/html' } })
      }
      return new Response('Not found', { status: 404, headers: { 'content-type': 'text/html' } })
    }) as typeof fetch
  }

  it('records provenance for the run', async () => {
    const report = await runAudit(COMMA_URL, 'geo', { ...BASE_OPTIONS, crawl: false, fetchImpl: stubWithRobots() })

    expect(report.chainOfCustody.fetchedAt).toBe(NOW.toISOString())
    expect(report.chainOfCustody.userAgent).toMatch(/BylineAuditBot/)
    expect(report.chainOfCustody.renderMode).toBe('raw')
    expect(report.chainOfCustody.finalUrl).toBe(COMMA_URL)
    expect(report.chainOfCustody.httpStatus).toBe(200)
  })

  it('never renders on a free run, even when the page is a JS shell', async () => {
    const renderSpy = { called: false }
    const report = await runAudit('https://example.com/', 'geo', {
      ...BASE_OPTIONS,
      fetchImpl: (async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
        if (url.endsWith('/robots.txt') || url.endsWith('/llms.txt')) return new Response('', { status: 404 })
        return new Response('<html><body><div id="root"></div><script>go()</script></body></html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        })
      }) as typeof fetch,
      renderFallback: {
        name: 'spy',
        isConfigured: () => true,
        render: async () => {
          renderSpy.called = true
          return { html: '<html><body><p>rendered</p></body></html>', finalUrl: 'https://example.com/' }
        },
      },
    })

    // The entitlement gate, not the content, is what decides. A free run has a
    // hard ceiling of zero paid fetches.
    expect(renderSpy.called).toBe(false)
    expect(report.chainOfCustody.renderMode).toBe('raw')
    // And the JS-only condition surfaces as a finding rather than being hidden.
    expect(report.access.jsOnlyContent).toBe(true)
    expect(report.withheldReason).toMatch(/do not execute JavaScript/i)
  })

  it('scores AI search crawler access but not training crawler access', async () => {
    const report = await runAudit(COMMA_URL, 'geo', { ...BASE_OPTIONS, crawl: false, fetchImpl: stubWithRobots() })

    const gptbot = report.access.crawlers.find((c) => c.token === 'GPTBot')!
    expect(gptbot.verdict).toBe('disallowed')
    expect(gptbot.scored).toBe(false)

    // GPTBot is blocked, but no AI *search* crawler is, so the factor is clean.
    const factor = report.breakdown.find((f) => f.id === 'access-crawlers')!
    expect(factor.detail).not.toMatch(/GPTBot/)
    expect(factor.status).toBe('good')
  })

  it('reports llms.txt without scoring it', async () => {
    const report = await runAudit(COMMA_URL, 'geo', { ...BASE_OPTIONS, crawl: false, fetchImpl: stubWithRobots() })
    expect(report.access.llmsTxt.present).toBe(false)
    expect(report.access.llmsTxt.copy).toMatch(/does not affect your score/i)

    const factor = report.breakdown.find((f) => f.id === 'access-crawlers')!
    expect(factor.detail).not.toMatch(/llms\.txt/i)
  })

  it('marks crawler access unverified when robots.txt is unreadable', async () => {
    const report = await runAudit(COMMA_URL, 'geo', {
      ...BASE_OPTIONS,
      crawl: false,
      fetchImpl: (async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
        if (url.endsWith('/robots.txt')) return new Response('', { status: 503 })
        if (url.endsWith('/llms.txt')) return new Response('', { status: 404 })
        return new Response(COMMA_HTML, { status: 200, headers: { 'content-type': 'text/html' } })
      }) as typeof fetch,
    })

    const factor = report.breakdown.find((f) => f.id === 'access-crawlers')!
    expect(factor.scored).toBe(false)
    expect(factor.status).toBe('unverified')
    expect(report.chainOfCustody.couldNotFetch.some((c) => c.url.endsWith('/robots.txt'))).toBe(true)
    expectInternallyConsistent(report)
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
