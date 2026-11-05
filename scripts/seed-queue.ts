/**
 * One-off: seed outreach_queue from Documents\byline-queue.md. After this the
 * table is the source of truth and /admin/today reads and writes it.
 *
 *   npx tsx scripts/seed-queue.ts [--dry]
 *
 * Inserts only ids that are not already in the table, so a re-run never
 * overwrites a status Michael has changed on the page.
 */
import { config } from 'dotenv'
import { readFileSync } from 'node:fs'

config({ path: '.env.local', quiet: true })
config({ path: 'C:/dev/Byline/.env.local', quiet: true })

const QUEUE = 'C:/Users/ozzy5/Documents/byline-queue.md'
const DONE_AT = '2026-10-21T09:00:00+03:00'

// Decided 2026-10-21 with Michael: what the file does not carry as data.
const DONE = new Set(['OB-01', 'F-L1', 'F-L2'])
const NEVER_SEED = new Set(['CM-05'])
const CLOSES_ON: Record<string, string> = { 'CM-06': '2026-10-28' }
const AFTER: Record<string, string[]> = {
  'F-X1': ['F-X2'],
  'F-X5': ['F-X2'],
  'F-X6': ['F-X2'],
  'F-X7': ['F-X6', 'F-L6', 'F-X2'],
  'F-X9': ['F-L5', 'F-X5'],
  'F-L5': ['F-L3'],
  'F-L6': ['F-L3'],
  'F-L7': ['F-L3', 'F-L4', 'F-L5', 'F-L6'],
  'B-X2': ['B-X1'],
  'B-X3': ['B-X1'],
  'B-X4': ['B-X1', 'F-L5'],
  'B-X5': ['B-X1'],
  'B-X6': ['B-X1', 'B-X2', 'B-X3', 'B-X4', 'B-X5'],
  'B-F4': ['B-F1', 'B-F2', 'B-F3'],
}
const OPENERS = new Set(['F-L3', 'F-X2', 'B-X1', 'B-F2', 'CM-02', 'CM-03', 'CM-04'])
const CLOSERS = new Set(['F-L7', 'B-X6', 'B-F4'])

function priority(id: string, warning: string | null): number {
  if (CLOSES_ON[id]) return 1
  if (CLOSERS.has(id)) return 5
  if (OPENERS.has(id)) return 2
  if (warning && /re-run/i.test(warning)) return 4
  return 3
}

function status(id: string, raw: string): string {
  if (DONE.has(id)) return 'done'
  const s = raw.split(/\s/)[0].toLowerCase()
  if (s === 'skipped') return 'withdrawn'
  return ['pending', 'done', 'withdrawn', 'superseded'].includes(s) ? s : 'pending'
}

async function main() {
  const dry = process.argv.includes('--dry')
  const { parseQueue } = await import('../src/lib/outreach-queue/parse')
  const items = parseQueue(readFileSync(QUEUE, 'utf8')).filter((i) => !NEVER_SEED.has(i.id))
  const base = Date.parse('2026-10-20T00:00:00Z')

  const rows = items.map((i, n) => {
    const st = status(i.id, i.status)
    return {
      id: i.id,
      type: i.type,
      account: i.account,
      platform: i.platform,
      target: i.target,
      parts: i.parts,
      note: i.note,
      warning: i.warning,
      rests_on: i.restsOn,
      engine: i.engine,
      status: st,
      closes_on: CLOSES_ON[i.id] ?? null,
      priority: priority(i.id, i.warning),
      after_ids: AFTER[i.id] ?? [],
      needs_rerun: !!i.warning && /re-run/i.test(i.warning),
      // File order, so ties sort the way the file reads.
      sort_order: n + 1,
      created_at: new Date(base + n * 1000).toISOString(),
      completed_at: st === 'done' ? DONE_AT : null,
    }
  })

  const ids = new Set(rows.map((r) => r.id))
  for (const [id, after] of Object.entries(AFTER)) {
    for (const a of [id, ...after]) if (!ids.has(a)) throw new Error(`Sequencing names ${a}, which is not in the queue file`)
  }

  const counts = new Map<string, number>()
  for (const r of rows) counts.set(`${r.type} | ${r.status}`, (counts.get(`${r.type} | ${r.status}`) ?? 0) + 1)
  console.log([...counts].sort().map(([k, v]) => `${k} | ${v}`).join('\n'))
  console.log(`total | ${rows.length}`)
  if (dry) return

  const { createServiceClient } = await import('../src/lib/supabase/service')
  const db = createServiceClient()
  const { data, error } = await db.from('outreach_queue').upsert(rows, { onConflict: 'id', ignoreDuplicates: true }).select('id')
  if (error) throw new Error(error.message)
  console.log(`inserted | ${data?.length ?? 0}`)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
