# Rewrite article generation prompts for editorial quality

- Session `5d421d2e-2a21-454c-b3ce-ec513ee20141`
- 2026-06-17 07:24 to 2026-06-17 07:30
- Branch: `master`  |  Claude Code 2.1.170

**Files touched (4):** `ARCHITECTURE.md`, `src/app/api/articles/generate-brief/route.ts`, `src/app/api/articles/generate-draft/route.ts`, `src/lib/keyword-intent.ts`

---


## Michael

Rewrite the article generation prompts for better first-pass quality. Read ARCHITECTURE.md first. Research only the files listed below — do NOT modify anything else.

## Context

The current prompts produce technically correct but editorially flat articles. The problems:
1. AI triple-listing pattern (rule of three) — everything described in groups of 3
2. No editorial stance per section — describes topics instead of arguing positions  
3. Generic openers — "When it comes to X...", "Choosing the right Y..." 
4. Brand avoidance constraints (avoid_topics, avoid_phrases) are collected but never injected into prompts — this caused a Breville brand-name violation
5. Scoring rubric runs post-draft — generation ignores the rubric's constraints
6. Expansion pass and polish pass inherit NONE of the anti-slop/humanization rules from Pass 1
7. Word count default is 1200 but brief targets 2100 and scorers target 1800–2500

## Files to read before editing

1. `src/app/api/articles/generate-brief/route.ts` — read in full
2. `src/app/api/articles/generate-draft/route.ts` — read in full
3. `src/lib/keyword-intent.ts` — skim for context

## Changes to make

### A. Fix brand constraint injection — BOTH route files

In `generate-brief/route.ts`:
- The `.select(...)` already includes `avoid_topics` (check). If not, add it.
- Add to the brief prompt, after the competitors line:
  ```
  ${brand.avoid_topics?.length ? `NEVER write about or reference: ${brand.avoid_topics.join(', ')}` : ''}
  ${brand.avoid_phrases?.length ? `NEVER use these phrases or terms: ${brand.avoid_phrases.join(', ')}` : ''}
  ${brand.competitors?.length ? `COMPETITOR NAMES — do not name these brands in the article unless the brand explicitly permits comparisons: ${brand.competitors.join(', ')}` : ''}
  ```

In `generate-draft/route.ts`:
- The `.select(...)` does NOT include `avoid_topics`, `avoid_phrases`, or `competitors`. Add all three to the select.
- Add a `BRAND CONSTRAINTS` block to the system prompt (after the `expertiseBlock`, before the HUMANIZATION RULES section):
  ```
  ${avoidBlock}
  ```
  Where `avoidBlock` is built in the route handler:
  ```typescript
  const avoidBlock = [
    brand.avoid_topics?.length ? `NEVER write about or reference: ${brand.avoid_topics.join(', ')}` : '',
    brand.avoid_phrases?.length ? `NEVER use these phrases or terms: ${brand.avoid_phrases.join(', ')}` : '',
    brand.competitors?.length ? `COMPETITOR NAMES — do not mention these brands by name in the article: ${brand.competitors.join(', ')}` : '',
  ].filter(Boolean).join('\n')
  const brandConstraintsBlock = avoidBlock ? `\n═══ BRAND CONSTRAINTS (non-negotiable) ═══\n${avoidBlock}\n` : ''
  ```

### B. Fix word count default — `generate-draft/route.ts`

Find the line that sets `targetWordCount` (defaults to 1200). Change the fallback logic to:
```typescript
const targetWordCount = body.target_word_count ?? brief?.word_count_target ?? 2100
```
This respects: explicit UI override > brief's target > sensible default.

### C. Rewrite the brief prompt for editorial stance — `generate-brief/route.ts`

Replace the current outline instruction with this version. The goal is to force argumentative H2 headings rather than topic labels.

Find the JSON instructions block in the prompt (the part that says `"outline": [{"heading": ...}]`) and update the notes/rules around it to:

