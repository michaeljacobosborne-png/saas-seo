import { describe, expect, it } from 'vitest'
import { brandMergers } from './brand-merge'
import { brandFromTitle, onboardingAccess, parseSuggestions, readIdentity } from './brand-derive'
import { extractPage } from '@/lib/geo-audit/extract'
import type { CrawlerAccessReport, CrawlerProbe } from '@/lib/geo-audit/crawler-access'

describe('brandMergers — form saves', () => {
  const prev = { industry: 'SaaS', competitors: ['A', 'B'], tone_examples: 'kept' }
  const { mergeStr, mergeArr } = brandMergers(prev, false)

  it('clears a field the user emptied (the residual merge defect)', () => {
    expect(mergeStr('', 'industry')).toBeNull()
    expect(mergeStr('   ', 'industry')).toBeNull()
    expect(mergeArr([], 'competitors')).toEqual([])
  })

  it('keeps a field the form did not send', () => {
    expect(mergeStr(undefined, 'tone_examples')).toBe('kept')
    expect(mergeArr(undefined, 'competitors')).toEqual(['A', 'B'])
  })

  it('writes new values, trimmed and de-duplicated', () => {
    expect(mergeStr(' Fintech ', 'industry')).toBe('Fintech')
    expect(mergeArr(['x', ' x ', '', 'y'], 'competitors')).toEqual(['x', 'y'])
  })
})

describe('brandMergers — agent saves keep the data-loss fix', () => {
  const prev = { industry: 'SaaS', competitors: ['A'] }
  const { mergeStr, mergeArr } = brandMergers(prev, true)

  it('treats an empty value as "not collected", never as a clear', () => {
    expect(mergeStr('', 'industry')).toBe('SaaS')
    expect(mergeArr([], 'competitors')).toEqual(['A'])
  })
})

describe('brandFromTitle', () => {
  it('prefers the segment that matches the domain', () => {
    expect(brandFromTitle('Content that ranks | Byline', 'https://bylineseo.com')).toBe('Byline')
    expect(brandFromTitle('Acme — Payroll for small teams', 'https://www.acme.io')).toBe('Acme')
  })
  it('falls back to the shortest segment', () => {
    expect(brandFromTitle('Home - Northwind Traders', 'https://nw-t.com')).toBe('Home')
  })
})

const HTML = `<!doctype html><html lang="en"><head>
<title>Payroll for small teams | Acme</title>
<meta name="description" content="Acme runs payroll for teams of 5 to 50 people.">
<meta property="og:site_name" content="Acme Payroll">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Acme Inc."}</script>
</head><body><main><h1>Payroll that small teams finish in ten minutes</h1>
<p>${'Built for founders and office managers who run payroll themselves. '.repeat(12)}</p></main></body></html>`

describe('readIdentity', () => {
  const page = extractPage(HTML, 'https://acme.io/')

  it('reads the name from structured data first, with evidence', () => {
    const id = readIdentity(page, HTML, 'https://acme.io/')
    expect(id.brand_name).toMatchObject({ value: 'Acme Inc.', source: 'json-ld', suggested: false })
    expect(id.website_url.value).toBe('https://acme.io')
    expect(id.description?.value).toContain('teams of 5 to 50')
  })
})

describe('parseSuggestions', () => {
  const page = extractPage(HTML, 'https://acme.io/')

  it('keeps a quote as evidence only when it is actually on the page', () => {
    const raw = JSON.stringify({
      industry: { value: 'Payroll software', quote: 'Payroll for small teams' },
      target_audience: { value: 'Founders and office managers', quote: 'founders and office managers who run payroll' },
      tone_notes: { value: 'Plain and direct', quote: 'we are the leading enterprise HR suite' },
      content_goals: { value: '', quote: '' },
      primary_keywords: ['Small Business Payroll', 'payroll software', 'payroll software'],
    })
    const s = parseSuggestions(`Here you go:\n${raw}`, page)
    expect(s.industry).toMatchObject({ value: 'Payroll software', suggested: true, evidence: 'Payroll for small teams' })
    expect(s.target_audience?.evidence).toBeTruthy()
    expect(s.tone_notes).toMatchObject({ value: 'Plain and direct', evidence: null })
    expect(s.content_goals).toBeNull()
    expect(s.primary_keywords?.value).toEqual(['small business payroll', 'payroll software'])
  })

  it('returns nothing on garbage', () => {
    expect(parseSuggestions('no json here', page).industry).toBeNull()
  })
})

function probe(over: Partial<CrawlerProbe>): CrawlerProbe {
  return {
    token: 'OAI-SearchBot', label: 'OAI-SearchBot', vendor: 'OpenAI', class: 'ai-search', docs: '', userAgent: '',
    status: 200, contentServed: true, bytes: 1000, bytesTruncated: false, blockKind: 'none', evidence: '',
    edgeVendor: null, robotsVerdict: 'allowed', divergence: null, attributable: true, ms: 10, ...over,
  }
}

function report(probes: CrawlerProbe[], baselineFailed = false): CrawlerAccessReport {
  return {
    url: 'https://acme.io/', checkedAt: '2026-09-30T00:00:00.000Z',
    baseline: { status: baselineFailed ? 403 : 200, contentServed: !baselineFailed, bytes: 1, ms: 1 },
    probes, baselineFailed, caveats: ['caveat'],
  }
}

describe('onboardingAccess', () => {
  it('shows AI search crawlers only, as facts', () => {
    const a = onboardingAccess(report([
      probe({ token: 'OAI-SearchBot' }),
      probe({ token: 'PerplexityBot', status: 403, contentServed: false, blockKind: 'edge-block', evidence: 'cf-ray' }),
      probe({ token: 'GPTBot', class: 'training', status: 403, contentServed: false, blockKind: 'edge-block' }),
    ]))
    expect(a.rows.map((r) => [r.token, r.state])).toEqual([['OAI-SearchBot', 'served'], ['PerplexityBot', 'refused']])
    expect(a.headline).toBe('1 of 2 AI search crawlers we tested were served your homepage.')
    expect(a.rows[1].evidence).toContain('HTTP 403')
  })

  it('reports unknown, never refused, when the baseline also failed', () => {
    const a = onboardingAccess(report([probe({ status: 403, contentServed: false, blockKind: 'edge-block' })], true))
    expect(a.rows[0].state).toBe('unknown')
    expect(a.headline).toMatch(/unknown/)
  })

  it('never claims visibility or citation', () => {
    const a = onboardingAccess(report([probe({})]))
    expect(`${a.headline} ${a.rows.map((r) => r.evidence).join(' ')}`).not.toMatch(/cite|citation|visib|rank|appear/i)
  })
})
