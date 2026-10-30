/**
 * The brief asks for a 150 to 160 character meta description and the model
 * rarely complies: of 30 stored briefs on 2026-10-27, 28 were outside the range
 * (99 to 147 characters; article 7f231a4c had 99). Nothing checked it. This
 * measures the length and asks for a targeted rewrite when it misses.
 */

export const META_MIN = 150
export const META_MAX = 160
/** Close enough to stop retrying; still inside what search results display. */
const ACCEPT_MIN = 140

export function metaProblem(meta: string, keyword: string | null): string | null {
  const n = meta.trim().length
  if (n < ACCEPT_MIN) return `It is ${n} characters. It must be ${META_MIN} to ${META_MAX}: add a specific detail about what the reader gets, not filler.`
  if (n > META_MAX) return `It is ${n} characters. It must be ${META_MIN} to ${META_MAX}: cut words, keep the meaning.`
  if (keyword && !meta.toLowerCase().includes(keyword.toLowerCase())) return `It must include the target keyword "${keyword}" exactly.`
  return null
}

export function buildMetaRewritePrompt(meta: string, keyword: string | null, problem: string): string {
  return `Rewrite this meta description for an article${keyword ? ` targeting "${keyword}"` : ''}.
${problem}
One or two plain sentences. No exclamation marks, no em dashes, no claims of results, rankings or prices.
Return only the new meta description, nothing else.

${meta}`
}

/** Cuts an over-long description at the last word that fits, ending on a full stop. */
function trimToMax(meta: string): string {
  const t = meta.trim()
  if (t.length <= META_MAX) return t
  const cut = t.slice(0, META_MAX - 1)
  const sentenceEnd = cut.lastIndexOf('. ')
  if (sentenceEnd >= ACCEPT_MIN - 1) return cut.slice(0, sentenceEnd + 1)
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:]$/, '')}.`
}

/**
 * Up to two targeted rewrites. Keeps the best attempt: in range wins, then the
 * one closest to the range. An over-long result is trimmed at a word boundary;
 * a short one is kept as is rather than padded with filler.
 */
export async function fitMetaDescription(
  meta: string | null | undefined,
  keyword: string | null,
  rewrite: (prompt: string) => Promise<string>,
): Promise<{ meta: string | null; attempts: number }> {
  if (!meta?.trim()) return { meta: meta ?? null, attempts: 0 }
  let best = meta.trim()
  let attempts = 0
  const distance = (s: string) => (s.length < META_MIN ? META_MIN - s.length : s.length > META_MAX ? s.length - META_MAX : 0)
  while (attempts < 2) {
    const problem = metaProblem(best, keyword)
    if (!problem) break
    attempts++
    const next = (await rewrite(buildMetaRewritePrompt(best, keyword, problem)).catch(() => '')).trim().replace(/^"|"$/g, '')
    if (!next) break
    const keepsKeyword = !keyword || next.toLowerCase().includes(keyword.toLowerCase())
    if (keepsKeyword && distance(next) < distance(best)) best = next
  }
  return { meta: trimToMax(best), attempts }
}
