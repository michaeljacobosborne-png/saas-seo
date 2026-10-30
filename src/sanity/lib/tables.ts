/**
 * Markdown tables → the post body's `table` object (docs/DECISIONS.md 30).
 *
 * `marked` renders a GFM table as <table>, but Portable Text's htmlToBlocks has
 * no table type and flattens it into paragraphs. The drafting pipeline therefore
 * lifts each table out before conversion, leaves a placeholder paragraph, and
 * swaps the structured block back in afterwards, the same way FAQs are handled.
 *
 * Pure, given a DOM parser, so it is tested without Sanity.
 */
export interface TableRow {
  _type: 'tableRow'
  _key: string
  cells: string[]
}

export interface TableBlock {
  _type: 'table'
  _key: string
  caption?: string
  header: string[]
  rows: TableRow[]
}

export const TABLE_PLACEHOLDER = 'BYLINETABLEPLACEHOLDER'

const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()

/**
 * Replace every top-level <table> in `html` with a placeholder paragraph and
 * return the tables as blocks. Warnings name what plain-text cells cannot keep.
 */
export function extractTables(
  html: string,
  parse: (html: string) => Document,
  key: () => string,
): { html: string; tables: TableBlock[]; warnings: string[] } {
  const doc = parse(`<body>${html}</body>`)
  const tables: TableBlock[] = []
  const warnings: string[] = []

  doc.body.querySelectorAll('table').forEach((table) => {
    const allRows = Array.from(table.querySelectorAll('tr'))
    const headRow = table.querySelector('thead tr') ?? allRows[0]
    const header = Array.from(headRow?.querySelectorAll('th,td') ?? []).map(text)
    const rows = allRows
      .filter((r) => r !== headRow)
      .map((r) => {
        const cells = Array.from(r.querySelectorAll('th,td')).map(text)
        while (cells.length < header.length) cells.push('')
        return { _type: 'tableRow' as const, _key: key(), cells: cells.slice(0, header.length) }
      })
    if (table.querySelector('a,strong,em,code')) {
      warnings.push(`Table ${tables.length + 1}: links and inline formatting inside cells are kept as plain text.`)
    }
    const caption = text(table.querySelector('caption'))
    tables.push({ _type: 'table', _key: key(), ...(caption ? { caption } : {}), header, rows })

    const p = doc.createElement('p')
    p.textContent = `${TABLE_PLACEHOLDER}${tables.length - 1}`
    table.replaceWith(p)
  })

  return { html: doc.body.innerHTML, tables, warnings }
}

/** Swap placeholder paragraphs back for the table blocks; returns the indices placed. */
export function reinsertTables(blocks: unknown[], tables: TableBlock[]): { blocks: unknown[]; placed: Set<number> } {
  const placed = new Set<number>()
  const out = blocks.map((block) => {
    const b = block as { _type?: string; children?: { text?: string }[] }
    if (b._type !== 'block' || !Array.isArray(b.children)) return block
    const hit = new RegExp(`^${TABLE_PLACEHOLDER}(\\d+)$`).exec(b.children.map((c) => c.text ?? '').join('').trim())
    const table = hit ? tables[Number(hit[1])] : undefined
    if (!table) return block
    placed.add(Number(hit![1]))
    return table
  })
  return { blocks: out, placed }
}
