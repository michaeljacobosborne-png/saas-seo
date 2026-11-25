import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

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
})
