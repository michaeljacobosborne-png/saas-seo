/**
 * Put a drafted reply into the action queue, so Michael can copy it from the
 * phone page rather than out of chat.
 *
 *   npx tsx --env-file=.env.local scripts/add-reply.ts <reply.json> [--dry]
 *
 * Input: { platform, target, text, note, restsOn?, warning? }
 * Becomes a pending reply item (RE-nn, next free number), due today. Replies
 * sort to the top of the today list and are never held by a cap (today.ts).
 * Never posts anything anywhere.
 */
import { readFileSync } from 'node:fs'

interface Reply {
  platform: 'LinkedIn' | 'X'
  target: string
  text: string
  note: string
  restsOn?: string | null
  warning?: string | null
}

async function main() {
  const [file] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  if (!file) throw new Error('Usage: add-reply.ts <reply.json> [--dry]')
  const r = JSON.parse(readFileSync(file, 'utf8')) as Reply
  const problems: string[] = []
  if (!r.target || !r.text || !r.platform) problems.push('missing platform, target or text')
  if (/—|–/.test(r.text)) problems.push('em or en dash')
  if (r.platform === 'X' && r.text.length > 280) problems.push(`X reply is ${r.text.length} characters`)
  if (problems.length) throw new Error(problems.join('; '))

  const { createServiceClient } = await import('../src/lib/supabase/service')
  const db = createServiceClient()
  const { data: ids, error: e0 } = await db.from('outreach_queue').select('id').like('id', 'RE-%')
  if (e0) throw new Error(e0.message)
  const id = `RE-${String(Math.max(0, ...(ids ?? []).map((x) => Number(x.id.slice(3)) || 0)) + 1).padStart(2, '0')}`
  console.log(`${id} ${r.platform} ${r.text.length} characters`)
  if (process.argv.includes('--dry')) return

  const now = new Date()
  const { error } = await db.from('outreach_queue').insert({
    id,
    type: 'reply',
    account: 'Founder, Michael Jacobs',
    platform: r.platform,
    target: r.target,
    parts: [{ label: 'text', text: r.text, part: null, alt: null, statedChars: r.text.length }],
    warning: r.warning ?? null,
    note: r.note,
    rests_on: r.restsOn ?? null,
    engine: 'n/a',
    status: 'pending',
    priority: 1,
    due_date: now.toISOString().slice(0, 10),
    after_ids: [],
    needs_rerun: false,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  })
  if (error) throw new Error(`${id}: ${error.message}`)
  console.log(`${id} inserted, pending`)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
