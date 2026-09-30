import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Marked } from 'marked'
import { describe, expect, it } from 'vitest'
import { adaptMarkdown, locateLine } from './adapt-markdown'
import { DRAFT_SCOPE, buildDraftReport } from './draft-report'
import { extractPage } from './extract'
import { findForbiddenClaims } from './gap'
import { scoreRetrievability } from './score-retrievability'
import { computeTotals } from './scoring'
import { MIN_ASSESSED_SHARE } from './types'

const NOW = new Date('2026-09-30T12:00:00Z')

const para = (topic: string) =>
  `${topic} is a practical discipline that content teams can measure. Acme tested it across 40 client sites in 2026 and found that 62% of pages lacked a direct answer in the first paragraph. The fix is usually structural rather than editorial, and it takes an afternoon.`

const MD = `# How to structure an article for AI answers

Answer engines lift self-contained passages. This guide shows how to write sections that stand alone when quoted.

## What is answer-first writing?

${para('Answer-first writing')}

## Why do headings matter?

${para('Heading hierarchy')}

### Use one H1

${para('A single H1')}

### Keep levels in order

${para('Ordered heading levels')}

## How long should a section be?

${para('Section length')}

- Aim for 40 to 180 words
- One idea per section
- Lead with the claim

## What should a table contain?

| Check | Target |
|---|---|
| H2 sections | 6+ |
| Section length | 40–180 words |

${para('A comparison table')}

## How do you add attribution?

${para('The Acme Attribution Method')}

### Name the source

${para('Named sourcing')}

## When should you update it?

${para('Freshness')}

## Where does this leave you?

${para('The Acme Attribution Method in practice')}

The Acme Attribution Method keeps claims tied to Acme. The Acme Attribution Method is simple.
`

