import { NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ArticleScores } from '@/lib/supabase/types'
import { ghlUpsertContact, ghlAddTags } from '@/lib/ghl'
import { logUsageEvent } from '@/lib/usage'
import Anthropic from '@anthropic-ai/sdk'

const AGENT_MODEL = 'claude-sonnet-4-6'

// Sentinel stored in agent_memory (account-level) to mark that the
// first-agent-session GHL event already fired for this user — mirrors the
// existing `expertise_nudge_shown` marker pattern, so no schema change needed.
const GHL_AGENT_USED_MARKER = 'ghl_agent_used_fired'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Auto-mode rewrites stream up to 8192 tokens, which can run well past the
// default serverless timeout. When the platform kills the function mid-stream,
// the connection is severed without a clean close and the client's reader.read()
// hangs forever (frozen spinner). Give the function room to finish the stream.
export const maxDuration = 60

type Message = { role: 'user' | 'assistant'; content: string }

function buildFailedList(breakdown: Record<string, { label: string; passed?: boolean }>): string {
  const failed = Object.values(breakdown)
    .filter((c) => c.passed === false)
    .map((c) => `- ${c.label}`)
  return failed.length ? failed.join('\n') : '(none)'
}

function buildMemoryNote(title: string, messages: Message[], response: string): string {
  const question = messages.find((m) => m.role === 'user')?.content?.slice(0, 120) ?? ''
  const snippet = response.replace(/\n+/g, ' ').slice(0, 250).trim()
  return `"${title}": Asked "${question}" → ${snippet}`
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { messages, mode, selectedText, fixInstruction, userInstruction } = await request.json() as {
    messages: Message[]
    mode?: 'review' | 'assist' | 'auto' | 'patch'
    selectedText?: string
    fixInstruction?: string
    userInstruction?: string   // optional focus instructions for auto mode
  }

  // Free tier: gate assist mode and enforce 3-turn cap on review
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('account_type, agent_turns_used')
    .eq('user_id', user.id)
    .maybeSingle()

  const isFree = profile?.account_type === 'free'

  if (isFree && mode === 'assist') {
    return NextResponse.json({
      error: 'Assist mode is available on paid plans. Upgrade to let the agent rewrite sections of your article directly.',
    }, { status: 403 })
  }

  if (isFree && mode === 'auto') {
    return NextResponse.json({
      error: 'Auto mode is available on paid plans. Upgrade to let the agent rewrite your full article automatically.',
    }, { status: 403 })
  }

  if (isFree && mode === 'patch') {
    return NextResponse.json({
      error: 'Patch mode is available on paid plans. Upgrade to let the agent make targeted fixes to your article.',
    }, { status: 403 })
  }

  if (isFree) {
    const turnsUsed = ((profile?.agent_turns_used as Record<string, number>) ?? {})[id] ?? 0
    if (turnsUsed >= 3) {
      return NextResponse.json({
        error: "You've used your 3 free agent turns on this article. Upgrade to get unlimited agent access.",
        code: 'FREE_TIER_LIMIT',
      }, { status: 403 })
    }
  }

  // First agent session activation event → GoHighLevel. Runs after the response
  // (the response is a stream, so after() fires once it closes) and is gated by a
  // one-time account-level sentinel so it fires exactly once per user across all
  // modes. Best-effort, never blocks/throws.
  if (user.email) {
    const email = user.email
    after(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any
      const { data: marker } = await sb
        .from('agent_memory')
        .select('id')
        .eq('user_id', user.id)
        .eq('memory_type', 'account')
        .eq('content', GHL_AGENT_USED_MARKER)
        .limit(1)
        .maybeSingle()
      if (marker) return // already fired

      // Claim the marker first so concurrent first sessions don't double-fire.
      await sb.from('agent_memory').insert({
        user_id: user.id,
        article_id: id,
        memory_type: 'account',
        content: GHL_AGENT_USED_MARKER,
      })

      const contactId = await ghlUpsertContact({
        email,
        customFields: { agent_sessions: 1 },
      })
      if (!contactId) return
      await ghlAddTags(contactId, ['agent_used'])
    })
  }

  // Fetch article first (required for everything else)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: article } = await (supabase as any)
    .from('articles')
    .select('title, target_keyword, word_count, content, scores, brand_profile_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!article) return NextResponse.json({ error: 'Article not found' }, { status: 404 })

  // Parallel: brand profile + account memory + article memory + content gaps
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseAny = supabase as any
  const [brandResult, accountMemResult, articleMemResult, contentGapsResult] = await Promise.all([
    article.brand_profile_id
      ? supabaseAny.from('brand_profiles').select('brand_name, brand_voice, tone_notes, expertise_notes, signature_angles').eq('id', article.brand_profile_id).eq('user_id', user.id).single()
      : Promise.resolve({ data: null }),
    supabaseAny.from('agent_memory').select('content').eq('user_id', user.id).eq('memory_type', 'account').order('updated_at', { ascending: false }).limit(5),
    supabaseAny.from('agent_memory').select('content').eq('user_id', user.id).eq('memory_type', 'article').eq('article_id', id).order('updated_at', { ascending: false }).limit(3),
    supabaseAny.from('saved_keywords').select('keyword, folder').eq('user_id', user.id).eq('has_article', false).order('created_at', { ascending: false }).limit(10),
  ])

  const brand = brandResult.data
  // Gracefully handle missing table (before migration is applied)
  const accountMemory: Array<{ content: string }> = accountMemResult.data ?? []
  const articleMemory: Array<{ content: string }> = articleMemResult.data ?? []
  const contentGaps: Array<{ keyword: string; folder: string }> = contentGapsResult.data ?? []

  const scores = article.scores as ArticleScores | null
  const fullContent = article.content ?? ''

  const weakAreasSection = scores ? `
WEAK AREAS TO PRIORITIZE (translate into specific editorial actions — do NOT recite verbatim):
SEO gaps:
${buildFailedList(scores.seo.breakdown)}
AEO gaps:
${buildFailedList(scores.aeo.breakdown as Record<string, { label: string; passed?: boolean }>)}
GEO gaps:
${buildFailedList(scores.geo.breakdown as Record<string, { label: string; passed?: boolean }>)}` : `
SCORING CONTEXT: Article not yet scored. Focus purely on the content above.`

  const memoryLines: string[] = []
  if (accountMemory.length) {
    memoryLines.push(`Account context:\n${accountMemory.map((m) => `- ${m.content}`).join('\n')}`)
  }
  if (articleMemory.length) {
    memoryLines.push(`Previous sessions on this article:\n${articleMemory.map((m) => `- ${m.content}`).join('\n')}`)
  }
  const memorySection = memoryLines.length
    ? `\nMEMORY FROM PREVIOUS SESSIONS (use to avoid repeating prior feedback — build on it, go deeper):\n${memoryLines.join('\n\n')}\n`
    : ''

  const contentGapsSection = contentGaps.length
    ? `\nCONTENT GAPS (keywords saved but not yet written — mention proactively if relevant to the current article):\n${contentGaps.map((g) => `- ${g.keyword} (folder: ${g.folder})`).join('\n')}\n`
    : ''

  const articleTitle = article.title ?? article.target_keyword ?? 'article'

  if (mode === 'assist') {
    const assistSystem = `You are in Assist mode. Your ONLY job is to return improved content — no commentary, no explanation, no preamble.

ARTICLE CONTEXT:
Title: ${articleTitle}
Target keyword: "${article.target_keyword ?? '(none set)'}"
${brand?.brand_name ? `Brand: ${brand.brand_name} | Voice: ${brand?.brand_voice ?? 'professional'}` : ''}
${brand?.tone_notes ? `Tone notes: ${brand.tone_notes}` : ''}
${brand?.expertise_notes ? `\nAUTHOR EXPERTISE (use this to ground the article in real experience):\n${brand.expertise_notes}` : ''}
${brand?.signature_angles ? `\nSIGNATURE ANGLES (reinforce these perspectives in rewrites):\n${brand.signature_angles}` : ''}

FULL ARTICLE CONTENT (for tone/style reference):
${fullContent}

Rules:
- Return ONLY the rewritten/new content in clean markdown
- Match the article's existing tone, sentence length, and formatting style exactly
- If rewriting selected text: return only what replaces that text
- If adding a new section: return just that section, formatted with the correct heading level
ANTI-SLOP EDITORIAL STANDARDS:
- Active voice. Find the human doing the action. Never: "The data suggests" — always: "Researchers found."
- Kill adverbs. If the verb needs one, replace the verb.
- No Wh- starters: What makes this / Which means / Why this matters — banned.
- No binary contrasts: "Not X — it's Y." Just say Y.
- No vague declaratives: "The implications are significant." Name the implication.
- No throat-clearing: It's worth noting / Importantly / Interestingly / Notably / Ultimately / Essentially.
- Em dashes (—) are banned. Replace with a comma, parentheses, or colon.
- No quotable one-liners ending paragraphs.
- No inanimate subjects doing human actions.
- Banned words: delve, leverage, robust, seamlessly, crucial, cutting-edge, game-changer, revolutionary, transformative, unprecedented, dive into, in today's landscape, moreover, furthermore, utilize, facilitate.
- Sentence variety: never three of matching length in a row.
- Every rewrite must sound like it was written by someone who knows this subject cold — not by a model following instructions.
- Never add a preamble like "Here's the rewritten version:" — just return the content`

    const userMessage = selectedText
      ? `${selectedText}\n\nInstruction: ${fixInstruction ?? ''}`
      : (fixInstruction ?? '')

    const assistStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        try {
          const anthropicStream = anthropic.messages.stream({
            model: AGENT_MODEL,
            max_tokens: 2048,
            system: assistSystem,
            messages: [{ role: 'user', content: userMessage }],
          })
          for await (const event of anthropicStream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              controller.enqueue(encoder.encode(event.delta.text))
            }
          }
          // Cost tracking — usage is on the final assembled message.
          try {
            const fm = await anthropicStream.finalMessage()
            await logUsageEvent({ userId: user.id, feature: 'agent_assist', model: AGENT_MODEL, inputTokens: fm.usage.input_tokens, outputTokens: fm.usage.output_tokens })
          } catch { /* never block the stream on cost logging */ }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Stream error'
          controller.enqueue(encoder.encode(`\n\n[Error: ${msg}]`))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(assistStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  }

  if (mode === 'auto') {
    const autoSystem = `You are a professional SEO editor performing a comprehensive article rewrite. Apply ALL failing audit criteria and fix ALL weak areas in one pass. Return ONLY the complete revised article in clean markdown — no preamble, no commentary, no explanation before or after.

ARTICLE CONTEXT:
Title: ${articleTitle}
Target keyword: "${article.target_keyword ?? '(none set)'}"
${brand?.brand_name ? `Brand: ${brand.brand_name} | Voice: ${brand?.brand_voice ?? 'professional'}` : ''}
${brand?.tone_notes ? `Tone notes: ${brand.tone_notes}` : ''}
${brand?.expertise_notes ? `\nAUTHOR EXPERTISE (preserve this voice and perspective throughout):\n${brand.expertise_notes}` : ''}
${brand?.signature_angles ? `\nSIGNATURE ANGLES (reinforce these throughout the rewrite):\n${brand.signature_angles}` : ''}
${weakAreasSection}

FULL ARTICLE TO REWRITE:
${fullContent}

REWRITE INSTRUCTIONS:
- Fix every failing criterion listed in the weak areas above
- Preserve the author's voice, tone, sentence rhythm, and formatting style throughout
- Keep all sections and structural elements that are already working
- Add or strengthen sections needed to pass failing criteria
- Do not add a preamble, intro, or any commentary — return the article content only
ANTI-SLOP STANDARDS (apply throughout the rewrite):
- Active voice. Find the human doing the action. Never: "The data suggests" — always: "Researchers found."
- Kill adverbs. If the verb needs one, replace the verb.
- No Wh- starters: What makes this / Which means / Why this matters — banned.
- No binary contrasts: "Not X — it's Y." Just say Y.
- No vague declaratives: "The implications are significant." Name the implication.
- No throat-clearing: It's worth noting / Importantly / Interestingly / Notably / Ultimately / Essentially.
- Em dashes (—) are banned. Replace with a comma, parentheses, or colon.
- No quotable one-liners ending paragraphs.
- No inanimate subjects doing human actions.
- Banned words: delve, leverage, robust, seamlessly, crucial, cutting-edge, game-changer, revolutionary, transformative, unprecedented, dive into, in today's landscape, moreover, furthermore, utilize, facilitate.
- Sentence variety: never three of matching length in a row.`

    const autoUserMessage = userInstruction
      ? `Rewrite the article now, applying all failing criteria and returning the complete revised article.\n\nAdditional focus: ${userInstruction}`
      : 'Rewrite the article now, applying all failing criteria and returning the complete revised article.'

    const autoStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        try {
          const anthropicStream = anthropic.messages.stream({
            model: AGENT_MODEL,
            max_tokens: 8192,
            system: autoSystem,
            messages: [{ role: 'user', content: autoUserMessage }],
          })
          for await (const event of anthropicStream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              controller.enqueue(encoder.encode(event.delta.text))
            }
          }
          // Cost tracking — usage is on the final assembled message.
          try {
            const fm = await anthropicStream.finalMessage()
            await logUsageEvent({ userId: user.id, feature: 'agent_auto', model: AGENT_MODEL, inputTokens: fm.usage.input_tokens, outputTokens: fm.usage.output_tokens })
          } catch { /* never block the stream on cost logging */ }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Stream error'
          controller.enqueue(encoder.encode(`\n\n[Error: ${msg}]`))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(autoStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  }

  if (mode === 'patch') {
    const patchSystem = `You are a targeted SEO editor. Your job is to fix ONE specific issue in the article.

ARTICLE CONTEXT:
Title: ${articleTitle}
Target keyword: "${article.target_keyword ?? '(none set)'}"
${brand?.brand_name ? `Brand: ${brand.brand_name} | Voice: ${brand?.brand_voice ?? 'professional'}` : ''}
${brand?.tone_notes ? `Tone notes: ${brand.tone_notes}` : ''}
${brand?.expertise_notes ? `\nAUTHOR EXPERTISE:\n${brand.expertise_notes}` : ''}
${brand?.signature_angles ? `\nSIGNATURE ANGLES:\n${brand.signature_angles}` : ''}

FULL ARTICLE (current):
${fullContent}

YOUR RESPONSE MUST start with EXACTLY one of these two lines (no spaces, no punctuation):
PATCH:APPEND
PATCH:REPLACE

Then on the very next line, a one-sentence summary prefixed with SUMMARY: that describes what you changed.

Then a blank line.

Then the content.

Rules:
- PATCH:APPEND — Use when the fix only requires ADDING a new section (FAQ, statistics callout, author bio, CTA, schema note, etc). Return ONLY the new section(s) in clean markdown. Do NOT return the rest of the article.
- PATCH:REPLACE — Use when the fix requires changes scattered throughout (keyword density, heading restructure, readability). Return the COMPLETE revised article in clean markdown.
- Match the article's existing tone and formatting style.
- No preamble. No "Here is the..." commentary. Output starts with PATCH:APPEND or PATCH:REPLACE.
ANTI-SLOP STANDARDS:
- Active voice. Kill adverbs. No throat-clearing (Importantly, Notably, Ultimately, Essentially).
- Em dashes (—) are banned. Replace with a comma, parentheses, or colon.
- No Wh- starters: What makes this / Which means / Why this matters.
- No binary contrasts: "Not X — it's Y."
- No inanimate subjects doing human actions.
- Banned words: delve, leverage, robust, seamlessly, crucial, cutting-edge, game-changer, revolutionary, transformative, unprecedented, dive into, moreover, furthermore, utilize, facilitate.`

    const patchStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        try {
          const anthropicStream = anthropic.messages.stream({
            model: AGENT_MODEL,
            max_tokens: 8192,
            system: patchSystem,
            messages: [{ role: 'user', content: `Fix this specific issue: ${userInstruction ?? 'improve the article'}` }],
          })
          for await (const event of anthropicStream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              controller.enqueue(encoder.encode(event.delta.text))
            }
          }
          try {
            const fm = await anthropicStream.finalMessage()
            await logUsageEvent({ userId: user.id, feature: 'agent_patch', model: AGENT_MODEL, inputTokens: fm.usage.input_tokens, outputTokens: fm.usage.output_tokens })
          } catch { /* never block the stream on cost logging */ }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Stream error'
          controller.enqueue(encoder.encode(`\n\n[Error: ${msg}]`))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(patchStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  }

  const expertiseSection = [
    brand?.expertise_notes ? `AUTHOR EXPERTISE (use this to ground the article in real experience):\n${brand.expertise_notes}` : '',
    brand?.signature_angles ? `SIGNATURE ANGLES (reinforce these perspectives in rewrites):\n${brand.signature_angles}` : '',
  ].filter(Boolean).join('\n\n')

  const nudgeAlreadyShown = accountMemory.some((m) => m.content === 'expertise_nudge_shown')
  const shouldNudge = !brand?.expertise_notes && !nudgeAlreadyShown

  const systemPrompt = `You are a senior SEO editor. Your job is to give specific, editorial feedback on the actual article content — not restate scores or metrics. When reviewing, cite specific lines or sections. When asked how to fix something, provide an example rewrite or concrete edit. Never repeat advice already given in this conversation.
When you review the article, flag any anti-slop violations you find — passive voice, banned words, Wh- starters, adverb clusters, vague declaratives. Quote the offending line and suggest a rewrite. These are as important as SEO score failures.
${memorySection}${contentGapsSection}
ARTICLE UNDER REVIEW:
Title: ${articleTitle}
Target keyword: "${article.target_keyword ?? '(none set)'}"
Word count: ${article.word_count ?? 'unknown'}
${brand?.brand_name ? `Brand: ${brand.brand_name} | Voice: ${brand?.brand_voice ?? 'professional'}` : ''}
${brand?.tone_notes ? `Tone notes: ${brand.tone_notes}` : ''}
${expertiseSection ? `\n${expertiseSection}` : ''}
${weakAreasSection}

FULL ARTICLE CONTENT:
${fullContent}

HOW TO BEHAVE:
- Read the article above and give paragraph-level, line-level observations. Quote the actual text when making a point. Example: "Your intro buries the keyword — it doesn't appear until the third sentence. Rewrite the opener as: '${article.target_keyword ?? 'your keyword'} is…'"
- Use the weak areas list to know what to look for — but turn each failure into a specific fix. Never say "keyword missing from H1." Instead say "Your H1 reads 'Getting Started with X' — change it to 'How to ${article.target_keyword ?? 'keyword'} in 5 Steps'."
- On follow-up questions: go DEEPER. Give the actual rewrite, the exact FAQ question to add, the specific H2 to rename. Do not restate what you already said.
- Be concise. Answer the specific question asked. Maximum 3-4 sentences unless a detailed rewrite is requested. Never write more than 3 bullet points without pausing to ask if they want to go deeper.
- When rewriting a section, match the tone, sentence length, and formatting style of the surrounding content. If the article uses short punchy sentences, do not write long flowing prose. If it uses numbered lists, maintain numbered lists. Never change the structural format of sections you are not asked to change.
- Prioritize fixes by editorial impact: structure and keyword placement first, then content depth, then polish.
- Be direct. The user is a professional.
ANTI-SLOP EDITORIAL STANDARDS:
- Active voice. Find the human doing the action. Never: "The data suggests" — always: "Researchers found."
- Kill adverbs. If the verb needs one, replace the verb.
- No Wh- starters: What makes this / Which means / Why this matters — banned.
- No binary contrasts: "Not X — it's Y." Just say Y.
- No vague declaratives: "The implications are significant." Name the implication.
- No throat-clearing: It's worth noting / Importantly / Interestingly / Notably / Ultimately / Essentially.
- Em dashes (—) are banned. Replace with a comma, parentheses, or colon.
- No quotable one-liners ending paragraphs.
- No inanimate subjects doing human actions.
- Banned words: delve, leverage, robust, seamlessly, crucial, cutting-edge, game-changer, revolutionary, transformative, unprecedented, dive into, in today's landscape, moreover, furthermore, utilize, facilitate.
- Sentence variety: never three of matching length in a row.
- Every rewrite must sound like it was written by someone who knows this subject cold — not by a model following instructions.`

  const stream = new ReadableStream({
    async start(controller) {
      let fullResponse = ''
      const encoder = new TextEncoder()
      try {
        const anthropicStream = anthropic.messages.stream({
          model: AGENT_MODEL,
          max_tokens: 2048,
          system: systemPrompt,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        })
        for await (const event of anthropicStream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            fullResponse += event.delta.text
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }
        // Cost tracking — usage is on the final assembled message.
        try {
          const fm = await anthropicStream.finalMessage()
          await logUsageEvent({ userId: user.id, feature: 'agent_review', model: AGENT_MODEL, inputTokens: fm.usage.input_tokens, outputTokens: fm.usage.output_tokens })
        } catch { /* never block the stream on cost logging */ }
        // Expertise nudge — append once if brand has no expertise notes and nudge not yet shown
        if (shouldNudge && fullResponse) {
          const nudgeText = '\n\n---\n*One thing that would improve every article I write for you: add your personal expertise and signature angles to your brand profile. Even rough notes work — it\'s the difference between content that ranks and content that actually sounds like you.*'
          controller.enqueue(encoder.encode(nudgeText))
          await supabaseAny.from('agent_memory').insert({
            user_id: user.id,
            article_id: id,
            memory_type: 'account',
            content: 'expertise_nudge_shown',
          })
        }
        // Save session memory after all tokens are streamed
        if (fullResponse && messages.length > 0) {
          const note = buildMemoryNote(articleTitle, messages, fullResponse)
          await supabaseAny.from('agent_memory').insert({
            user_id: user.id,
            article_id: id,
            memory_type: 'article',
            content: note,
          })
        }
        // Increment free tier review turn counter
        if (isFree && fullResponse) {
          const currentTurns = ((profile?.agent_turns_used as Record<string, number>) ?? {})[id] ?? 0
          await supabaseAny.from('profiles').update({
            agent_turns_used: { ...(profile?.agent_turns_used as Record<string, number> ?? {}), [id]: currentTurns + 1 },
            updated_at: new Date().toISOString(),
          }).eq('user_id', user.id)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stream error'
        controller.enqueue(encoder.encode(`\n\n[Error: ${msg}]`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}