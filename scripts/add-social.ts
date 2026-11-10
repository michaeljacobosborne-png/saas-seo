/**
 * Put drafted social posts into the action queue (outreach_queue), so Michael
 * can copy them from the phone page. Never posts anything anywhere.
 *
 *   npx tsx --env-file=.env.local scripts/add-social.ts <posts.json> [--dry]
 *
 * Input: a JSON array of
 *   { account: "founder" | "brand", platform: "X" | "LinkedIn" | "Facebook",
 *     text, restsOn, note?, warning?, afterIds?: string[], dueDate?: "YYYY-MM-DD" }
 * A post promoting a blog article waits for it with afterIds ["blog:<slug>"].
 *
 * Refuses, writing nothing: em or en dashes, exclamation points, X over 280
 * (links count as 23), a link in a Facebook post body (DECISIONS 40).
 * Skips any post whose text is already queued. Ids are the next free number
 * per prefix, with no dash before it: F-X15, F-L14, B-X11, B-F8.
 */
import { readFileSync } from 'node:fs'
import { xLength } from '../src/lib/outreach-queue/parse'

interface Draft {
  account: 'founder' | 'brand'
  platform: 'X' | 'LinkedIn' | 'Facebook'
  text: string
  restsOn: string
  note?: string | null
  warning?: string | null
  afterIds?: string[]
  dueDate?: string | null
}

const ACCOUNT = { founder: 'Founder, Michael Jacobs', brand: 'Brand, Byline' }
const PREFIX = { founder: { X: 'F-X', LinkedIn: 'F-L', Facebook: 'F-F' }, brand: { X: 'B-X', LinkedIn: 'B-L', Facebook: 'B-F' } }
const TARGET = { founder: 'Founder, personal', brand: 'Brand, business' }
const LINK = /(https?:\/\/\S+|www\.[a-z0-9-]+\.\S+|\b[a-z0-9-]+\.(?:com|co\.uk|io|ai|org|net|dev)\b(?:\/\S*)?)/i

function problems(d: Draft): string[] {
  const out: string[] = []
  if (!ACCOUNT[d.account] || !['X', 'LinkedIn', 'Facebook'].includes(d.platform) || !d.text?.trim() || !d.restsOn) out.push('missing account, platform, text or restsOn')
  if (/[—–]/.test(d.text)) out.push('em or en dash')
  if (/!/.test(d.text)) out.push('exclamation point')
  if (d.platform === 'X' && xLength(d.text) > 280) out.push(`X post is ${xLength(d.text)}/280`)
  if (d.platform === 'Facebook' && LINK.test(d.text)) out.push('link in a Facebook post body (DECISIONS 40): put it in the first comment instead')
  return out
}

async function main() {
  const [file] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  if (!file) throw new Error('Usage: add-social.ts <posts.json> [--dry]')
  const drafts = JSON.parse(readFileSync(file, 'utf8')) as Draft[]
  let bad = 0
  for (const d of drafts) {
    const p = problems(d)
    const size = d.platform === 'X' ? `${xLength(d.text)}/280` : `${d.text.length}`
    console.log(`${PREFIX[d.account]?.[d.platform] ?? '?'} ${d.platform} ${size}${p.length ? `  REFUSED: ${p.join('; ')}` : ''}`)
    if (p.length) bad++
  }
  if (bad) throw new Error(`${bad} post(s) refused; nothing written`)
  if (process.argv.includes('--dry')) return

  const { createServiceClient } = await import('../src/lib/supabase/service')
  const db = createServiceClient()
  const { data: existing, error: e0 } = await db.from('outreach_queue').select('id, parts').eq('type', 'social post')
  if (e0) throw new Error(e0.message)
  const have = new Set((existing ?? []).map((r) => String(r.parts?.[0]?.text ?? '')))
  const next = new Map<string, number>()
  for (const r of existing ?? []) {
    const m = /^([A-Z]-[A-Z])(\d+)$/.exec(r.id)
    if (m) next.set(m[1], Math.max(next.get(m[1]) ?? 0, Number(m[2])))
  }
  const now = new Date().toISOString()
  const rows = []
  for (const d of drafts) {
    if (have.has(d.text)) {
      console.log(`skip: already queued (${d.text.slice(0, 40)}...)`)
      continue
    }
    const prefix = PREFIX[d.account][d.platform]
    const n = (next.get(prefix) ?? 0) + 1
    next.set(prefix, n)
    rows.push({
      id: `${prefix}${n}`,
      type: 'social post',
      account: ACCOUNT[d.account],
      platform: d.platform,
      target: `${TARGET[d.account]} ${d.platform === 'Facebook' ? 'Facebook page' : d.platform}`,
      parts: [{ label: 'text', text: d.text, part: null, alt: null, statedChars: d.platform === 'X' ? xLength(d.text) : d.text.length }],
      warning: d.warning ?? null,
      note: d.note ?? null,
      rests_on: d.restsOn,
      engine: 'n/a',
      status: 'pending',
      priority: 3,
      after_ids: d.afterIds ?? [],
      due_date: d.dueDate ?? null,
      needs_rerun: false,
      created_at: now,
      updated_at: now,
    })
  }
  if (!rows.length) return
  const { data, error } = await db.from('outreach_queue').insert(rows).select('id')
  if (error) throw new Error(error.message)
  console.log(`inserted: ${(data ?? []).map((r) => r.id).join(', ')}`)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
