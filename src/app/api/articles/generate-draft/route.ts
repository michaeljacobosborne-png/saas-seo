export const maxDuration = 300

import { NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ghlUpsertContact, ghlAddTags } from '@/lib/ghl'
import { logUsageEvent } from '@/lib/usage'
import { authorFromProfile } from '@/lib/article-scores'
import { runDraftPipeline, type Chat } from '@/lib/generator/pipeline'
import type { EvidenceSource } from '@/lib/generator/evidence-guard'
import type OpenAI from 'openai'
import OpenAIDefault from 'openai'

const openai = new OpenAIDefault({ apiKey: process.env.OPENAI_API_KEY })

// Accumulates token usage across the draft pipeline's model calls so we can
// log one usage_event per model (gpt-4o for the writing passes, gpt-4o-mini for
// the cheap rewrite passes).
type UsageTally = { gpt4oIn: number; gpt4oOut: number; miniIn: number; miniOut: number }
function addUsage(tally: UsageTally, model: 'gpt-4o' | 'gpt-4o-mini', usage?: OpenAI.CompletionUsage | null) {
  if (!usage) return
  if (model === 'gpt-4o') {
    tally.gpt4oIn += usage.prompt_tokens
    tally.gpt4oOut += usage.completion_tokens
  } else {
    tally.miniIn += usage.prompt_tokens
    tally.miniOut += usage.completion_tokens
  }
}