```
"outline": [
  {
    "heading": "H2 heading — must make a claim or imply a verdict, NOT just label a topic. BAD: 'Factors to Consider'. GOOD: 'The Factor That Actually Determines Which One to Buy'. BAD: 'Types of X'. GOOD: 'Only Two Types of X Are Worth Your Time'.",
    "heading_level": "H2",
    "notes": "State the argument this section will make. One sentence: what does this section conclude? Then: what evidence or examples support it? What does the reader believe at the end of this section that they didn't believe at the start?",
    "word_count_target": 250
  }
],
```

Also add to the brief prompt (after the `serp_intent` field explanation):
```
If serp_intent is "commercial" or "comparison", the outline MUST include a section titled something like "What We Found After Testing" or "Our Evaluation: How We Ranked These" — framed as original research or testing, even if based on secondary sources. This framing transforms perceived authority.
```

And add a new top-level rule at the end of the brief prompt, before the closing:
```
OUTLINE RULE: Every H2 heading must pass this test — could this heading appear on a Wikipedia article or a generic AI article? If yes, rewrite it as a specific claim, verdict, or surprising finding. Generic topic headings are forbidden.
```

### D. Upgrade the draft system prompt — `generate-draft/route.ts`

In the ANTI-SLOP RULES section, add these rules (insert after the existing banned-words line):

```
• RULE OF THREE BAN: Never list exactly three items in a row when the number is arbitrary. "Fast, reliable, and affordable" — this is an AI tell. Use two or four items, or write a sentence instead of a list. If a list genuinely has three items (e.g., three steps), that's fine — but do not manufacture triads for rhetorical effect.
• Every H2 section must argue, not describe. The first sentence of every H2 section must state the section's conclusion or verdict, not introduce the topic. BAD: "There are several factors to consider when choosing X." GOOD: "Most buyers focus on the wrong factor — here's the one that actually matters."
• Openings must be claims or facts. The article's first sentence must be either (a) a specific, surprising claim or (b) a concrete statistic. NEVER start with: "When it comes to", "If you're looking for", "Choosing the right", "In today's", "Whether you're", "X is one of the most", "Are you looking for". The first sentence must be unpredictable.
• No section-closing summaries. Do not end a section with a sentence that restates what was just said. The last sentence of every section should either (a) land the point harder or (b) create tension for the next section. Never: "As you can see, X is an important factor to consider."
```

Also update the SEO RULES to add inline GEO/AEO constraints (so generation targets the rubric from the start):
After the existing SEO RULES block, update GEO and AEO to add generation-time instructions:

```
═══ GEO RULES (Generative Engine Optimization) ═══
• Include at least one definitional statement per major H2 section (AI engines pull these) — format: "[Topic] is [precise definition]."
• Include one stat or data sentence per H2 section. Real stats preferred; if unavailable, use framing like "Industry benchmarks show..." or cite a named data source category.
• Clear H2 hierarchy — each H2 section is self-contained and scannable
• GENERATION CONSTRAINT: Before writing each H2 section, internally ask: "What is the one claim this section proves?" Lead with that claim.

═══ AEO RULES (Answer Engine Optimization) ═══
• At least one paragraph (40-60 words) that directly answers "What is [topic]?" — natural prose, not a heading
• Every FAQ H3 question gets an immediate paragraph answer (40-80 words) before any next heading
• GENERATION CONSTRAINT: Place a 40-80 word direct-answer paragraph within the first 200 words of the article. This is the paragraph that will be pulled as a featured snippet.
```

### E. Apply anti-slop rules to the expansion pass — `generate-draft/route.ts`

Find the expansion Pass 2 prompts (Step A strategist, Step C editor — they appear around lines 210-346). 

Step C (the expansion editor) currently has its own system prompt. Add to that system prompt — after the existing instructions but before the close:

