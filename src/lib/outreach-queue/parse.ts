/**
 * Parser for Documents\byline-queue.md, ported from the dashboard session's
 * build_dashboard.py so the seed reads the file exactly as the prototype did.
 * Used once to seed outreach_queue; the table is the source of truth after that.
 */

export interface QueuePart {
  label: string
  text: string
  /** "2/5" for thread parts. */
  part: string | null
  /** "connection note version" and similar alternates. */
  alt: string | null
  /** The count the file states, e.g. "(213 chars)". */
  statedChars: number | null
}

export interface ParsedItem {
  id: string
  type: string
  account: string
  platform: string
  target: string | null
  warning: string | null
  note: string | null
  restsOn: string | null
  engine: string | null
  status: string
  parts: QueuePart[]
}

const SKIP = new Set(['Byline action queue', 'Format contract', 'Counts', 'Deliberately excluded'])
const KEYS = ['type', 'account', 'platform', 'target', 'chars', 'warning', 'note', 'rests-on', 'engine', 'status']

const orNull = (v: string | undefined) => (v === undefined || v.trim().toLowerCase() === 'none' ? null : v.trim())

export function parseQueue(raw: string): ParsedItem[] {
  const lines = raw.replace(/\r\n/g, '\n').split('\n')
  type Cur = { id: string; keys: Record<string, string>; parts: QueuePart[] }
  const items: Cur[] = []
  let cur: Cur | null = null
  let mode: 'keys' | 'fence' | null = null
  let label = ''
  let buf: string[] = []

  for (const ln of lines) {
    const h2 = /^## (.+?)\s*$/.exec(ln)
    if (h2 && !SKIP.has(h2[1])) {
      if (cur) items.push(cur)
      cur = { id: h2[1], keys: {}, parts: [] }
      mode = 'keys'
      continue
    }
    if (!cur) continue

    if (mode === 'fence') {
      if (ln.trim() === '```') {
        cur.parts.push(makePart(label, buf.join('\n')))
        buf = []
        mode = 'keys'
      } else {
        buf.push(ln)
      }
      continue
    }

    const h3 = /^### (.+?)\s*$/.exec(ln)
    if (h3) {
      label = h3[1]
      continue
    }
    if (ln.trim() === '```text') {
      mode = 'fence'
      buf = []
      continue
    }
    const kv = /^- ([a-z-]+): (.*)$/.exec(ln)
    if (kv && KEYS.includes(kv[1])) cur.keys[kv[1]] = kv[2].trim()
  }
  if (cur) items.push(cur)

  return items.map((c) => ({
    id: c.id,
    type: c.keys.type ?? 'social post',
    account: c.keys.account ?? 'unknown',
    platform: c.keys.platform ?? 'unknown',
    target: orNull(c.keys.target),
    warning: orNull(c.keys.warning),
    note: orNull(c.keys.note),
    restsOn: orNull(c.keys['rests-on']),
    engine: orNull(c.keys.engine),
    status: c.keys.status ?? 'pending',
    parts: c.parts,
  }))
}

function makePart(label: string, text: string): QueuePart {
  const count = /\((\d+) chars\)/.exec(label)
  const part = /^text (\d+)\/(\d+)/.exec(label)
  const alt = /^text,\s*(.+)$/.exec(label)
  return {
    label,
    text,
    part: part ? `${part[1]}/${part[2]}` : null,
    alt: alt ? alt[1] : null,
    statedChars: count ? Number(count[1]) : null,
  }
}

/** X counts any link as 23 characters. */
export function xLength(text: string): number {
  return text.replace(/https?:\/\/\S+/g, 'x'.repeat(23)).length
}