const asConstraintList = (v: unknown): string =>
  Array.isArray(v) ? v.filter(Boolean).join(', ') : typeof v === 'string' ? v.trim() : ''

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { articleId: string; target_word_count?: number; evidence?: string }
  const { articleId } = body
  if (!articleId) return NextResponse.json({ error: 'articleId is required' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const [{ data: article }, { data: profileData }, { data: subData }] = await Promise.all([
    sb.from('articles').select('id, title, brief, brand_profile_id, keyword_project_id, target_keyword').eq('id', articleId).eq('user_id', user.id).single(),
    sb.from('profiles').select('account_type').eq('user_id', user.id).maybeSingle(),
    sb.from('subscriptions').select('plan, status').eq('user_id', user.id).eq('status', 'active').limit(1).maybeSingle(),
  ])

  if (!article) return NextResponse.json({ error: 'Article not found' }, { status: 404 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const brief = article.brief as Record<string, any>
  if (!brief) return NextResponse.json({ error: 'No brief found — generate a brief first' }, { status: 400 })

  // A target, not a quota: the pipeline aims for 85–110% and lets a complete
  // shorter article stand (generator audit change 11).
  const targetWordCount = body.target_word_count ?? (brief.word_count_target as number | undefined) ?? 1500

  // `*` so the author columns are picked up whether or not that migration ran.
  const { data: brand } = article.brand_profile_id
    ? await sb.from('brand_profiles').select('*').eq('id', article.brand_profile_id).eq('user_id', user.id).single()
    : { data: null }

  // Polish pass on Growth and Multi-Brand plans.
  const activeSub = subData as { plan: string } | null
  const runPolishPass =
    (profileData?.account_type ?? null) !== 'free' &&
    (activeSub?.plan === 'pro' || activeSub?.plan === 'agency' || activeSub?.plan === 'team')

  // The only facts the writer may use: what the user supplied for this article.
  const evidenceText = (typeof body.evidence === 'string' ? body.evidence : (brief.user_evidence as string | undefined) ?? '').trim()
  const sources: EvidenceSource[] = evidenceText ? [{ label: 'Supplied by the writer for this article', text: evidenceText }] : []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const outlineText = (brief.outline as any[] ?? []).map((s: any) => {
    const hLevel = s.heading_level === 'H3' ? '###' : '##'
    return `${hLevel} ${s.heading}\n  → ${s.notes} (~${s.word_count_target} words)`
  }).join('\n\n')

  const setStatus = async (status: string) => {
    const { error } = await sb.from('articles').update({ status }).eq('id', articleId).eq('user_id', user.id)
    return error as { message: string } | null
  }

  // Fatal if we cannot even flip to 'generating': the final save would fail too.
  const generatingErr = await setStatus('generating')
  if (generatingErr) {
    console.error(`generate-draft: failed to set status=generating for article ${articleId}: ${generatingErr.message}`)
    return NextResponse.json({ error: generatingErr.message }, { status: 500 })
  }

  const tally: UsageTally = { gpt4oIn: 0, gpt4oOut: 0, miniIn: 0, miniOut: 0 }
  const chat: Chat = async (req) => {
    const model = req.model === 'main' ? 'gpt-4o' : 'gpt-4o-mini'
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        ...(req.system ? [{ role: 'system' as const, content: req.system }] : []),
        { role: 'user' as const, content: req.user },
      ],
      temperature: req.temperature,
      max_tokens: req.maxTokens,
      ...(req.json ? { response_format: { type: 'json_object' as const } } : {}),
    })
    addUsage(tally, model, completion.usage)
    return completion.choices[0].message.content ?? ''
  }

  const keyword = (article.target_keyword ?? brief.target_keyword ?? '') as string
  let result
  try {
    result = await runDraftPipeline(chat, {
      articleId,
      brand: {
        name: brand?.brand_name ?? null,
        voice: brand?.brand_voice,
        tone: brand?.tone_notes,
        audience: brand?.target_audience,
        industry: brand?.industry,
        expertiseNotes: brand?.expertise_notes,
        signatureAngles: brand?.signature_angles,
        avoidTopics: asConstraintList(brand?.avoid_topics),
        avoidPhrases: asConstraintList(brand?.avoid_phrases),
        competitors: asConstraintList(brand?.competitors),
      },
      author: authorFromProfile(brand),
      sources,
      keyword,
      secondaryKeywords: (brief.secondary_keywords as string[]) ?? [],
      title: (article.title as string | null) ?? (brief.h1_options as string[])?.[0] ?? keyword,
      serpIntent: (brief.serp_intent as string) ?? 'informational',
      toneNotes: (brief.tone_notes as string) ?? brand?.tone_notes ?? '',
      competitorGaps: (brief.competitor_gaps as string[]) ?? [],
      directAnswer: (brief.direct_answer as string | undefined) ?? null,
      outlineText,
      targetWordCount,
      polish: runPolishPass,
      onStage: async (stage) => {
        if (stage === 'generating') return
        const err = await setStatus(stage)
        // Progress indicator only: never abort paid-for work over it.
        if (err) console.error(`generate-draft: failed to set status=${stage} for article ${articleId}: ${err.message}`)
      },
    })
  } catch (err) {
    await setStatus('brief_ready')
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `AI generation failed: ${msg}` }, { status: 500 })
  }

  const { content, wordCount, passCount, report } = result
  const { error: updateError } = await sb
    .from('articles')
    .update({
      content,
      word_count: wordCount,
      status: 'ready',
      target_word_count: targetWordCount,
      pass_count: passCount,
      // What the guard replaced and what the engine gate did, kept with the brief
      // so the writer can see which placeholders need real evidence.
      brief: { ...brief, user_evidence: evidenceText || undefined, generation_report: report },
    })
    .eq('id', articleId)
    .eq('user_id', user.id)

  if (updateError) {
    // Never leave the article stranded in an in-flight status.
    console.error(`generate-draft: final save failed for article ${articleId}: ${updateError.message}`)
    await setStatus('brief_ready')
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // First-article activation event → GoHighLevel. Best-effort, never blocks/throws.
  if (user.email) {
    const email = user.email
    after(async () => {
      const { count, error: countError } = await sb
        .from('articles')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'ready')
      if (countError || count !== 1) return
      const contactId = await ghlUpsertContact({ email, customFields: { articles_generated: 1 } })
      if (!contactId) return
      await ghlAddTags(contactId, ['first_article_generated'])
    })
  }

  after(() => {
    if (tally.gpt4oIn || tally.gpt4oOut) {
      void logUsageEvent({ userId: user.id, feature: 'draft_gen', model: 'gpt-4o', inputTokens: tally.gpt4oIn, outputTokens: tally.gpt4oOut })
    }
    if (tally.miniIn || tally.miniOut) {
      void logUsageEvent({ userId: user.id, feature: 'draft_gen', model: 'gpt-4o-mini', inputTokens: tally.miniIn, outputTokens: tally.miniOut })
    }
  })

  return NextResponse.json({
    content,
    word_count: wordCount,
    pass_count: passCount,
    evidence_placeholders: report.evidenceReplaced.length,
  })
}
