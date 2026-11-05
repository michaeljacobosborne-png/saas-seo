/**
 * Put a plain LinkedIn connection request and its follow-up message into the
 * action queue as a linked pair, the OB-02 shape:
 *   RQ-nn  the request, no note, pending and due today
 *   OB-nn  the message, waiting until he accepts RQ-nn
 *
 *   npx tsx --env-file=.env.local scripts/add-connection.ts <connection.json> [--dry]
 *
 * Input: { name, target, requestNote, message, messageNote, restsOn? }
 * The message is held to LinkedIn's 200 characters. Never sends anything.
 */
import { readFileSync } from 'node:fs'

const MAX = 200

interface Connection {
  name: string
  target: string
  requestNote: string
  message: string
  messageNote: string
  restsOn?: string | null
}

async function main() {
  const [file] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  if (!file) throw new Error('Usage: add-connection.ts <connection.json> [--dry]')
  const c = JSON.parse(readFileSync(file, 'utf8')) as Connection
  if (!c.name || !c.target || !c.message) throw new Error('missing name, target or message')
  if (c.message.length > MAX) throw new Error(`message is ${c.message.length}/${MAX}`)
  if (/—|–|!/.test(c.message)) throw new Error('dash or exclamation mark in the message')

  const { createServiceClient } = await import('../src/lib/supabase/service')
  const db = createServiceClient()
  const { data: ids, error: e0 } = await db.from('outreach_queue').select('id').or('id.like.RQ-%,id.like.OB-%')
  if (e0) throw new Error(e0.message)
  const n = String(Math.max(0, ...(ids ?? []).map((x) => Number(x.id.slice(3)) || 0)) + 1).padStart(2, '0')
  const rq = `RQ-${n}`
  const ob = `OB-${n}`
  console.log(`${rq} + ${ob}, message ${c.message.length}/${MAX}`)
  if (process.argv.includes('--dry')) return

  const now = new Date().toISOString()
  const base = {
    type: 'outbound message',
    account: 'Founder, Michael Jacobs',
    platform: 'LinkedIn',
    target: c.target,
    rests_on: c.restsOn ?? null,
    engine: 'n/a',
    priority: 1,
    needs_rerun: false,
    created_at: now,
    updated_at: now,
  }
  const { error: e1 } = await db.from('outreach_queue').insert({
    ...base,
    id: rq,
    parts: [{ label: 'text', text: `Connection request to ${c.name}. No note: send it plain.`, part: null, alt: null, statedChars: null }],
    warning: 'No note. The free account has used its custom notes for the month.',
    note: c.requestNote,
    status: 'pending',
    due_date: now.slice(0, 10),
    after_ids: [],
  })
  if (e1) throw new Error(`${rq}: ${e1.message}`)
  const { error: e2 } = await db.from('outreach_queue').insert({
    ...base,
    id: ob,
    parts: [{ label: 'text, message after he accepts', text: c.message, part: null, alt: 'message after he accepts', statedChars: c.message.length }],
    warning: `Send only after ${c.name} accepts ${rq}.`,
    note: c.messageNote,
    status: 'blocked',
    blocked_reason: `Waiting for ${c.name} to accept the connection request (${rq}).`,
    blocked_at: now,
    after_ids: [rq],
  })
  if (e2) throw new Error(`${ob}: ${e2.message}`)
  console.log(`${rq} pending, ${ob} waiting on it`)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
