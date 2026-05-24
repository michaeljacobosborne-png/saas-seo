export interface KeywordIdea {
  keyword: string
  search_volume: number | null
  competition: string | null
  competition_index: number | null
  cpc: number | null
  keyword_difficulty: number | null
}

export async function getKeywordIdeas(
  seedKeywords: string[],
  location = 'United States',
  language = 'English',
  limit = 50
): Promise<KeywordIdea[]> {
  const login = process.env.DATAFORSEO_LOGIN
  const password = process.env.DATAFORSEO_PASSWORD

  if (!login || !password) {
    throw new Error('DataForSEO credentials not configured. Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD.')
  }

  const credentials = Buffer.from(`${login}:${password}`).toString('base64')

  const response = await fetch(
    'https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_ideas/live',
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        {
          keywords: seedKeywords,
          language_name: language,
          location_name: location,
          limit,
          include_seed_keyword: true,
        },
      ]),
    }
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`DataForSEO API error ${response.status}: ${text}`)
  }

  const data = await response.json()

  if (data.tasks?.[0]?.status_code !== 20000) {
    throw new Error(`DataForSEO task error: ${data.tasks?.[0]?.status_message ?? 'Unknown error'}`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = data.tasks?.[0]?.result?.[0]?.items ?? []

  return items.map((item) => ({
    keyword: item.keyword,
    search_volume: item.keyword_info?.search_volume ?? null,
    competition: item.keyword_info?.competition_level ?? null,
    competition_index:
      item.keyword_info?.competition != null
        ? Math.round(item.keyword_info.competition * 100)
        : null,
    cpc: item.keyword_info?.cpc ?? null,
    keyword_difficulty: item.keyword_properties?.keyword_difficulty ?? null,
  }))
}
