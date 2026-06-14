import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

/**
 * Full brand profile context — mirrors all stored brand_profiles columns.
 * Pass as many fields as available; the intent layer uses whichever are present.
 */
export interface BrandContext {
  brand_name?: string | null
  industry?: string | null
  target_audience?: string | null
  website_url?: string | null
  tone_notes?: string | null
  content_goals?: string | null
  avoid_topics?: string | null
  competitors?: string[] | null
  expertise_notes?: string | null
  signature_angles?: string | null
  avoid_phrases?: string | null
  primary_keywords?: string[] | null
}

/**
 * Known acronyms expanded deterministically BEFORE the AI call.
 * Prevents the model from guessing (the "aeo" → "digital" failure mode)
 * and covers a wide range of business, marketing, and tech topics.
 */
const ACRONYM_MAP: Record<string, string> = {
  // SEO / content / search
  aeo: 'answer engine optimization',
  seo: 'search engine optimization',
  sem: 'search engine marketing',
  serp: 'search engine results page',
  geo: 'generative engine optimization',
  cro: 'conversion rate optimization',
  ctr: 'click through rate',
  // AI / tech
  llm: 'large language model',
  ai: 'artificial intelligence',
  api: 'application programming interface',
  sdk: 'software development kit',
  saas: 'software as a service',
  paas: 'platform as a service',
  iaas: 'infrastructure as a service',
  crm: 'customer relationship management',
  cms: 'content management system',
  erp: 'enterprise resource planning',
  // Business model / growth
  b2b: 'business to business',
  b2c: 'business to consumer',
  d2c: 'direct to consumer',
  plg: 'product led growth',
  pmf: 'product market fit',
  gtm: 'go to market',
  // Metrics / finance
  roi: 'return on investment',
  kpi: 'key performance indicator',
  okr: 'objectives and key results',
  cac: 'customer acquisition cost',
  ltv: 'customer lifetime value',
  arr: 'annual recurring revenue',
  mrr: 'monthly recurring revenue',
  arpu: 'average revenue per user',
  nps: 'net promoter score',
  csat: 'customer satisfaction score',
  ebitda: 'earnings before interest taxes depreciation amortization',
  ipo: 'initial public offering',
  // Paid / performance marketing
  ppc: 'pay per click',
  cpa: 'cost per acquisition',
  cpl: 'cost per lead',
  cpm: 'cost per thousand impressions',
  roas: 'return on ad spend',
  // Sales / pipeline
  mql: 'marketing qualified lead',
  sql: 'sales qualified lead',
  icp: 'ideal customer profile',
  sdr: 'sales development representative',
  ae: 'account executive',
  csm: 'customer success manager',
  // Content / brand
  ugc: 'user generated content',
  cta: 'call to action',
  sov: 'share of voice',
  pr: 'public relations',
  // Finance / investment
  vc: 'venture capital',
  pe: 'private equity',
  cogs: 'cost of goods sold',
}

// Filler words stripped in the deterministic fallback ONLY.
// Not used to instruct the AI — that caused the over-stripping bug.
const FILLER_WORDS = new Set([
  'what', 'whats', 'how', 'why', 'when', 'where', 'who', 'does', 'do', 'is',
  'are', 'can', 'could', 'should', 'the', 'a', 'an', 'of', 'to', 'for', 'in',
  'on', 'about', 'me', 'my', 'i',
])

/** Expand known acronyms in the input before the AI sees it. */
function expandAcronyms(input: string): string {
  return input.replace(/[a-zA-Z]+/g, (word) => ACRONYM_MAP[word.toLowerCase()] ?? word)
}

/** Build a rich, structured brand summary from all available profile fields. */
function buildBrandSummary(brand: BrandContext | null): string {
  if (!brand) return ''
  const lines: string[] = []
  if (brand.brand_name) lines.push(`Business: ${brand.brand_name}`)
  if (brand.website_url) lines.push(`Website: ${brand.website_url}`)
  if (brand.industry) lines.push(`Industry: ${brand.industry}`)
  if (brand.target_audience) lines.push(`Audience: ${brand.target_audience}`)
  if (brand.content_goals) lines.push(`Content goals: ${brand.content_goals}`)
  if (brand.expertise_notes) lines.push(`Expertise: ${brand.expertise_notes}`)
  if (brand.signature_angles) lines.push(`Content angles: ${brand.signature_angles}`)
  if (brand.tone_notes) lines.push(`Brand voice: ${brand.tone_notes}`)
  if (brand.avoid_topics) lines.push(`Avoid: ${brand.avoid_topics}`)
  if (brand.competitors?.length) lines.push(`Competitors: ${brand.competitors.join(', ')}`)
  if (brand.primary_keywords?.length) lines.push(`Core keywords: ${brand.primary_keywords.join(', ')}`)
  return lines.join('\n')
}

/** Significant (non-filler, length > 2) lowercase words from a string. */
function topicWordsOf(text: string): Set<string> {
  return new Set(
    text.toLowerCase().split(/\s+/).filter((w) => w.length > 2 && !FILLER_WORDS.has(w))
  )
}

