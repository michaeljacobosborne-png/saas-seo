import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

/** Brand fields used to give the intent layer context about who's searching. */
export interface BrandContext {
  brand_name?: string | null
  industry?: string | null
  target_audience?: string | null
}

/**
 * Known SEO/marketing acronyms, expanded deterministically BEFORE the AI call.
 *
 * Why this exists: relying on the model to "guess" that AEO means answer engine
 * optimization is exactly how "what is aeo" turned into "digital" brand-name junk
 * ("dakota digital", "reliance digital", ...). When the brand industry context
 * leaned digital-marketing, Haiku didn't recognize the acronym and drifted to the
 * brand lens. Expanding the acronym inline removes the guess entirely.
 */
const ACRONYM_MAP: Record<string, string> = {
  aeo: 'answer engine optimization',
  seo: 'search engine optimization',
  sem: 'search engine marketing',
  cro: 'conversion rate optimization',
  ctr: 'click through rate',
  serp: 'search engine results page',
  llm: 'large language model',
  ai: 'artificial intelligence',
  geo: 'generative engine optimization',
  kpi: 'key performance indicator',
}

// Question/filler words we drop when deriving a topic from raw input. Kept small
// and used ONLY for the deterministic fallback — we no longer ask the AI to strip
// words blindly (that's what lost the original topic).
const FILLER_WORDS = new Set([
  'what', 'whats', 'how', 'why', 'when', 'where', 'who', 'does', 'do', 'is',
  'are', 'can', 'could', 'should', 'the', 'a', 'an', 'of', 'to', 'for', 'in',
  'on', 'about', 'me', 'my', 'i',
])

/**
 * Replace any standalone known acronym (case-insensitive) with its expansion.
 * Operates on whole alphabetic word runs, so "aim" is untouched but "ai" expands.
 */
function expandAcronyms(input: string): string {
  return input.replace(/[a-zA-Z]+/g, (word) => {
    const expansion = ACRONYM_MAP[word.toLowerCase()]
    return expansion ?? word
  })
}

function buildBrandSummary(brand: BrandContext | null): string {
  if (!brand) return 'No brand profile available.'
  const parts: string[] = []
  if (brand.brand_name) parts.push(`Brand: ${brand.brand_name}`)
  if (brand.industry) parts.push(`Industry: ${brand.industry}`)
  if (brand.target_audience) parts.push(`Target audience: ${brand.target_audience}`)
  return parts.length ? parts.join('. ') : 'No brand profile available.'
}

/** Significant (length > 2, non-filler) lowercase words of a string. */
function topicWordsOf(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2 && !FILLER_WORDS.has(w))
  )
}

/**
 * Deterministic fallback: derive a clean topic from the (already acronym-expanded)
 * input by dropping filler words and keeping the last 2-3 meaningful words.
 */
function fallbackSeeds(expandedInput: string): string[] {
  const words = expandedInput.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const meaningful = words.filter((w) => !FILLER_WORDS.has(w.toLowerCase()))
  const pick = (meaningful.length ? meaningful : words).slice(-3)
  const topic = pick.join(' ').trim()
  return topic ? [topic] : [expandedInput.trim()]
}

/**
 * True if the seeds have lost the original topic — i.e. the expanded input has
 * meaningful words but NONE of them appear anywhere in the seeds. That's the
 * signature of the model drifting to brand context ("aeo" → "digital marketing").
 */
function seedsLostTopic(seeds: string[], expandedInput: string): boolean {
  const topicWords = topicWordsOf(expandedInput)
  if (topicWords.size === 0) return false // nothing meaningful to validate against
  const seedWords = new Set(seeds.join(' ').toLowerCase().split(/\s+/))
  for (const w of topicWords) {
    if (seedWords.has(w)) return false
  }
  return true
}

/**
 * Interpret a raw search input — which may be a natural language question, a
 * topic, or already a clean keyword — into 1-3 clean keyword seeds suitable for
 * DataForSEO's keyword_ideas API.
 *
 * DataForSEO expects clean seeds like "answer engine optimization", not
 * questions like "What is AEO?". Pipeline:
 *   1. Expand known acronyms deterministically (aeo → answer engine optimization).
 *   2. Ask Claude Haiku to rephrase the query as 1-3 topic seeds. Brand context is
 *      passed as OPTIONAL reference in the user message, not as a system directive,
 *      so it can't hijack the interpretation.
 *   3. Validate the seeds still contain the original topic; if they drifted, fall
 *      back to a deterministic extraction of the expanded input.
 *
 * Always falls back gracefully so the tool never breaks.
 */
export async function interpretSeedQuery(
  input: string,
  brand: BrandContext | null
): Promise<string[]> {
  const trimmed = input.trim()
  if (!trimmed) return []

  // Step 1 — expand acronyms before anything else sees the query.
  const expanded = expandAcronyms(trimmed)

  const systemPrompt = `You are a keyword research assistant. Your job is to rephrase the user's input into 1-3 clean keyword seeds for DataForSEO's keyword discovery API.

A good seed is the underlying TOPIC, phrased the way someone would type it into a search box — a noun phrase, not a full question.

RULES:
- Rephrase the question as its topic; do NOT blindly delete words and never drop the subject of the query.
- "what is answer engine optimization" → "answer engine optimization", NOT "digital" or "engine".
- "how to improve email deliverability" → "email deliverability", "improve email deliverability".
- Keep the core subject intact — every seed must clearly be about the same thing the user asked about.
- Do not invent unrelated topics. If you are unsure what a term means, keep the term itself as the seed rather than guessing.
- Seeds should be 1-5 word search phrases.

Return ONLY a JSON array of strings. Example for "what is answer engine optimization": ["answer engine optimization", "answer engine optimization strategy", "AEO SEO"]`

  // Brand context goes in the USER message as optional reference, NOT the system
  // prompt — it must not become the primary lens for interpretation.
  const userMessage = `User query: ${expanded}
Brand context (optional reference only — ignore if not relevant to the query): ${buildBrandSummary(brand)}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim()

    // The model may wrap the array in prose or a code fence despite instructions;
    // pull out the first JSON array we can find.
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) return fallbackSeeds(expanded)

    const parsed: unknown = JSON.parse(match[0])
    if (!Array.isArray(parsed)) return fallbackSeeds(expanded)

    const seeds = parsed
      .filter((s): s is string => typeof s === 'string')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .slice(0, 3)

    if (seeds.length === 0) return fallbackSeeds(expanded)

    // Step 3 — validation. If the seeds drifted off-topic (the classic "aeo" →
    // "digital" failure), discard them and use the deterministic extraction.
    if (seedsLostTopic(seeds, expanded)) {
      console.warn(
        `[Byline] Keyword intent drifted off-topic for "${trimmed}" → ${JSON.stringify(seeds)}; falling back to topic extraction.`
      )
      return fallbackSeeds(expanded)
    }

    return seeds
  } catch (err) {
    // Graceful fallback — never let the intent layer break research. Use the
    // acronym-expanded extraction so even on failure we send a sane topic.
    console.warn('[Byline] Keyword intent interpretation failed, using expanded fallback:', err)
    return fallbackSeeds(expanded)
  }
}
