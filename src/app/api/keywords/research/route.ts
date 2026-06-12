export const maxDuration = 60

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getKeywordIdeas, KeywordIdea } from '@/lib/dataforseo'
import { checkKeywordSessionLimit, incrementKeywordSession } from '@/lib/usage'
import { interpretSeedQuery } from '@/lib/keyword-intent'
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

  // Seeds from the discovery brief are already clean (the agent built 15-20
  // targeted phrases). A raw seed_topic from the "direct keyword" path may be a
  // natural language question ("What is AEO?") that DataForSEO can't use — so we
  // run it through the AI intent layer below to extract clean seeds.
  const briefSeeds: string[] = seeds?.length ? seeds : []
  const rawSeedTopic = seed_topic?.trim() || ''

  if (!project_id || (briefSeeds.length === 0 && !rawSeedTopic)) {
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

  // Enforce the per-plan keyword-session limit before doing any paid work.
  const limitCheck = await checkKeywordSessionLimit(user.id, supabase)
  if (!limitCheck.allowed) {
    return NextResponse.json({
      error: `You've used all ${limitCheck.limit} keyword research sessions for this month. Upgrade your plan for more.`,
      code: 'KEYWORD_SESSION_LIMIT',
      used: limitCheck.used,
      limit: limitCheck.limit,
    }, { status: 429 })
  }

  // Resolve the seeds we'll actually send to DataForSEO.
  // - Brief seeds are already clean → use them as-is.
  // - A raw seed_topic may be a natural language query → run the AI intent layer
  //   to interpret it (with brand context) into 1-3 clean keyword seeds.
  let seedsToUse: string[] = briefSeeds
  let interpretedFromRaw = false
  if (briefSeeds.length === 0) {
    // Pull lightweight brand context so the intent layer can disambiguate the query.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: brandProfile } = await (supabase as any)
      .from('brand_profiles')
      .select('brand_name, industry, target_audience, website_url, tone_notes, content_goals, avoid_topics, competitors, expertise_notes, signature_angles, avoid_phrases, primary_keywords')
      .eq('user_id', user.id)
      .single()

    seedsToUse = await interpretSeedQuery(rawSeedTopic, brandProfile ?? null)
    // Flag when the interpreter actually changed the input so the UI can surface it.
    interpretedFromRaw = !(seedsToUse.length === 1 && seedsToUse[0] === rawSeedTopic)
  }

  // Mark as researching; save brief if provided
  const updatePayload: Record<string, unknown> = { status: 'researching' }
  if (brief) updatePayload.research_brief = brief

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('keyword_projects')
    .update(updatePayload)
    .eq('id', project_id)

  const serviceClient = createServiceClient()

  try {
    // Check cache for seeds before calling DataForSEO
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: cachedRows } = await (serviceClient as any)
      .from('keyword_cache')
      .select('*')
      .in('keyword', seedsToUse)
      .gt('expires_at', new Date().toISOString())

    const cachedKeywordSet = new Set<string>(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (cachedRows ?? []).map((r: any) => r.keyword as string)
    )
    const cacheMisses = seedsToUse.filter((s) => !cachedKeywordSet.has(s))

    console.log(`Cache hits: ${(cachedRows ?? []).length} / Total seeds: ${seedsToUse.length}`)

    // Map cached rows to KeywordIdea shape
    const cachedIdeas: KeywordIdea[] = (cachedRows ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (r: any) => ({
        keyword: r.keyword,
        search_volume: r.volume,
        competition: null,
        competition_index: null,
        cpc: r.cpc,
        keyword_difficulty: r.difficulty,
      })
    )

    // Call DataForSEO only for cache misses
    let freshIdeas: KeywordIdea[] = []
    if (cacheMisses.length > 0) {
      freshIdeas = await getKeywordIdeas(cacheMisses, 'United States', 'English', 50)

      // Write all returned keywords to cache (upsert so related surfaced keywords are stored too)
      if (freshIdeas.length > 0) {
        const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
        const nowIso = new Date().toISOString()
        const cacheRows = freshIdeas.map((k) => ({
          keyword: k.keyword,
          volume: k.search_volume,
          difficulty: k.keyword_difficulty,
          cpc: k.cpc,
          fetched_at: nowIso,
          expires_at: expiresAt,
        }))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (serviceClient as any)
          .from('keyword_cache')
          .upsert(cacheRows, { onConflict: 'keyword' })
      }
    }

    // Merge cached + fresh results
    const allIdeas = [...cachedIdeas, ...freshIdeas]

    // Filter: keep keywords that share at least one significant word with the topic,
    // OR have a relevance score (if DataForSEO provides one) above threshold.
    // Simple approach: filter ideas where keyword text overlaps with any seed word (length > 4 chars)
    const topicText = (typeof brief?.topic === 'string' && brief.topic) || seedsToUse.join(' ')
    const topicWords = new Set(
      topicText.toLowerCase().split(/\s+/).filter((w) => w.length > 4)
    )
    const filteredIdeas = allIdeas.filter((kw) => {
      const kwWords = kw.keyword.toLowerCase().split(/\s+/)
      const relevanceScore = (kw as { relevance_score?: number }).relevance_score
      return kwWords.some((w) => topicWords.has(w)) ||
             (relevanceScore != null && relevanceScore > 0.5)
    })
    // Fall back to all ideas if filter removes everything (or leaves too few to be useful)
    const ideas = filteredIdeas.length >= 5 ? filteredIdeas : allIdeas

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

    // Clear existing keywords before re-inserting (handles refresh case)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('keywords')
      .delete()
      .eq('project_id', project_id)

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

    // Mark complete and record when research last ran
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('keyword_projects')
      .update({ status: 'complete', last_researched_at: new Date().toISOString() })
      .eq('id', project_id)

    // Count this run against the user's monthly keyword-session allowance.
    await incrementKeywordSession(user.id, supabase)

    return NextResponse.json({
      success: true,
      count: rows.length,
      // Surfaced when a raw seed_topic was rewritten by the intent layer, so the
      // UI can show "Searching for: …" with the keywords actually queried.
      resolved_seeds: interpretedFromRaw ? seedsToUse : undefined,
      original_seed: interpretedFromRaw ? rawSeedTopic : undefined,
    })
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
