import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractPage } from './extract'
import { assessCitability } from './assess-citability'
import type { KeyPageResult } from './crawl'

/**
 * The freshness date often comes from the blog page, and its evidence was
 * labelled with the home URL (app.bylineseo.com, 2026-10-08). Both fixtures are
 * our own live pages, fetched 2026-10-26.
 */

const fixture = (name: string) => readFileSync(join(__dirname, '__fixtures__', name), 'utf8')
const HOME_URL = 'https://app.bylineseo.com/'
const BLOG_URL = 'https://app.bylineseo.com/blog'
const home = extractPage(fixture('bylineseo-home-2026-10-26.html'), HOME_URL)
const blogPage = extractPage(fixture('bylineseo-blog-2026-10-26.html'), BLOG_URL)
const blog: KeyPageResult = { role: 'blog', url: BLOG_URL, linkText: 'Blog', page: blogPage, ok: true, status: 200 }
const NOW = new Date('2026-10-26T12:00:00Z')

const freshness = () =>
  assessCitability({ home, keyPages: [blog], now: NOW }).signals.find((s) => s.id === 'freshness-provenance')!

describe('freshness evidence names the page the date came from', () => {
  it('reads the newest date from the blog page', () => {
    const newestHome = Math.max(0, ...home.dates.map((d) => d.time))
    const newestBlog = Math.max(...blogPage.dates.map((d) => d.time))
    expect(newestBlog).toBeGreaterThan(newestHome)
  })

  it('labels that date with the blog URL, not the home URL', () => {
    const s = freshness()
    const date = s.evidence.find((e) => e.kind === 'date')!
    expect(date.url).toBe(BLOG_URL)
    expect(s.detail).toContain(`on the blog page, ${BLOG_URL}`)
  })

  it('still labels a home page date with the home URL', () => {
    const s = assessCitability({ home: blogPage, keyPages: [], now: NOW }).signals.find((x) => x.id === 'freshness-provenance')!
    const date = s.evidence.find((e) => e.kind === 'date')!
    expect(date.url).toBe(BLOG_URL)
    expect(s.detail).not.toContain('on the blog page')
  })
})
