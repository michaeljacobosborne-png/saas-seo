import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

/** Brand fields used to give the intent layer context about who's searching. */
export interface BrandContext {
  brand_name?: string | null
  industry?: string | null
  target_audience?: string | null
}

function buildBrandSummary(brand: BrandContext | null): string {
  if (!brand) return 'No brand profile available.'
  const parts: string[] = []
  if (brand.brand_name) parts.push(`Brand: ${brand.brand_name}`)
  if (brand.industry) parts.push(`Industry: ${brand.industry}`)
  if (brand.target_audience) parts.push(`Target audience: ${brand.target_audience}`)
  return parts.length ? parts.join('. ') : 'No brand profile available.'
}

/**
 * Interpret a raw search input — which may be a natural language question, a
 * topic, or already a clean keyword — into 1-3 clean keyword seeds suitable for
 * DataForSEO's keyword_ideas API.
 *
 * DataForSEO expects clean seeds like "answer engine optimization", not
 * questions like "What is AEO?". This runs the input through Claude Haiku to
 * extract usable seeds, interpreting it in the context of the user's brand.
 *
 * Always falls back to the original input so the tool never breaks: if the AI
 * call fails or returns nothing useful, the returned array is just [input].
 */
export async function interpretSeedQuery(
  input: string,
  brand: BrandContext | null
): Promise<string[]> {
  const trimmed = input.trim()
  if (!trimmed) return []

  const systemPrompt = `You are a keyword research assistant. Extract the core TOPIC or ENTITY from the user's input and return 1-3 clean keyword seeds for DataForSEO's keyword discovery API.

Brand context: ${buildBrandSummary(brand)}

CRITICAL RULES:
- Return ONLY noun phrases and topic terms — NEVER return question-format strings
- WRONG: "what does AEO stand for", "how to do SEO", "what is content marketing"
- RIGHT: "answer engine optimization", "AEO SEO strategy", "content marketing"
- Strip all question words: what, how, why, when, where, who, does, is, are, can
- Seeds must be 2-4 word phrases that someone would use as a search topic
- If the input contains an acronym, expand it: "AEO" → "answer engine optimization"

Return ONLY a JSON array of strings. Example for "what is AEO?": ["answer engine optimization", "AEO content strategy", "AEO SEO"]`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system: systemPrompt,
      messages: [{ role: 'user', content: trimmed }],
    })

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim()

    // The model may wrap the array in prose or a code fence despite instructions;
    // pull out the first JSON array we can find.
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) return [trimmed]

    const parsed: unknown = JSON.parse(match[0])
    if (!Array.isArray(parsed)) return [trimmed]

    const seeds = parsed
      .filter((s): s is string => typeof s === 'string')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .slice(0, 3)

    return seeds.length > 0 ? seeds : [trimmed]
  } catch (err) {
    // Graceful fallback — never let the intent layer break research.
    console.warn('[Byline] Keyword intent interpretation failed, using raw input:', err)
    return [trimmed]
  }
}
