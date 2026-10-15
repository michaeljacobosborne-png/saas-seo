import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { extractPage } from '@/lib/geo-audit/extract'
import { scoreRetrievability } from '@/lib/geo-audit/score-retrievability'

// The image builder needs Sanity env; tables never touch it.
vi.mock('@/sanity/lib/image', () => ({ urlFor: () => ({ width: () => ({ fit: () => ({ auto: () => ({ url: () => '' }) }) }) }) }))

const { PortableTextBody, withoutBodyH1 } = await import('./PortableTextBody')

const TABLE = {
  _type: 'table',
  _key: 't1',
  caption: 'What to check in a draft',
  header: ['Criterion', 'Why it matters'],
  rows: [
    { _type: 'tableRow', _key: 'r1', cells: ['Direct answer', 'Engines lift the opening'] },
    { _type: 'tableRow', _key: 'r2', cells: ['Question headings', 'They match the query'] },
  ],
}

describe('the blog table renderer', () => {
  const html = renderToStaticMarkup(<PortableTextBody value={[TABLE] as never} />)

  it('emits semantic table markup, not a div grid', () => {
    expect(html).toMatch(/<table[\s>]/)
    expect(html).toContain('<caption')
    expect(html).toMatch(/<thead[^>]*><tr><th scope="col"/)
    expect(html).toContain('<tbody>')
    expect((html.match(/<th /g) ?? []).length).toBe(2)
    expect((html.match(/<td /g) ?? []).length).toBe(4)
  })

  it('is detected and credited by our own engine under extractability', () => {
    const page = extractPage(`<!doctype html><html><body><main><article>${html}</article></main></body></html>`, 'https://www.bylineseo.com/blog/x')
    expect(page.tables).toHaveLength(1)
    expect(page.tables[0].headerCells).toEqual(['Criterion', 'Why it matters'])
    const density = scoreRetrievability({ home: page, access: null, now: new Date('2026-10-05T00:00:00Z'), contentReadable: true })
      .groups.flatMap((g) => g.checks)
      .find((c) => c.id === 'extract-density')!
    expect(density.detail).toMatch(/1 table\(s\) present comparable values side by side/)
  })

  it('drops a doubled body H1 for existing posts', () => {
    const blocks = [{ _type: 'block', style: 'h1', _key: 'a', children: [] }, { _type: 'block', style: 'normal', _key: 'b', children: [] }]
    expect(withoutBodyH1(blocks as never).map((b) => b._key)).toEqual(['b'])
  })
})
