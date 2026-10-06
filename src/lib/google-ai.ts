// Google Gemini API helper for AI citation tracking (with search grounding)

export interface GeminiCitationCheckResult {
  cited: boolean
  citationUrl: string | null
  sources: string[]
  rawResponse: unknown
}

export function isConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY
}

export async function checkCitation(
  keyword: string,
  targetDomain: string
): Promise<GeminiCitationCheckResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return { cited: false, citationUrl: null, sources: [], rawResponse: null }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20000)

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: keyword }] }],
          tools: [{ google_search_retrieval: {} }],
        }),
        signal: controller.signal,
      }
    )

    if (!response.ok) {
      console.error(`[google-ai] API error: ${response.status}`)
      return { cited: false, citationUrl: null, sources: [], rawResponse: null }
    }

    const data = await response.json()

    // Extract cited URLs from grounding metadata
    const chunks: Array<{ web?: { uri: string } }> =
      data?.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []
    const sources = chunks
      .map((c) => c.web?.uri)
      .filter((uri): uri is string => !!uri)

    const citationUrl = sources.find((url) => url.includes(targetDomain)) ?? null

    return {
      cited: !!citationUrl,
      citationUrl,
      sources,
      rawResponse: data,
    }
  } catch (err) {
    console.error('[google-ai] checkCitation error:', err)
    return { cited: false, citationUrl: null, sources: [], rawResponse: null }
  } finally {
    clearTimeout(timeout)
  }
}
