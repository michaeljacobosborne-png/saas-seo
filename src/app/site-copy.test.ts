import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { organizationNode, PRODUCT_SUMMARY } from '@/lib/structured-data'

/**
 * What the public pages tell a reader or a scraper about the product (2026-11-25).
 * A prospecting tool read the live site and called Byline an "AI SEO content
 * writing platform": the structured data led with keyword research and content
 * generation, and several closing lines still sold drafts. These guard the pieces
 * that went stale.
 */
const ROOT = join(__dirname)
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|mdx?)$/.test(f) && !/\.test\./.test(f) ? [p] : []
  })
const files = walk(ROOT)
const read = (p: string) => readFileSync(p, 'utf8')

describe('public pages', () => {
  it('no page hardcodes a copyright year: it goes stale the day the year turns', () => {
    const offenders = files.filter((f) => /(©|&copy;)\s*20\d\d/.test(read(f)))
    expect(offenders).toEqual([])
  })

  // /audit is the content-gap tool: a draft is its natural next step, so it is left alone on purpose.
  it('the analyzer pages do not close by selling generated drafts as the paid product', () => {
    const offenders = files.filter((f) => /(geo-analyzer|ao-analyzer)/.test(f) && /sign up to generate a draft/i.test(read(f)))
    expect(offenders).toEqual([])
  })

  it('the homepage structured data does not say "free trial"', () => {
    expect(read(join(ROOT, 'page.tsx'))).not.toMatch(/Free trial available/)
  })

  it('the homepage workflow is no longer Research, Generate, Optimize', () => {
    const src = read(join(ROOT, 'page.tsx'))
    expect(src).not.toMatch(/Step 1: Research|Step 2: Generate|Step 3: Optimize|From keyword to scored draft/)
  })

  it('every copyright line names the legal entity, the same on every page', () => {
    // Pages and layouts only: the footer of a transactional email (api/audit/lead) is not a page.
    const lines = files.filter((f) => !/[\\/]api[\\/]|[\\/]lib[\\/]/.test(f)).flatMap((f) => (read(f).match(/(?:©|&copy;)[^<\n]*/g) ?? []).map((l) => [f, l] as const))
    expect(lines.length).toBeGreaterThan(5)
    const bad = lines.filter(([, l]) => !/getFullYear\(\)\} Peacock Creative Services LLC$/.test(l.trim()))
    expect(bad).toEqual([])
  })
})

describe('what the homepage structured data says Byline is', () => {
  const src = read(join(ROOT, 'page.tsx'))
  const list = src.slice(src.indexOf('featureList: ['), src.indexOf(']', src.indexOf('featureList: [')))
  const features = [...list.matchAll(/'([^']+)'/g)].map((m) => m[1])

  it('leads with the crawler probe, scoring and monitoring; article drafting is bundled and last but one', () => {
    expect(features[0]).toMatch(/^Crawler access probe/)
    expect(features[1]).toMatch(/^Retrievable score/)
    expect(features[3]).toMatch(/^Daily crawler access checks/)
    const draft = features.findIndex((f) => /Article drafting/.test(f))
    expect(draft).toBeGreaterThan(features.findIndex((f) => /Daily crawler access/.test(f)))
    expect(features.slice(0, 5).join(' ')).not.toMatch(/keyword research|content generation|drafting/i)
  })

  it('the description does not make drafting articles part of what Byline is', () => {
    const desc = src.slice(src.indexOf('description: `${PRODUCT_SUMMARY}'), src.indexOf('offers:'))
    expect(desc).toContain('PRODUCT_SUMMARY')
    expect(desc).not.toMatch(/draft|article|keyword/i)
  })

  it('the Organization node carries the same one-sentence description', () => {
    expect(organizationNode().description).toBe(PRODUCT_SUMMARY)
    expect(PRODUCT_SUMMARY).toMatch(/^Byline requests a page as six AI crawlers and as an ordinary browser/)
  })

  it('the "six" is documented next to where it is written', () => {
    expect(read(join(ROOT, '..', 'lib', 'structured-data.ts'))).toMatch(/if the crawler set changes, change this number/)
    expect(src).toMatch(/must change if the crawler set does/)
  })
})
