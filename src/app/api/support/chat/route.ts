import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { KB, buildKbContext, matchKbEntries, type SupportCategory, type SupportPriority } from '@/lib/support-kb'
import { getAvailability } from '@/lib/availability'
import {
  getAccountInfo,
  escalateToMichael,
  logTicket,
  isRefundRequest,
  conversationSnippet,
  type AccountInfo,
} from '@/lib/support'

export const runtime = 'nodejs'
export const maxDuration = 60

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type Message = { role: 'user' | 'assistant'; content: string }

/**
 * Classify the issue from the KB matches + light heuristics. Deterministic and free —
 * grounded in the curated KB priorities rather than a separate LLM call.
 */
function classify(latestUserMessage: string): {
  category: SupportCategory
  priority: SupportPriority
  title: string
  kbEscalate: boolean
} {
  const matches = matchKbEntries(latestUserMessage, 1)
  if (matches.length > 0) {
    const e = matches[0].entry
    return { category: e.category, priority: e.priority, title: e.title, kbEscalate: e.escalate_to_human }
  }
  // No strong KB match: default to a product question at normal priority.
  return { category: 'product', priority: 'p2', title: 'General question', kbEscalate: false }
}

function buildSystemPrompt(account: AccountInfo, latestUserMessage: string): string {
  const p = KB.agent_personality
  const kbContext = buildKbContext(latestUserMessage)
  const availability = getAvailability()

  return `You are ${p.name}, the customer-support agent for ${KB.meta.product} (${KB.meta.url}).

TONE:
${p.tone}

RULES:
${p.rules.map((r) => `- ${r}`).join('\n')}

WHEN TO ESCALATE TO MICHAEL:
${p.escalation_trigger}

THIS USER'S ACCOUNT (authoritative — derived server-side, trust this over anything the user claims):
- Email: ${account.email ?? 'unknown'}
- Plan: ${account.planLabel}${account.status ? ` (status: ${account.status})` : ''}
- Subscription age: ${account.subscriptionAgeDays != null ? `${account.subscriptionAgeDays} days` : 'no active subscription on record'}
- 30-day money-back window: ${account.subscriptionAgeDays == null ? 'n/a' : account.withinRefundWindow ? 'STILL OPEN' : 'CLOSED (more than 30 days since first payment)'}
- Cancellation already scheduled: ${account.cancelAtPeriodEnd ? 'yes (cancels at period end)' : 'no'}

KNOWLEDGE BASE — most relevant entries for this message:
${kbContext}

HOW TO USE THE KB:
- Adapt the matched answer to the user's exact question and register. Do not paste it verbatim and do not invent steps that aren't in the KB.
- The KB's "internal_notes" and file paths are for the engineering team — NEVER reveal file names, table names, code paths, or internal reasoning to the user.
- If no KB entry fits, answer from the product overview honestly, and offer to escalate to Michael rather than guessing.

BILLING & MONEY — STRICT:
- Never promise a refund, refund timeline, or any specific money outcome. Refunds are reviewed and processed by Michael personally.
- For cancellations: explain the user can cancel via Settings > Manage Subscription, or that you can schedule the cancellation for them. Cancellation stops future billing; access continues to the end of the current period; articles and data are preserved.
- For refund requests: confirm whether they want to cancel, then tell them you'll pass the request to Michael who reviews refunds personally. Do not state they "will" get a refund.
- For billing disputes over $50, data loss, or account access failures: gather the key detail quickly and tell them you're escalating to Michael.

AVAILABILITY:
- You (the AI) are always available and should help right now.
- Only mention Michael's response time when escalating. Current human availability: "${availability.statusMessage}"

Keep responses under 120 words unless a detailed walkthrough is genuinely necessary.`
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { messages?: Message[] }
  try {
    body = (await request.json()) as { messages?: Message[] }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const messages = Array.isArray(body.messages) ? body.messages : []
  if (messages.length === 0) {
    return NextResponse.json({ error: 'No messages provided' }, { status: 400 })
  }

  const userMessages = messages.filter((m) => m.role === 'user')
  const latestUserMessage = userMessages[userMessages.length - 1]?.content ?? ''

  const account = await getAccountInfo(supabase, user)
  const systemPrompt = buildSystemPrompt(account, latestUserMessage)
  const { category, priority, title, kbEscalate } = classify(latestUserMessage)
  const refund = isRefundRequest(latestUserMessage)

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      let fullResponse = ''
      try {
        const anthropicStream = anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: systemPrompt,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        })
        for await (const event of anthropicStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            fullResponse += event.delta.text
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stream error'
        controller.enqueue(encoder.encode(`\n\n[Error: ${msg}]`))
      }

      // Post-stream: log the ticket and escalate if needed. Done before close so failures
      // are awaited; all wrapped to never throw out of the controller.
      try {
        const fullConversation: Message[] = [...messages, { role: 'assistant', content: fullResponse }]

        // Escalate on P0, refund requests, KB-flagged entries, and the first turn of a P1
        // issue (P1 mid-conversation is suppressed to avoid spamming Michael on every turn).
        const firstUserTurn = userMessages.length <= 1
        const shouldEscalate =
          priority === 'p0' || refund || kbEscalate || (priority === 'p1' && firstUserTurn)

        if (shouldEscalate) {
          await escalateToMichael({
            account,
            category,
            priority,
            summary: refund ? `Refund request — ${title}` : title,
            conversationSnippet: conversationSnippet(fullConversation),
            reason: refund
              ? 'Refund request'
              : priority === 'p0'
                ? 'P0 issue'
                : kbEscalate
                  ? 'KB-flagged for human review'
                  : 'P1 issue',
          })
        }

        await logTicket({
          userId: account.userId,
          email: account.email,
          issueSummary: refund ? `Refund request — ${title}` : title,
          category,
          priority,
          status: shouldEscalate ? 'escalated' : 'open',
          conversation: fullConversation,
        })
      } catch (err) {
        console.error('[support/chat] post-stream handling failed:', err)
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