```
ANTI-SLOP REMINDER (apply to all expanded content):
• Rule of three ban: never manufacture triads. Vary list length.
• Every new section must argue, not describe. Lead each new H2 with its conclusion.
• No throat-clearing openers on new sections. Cut "Now let's look at...", "Another important consideration is..."
• No section-closing restatements. End on a sharper note or a tension-builder.
• No banned words: delve, leverage, robust, seamlessly, crucial, cutting-edge, utilize, facilitate.
• Vary sentence length. Short sentences punch. Then a longer sentence that qualifies or expands.
```

### F. Update ARCHITECTURE.md

After making code changes, update ARCHITECTURE.md to note:
- The brand constraint fields (avoid_topics, avoid_phrases, competitors) are now injected into both brief and draft generation
- Word count default changed from 1200 to brief's target (2100)
- Rule-of-three and editorial-stance rules added to anti-slop section

## Commit instructions

- Read each file before editing
- Run `npx tsc --noEmit` before committing
- `git pull --rebase origin master` before staging
- Commit: `git -c user.email=michaeljacobosborne@gmail.com -c user.name="Michael Osborne" commit -m "Upgrade generation prompts: editorial stance, anti-rule-of-3, brand constraints, word count fix"`
- Push: `git push origin master`
- Deploy: `curl -X POST "https://api.vercel.com/v1/integrations/deploy/prj_DkQtXvVAVjzwC5qH2RqPfOG7vktr/HCPNWt1KoS"`
- Never commit .env files or force push

**Claude:** I'll start by reading ARCHITECTURE.md and the files I need to work with.

> `Read: ARCHITECTURE.md`

**Claude:** Now let me read the two route files and skim the keyword-intent file.

> `Read: src/app/api/articles/generate-brief/route.ts`

> `Read: src/app/api/articles/generate-draft/route.ts`

> `Read: src/lib/keyword-intent.ts`

**Claude:** I have full context now. Let me note one discrepancy before editing: ARCHITECTURE.md says `avoid_topics` is `text[]` but `avoid_phrases` is plain `text`, and `keyword-intent.ts` types both as `string`. The codebase is inconsistent about these types. To avoid a runtime crash on `.join()`, I'll use a small normalization helper that handles both string and array forms while producing exactly the prompt output the task specifies. I'll flag this in my summary.

Let me start editing `generate-brief/route.ts`.

> `Edit: src/app/api/articles/generate-brief/route.ts`

**Claude:** Now build the constraint block and inject it into the brief prompt. Let me add a helper and the block before the prompt:

> `Edit: src/app/api/articles/generate-brief/route.ts`

**Claude:** Now part C — rewrite the outline JSON block and rules in the brief prompt:

> `Edit: src/app/api/articles/generate-brief/route.ts`

**Claude:** Now `generate-draft/route.ts`. First, the word count default (part B) — `brief` isn't available at line 22, so I'll move the declaration to after `brief` is established:

> `Edit: src/app/api/articles/generate-draft/route.ts`

> `Edit: src/app/api/articles/generate-draft/route.ts`

**Claude:** Now part A for draft — add the brand fields to the select:

> `Edit: src/app/api/articles/generate-draft/route.ts`

**Claude:** Now build the `brandConstraintsBlock` and inject it into the system prompt after the expertiseBlock:

> `Edit: src/app/api/articles/generate-draft/route.ts`

**Claude:** Now inject `brandConstraintsBlock` into the system prompt (after expertiseBlock, before HUMANIZATION RULES):

> `Edit: src/app/api/articles/generate-draft/route.ts`

**Claude:** Now part D — add the new ANTI-SLOP rules after the banned-words line:

> `Edit: src/app/api/articles/generate-draft/route.ts`

**Claude:** Now update the AEO and GEO rule blocks with the generation-time constraints (part D continued):

> `Edit: src/app/api/articles/generate-draft/route.ts`