describe('adaptMarkdown — equivalence with the live extractor (spec §2.5)', () => {
  it('scores Chunkability and Extractability the same as the equivalent HTML page', () => {
    const { page: fromDraft } = adaptMarkdown(MD, { articleId: 'a1', title: 'How to structure an article for AI answers' })

    // The same content, hand-written as the HTML a template would publish.
    const html = `<!doctype html><html><head><title>t</title></head><body><main><article>${
      MD.split('\n\n')
        .map((b) => {
          const t = b.trim()
          if (t.startsWith('### ')) return `<h3>${t.slice(4)}</h3>`
          if (t.startsWith('## ')) return `<h2>${t.slice(3)}</h2>`
          if (t.startsWith('# ')) return `<h1>${t.slice(2)}</h1>`
          if (t.startsWith('- ')) return `<ul>${t.split('\n').map((l) => `<li>${l.slice(2)}</li>`).join('')}</ul>`
          if (t.startsWith('|')) {
            const rows = t.split('\n').filter((l) => !/^\|-/.test(l)).map((l) => l.split('|').slice(1, -1).map((c) => c.trim()))
            return `<table><thead><tr>${rows[0].map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.slice(1).map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`
          }
          return `<p>${t}</p>`
        })
        .join('\n')
    }</article></main></body></html>`
    const fromHtml = extractPage(html, 'https://acme.test/post')

    const score = (home: typeof fromHtml) => {
      const r = scoreRetrievability({ home, access: null, now: NOW })
      return Object.fromEntries(
        r.groups.filter((g) => g.id === 'chunkability' || g.id === 'extractability').flatMap((g) => g.checks.map((c) => [c.id, c.score])),
      )
    }
    expect(score(fromDraft)).toEqual(score(fromHtml))
  })

  it('blanks publication-layer fields and uses a draft: evidence URL', () => {
    const { page } = adaptMarkdown(MD, { articleId: 'a1' })
    expect(page.url).toBe('draft:a1')
    expect(page.canonical).toBe('')
    expect(page.metaDescription).toBe('')
    expect(page.structuredData).toEqual([])
    expect(page.jsonLdBlocks).toEqual([])
  })

  it('drops raw HTML, including injected JSON-LD, and counts it', () => {
    const md = `${MD}\n<div class="x">embedded</div>\n\n<script type="application/ld+json">{"@type":"Organization","name":"Fake"}</script>\n`
    const { page, rawHtmlBlocks } = adaptMarkdown(md, { articleId: 'a1' })
    expect(rawHtmlBlocks).toBeGreaterThanOrEqual(2)
    expect(page.structuredDataTypes).toEqual([])
    expect(page.mainText).not.toContain('embedded')
  })

  it('reads editor-saved HTML (TipTap autosave) instead of dropping it', () => {
    const md = adaptMarkdown(MD, { articleId: 'a1' }).page
    const html = adaptMarkdown(new Marked().parse(MD, { async: false }) as string, { articleId: 'a1' })
    expect(html.rawHtmlBlocks).toBe(0)
    expect(html.page.wordCount).toBe(md.wordCount)
    expect(html.page.headings).toEqual(md.headings)
    // Structured data injected via saved HTML is still a template concern.
    const withLd = adaptMarkdown(`<p>x</p><script type="application/ld+json">{"@type":"Organization","name":"F"}</script>`, { articleId: 'a' })
    expect(withLd.page.structuredDataTypes).toEqual([])
  })

  it('uses the article title as the H1 only when the draft has none', () => {
    const noH1 = MD.replace(/^# .*\n/, '')
    expect(adaptMarkdown(noH1, { articleId: 'a', title: 'Title' }).h1FromTitle).toBe(true)
    expect(adaptMarkdown(MD, { articleId: 'a', title: 'Title' }).h1FromTitle).toBe(false)
  })
})

describe('buildDraftReport — the draft-time denominator', () => {
  const report = buildDraftReport({ markdown: MD, articleId: 'a1', title: 'T', brandName: 'Acme', now: NOW })

  it('leaves MIN_ASSESSED_SHARE at 0.6', () => {
    expect(MIN_ASSESSED_SHARE).toBe(0.6)
  })

  it('scores over 45 points, not 100, so a real draft is not withheld', () => {
    expect(report.retrievability.draftMaxScore).toBe(45)
    expect(report.retrievability.totalMaxScore).toBe(100)
    expect(report.retrievability.scoreWithheld).toBe(false)
    expect(report.retrievability.score).toBeGreaterThan(0)
    expect(report.retrievability.score).toBe(Math.round((report.retrievability.rawScore / report.retrievability.assessedMaxScore) * 100))
  })

  it('would be withheld on every draft through the live denominator — the reason the draft one exists', () => {
    // The same draft checks, totalled over the live 100-point scale.
    const live = computeTotals(report.retrievability.groups.flatMap((g) => g.checks))
    expect(live.assessedMaxScore / live.totalMaxScore).toBeLessThan(MIN_ASSESSED_SHARE)
    expect(live.scoreWithheld).toBe(true)
  })

  it('marks Access and Parseability unverified and excludes them — never scores the markdown text ratio', () => {
    for (const id of ['access', 'parseability'] as const) {
      const g = report.retrievability.groups.find((x) => x.id === id)!
      expect(g.scored).toBe(false)
      expect(g.checks.every((c) => c.state === 'unverified' && !c.scored && c.score === 0)).toBe(true)
    }
    expect(report.afterPublication.map((a) => a.id)).toEqual(
      expect.arrayContaining(['access-crawlers', 'parse-server-text', 'parse-structured-data', 'named-authorship']),
    )
  })

  it('still withholds a draft too thin to assess, inside the draft denominator', () => {
    const thin = buildDraftReport({ markdown: '## Hello\n\nShort.', articleId: 'a2', now: NOW })
    expect(thin.retrievability.scoreWithheld).toBe(true)
    expect(thin.retrievability.score).toBe(0)
    expect(thin.gap.quadrant).toBe('indeterminate')
  })

  it('assesses the three writer-controlled citability signals and leaves template ones unverified', () => {
    const byId = Object.fromEntries(report.citability.signals.map((s) => [s.id, s.band]))
    expect(byId['named-authorship']).toBe('unverified')
    expect(byId['entity-resolution']).toBe('unverified')
    expect(byId['freshness-provenance']).toBe('unverified')
    expect(byId['brand-proximity']).not.toBe('unverified')
    expect(byId['original-evidence']).not.toBe('unverified')
    expect(byId['proprietary-terms']).not.toBe('unverified')
  })

  it('does not blame page chrome when the brand is missing from a draft', () => {
    const r = buildDraftReport({ markdown: MD.replace(/Acme/g, 'Example'), articleId: 'a1', brandName: 'Zenith', now: NOW })
    const s = r.citability.signals.find((x) => x.id === 'brand-proximity')!
    expect(s.band).toBe('absent')
    expect(s.detail).not.toMatch(/chrome/)
  })

  it('reports brand proximity as unverified, not absent, without a brand name', () => {
    const r = buildDraftReport({ markdown: MD, articleId: 'a1', now: NOW })
    expect(r.citability.signals.find((s) => s.id === 'brand-proximity')?.band).toBe('unverified')
  })

  it('puts evidence on every scored finding, with a draft URL and line numbers', () => {
    const scored = report.retrievability.groups.flatMap((g) => g.checks).filter((c) => c.scored && c.score > 0)
    expect(scored.length).toBeGreaterThan(0)
    const withEvidence = scored.filter((c) => c.evidence.length > 0)
    expect(withEvidence.length).toBeGreaterThan(0)
    for (const c of withEvidence) for (const e of c.evidence) expect(e.url).toBe('draft:a1')
    expect(scored.flatMap((c) => c.evidence).some((e) => /^L\d+ · /.test(e.snippet))).toBe(true)
  })

  it('never claims AI visibility, citation or a guarantee', () => {
    const text = JSON.stringify(report)
    expect(findForbiddenClaims(text)).toEqual([])
    expect(DRAFT_SCOPE).toMatch(/not a measurement of whether any AI system retrieves or cites/)
  })

  it('makes no model call: the scoring path imports no model SDK', () => {
    const src = ['draft-report.ts', 'adapt-markdown.ts'].map((f) => readFileSync(join(__dirname, f), 'utf8')).join('\n')
    expect(src).not.toMatch(/@anthropic-ai|openai|narrate/)
  })
})

describe('locateLine', () => {
  it('finds the markdown line for a snippet, or returns null rather than guessing', () => {
    expect(locateLine(MD, 'Why do headings matter?')).toBe(9)
    expect(locateLine(MD, 'nothing like this appears')).toBeNull()
  })
})
