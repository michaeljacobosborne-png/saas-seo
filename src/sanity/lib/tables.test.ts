import { JSDOM } from 'jsdom'
import { marked } from 'marked'
import { describe, expect, it } from 'vitest'
import { extractTables, reinsertTables, TABLE_PLACEHOLDER } from './tables'

const parse = (h: string) => new JSDOM(h).window.document
let n = 0
const key = () => `k${n++}`

const MD = `Intro paragraph.

| Criterion | Why it matters | How to check |
|---|---|---|
| Direct answer | Engines lift the opening | First paragraph under 300 characters |
| **Question headings** | Match the query | [See guide](https://example.com) |

After the table.`

describe('markdown tables become table blocks', () => {
  const html = marked.parse(MD, { async: false, gfm: true }) as string
  const out = extractTables(html, parse, key)

  it('lifts the table with its header row and data rows', () => {
    expect(out.tables).toHaveLength(1)
    expect(out.tables[0].header).toEqual(['Criterion', 'Why it matters', 'How to check'])
    expect(out.tables[0].rows.map((r) => r.cells)).toEqual([
      ['Direct answer', 'Engines lift the opening', 'First paragraph under 300 characters'],
      ['Question headings', 'Match the query', 'See guide'],
    ])
  })

  it('leaves a placeholder where the table was and warns about lost inline formatting', () => {
    expect(out.html).toContain(`${TABLE_PLACEHOLDER}0`)
    expect(out.html).not.toContain('<table')
    expect(out.warnings[0]).toMatch(/plain text/)
  })

  it('puts the block back in place of its placeholder', () => {
    const blocks = [
      { _type: 'block', children: [{ text: 'Intro paragraph.' }] },
      { _type: 'block', children: [{ text: `${TABLE_PLACEHOLDER}0` }] },
    ]
    const { blocks: placedBlocks, placed } = reinsertTables(blocks, out.tables)
    expect(placed.has(0)).toBe(true)
    expect((placedBlocks[1] as { _type: string })._type).toBe('table')
  })

  it('pads short rows and trims long ones to the header width', () => {
    const t = extractTables('<table><tr><th>A</th><th>B</th></tr><tr><td>1</td></tr><tr><td>1</td><td>2</td><td>3</td></tr></table>', parse, key)
    expect(t.tables[0].rows.map((r) => r.cells)).toEqual([['1', ''], ['1', '2']])
  })
})
