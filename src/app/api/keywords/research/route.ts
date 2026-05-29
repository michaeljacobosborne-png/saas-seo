export const maxDuration = 60

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getKeywordIdeas } from '@/lib/dataforseo'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

interface ClusterResult {
  name: string
  keywords: string[]
}

async function clusterKeywords(keywords: string[]): Promise<ClusterResult[]> {
  if (keywords.length === 0) return []

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'user',
        content: `Group these SEO keywords into 4–6 meaningful topic clusters based on search intent and theme. Be concise with cluster names (2–4 words).

Keywords: ${keywords.join(', ')}

Return JSON only in this exact format:
{"clusters": [{"name": "Cluster Name", "keywords": ["keyword1", "keyword2"]}]}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
  })

  try {
    const parsed = JSON.parse(response.choices[0].message.content ?? '{}')
    return parsed.clusters ?? []
  } catch {
    return []
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { project_id, seed_topic, seeds, brief } = body as {
    project_id: string
    seed_topic?: string
    seeds?: string[]
    brief?: Record<string, unknown>
  }

  const seedsToUse: string[] = seeds?.length ? seeds : seed_topic ? [seed_topic] : []

  if (!project_id || seedsToUse.length === 0) {
    return NextResponse.json({ error: 'project_id and seed_topic or seeds are required' }, { status: 400 })
  }

  // Verify ownership
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: project } = await (supabase as any)
    .from('keyword_projects')
    .select('id')
    .eq('id', project_id)
    .eq('user_id', user.id)
    .single()

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // Mark as researching; save brief if provided
  const updatePayload: Record<string, unknown> = { status: 'researching' }
  if (brief) updatePayload.research_brief = brief

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('keyword_projects')
    .update(updatePayload)
    .eq('id', project_id)

  try {
    // Fetch keyword ideas — DataForSEO supports multiple seeds natively
    const ideas = await getKeywordIdeas(seedsToUse, 'United States', 'English', 50)

    if (ideas.length === 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('keyword_projects')
        .update({ status: 'error' })
        .eq('id', project_id)
      return NextResponse.json({ error: 'No keyword ideas returned' }, { status: 502 })
    }

    // Cluster keywords with AI
    const clusters = await clusterKeywords(ideas.map((k) => k.keyword))

    const clusterMap = new Map<string, string>()
    clusters.forEach((c) => {
      c.keywords.forEach((kw) => clusterMap.set(kw.toLowerCase(), c.name))
    })

    // Insert keywords into DB
    const rows = ideas.map((k) => ({
      project_id,
      keyword: k.keyword,
      avg_monthly_searches: k.search_volume,
      competition: k.competition,
      competition_index: k.competition_index,
      cpc: k.cpc,
      keyword_difficulty: k.keyword_difficulty,
      cluster: clusterMap.get(k.keyword.toLowerCase()) ?? 'Other',
      selected: false,
    }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (supabase as any)
      .from('keywords')
      .insert(rows)

    if (insertError) throw new Error(insertError.message)

    // Mark complete
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('keyword_projects')
      .update({ status: 'complete' })
      .eq('id', project_id)

    return NextResponse.json({ success: true, count: rows.length })
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('keyword_projects')
      .update({ status: 'error' })
      .eq('id', project_id)

    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
