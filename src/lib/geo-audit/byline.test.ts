import { describe, expect, it } from 'vitest'
import { verifyByline } from './byline'
import { extractPage } from './extract'

const page = (body: string, ld = '') =>
  extractPage(
    `<!doctype html><html><head><title>Post</title>${ld}</head><body><main><article><h1>Post</h1>${body}</article></main></body></html>`,
    'https://acme.test/blog/post',
  )

describe('verifyByline (decision 17: a profile claim is an intention, the page is the evidence)', () => {
  it('returns nothing when the profile names no author', () => {
    expect(verifyByline(page('<p>Hello</p>'), null)).toBeNull()
    expect(verifyByline(page('<p>Hello</p>'), '  ')).toBeNull()
  })

  it('finds a visible byline in the page text, with the surrounding text as evidence', () => {
    const r = verifyByline(page('<p class="byline">By Michael  Jacobs · 5 min read</p><p>Body text.</p>'), 'Michael Jacobs')!
    expect(r.found).toBe(true)
    expect(r.evidence[0].kind).toBe('text')
    expect(r.evidence[0].snippet).toContain('Michael Jacobs')
    expect(r.evidence[0].url).toBe('https://acme.test/blog/post')
  })

  it('finds a Person node in structured data', () => {
    const ld = '<script type="application/ld+json">{"@type":"Person","name":"Michael Jacobs"}</script>'
    const r = verifyByline(page('<p>Body only.</p>', ld), 'michael jacobs')!
    expect(r.found).toBe(true)
    expect(r.evidence.some((e) => e.kind === 'jsonld')).toBe(true)
  })

  it('reports a profile/page mismatch as a finding', () => {
    const r = verifyByline(page('<p>No author anywhere on this page.</p>'), 'Michael Jacobs')!
    expect(r.found).toBe(false)
    expect(r.evidence).toEqual([])
    expect(r.detail).toMatch(/names Michael Jacobs as the author, but no byline/)
    expect(r.detail).toMatch(/only what renders on the page is evidence/)
  })

  it('does not count a different person with a similar name', () => {
    expect(verifyByline(page('<p>By Michael Jackson</p>'), 'Michael Jacobs')!.found).toBe(false)
  })
})
