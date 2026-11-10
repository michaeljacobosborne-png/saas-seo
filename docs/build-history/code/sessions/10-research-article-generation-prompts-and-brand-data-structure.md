# Research article generation prompts and brand data structure

- Session `cf906479-7330-47a2-aa71-f69cea16986f`
- 2026-06-17 07:20 to 2026-06-17 07:22
- Branch: `master`  |  Claude Code 2.1.170

**Files touched (4):** `src/app/api/articles/generate-draft/route.ts`, `src/app/api/articles/generate-brief/route.ts`, `src/lib/keyword-intent.ts`, `src/app/api/articles/score/route.ts`

---


## Michael

Research only — no changes. I need to understand exactly how article drafts are generated today before rewriting the prompts.

Read these files completely and report back:
1. src/app/api/articles/generate-draft/route.ts — the full system prompt and user prompt used to generate the draft, how brand profile data is injected, how scoring/rubric is passed
2. src/app/api/articles/generate-brief/route.ts — how the brief/outline is built
3. Any file in src/lib/ or src/prompts/ that contains generation prompts (check for constants or template strings with "system", "prompt", "instruction" etc.)
4. How the brand profile data is structured when passed to generation (check what fields from brand_profiles table are used)
5. How the scoring rubric (SEO, AEO, GEO, Readability) is computed — is it pre-draft or post-draft?

Report the full current system prompt text verbatim, plus the brand profile fields that are injected into generation.

**Claude:** I'll research the draft generation flow. Let me start by reading the two named route files and searching for prompt files in parallel.

> `Read: src/app/api/articles/generate-draft/route.ts`

> `Read: src/app/api/articles/generate-brief/route.ts`

> `Grep: system|prompt|instruction|rubric|You are`

> `Glob: src/prompts/**`

