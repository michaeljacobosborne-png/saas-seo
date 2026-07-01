import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAccountInfo, escalateToMichael, logTicket, conversationSnippet } from '@/lib/support'
import type { SupportCategory, SupportPriority } from '@/lib/support-kb'

export const runtime = 'nodejs'

type Message = { role: 'user' | 'assistant'; content: string }

const CATEGORIES: SupportCategory[] = ['billing', 'technical', 'product', 'account']
const PRIORITIES: SupportPriority[] = ['p0', 'p1', 'p2', 'p3']

/**
 * Escalate a support conversation to Michael via Telegram and log an escalated ticket.
 * Used by the "talk to a human" widget action and reusable internally. Account info is
 * derived server-side; only the summary/conversation are taken from the client.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    summary?: string
    category?: string
    priority?: string
    reason?: string
    conversation?: Message[]
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const summary = (body.summary ?? '').toString().slice(0, 500) || 'User requested to speak with a human'
  const category = CATEGORIES.includes(body.category as SupportCategory)
    ? (body.category as SupportCategory)
    : 'account'
  const priority = PRIORITIES.includes(body.priority as SupportPriority)
    ? (body.priority as SupportPriority)
    : 'p1'
  const conversation = Array.isArray(body.conversation) ? body.conversation : []

  const account = await getAccountInfo(supabase, user)

  const { result, availability } = await escalateToMichael({
    account,
    category,
    priority,
    summary,
    conversationSnippet: conversation.length
      ? conversationSnippet(conversation)
      : summary,
    reason: body.reason?.toString().slice(0, 120) || 'Manual escalation',
  })

  await logTicket({
    userId: account.userId,
    email: account.email,
    issueSummary: summary,
    category,
    priority,
    status: 'escalated',
    conversation: conversation.length ? conversation : { summary, reason: body.reason ?? null },
  })

  return NextResponse.json({
    ok: true,
    delivered: result.ok,
    availability: availability.statusMessage,
  })
}
