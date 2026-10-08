// Shared server-side logic for the customer-support agent:
// account-info derivation, Telegram escalation formatting, and ticket logging.
//
// SECURITY: account info is ALWAYS derived server-side from the authenticated session
// and the subscriptions/profiles tables — never trusted from the client. The client only
// supplies the conversation messages.

import { createServiceClient } from '@/lib/supabase/service'
import { sendTelegramMessage, escapeMarkdown } from '@/lib/telegram'
import { getAvailability } from '@/lib/availability'

export const REFUND_WINDOW_DAYS = 30

export interface AccountInfo {
  userId: string
  email: string | null
  plan: string | null // raw DB value: starter | pro | agency
  planLabel: string // display: Starter | Growth | Team | Free | None
  status: string | null
  accountType: string | null // free | (null for paid)
  subscriptionId: string | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  subscriptionStartDate: string | null // ISO
  subscriptionAgeDays: number | null
  withinRefundWindow: boolean
  cancelAtPeriodEnd: boolean
  currentPeriodEnd: string | null
}

export function planLabel(plan?: string | null): string {
  switch (plan) {
    case 'starter':
      return 'Starter'
    case 'pro':
      return 'Growth'
    case 'agency':
      return 'Team'
    default:
      return 'None'
  }
}

interface AuthedUser {
  id: string
  email?: string | null
}

/**
 * Build the authoritative account snapshot for a user from Supabase.
 * `supabase` is the request-scoped (RLS) client; reads are limited to the user's own rows.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getAccountInfo(supabase: any, user: AuthedUser): Promise<AccountInfo> {
  const [{ data: sub }, { data: profile }] = await Promise.all([
    supabase
      .from('subscriptions')
      .select(
        'id, plan, status, stripe_customer_id, stripe_subscription_id, current_period_end, cancel_at_period_end, created_at'
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('profiles').select('account_type').eq('user_id', user.id).maybeSingle(),
  ])

  const startDate: string | null = sub?.created_at ?? null
  let ageDays: number | null = null
  if (startDate) {
    const ms = Date.now() - new Date(startDate).getTime()
    ageDays = Math.floor(ms / (1000 * 60 * 60 * 24))
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    plan: sub?.plan ?? null,
    planLabel: sub?.plan ? planLabel(sub.plan) : profile?.account_type === 'free' ? 'Free' : 'None',
    status: sub?.status ?? null,
    accountType: profile?.account_type ?? null,
    subscriptionId: sub?.id ?? null,
    stripeCustomerId: sub?.stripe_customer_id ?? null,
    stripeSubscriptionId: sub?.stripe_subscription_id ?? null,
    subscriptionStartDate: startDate,
    subscriptionAgeDays: ageDays,
    withinRefundWindow: ageDays != null && ageDays <= REFUND_WINDOW_DAYS,
    cancelAtPeriodEnd: !!sub?.cancel_at_period_end,
    currentPeriodEnd: sub?.current_period_end ?? null,
  }
}

export interface EscalationInput {
  account: AccountInfo
  category: string
  priority: string
  summary: string
  conversationSnippet: string
  /** Short reason label, e.g. "Refund request" or "P0 — data loss". */
  reason?: string
}

/**
 * Format and send an escalation to Michael's Telegram. Returns the Telegram result and the
 * customer-facing availability line (which the caller appends to the user's confirmation).
 */
export async function escalateToMichael(input: EscalationInput) {
  const { account, category, priority, summary, conversationSnippet, reason } = input
  const availability = getAvailability()

  const lines = [
    '🚨 *Byline Support Escalation*',
    reason ? `*Reason:* ${escapeMarkdown(reason)}` : '',
    `*Priority:* ${String(priority).toUpperCase()}`,
    `*Category:* ${escapeMarkdown(category)}`,
    `*User:* ${escapeMarkdown(account.email ?? 'unknown')}`,
    `*Plan:* ${account.planLabel}${account.status ? ` (${account.status})` : ''}`,
    `*Subscription age:* ${
      account.subscriptionAgeDays != null ? `${account.subscriptionAgeDays} days` : 'n/a'
    }${account.withinRefundWindow ? ' — WITHIN 30-day MBG window' : account.subscriptionAgeDays != null ? ' — outside MBG window' : ''}`,
    `*User ID:* \`${account.userId}\``,
    '',
    `*Issue:* ${escapeMarkdown(summary)}`,
    '',
    '*Conversation snippet:*',
    escapeMarkdown(conversationSnippet.slice(0, 800)),
    '',
    `_${availability.statusMessage}_`,
  ].filter(Boolean)

  const result = await sendTelegramMessage(lines.join('\n'))
  return { result, availability }
}

export interface TicketInput {
  userId: string
  email: string | null
  issueSummary: string
  category: string
  priority: string
  status?: 'open' | 'resolved' | 'escalated'
  conversation: unknown
}

/**
 * Persist a support ticket via the service client (server-authoritative; bypasses RLS).
 * Failures are logged but never thrown — logging must not break the support flow.
 * Degrades silently if the support_tickets table hasn't been migrated yet.
 */
export async function logTicket(input: TicketInput): Promise<void> {
  try {
    const svc = createServiceClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (svc as any).from('support_tickets').insert({
      user_id: input.userId,
      email: input.email,
      issue_summary: input.issueSummary,
      category: input.category,
      priority: input.priority,
      status: input.status ?? 'open',
      conversation: input.conversation,
    })
    if (error) console.error('[support] ticket log failed:', error.message)
  } catch (err) {
    console.error('[support] ticket log threw:', err instanceof Error ? err.message : err)
  }
}

/** Detect an explicit refund request (vs. a plain cancellation). */
export function isRefundRequest(text: string): boolean {
  return /\brefund(s|ed|ing)?\b|money[\s-]?back|my money/i.test(text)
}

/** Compact a message list into a readable snippet for escalation payloads. */
export function conversationSnippet(messages: Array<{ role: string; content: string }>): string {
  return messages
    .slice(-6)
    .map((m) => `${m.role === 'user' ? 'User' : 'Agent'}: ${m.content}`)
    .join('\n')
}
