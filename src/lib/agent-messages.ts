/**
 * What an agent chat message would put into the article if "Apply to article"
 * is pressed.
 *
 * A Fix reports its outcome as a chat message ("✅ Added … (1 block changed …)",
 * "❌ …", "⏳ Applying fix…"). Those are status lines about the article, never
 * article content: the signed-in pass (2026-10-04) found the agent's own
 * summary entering the body, and in Review mode this button was a second route
 * for exactly that. Status messages are therefore never applicable.
 */
const STATUS_PREFIX = /^\s*(?:✅|❌|⏳|SUMMARY:|PATCH:)/u

export function extractApplicableContent(content: string): string | null {
  if (STATUS_PREFIX.test(content)) return null
  const codeMatch = content.match(/```[\w]*\n?([\s\S]+?)```/)
  if (codeMatch) return codeMatch[1].trim()
  const bqLines = content.split('\n').filter((l) => l.startsWith('> '))
  if (bqLines.length >= 2) return bqLines.map((l) => l.replace(/^>\s?/, '')).join('\n')
  // Fallback: treat the full response as applicable if it's substantial
  const trimmed = content.trim()
  if (trimmed.length > 100) return trimmed
  return null
}