**Claude:** Now part E — add the anti-slop reminder to the expansion editor (Step C) system prompt:

> `Edit: src/app/api/articles/generate-draft/route.ts`

**Claude:** All code edits done. Let me typecheck:

> `PowerShell: Run TypeScript typecheck`

**Claude:** Typecheck passes. Now update ARCHITECTURE.md (part F):

> `Edit: ARCHITECTURE.md`

**Claude:** Code, typecheck, and ARCHITECTURE.md are done. Now the git workflow — staging only my two route files explicitly (the working tree has unrelated changes I must not touch):

> `PowerShell: Pull and rebase from origin master`

**Claude:** Pre-existing unstaged changes block the rebase. I'll commit my two files first with explicit pathspec (per the shared-worktree convention), then rebase and push.

> `PowerShell: Stage my two route files and show cached diff stat`

**Claude:** Only my two files are staged. Committing:

> `PowerShell: Commit the two route files`

> `PowerShell: Pull and rebase from origin master`

**Claude:** The unrelated unstaged changes still block it. I'll use autostash so the rebase stashes/restores them without touching my commit:

> `PowerShell: Pull rebase with autostash for unrelated unstaged changes`

**Claude:** Up to date. Now push:

> `PowerShell: Push to origin master`

**Claude:** Pushed. Now trigger the Vercel deploy:

> `PowerShell: Trigger Vercel deploy hook`

**Claude:** Done. Deploy is queued (`PENDING`).

## Summary

Rewrote the article-generation prompts across both route files. Typecheck passed, committed (`2f8ffbf`), pushed to `master`, and deployed.

**`generate-brief/route.ts`**
- **A.** Added `avoid_topics, avoid_phrases` to the brand `.select(...)` (`competitors` was already there). Injected a `NEVER write about…` / `NEVER use these phrases…` / `COMPETITOR NAMES…` block into the brief prompt.
- **C.** Replaced the flat outline schema with claim/verdict-forcing heading + notes guidance; added the commercial/comparison "What We Found After Testing" requirement and the top-level OUTLINE RULE banning generic topic headings.

**`generate-draft/route.ts`**
- **A.** Added `avoid_topics, avoid_phrases, competitors` to the `.select(...)` and injected a `BRAND CONSTRAINTS (non-negotiable)` block after the expertise block.
- **B.** Word-count default is now `body.target_word_count ?? brief.word_count_target ?? 2100` (moved the declaration to after `brief` is established, since it wasn't in scope at the original line).
- **D.** Added rule-of-three ban, H2-must-argue, claim/fact openers, and no-section-closing-summaries to ANTI-SLOP; added generation-time constraints to the GEO and AEO blocks.
- **E.** Added the anti-slop reminder to the expansion editor (Step C) system prompt.

**`ARCHITECTURE.md`** — documented the brand-constraint injection, the word-count default change, and the new editorial/anti-rule-of-3 rules.

**One deviation worth flagging:** the task's literal code used `brand.avoid_phrases.join(', ')`, but per ARCHITECTURE.md `avoid_phrases` is a plain `text` column (and `keyword-intent.ts` types both `avoid_topics` and `avoid_phrases` as `string`), while `avoid_topics`/`competitors` are `text[]`. The codebase is internally inconsistent on these types, so calling `.join()` directly would throw at runtime whenever `avoid_phrases` is a non-empty string. I used a small `asConstraintList()` helper in both routes that normalizes string-or-array to the same comma-joined output — identical prompt text to what you specified, but crash-safe regardless of the real column type. Worth confirming the actual `avoid_phrases` column type in Supabase if you want to simplify later.

Note: the working tree had unrelated pre-existing changes (`package.json`, `articles/page.tsx`, `keywords/page.tsx`, plus untracked `.html`/`.patch`/script files) — I staged only my two route files with explicit pathspecs and left everything else untouched. ARCHITECTURE.md is gitignored, so its update is local-only as intended.