/** Deterministic fallback: drop filler words, keep last 2-3 meaningful words. */
function fallbackSeeds(expandedInput: string): string[] {
  const words = expandedInput.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const meaningful = words.filter((w) => !FILLER_WORDS.has(w.toLowerCase()))
  const pick = (meaningful.length ? meaningful : words).slice(-3)
  const topic = pick.join(' ').trim()
  return topic ? [topic] : [expandedInput.trim()]
}

/**
 * Returns true when the AI-generated seeds no longer contain any word from the
 * original (expanded) query — the signature of the model drifting off-topic.
 */
function seedsLostTopic(seeds: string[], expandedInput: string): boolean {
  const topicWords = topicWordsOf(expandedInput)
  if (topicWords.size === 0) return false
  const seedWords = new Set(seeds.join(' ').toLowerCase().split(/\s+/))
  for (const w of topicWords) {
    if (seedWords.has(w)) return false
  }
  return true
}

/**
 * Interpret a raw search input into 1-3 clean keyword seeds for DataForSEO.
 *
 * Pipeline:
 *  1. Expand known acronyms deterministically (free, fast, reliable).
 *  2. Call Claude Sonnet with the user's full brand profile as context.
 *     The model has access to a web_search tool it can call if the term is
 *     ambiguous or industry-specific and brand context alone isn't enough.
 *  3. Validate the seeds still relate to the original topic.
 *  4. Fall back to deterministic topic extraction if the AI fails or drifts.
 *
 * Always falls back gracefully — this layer must never break keyword research.
 */
export async function interpretSeedQuery(
  input: string,
  brand: BrandContext | null
): Promise<string[]> {
  const trimmed = input.trim()
  if (!trimmed) return []

  // Step 1 — acronym expansion (deterministic, before AI sees the query).
  const expanded = expandAcronyms(trimmed)

  const brandSummary = buildBrandSummary(brand)

  const systemPrompt = `You are a keyword research assistant. Your job is to understand what the user wants to research and return 1-3 clean keyword seeds for DataForSEO's keyword discovery API.

A good seed is a search phrase — the underlying topic phrased the way someone types it into Google. It should be a noun phrase, not a question.

RULES:
- Extract the TOPIC from the query, not literal words. Rephrase questions as topics.
  - "what is answer engine optimization" → "answer engine optimization"
  - "how to improve email deliverability" → "email deliverability", "email deliverability best practices"
  - "best tools for B2B lead gen" → "B2B lead generation tools", "B2B lead generation"
- Keep the core subject intact. Never drop the main topic.
- If a term is ambiguous or you are unsure what it means in this business context, use the web_search tool to look it up before deciding on seeds.
- Seeds should be 1-5 word phrases.
- Return ONLY a JSON array of strings — no prose, no explanation.

Example: ["answer engine optimization", "answer engine optimization strategy"]`

  const userMessage = brandSummary
    ? `User query: "${expanded}"\n\nBrand context:\n${brandSummary}`
    : `User query: "${expanded}"`

  try {
    // Use Sonnet with the web_search tool so it can look up unfamiliar terms.
    // max_uses=2 caps searches per call to control latency and cost.
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      tools: [
        {
          // Anthropic server-side web search — no client implementation needed.
          // Falls back automatically if unavailable.
          type: 'web_search_20250305' as 'web_search_20250305',
          name: 'web_search',
          max_uses: 2,
        },
      ],
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })

    // Collect all text blocks (the model may produce text before and after tool use).
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim()

    const match = text.match(/\[[\s\S]*?\]/)
    if (!match) return fallbackSeeds(expanded)

    const parsed: unknown = JSON.parse(match[0])
    if (!Array.isArray(parsed)) return fallbackSeeds(expanded)

    const seeds = parsed
      .filter((s): s is string => typeof s === 'string')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .slice(0, 3)

    if (seeds.length === 0) return fallbackSeeds(expanded)

    if (seedsLostTopic(seeds, expanded)) {
      console.warn(
        `[Byline] Keyword intent drifted off-topic for "${trimmed}" → ${JSON.stringify(seeds)}; using fallback.`
      )
      return fallbackSeeds(expanded)
    }

    return seeds
  } catch (err) {
    // If the web_search tool type isn't recognised by this SDK version,
    // retry without it so we never block keyword research.
    const errMsg = err instanceof Error ? err.message : String(err)
    if (errMsg.includes('web_search') || errMsg.includes('tool')) {
      try {
        const fallbackResponse = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 512,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
        })
        const text = fallbackResponse.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('')
          .trim()
        const match = text.match(/\[[\s\S]*?\]/)
        if (!match) return fallbackSeeds(expanded)
        const parsed: unknown = JSON.parse(match[0])
        if (!Array.isArray(parsed)) return fallbackSeeds(expanded)
        const seeds = (parsed as unknown[])
          .filter((s): s is string => typeof s === 'string')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
          .slice(0, 3)
        return seeds.length > 0 && !seedsLostTopic(seeds, expanded)
          ? seeds
          : fallbackSeeds(expanded)
      } catch {
        // Final fallback
      }
    }
    console.warn('[Byline] Keyword intent interpretation failed, using expanded fallback:', err)
    return fallbackSeeds(expanded)
  }
}