**Claude:** Now let me find the scoring/rubric computation and check the keyword-intent prompt (used by the brief's direct-mode path).

> `Grep: AEO|GEO|readability|Readability|seo_score|rubric|computeScore|scoreArticle`

> `Read: src/lib/keyword-intent.ts`

**Claude:** Now the scoring route — this is question 5 (pre- vs post-draft) and the rubric.

> `Read: src/app/api/articles/score/route.ts`

**Claude:** I have everything needed. Here's the complete picture.

---

# How Article Drafts Are Generated Today

## Pipeline overview

The flow is three separate API routes, called in sequence by the UI:

1. **`generate-brief`** → produces a JSON brief/outline (stored in `articles.brief`)
2. **`generate-draft`** → writes the full markdown article from that brief (multi-pass)
3. **`score`** → computes SEO/AEO/GEO/Readability **after** the draft exists (post-draft, deterministic — no AI)

There is **no `src/prompts/` directory and no shared prompt constants file**. Every prompt is an inline template string inside its route. The only prompt living in `src/lib/` is the keyword-seed interpreter (`keyword-intent.ts`), which feeds the brief's quick-write path.

All generation uses **OpenAI `gpt-4o` / `gpt-4o-mini`** (not Claude). The only Claude call in this flow is the keyword-intent seed interpreter (`claude-sonnet-4-6`).

---

## 1. The draft system prompt — VERBATIM

From `src/app/api/articles/generate-draft/route.ts:101-145`. Variables interpolated: `${brandName}`, `${brandVoice}`, `${toneNotes}`, `${audience}`, `${expertiseBlock}`.

```
You are an expert SEO content writer for ${brandName}.

BRAND VOICE: ${brandVoice}
TONE: ${toneNotes}
AUDIENCE: ${audience}
${expertiseBlock ? `\n${expertiseBlock}\n` : ''}

═══ HUMANIZATION RULES (non-negotiable) ═══
• Vary sentence length deliberately — a 6-word sentence after a 30-word one creates rhythm. Never three sentences of matching length in a row.
• Use contractions (it's, you'll, that's, don't, you're, there's) — their absence is an AI tell.
• Write the intro as a problem, consequence, or tension — never a definition, never "In this article we'll cover..."
• Use editorial transitions sparingly and purposefully: "Here's the thing." / "That matters because..." / "Most people skip this part." / "The catch:" — max one per section.
• Include specific numbers, named tools, concrete examples. Vague generalities are a sign you don't know the subject.
• Intro a list with a sentence, follow it with a sentence. Never dump raw bullets without context.

═══ ANTI-SLOP RULES (non-negotiable) ═══
• Active voice only. Find the human doing the action. Make them the subject. "Researchers found" not "The data suggests."
• Kill every adverb. If the verb needs an adverb, find a stronger verb.
• No Wh- sentence starters: no "What makes this...", "Which means...", "Why this matters..."
• No binary contrasts: not "Not X — it's Y." Just say Y.
• No vague declaratives: not "The implications are significant." Name the specific implication.
• No throat-clearing openers: never start a sentence with It's worth noting / Importantly / Interestingly / Notably / Ultimately / Essentially.
• No quotable one-liners dangling at the end of paragraphs. That's AI finishing a thought cinematically.
• No inanimate subjects doing human verbs: "This approach enables..." → "You can now..."
• No false urgency or hype: game-changer, revolutionary, transformative, unprecedented, powerful — cut them all.
• Banned words: delve, leverage, robust, seamlessly, crucial, cutting-edge, dive into, it's worth noting, in today's landscape, moreover, furthermore, utilize (use "use"), facilitate (use "help"), implement (use "build" or "run").
• No em dashes used dramatically. If you need an em dash for a parenthetical, use parentheses or a comma.
• Every paragraph must earn its place. If removing it loses nothing, cut it.

═══ SEO RULES (apply strictly) ═══
• Target keyword must appear: in the H1, within the first 100 words, in at least one H2, and in the meta (meta goes in brief, not body)
• Secondary keywords distributed naturally — never stuffed, never repeated within the same paragraph
• Include a FAQ section with 3-5 questions (each as H3, answer immediately follows as a paragraph)
• Include a "Key Takeaways" section

═══ AEO RULES (Answer Engine Optimization) ═══
• At least one paragraph (40-60 words) that directly answers "What is [topic]?" — natural prose, not a heading
• Every FAQ H3 question gets an immediate paragraph answer (40-80 words) before any next heading

═══ GEO RULES (Generative Engine Optimization) ═══
• Include at least one definitional statement per major H2 section (AI engines pull these)
• Include one stat/data sentence per H2 section — citing a general category is fine: "According to DataForSEO research..." or "Industry benchmarks show..."
• Clear H2 hierarchy — each H2 section is self-contained and scannable

Write in Markdown. Use # for H1, ## for H2, ### for H3. Do not include the meta description in the body. Start directly with the # H1.
```

### The draft user prompt — VERBATIM (`route.ts:147-162`)

```
Write a complete SEO article using the brief below.

TARGET KEYWORD: ${brief.target_keyword}
SECONDARY KEYWORDS: ${(brief.secondary_keywords ?? []).join(', ')}
H1: ${brief.h1_options?.[0] ?? brief.target_keyword}
SERP INTENT: ${brief.serp_intent ?? 'informational'}
TONE NOTES: ${brief.tone_notes ?? toneNotes}
COMPETITOR GAPS TO ADDRESS: ${(brief.competitor_gaps ?? []).join('; ')}
TARGET WORD COUNT: ${targetWordCount}

WORD COUNT REQUIREMENT: The article must be exactly ${targetWordCount} words. Do not go under. If content runs short, add a relevant FAQ section, case study, or deeper analysis section — never add filler.

OUTLINE:
${outlineText}

Write the full article now.
```

Model: `gpt-4o`, `temperature: 0.7`, `max_tokens: 3800`. `targetWordCount` defaults to **1200** (note the mismatch — the brief asks for ~2100; see gotchas below).

### Draft multi-pass structure (important context for a rewrite)

The draft is **not a single call**. There are up to three stages:

- **Pass 1** — the system+user prompts above (`route.ts:179-202`).
- **Pass 2 (expansion)** — fires only if Pass 1 is **< 85% of target word count** (`route.ts:208-346`). Three sub-calls:
  - *Step A* (`gpt-4o-mini`, temp 0.3): "You are an SEO content strategist… identify 3-4 specific subtopics… Return a JSON object with key `angles`…"
  - *Step B*: pulls related keywords from DataForSEO / `keyword_cache` for those angles (no LLM).
  - *Step C* (`gpt-4o`, temp 0.7, max_tokens 5000): "You are a senior SEO editor. Your job is to expand the provided article to reach the target word count. Use ONLY the research data provided… Never add filler…"
- **Polish Pass** — **Growth/Agency plans only** (gated by `account_type !== 'free'` + Stripe price ID match, `route.ts:70-88, 348-487`). Generates 3 intro + 3 conclusion variants (`gpt-4o`, temp 0.85), then a `gpt-4o-mini` "editorial judge" picks the best of each, and the article's intro/conclusion are swapped in. Starter/Free never get this.

---

## 2. How the brief/outline is built (`generate-brief/route.ts`)

Single `gpt-4o` call, `temperature: 0.3`, `max_tokens: 1400`, `response_format: json_object`. **No separate system message** — everything is one user prompt (`route.ts:129-157`):

```
You are an SEO content strategist for ${brand.brand_name}${brand.industry ? `, a ${brand.industry} company` : ''}, targeting ${brand.target_audience ?? 'their ideal audience'}.

Brand voice: ${brand.brand_voice ?? 'professional'}
Tone notes: ${brand.tone_notes ?? 'none'}
Competitors: ${brand.competitors?.join(', ') || 'none'}
Brand keywords: ${brand.primary_keywords?.join(', ') || 'none'}
${brand.expertise_notes ? `\nExpertise: ${brand.expertise_notes}` : ''}
${brand.signature_angles ? `Content angles: ${brand.signature_angles}` : ''}

${isDirectMode ? `Article topic: "${directTopic}"\n` : ''}Keywords for this article:
${kwLines}

Generate a comprehensive SEO content brief. Return JSON only, no markdown:
{
  "target_keyword": "single best keyword to rank for from the list",
  "secondary_keywords": ["8-12 related terms to include naturally — mix from the list and related concepts"],
  "h1_options": ["Option 1 — compelling, specific, keyword-forward", "Option 2", "Option 3"],
  "meta_description": "155 chars max, includes target keyword, strong hook",
  "url_slug": "clean-keyword-rich-slug",
  "outline": [
    {"heading": "Section heading", "heading_level": "H2", "notes": "what to cover, specific angle, data to include", "word_count_target": 250}
  ],
  "word_count_target": 2100,
  "tone_notes": "specific writing guidance combining brand voice and keyword intent",
  "competitor_gaps": ["angle competitors likely miss", "angle 2", "angle 3"],
  "serp_intent": "informational"
}

Rules: outline must include an FAQ section (H2) with 3-5 H3 questions and a Key Takeaways H2. Total outline word_count_targets should sum to word_count_target.
```

`kwLines` is built two ways: **project mode** (keywords pulled from the `keywords` table for a research project) or **direct/quick-write mode** (topic → `interpretSeedQuery` Claude call → DataForSEO ideas).

The brief is stored in `articles.brief` (JSONB), plus `target_keyword`, `title`, `supporting_keywords`, `meta_description` columns.

---

## 3. Brand profile fields injected into generation

The two routes pull **different column subsets** from `brand_profiles`:

| Field | generate-brief | generate-draft | Notes |
|---|---|---|---|
| `brand_name` | ✅ | ✅ | draft falls back to `'the company'` |
| `industry` | ✅ | ❌ | brief only |
| `target_audience` | ✅ | ✅ (`audience`) | draft fallback `'readers looking to learn'` |
| `brand_voice` | ✅ | ✅ | fallback `'professional'` |
| `tone_notes` | ✅ | ✅ | draft fallback `'Clear, direct, evidence-backed.'` |
| `competitors` | ✅ | ❌ | brief only |
| `primary_keywords` | ✅ | ❌ | brief only |
| `content_goals` | ✅ (via keyword-intent) | ❌ | |
| `expertise_notes` | ✅ | ✅ | draft puts it in the "AUTHOR EXPERTISE" block |
| `signature_angles` | ✅ | ✅ | draft labels it "SIGNATURE ANGLES" |

**Draft `select`** (`generate-draft/route.ts:60`): `brand_name, brand_voice, tone_notes, target_audience, industry, expertise_notes, signature_angles` — but note `industry` is selected yet **never used** in the draft prompt.

**Brief `select`** (`generate-brief/route.ts:63`): `brand_name, industry, target_audience, brand_voice, tone_notes, competitors, primary_keywords, content_goals, expertise_notes, signature_angles`.

The `expertiseBlock` in the draft (`route.ts:96-99`):
```
═══ AUTHOR EXPERTISE (ground the article here) ═══
The author has real experience in this space. Where relevant, weave in or reference these perspectives naturally — don't quote them verbatim, use them to inform specific claims and examples:
${brand.expertise_notes}

SIGNATURE ANGLES: ${brand.signature_angles}
```

Fields that **exist in `BrandContext` but are NOT passed to draft generation**: `website_url`, `avoid_topics`, `avoid_phrases`. The "banned words" list is hardcoded in the prompt, not driven by the brand's `avoid_phrases`.

---

## 4. Scoring rubric — POST-draft, fully deterministic (no AI)

`src/app/api/articles/score/route.ts` runs **after** the draft is saved, as a separate user-triggered call. It reads `articles.content` + `articles.brief` and computes four scores with **regex/string heuristics only — zero LLM calls**. Results stored in `articles.scores`.

**SEO (`computeSEO`, sums to 100):** kw in H1 (15), kw in first 100 words (10), kw in meta (10), meta length 120–155 (5), 2–4 H2s (10), secondary kw coverage (up to 15, prorated), word count 1800–2500 (10), FAQ present (10), kw in slug (5), density < 3% (10).

**Readability (`computeReadability`, starts at 100, subtracts):** avg sentence length (target 15–20; −10/−25), passive-voice regex hits (target <5; −10/−20), avg paragraph length (target ~100; −5/−15).

**GEO (`computeGEO`, 5×20):** definitional statement in first 500 words, ≥3 H2 sections, stat/data references ≥ H2 count, FAQ present, word count ≥1500.

**AEO (`computeAEO`):** FAQ H3 questions (≥3 → 40, ≥1 → 20), direct-answer paragraph 40–80 words (30), lists present (15), Key Takeaways/Summary section (15).

Plus non-rubric `ranking_prediction` (from keyword difficulty + SEO score) and `traffic_prediction` (search volume × CTR curve).

---

## Gotchas worth knowing before you rewrite the prompts

1. **Target word-count conflict.** The brief asks the model for `word_count_target: 2100` and the SEO/GEO scorers target 1800–2500 / ≥1500 — but `generate-draft` defaults `targetWordCount` to **1200** when the client doesn't pass one (`route.ts:22`). A 1200-word draft will fail the SEO "word count 1800–2500" check and likely the GEO length check. Check what the UI actually sends as `target_word_count`.

2. **Rubric is heuristic, not semantic.** Scores reward regex patterns (e.g., GEO "stats" matches the literal `%` sign or "according to"; AEO "direct answer" just needs any 40–80 word paragraph). Prompt rewrites should be tested against these specific patterns, or the scores won't move.

3. **The prompt's own rules don't all match the scorer.** E.g., the system prompt bans em dashes and adverbs, but the scorer never checks for them. Conversely the scorer rewards a 120–155 char meta and a keyword-rich slug — both produced by `generate-brief`, not the draft. The draft and the score live in different files with no shared source of truth.

4. **Two divergent brand-field selects.** If you add a brand field to one route's prompt, you must also add it to that route's `.select(...)` — they're maintained independently.

5. **Three-to-seven LLM calls per draft.** A prompt rewrite of "the draft" really means touching: Pass 1 system+user, the expansion strategist + editor prompts, and the polish intro/conclusion/judge prompts. They don't share the humanization/anti-slop rules — only Pass 1 has them.

No files were modified.
