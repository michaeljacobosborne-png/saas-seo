// Perplexity Sonar API helper for AI citation tracking

export interface CitationCheckResult {
  cited: boolean
  citationUrl: string | null
  sources: string[]
  rawResponse: unknown
}

export function isConfigured(): boolean {
  return !!process.env.PERPLEXITY_API_KEY
}

export async function checkCitation(
  keyword: string,
  targetDomain: string
): Promise<CitationCheckResult> {
  const apiKey = process.env.PERPLEXITY_API_KEY
  if (!apiKey) {
    return { cited: false, citationUrl: null, sources: [], rawResponse: null }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [{ role: 'user', content: keyword }],
        return_citations: true,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      console.error(`[perplexity] API error: ${response.status}`)
      return { cited: false, citationUrl: null, sources: [], rawResponse: null }
    }

    const data = await response.json()
    const sources: string[] = data.citations ?? []
    const citationUrl = sources.find(url => url.includes(targetDomain)) ?? null

    return {
      cited: !!citationUrl,
      citationUrl,
      sources,
      rawResponse: data,
    }
  } catch (err) {
    console.error('[perplexity] checkCitation error:', err)
    return { cited: false, citationUrl: null, sources: [], rawResponse: null }
  } finally {
    clearTimeout(timeout)
  }
}
