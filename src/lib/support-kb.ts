// Knowledge base for the Byline customer-support agent.
// Source of truth lives in ./support-kb.json (kept in sync with the team's draft).
// This module wraps the raw JSON with types and a lightweight trigger-phrase matcher
// used to surface the most relevant entries into the agent's system prompt.

import rawKb from './support-kb.json'

export type SupportCategory = 'billing' | 'technical' | 'product' | 'account'
export type SupportPriority = 'p0' | 'p1' | 'p2' | 'p3'

export interface KbEntry {
  id: string
  category: SupportCategory
  priority: SupportPriority
  title: string
  trigger_phrases: string[]
  agent_response: string
  escalate_to_human: boolean
  escalation_reason: string
  internal_notes: string
}

export interface KnowledgeBase {
  meta: {
    product: string
    url: string
    support_email: string
    last_updated: string
    version: string
  }
  agent_personality: {
    name: string
    tone: string
    rules: string[]
    escalation_trigger: string
  }
  entries: KbEntry[]
}

export const KB = rawKb as KnowledgeBase

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'to', 'of',
  'in', 'on', 'for', 'my', 'me', 'i', 'it', 'this', 'that', 'with', 'how', 'do', 'does',
  'can', 'cant', 'won', 'wont', 'not', 'no', 'you', 'your', 'we', 'our', 'why', 'what',
  'when', 'where', 'get', 'got', 'have', 'has', 'had', 'will', 'would', 'should', 'about',
])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t))
}

/**
 * Score how well a KB entry matches a user message.
 * Exact/substring trigger-phrase hits weigh heavily; token overlap is a softer signal.
 */
function scoreEntry(entry: KbEntry, message: string, tokens: Set<string>): number {
  const lower = message.toLowerCase()
  let score = 0

  for (const phrase of entry.trigger_phrases) {
    const p = phrase.toLowerCase()
    if (lower.includes(p)) {
      score += 10
      continue
    }
    // Partial: how many of the phrase's significant tokens appear in the message
    const phraseTokens = tokenize(phrase)
    if (phraseTokens.length === 0) continue
    const hits = phraseTokens.filter((t) => tokens.has(t)).length
    score += (hits / phraseTokens.length) * 3
  }

  // Title token overlap is a weak tie-breaker
  const titleHits = tokenize(entry.title).filter((t) => tokens.has(t)).length
  score += titleHits * 0.5

  return score
}

export interface KbMatch {
  entry: KbEntry
  score: number
}

/**
 * Return the top matching KB entries for a user message, best first.
 * Entries below a minimum relevance threshold are dropped.
 */
export function matchKbEntries(message: string, limit = 4): KbMatch[] {
  const tokens = new Set(tokenize(message))
  return KB.entries
    .map((entry) => ({ entry, score: scoreEntry(entry, message, tokens) }))
    .filter((m) => m.score >= 1.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/**
 * Build the KB context block injected into the agent's system prompt.
 * Includes the matched entries' customer-facing answers and (for internal reasoning)
 * their category/priority/escalation flags. Internal notes are NOT sent to the model
 * as customer copy — they're included so the agent can reason about escalation, but the
 * agent is instructed never to surface them verbatim.
 */
export function buildKbContext(message: string, limit = 4): string {
  const matches = matchKbEntries(message, limit)
  if (matches.length === 0) {
    return 'No specific knowledge-base entry strongly matches this message. Answer from the product overview and the personality rules. If you are unsure, say so and offer to escalate to Michael.'
  }
  return matches
    .map(({ entry }, i) => {
      return [
        `### KB MATCH ${i + 1}: ${entry.title}`,
        `category: ${entry.category} | priority: ${entry.priority} | escalate_to_human: ${entry.escalate_to_human}`,
        entry.escalate_to_human && entry.escalation_reason ? `escalation_reason: ${entry.escalation_reason}` : '',
        `Customer-facing answer to adapt (do not paste verbatim, match the user's register):`,
        entry.agent_response,
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n\n')
}
