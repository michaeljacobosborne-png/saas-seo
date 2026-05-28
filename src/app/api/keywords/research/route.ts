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
  const { project_id, seed_topic } = body as { project_id: string; seed_topic: string }

  if (!project_id || !seed_topic) {
    return NextResponse.json({ error: 'project_id and seed_topic are required' }, { status: 400 })
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

  // Mark as researching
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('keyword_projects')
    .update({ status: 'researching' })
    .eq('id', project_id)

  try {
    // 1. Fetch keyword ideas from DataForSEO
    const ideas = await getKeywordIdeas([seed_topic], 'United States', 'English', 20)

    if (ideas.length === 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('keyword_projects')
        .update({ status: 'error' })
        .eq('id', project_id)
      return NextResponse.json({ error: 'No keyword ideas returned' }, { status: 502 })
    }

    // 2. Cluster keywords with AI
    const clusters = await clusterKeywords(ideas.map((k) => k.keyword))

    const clusterMap = new Map<string, string>()
    clusters.forEach((c) => {
      c.keywords.forEach((kw) => clusterMap.set(kw.toLowerCase(), c.name))
    })

    // 3. Insert keywords into DB
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

    // 4. Mark complete
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
