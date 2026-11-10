# Audit codebase and clean up AI-generated code

- Session `474e0a6a-8fd2-418b-a920-c1d21573f832`
- 2026-07-02 03:46 to 2026-07-02 15:03
- Branch: `master`  |  Claude Code 2.1.197

**Files touched (8):** `package.json`, `.gitignore`, `ARCHITECTURE.md`, `CLEANUP_AUDIT.md`, `C:/Users/ozzy5/.claude/projects/C--Users-ozzy5-OneDrive-Documents-Byline/memory/cleanup-audit-2026-07.md`, `C:/Users/ozzy5/.claude/projects/C--Users-ozzy5-OneDrive-Documents-Byline/memory/MEMORY.md`, `src/app/auth/callback/route.ts`, `src/lib/usage.ts`

---


## Michael

I WANT YOU to do a full audit of this code base and see where we can clean it up. it is a live prodcut so we cannot break any features. want all the ai slop code cleaned out and made better for the eventual handoff to a human dev

**Claude:** I'll run a full audit of the codebase — first a quick survey of the structure myself, then parallel deep-dives into different dimensions (dead code, duplication, API consistency, dependencies, AI-slop patterns). Since this is a live product, the deliverable will be a prioritized cleanup report with risk ratings, not blind changes.

> `PowerShell: List repo root contents`

> `Read: package.json`

> `Glob: src/**/*.{ts,tsx}`

> `Glob: src/**/*.{ts,tsx}`

> `Read: .gitignore`

> `PowerShell: Count tracked files and show git status`

> `Agent: Audit src/lib for slop`

> `Agent: Audit API routes`

> `Agent: Audit pages/components`

> `Agent: Audit root clutter/config`

> `PowerShell: Show uncommitted changes`

**Claude:** Four audit agents are running. While they work, let me check the uncommitted changes sitting in the working tree.

> `PowerShell: Diff stat of the three modified files`

> `PowerShell: View diff of check-ai-visibility route`

> `PowerShell: View remaining two uncommitted diffs`

> `Grep: check-ai-visibility`

> `Read: ARCHITECTURE.md`

> `Monitor`

**Claude:** The audit agents will notify me as they complete — no need to poll. Standing by for their results, then I'll compile the full prioritized cleanup report.

## Michael

<task-notification>
<task-id>a31a35d5b04720c59</task-id>
<tool-use-id>toolu_01BF9ZhfzfRir82meK5rkh6F</tool-use-id>
<output-file>C:\Users\ozzy5\AppData\Local\Temp\claude\C--Users-ozzy5-OneDrive-Documents-Byline\474e0a6a-8fd2-418b-a920-c1d21573f832\tasks\a31a35d5b04720c59.output</output-file>
<status>completed</status>
<summary>Agent "Audit root clutter/config" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>I have everything I need. Compiling the report.

# Repo Hygiene Audit — Byline (handoff prep)

All findings verified directly. READ-ONLY — nothing was modified.

## 1. Secrets and PII — URGENT flags

**Live credentials hardcoded (verified by opening the files):**

| File | Line | What |
|---|---|---|
| `run-byline-workflows.bat` | 4 | GoHighLevel PIT token, `GHL_API_KEY=pit-8e26…1491` (full live token) |
| `run-byline-workflows.bat` | 5 | GHL Location ID (low sensitivity but identifying) |
| `run-byline-workflows.bat` | 6 | Full Firebase **refresh token** (`GHL_FIREBASE_REFRESH_TOKEN=AMf-vBy…`) — long-lived credential |
| `debug-ghl.bat` | 14 | Same Firebase refresh token |
| `debug-ghl.bat` | 15 | Firebase web API key (`AIzaSy…`) embedded in URL — web API keys are semi-public, but combined with the refresh token on line 14 it enables full token exchange |

Neither `.bat` file is gitignored (see §6). **Recommend rotating the GHL PIT token and the Firebase refresh token before handoff** regardless of whether they're ever committed — they've been sitting in a OneDrive-synced folder.

**PII (verified by opening both CSVs):**
- `byline-leads-cleaned.csv` — real prospect data: names, emails, companies, job titles, LinkedIn URLs (~130 rows by size)
- `byline-leads-uncontacted-clean.csv` — same schema, different people

Both are untracked and NOT gitignored. Must not be committed (GDPR-relevant personal data). Move out of the repo.

**Clean:** the two `wf-byline-*.py` builders read `GHL_PRIVATE_KEY`/`GHL_API_KEY` from env (lines 342/428) — no hardcoded secrets. `scripts/*.ts` read from `.env.local` via dotenv — clean.

## 2. Root inventory — every non-code file, with disposition

### (a) Safe to DELETE
| File | Reason |
|---|---|
| `0001-…support-widget…patch`, `0002-…Apply-button…patch`, `0003-…onboarding-checklist…patch` | **Verified applied**: all three reverse-apply cleanly against HEAD (`git apply --check --reverse` exit 0); landed as commit `63ba408` "Beta fixes: support widget, apply button, dashboard empty state" |
| `bylinepolicies.html`, `bylinelaunchmarketingplan.html`, `bylineproducthuntlisting.html`, `bylineredditplan.html` | **Verified byte-identical (MD5 match)** to their hyphenated twins `byline-policies.html`, `byline-launch-marketing-plan.html`, `byline-producthunt-listing.html`, `byline-reddit-plan.html` |
| `audit-dump.txt`, `audit-route-dump.txt`, `brand-dump.txt`, `brand-save-dump.txt`, `keyword-detail-dump.txt` | Debug dumps (already gitignored) |
| `src_app_(dashboard)_keywords_page.tsx.txt`, `src_app_api_keywords_*.ts.txt` (one is 0 bytes) | Source-copy scratch files (gitignored) |
| `fix.py` | One-off patcher for `src/app/api/audit/route.ts` JSON parsing — that fix is a self-replacing script, already run (gitignored) |
| `replacements.txt` (32 bytes) | Scratch (gitignored) |
| `byline-site.zip`, `byline-site - branded.zip`, `byline-site - branded (2).zip` | Site-export archives; the two "branded" zips differ from each other, but the unzipped `byline-site - branded/` folder exists locally and `byline-site/` is tracked in git. Gitignored (`*.zip`) |
| `tsconfig.tsbuildinfo` | Build artifact (gitignored) |
| `debug-ghl.bat` | One-off GHL CLI connectivity test — delete (contains secrets, see §1) |

### (b) Move OUT of the repo (marketing/business docs, no code value)
`brandkit.html`, `byline-policies.html`, `byline-launch-marketing-plan.html`, `byline-producthunt-listing.html`, `byline-reddit-plan.html`, `byline-social-strategy.html`, `byline-reddit-outreach-toolkit.md`, `rankpill-competitive-audit.html`, `waitlist.html` (standalone pre-launch landing page, self-contained HTML — the app has its own marketing pages in `src/app/(marketing)/`).

Borderline: `privacy.html` / `terms.html` — see §3; also move/delete.

GHL workflow tooling — `run-byline-workflows.bat` (after stripping secrets), `wf-byline-audit-nurture-builder.py`, `wf-byline-onboarding-builder.py` — belongs with the GHL CLI at `C:\Users\ozzy5\tools\gohighlevel-cli\builders\` (the .bat already copies them there), not in the app repo.

### (c) SENSITIVE — never commit, move out + rotate
`byline-leads-cleaned.csv`, `byline-leads-uncontacted-clean.csv`, `run-byline-workflows.bat`, `debug-ghl.bat` (details in §1).

### Keep (tracked/expected)
`README.md`, `AGENTS.md`, `CLAUDE.md`, config files, `package*.json`, `sanity.config.ts`, `byline-site/` (tracked — though a static marketing site inside the app repo is itself odd), `ARCHITECTURE.md` (gitignored by design), `.env.local` (gitignored).

## 3. privacy.html / terms.html / waitlist.html vs public/ and src/app

- **public/ contains NO HTML** — only `dashboard-screenshot-1.png`, `dashboard-screenshot-2.png`, `icon-192.png`. The root HTML files are not duplicates of anything in public/.
- **src/app has real pages**: `src/app/(marketing)/privacy/page.tsx` and `src/app/(marketing)/terms/page.tsx` are tracked and live. The root `privacy.html`/`terms.html` are standalone static pages ("Peacock Creative Services LLC", inline DM Sans styling) — pre-app-era artifacts, **redundant**, safe to move out/delete.
- `waitlist.html` is a self-contained pre-launch landing page — also redundant with the live app.

## 4. scripts/

| Script | Tracked? | Verdict |
|---|---|---|
| `scripts/_apply-migration.mjs` | tracked | One-off: hardcodes migration file `20260608_fix_articles_status_check.sql` and two `aws-{0,1}-us-east-2.pooler.supabase.com` hosts; reads creds from `.env.local` (no secrets in file). Done its job — deletable, or generalize if kept |
| `scripts/diagnose-paid-subs.ts` | untracked | Read-only diagnostic for the paid-profile/subscription-row incident. Env-based creds. Keep or delete at will |
| `scripts/fix-paid-users.ts` | untracked | One-off incident recovery; header literally says "NOT committed. Delete after the incident is resolved." — **delete** |

**No package.json entry runs any of them.** Only `dev/build/start/lint/migrate` exist. The .ts scripts document `npx tsx …` usage, but **neither `tsx` nor `dotenv` is in package.json** (dotenv is imported by both .ts scripts) — a fresh clone can't run them without ad-hoc installs. Also `"migrate": "npx supabase db push --db-url $SUPABASE_DB_URL"` uses `$VAR` syntax that won't expand in cmd/PowerShell — bash-only on a Windows-developed project.

## 5. supabase/

25 migrations with **two numbering schemes**: `001`–`014` (unprefixed) then date-stamped `20260601`–`20260702`. No exact duplicates, but one real overlap:

- `011_add_brand_profile_fields.sql` adds `brand_profiles.avoid_topics text`; `20260601_add_brand_profile_columns.sql` adds `avoid_topics text[] default '{}'`. Both use `IF NOT EXISTS`, so **whichever ran first silently wins the type** (`text` vs `text[]`) — worth verifying against the live DB at handoff.
- Per session memory (unverified against the live DB): migrations `20260615_add_publishing`, `20260618_usage_events`, and the keyword source/brand one require **manual application in Supabase** — handoff dev should confirm which migrations have actually been applied; there is no migration-state tracking in the repo.
- `supabase/.temp/` (CLI state incl. `linked-project.json` with project ref) is correctly gitignored.
- `schema.sql` + `README.md` describe only the original 4 tables — stale relative to 25 migrations.

## 6. .gitignore coverage of the clutter

**Covered** (safe from accidental commit): `*-dump.txt`, `audit-*.txt`, `src_app_*.txt`, `replacements.txt`, `fix.py`, `*.zip`, `byline-site - branded/`, `*.tsbuildinfo`, `.env*`, `ARCHITECTURE.md`, `supabase/.temp/`.

**NOT covered — one `git add .` away from being committed:**
- `byline-leads-cleaned.csv`, `byline-leads-uncontacted-clean.csv` (**PII**)
- `run-byline-workflows.bat`, `debug-ghl.bat` (**live secrets**)
- All marketing HTML (`brandkit.html`, `byline-*.html`, `waitlist.html`, `privacy.html`, `terms.html`, `rankpill-competitive-audit.html`) and `byline-reddit-outreach-toolkit.md`
- The three `.patch` files
- `wf-byline-*.py`
- `.claude/` — contains `settings.local.json`, skills, **and a full agent worktree copy of the entire repo** under `.claude/worktrees/agent-ac84700f2a32263a1/` (with its own `.git`) — committing this would be messy; add `.claude/` (or at least `.claude/worktrees/` + `settings.local.json`) to .gitignore

Suggested additions before handoff: `*.csv`, `*.bat`, `*.patch`, `.claude/` (or targeted equivalents).

**Inverse problem:** the `.env*` pattern also ignores `.env.local.example` — the env template referenced by `supabase/README.md` (`cp .env.local.example .env.local`) exists locally but is **not in git**, so a fresh clone has no env template. Fix with a `!.env.local.example` negation before handoff.

## 7. Config findings

- **`next.config.ts`** — clean; only a Sanity CDN image remotePattern. No `typescript.ignoreBuildErrors`, no `eslint.ignoreDuringBuilds`. 
- **`tsconfig.json`** — `strict: true`, standard Next setup. No red flags.
- **`eslint.config.mjs`** — stock next/core-web-vitals + TS; no rules disabled.
- **`vercel.json`** — single cron: `/api/cron/check-ai-visibility` Mondays 09:00 UTC. Nothing odd, but note the only automation in the repo is this one cron.
- **`package.json`** — no test script, no typecheck script; `migrate` script is bash-only (above). Package name is still `seo-saas` (cosmetic).

## Summary for the handoff dev

1. **Rotate the GHL PIT token + Firebase refresh token now** (exposed in the two .bat files).
2. Move the two lead CSVs and all marketing HTML out of the repo; delete the 4 hash-identical `bylineXxx.html` duplicates, the 3 applied patches, the 5 dump files, and `scripts/fix-paid-users.ts`.
3. Patch `.gitignore`: add `*.csv`, `*.bat`, `*.patch`, `.claude/`; un-ignore `.env.local.example`.
4. Reconcile which supabase migrations have actually been applied to prod (no tracking exists; at least 3 were manual-apply); check `avoid_topics` column type (011 vs 20260601 conflict).</result>
<usage><subagent_tokens>71456</subagent_tokens><tool_uses>33</tool_uses><duration_ms>5701498</duration_ms></usage>
</task-notification>

**Claude:** Repo-hygiene audit is in — headline findings: **live GHL and Firebase tokens hardcoded in the two `.bat` files** (unignored, one `git add .` from being committed), lead CSVs with real PII in the repo root, plus ~20 files verified safe to delete (byte-identical duplicates, applied patches, debug dumps). Three agents still running — I'll hold the full report until they're all back.

## Michael

<task-notification>
<task-id>ac53cf64980d3862c</task-id>
<tool-use-id>toolu_01HZHiDWBVNAuremiaTCBUTy</tool-use-id>
<output-file>C:\Users\ozzy5\AppData\Local\Temp\claude\C--Users-ozzy5-OneDrive-Documents-Byline\474e0a6a-8fd2-418b-a920-c1d21573f832\tasks\ac53cf64980d3862c.output</output-file>
<status>completed</status>
<summary>Agent "Audit src/lib for slop" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>All reads and greps are complete. Here is the audit report.

# AI-Slop &amp; Cleanup Audit — `src/lib/` + `src/sanity/`

All findings verified by reading every file in scope and grepping `src/`, `scripts/`, and root configs for consumers.

## Findings

### Dead code (exported, never imported anywhere in src/)

| # | File / lines | Description | Action | Risk |
|---|---|---|---|---|
| 1 | `src/lib/usage.ts:14` (`calcCostUsd`), `:53` (`PLAN_LIMITS`) | Both exported but only referenced inside `usage.ts` itself. | Remove `export` keyword. | safe |
| 2 | `src/lib/checkout.ts:7` (`CHECKOUT_PRICE_IDS`) | Exported with a comment claiming it's "shared by the POST checkout API and the GET checkout-redirect route" — both routes actually import only `isValidPlanInterval`/`resolveCheckoutUrl`. Comment is stale. | Un-export; fix comment. | safe |
| 3 | `src/lib/support.ts:12` (`REFUND_WINDOW_DAYS`), `:31` (`planLabel`) | Only used within `support.ts`. | Un-export. | safe |
| 4 | `src/lib/google-search-console.ts:20` (`GSC_SCOPE`), `:22` (`getRedirectUri`) | Only used within the same file. | Un-export. | safe |
| 5 | `src/lib/article-scoring.ts:3` (`export type { ArticleScores }`), `:47` (`countWords`), `:51` (`stripMarkdown`) | The type re-export is never imported (routes import `ArticleScores` from `@/lib/supabase/types` directly); `countWords`/`stripMarkdown` are only used internally. | Delete re-export; un-export helpers. | safe |
| 6 | `src/lib/supabase/types.ts:3` (`Subscription`), `:62` (`Keyword`), `:110` (`Database`) | Never imported anywhere. `Keyword` is even shadowed by local `interface Keyword` definitions in `keywords/[id]/page.tsx:14` and `articles/new/page.tsx:18`. `Database` is defined but **never applied** to any Supabase client. | Either wire `createClient&lt;Database&gt;()` in `supabase/{server,service,client}.ts` (preferred — kills the `as any` casts below), or delete. | needs-testing if wiring; safe if deleting |
| 7 | `src/sanity/env.ts:37` (`readToken`) | Exported, zero importers (client.ts uses CDN, no token). | Delete. | safe |
| 8 | `src/lib/ahrefs.ts:20` (`ahrefsRank` field) | Always hardcoded `0` ("kept for interface compatibility"). The only UI consumer, `src/app/(dashboard)/dashboard/domain-authority.tsx:69`, renders "Ahrefs Rank #" only when `&gt; 0` — a permanently dead UI branch. | Drop the field from `DomainRating` and the dead branch in domain-authority.tsx (+ local type in `content-audit/page.tsx:13`). | low |

### Duplication

| # | File / lines | Description | Action | Risk |
|---|---|---|---|---|
| 9 | `src/lib/perplexity.ts` vs `src/lib/google-ai.ts` (whole files) | Near-identical twins: same `isConfigured()`/`checkCitation()` exports, same result shape, same AbortController+timeout+swallow-error flow. Callers must use namespace imports (`import * as perplexity`) to disambiguate. | Merge into one `citation-check.ts` with a provider parameter, or at least share the result type and fetch scaffolding. | low |
| 10 | `src/lib/keyword-intent.ts:219-247` vs `:253-276` | The catch-block "retry without web_search" duplicates the text-extraction → regex → JSON.parse → filter → validate pipeline almost verbatim (~25 lines twice). | Extract a `parseSeeds(response)` helper. | safe |
| 11 | `src/lib/email.ts:8`, `src/lib/telegram.ts:6`, `src/lib/analytics-server.ts:21`, `src/lib/meta-capi.ts:31` | Four near-identical `{ ok?, skipped?, status?, error? }` result interfaces (`EmailResult`, `TelegramResult`, `Ga4Result`, `MetaCapiResult`). | Optional: one shared `SendResult` type. Cosmetic. | safe |
| 12 | `src/lib/support-kb.ts:42-55` vs `src/lib/keyword-intent.ts:95-129` | Two bespoke stopword-list + tokenizer implementations (`STOPWORDS`/`tokenize` vs `FILLER_WORDS`/`topicWordsOf`). Different purposes, but a handoff dev will wonder which to reuse. | Leave, or consolidate if touched. | safe |
| 13 | `src/lib/article-scoring.ts:112` and `:130` | `computeSEO` computes `countWords(content)` twice (`wc` and `totalWords`). | Reuse the first value. | safe |

### AI-slop patterns

| # | File / lines | Description | Action | Risk |
|---|---|---|---|---|
| 14 | `src/lib/keyword-intent.ts:210` | `type: 'web_search_20250305' as 'web_search_20250305'` — a self-cast to its own literal type; does nothing. | Remove the cast. | safe |
| 15 | `src/lib/keyword-intent.ts:29-91` | 60-entry `ACRONYM_MAP` blindly rewrites every standalone occurrence of 2-letter tokens: `ai`→"artificial intelligence", `pr`→"public relations", `ae`→"account executive", `sql`→"sales qualified lead". A user searching "sql performance tuning" gets seeds for "sales qualified lead performance tuning". | Trim the map to unambiguous SEO terms, or require word-boundary + domain heuristics. | needs-testing |
| 16 | `src/lib/dataforseo.ts:20-21` | `console.warn` with a long message immediately followed by `throw new Error` carrying the same info — double reporting of one condition. | Keep the throw, drop the warn. | safe |
| 17 | `supabase: any` parameter pattern — `src/lib/support.ts:54`, `src/lib/usage.ts:74,97,123,136`, `src/lib/checkout.ts:42`, `src/lib/search-console-connection.ts:26,46` (each with its own `eslint-disable @typescript-eslint/no-explicit-any`) plus `(svc as any)` casts in `support.ts:154` and `usage.ts:39` | Systematic `any` for every Supabase client parameter. Direct consequence of finding #6 (unused `Database` generic). Eight disable comments for one root cause. | Type as `SupabaseClient&lt;Database&gt;` once the clients are generic-typed. | needs-testing |
| 18 | `src/lib/ghl.ts:94-126, 132-144, 150-160, 169-179` | Every exported function wraps its body in try/catch even though `ghlFetch` already never throws — belt-and-suspenders acknowledged in the code's own comments ("Defensive — isConfigured/ghlFetch already swallow"). Intentional fire-and-forget contract, and errors ARE logged, so this is defensible; just verbose. | Leave (documented contract) or trim outer catches. | safe |
| 19 | `src/lib/email.ts:3-6` | Stale narrating header: "As of this writing Resend is NOT yet configured… no RESEND_API_KEY". Per project memory the Resend/SMTP setup is the active fix path — this comment will mislead the next dev. | Verify env state and update/delete the note. | safe |
| 20 | `any[]` payload parsing — `src/lib/dataforseo.ts:58`, `src/lib/ahrefs.ts:61`, `src/lib/google-search-console.ts:134,177`, `src/lib/ghl.ts:44,102` | `any` for third-party API responses, each with an eslint-disable. Acceptable at API boundaries but could be minimal response interfaces. Low priority. | Optional typed response shapes. | safe |

### Inconsistency

| # | File / lines | Description | Action | Risk |
|---|---|---|---|---|
| 21 | `src/lib/usage.ts:133-163` (`checkArticleLimit`) vs `:61-88` (`resolvePlan`) | **Likely prod bug.** `checkKeywordSessionLimit` resolves plans through `PLAN_ALIASES` (mapping DB value `team` → `agency`), but `checkArticleLimit` casts `sub?.plan` directly: a `team` subscription row gets `PLAN_LIMITS['team'] → undefined → limit 0`, blocking all article generation for that user. Also ignores `account_type === 'free'` unlike its sibling. The `limit === Infinity` check at `:160` is dead — no plan has `Infinity`. | Route `checkArticleLimit` through `resolvePlan`; delete the `Infinity` check. | needs-testing |
| 22 | `src/lib/ahrefs.ts` (filename) | File named `ahrefs.ts`, header says "Domain Rank integration via DataForSEO" — Ahrefs was swapped out (commit 8c071f4) but the filename and interface vocabulary survived. | Rename to `domain-rating.ts`, update 1 importer (`api/domain-rating/route.ts`). | low |
| 23 | Error-shape conventions across `src/lib/` | Three coexisting failure conventions for external calls: throw (`dataforseo`, `google-search-console`, `encrypt`, `checkout`), return-null-silently (`ahrefs`, `ghl`), return result object (`email`, `telegram`, `meta-capi`, `analytics-server`, `perplexity`, `google-ai`, `publishing`). Mostly deliberate per call-site criticality, but undocumented. | Document the convention in ARCHITECTURE.md rather than refactor. | safe |
| 24 | `src/lib/keyword-intent.ts:3` vs `src/app/api/support/chat/route.ts:18` | Anthropic client constructed at **module scope** in keyword-intent (import-time env read) while routes construct their own per-module instances — two patterns for the same job, no shared `lib/anthropic.ts`. | Optional: single lazy `getAnthropic()` à la `getStripe()`. | low |
| 25 | `src/sanity/schemas/` vs `src/sanity/schemaTypes/` | Schemas live in `schemas/` but the aggregator index lives in a parallel `schemaTypes/` directory containing only one 9-line file. Two directories for one concern. | Fold `schemaTypes/index.ts` into `schemas/index.ts` and update `sanity.config.ts:18`. | safe |

### Risk notes (load-bearing / fragile — don't "clean" blindly)

- **`src/lib/google-ai.ts:28`** — hardcoded `gemini-1.5-flash` with `google_search_retrieval`. Google retired Gemini 1.5 API access for new projects (deprecation announced for Sept 2025); since `checkCitation` swallows all errors and returns `cited: false`, the Gemini leg of AI-visibility checks could be **silently failing in prod right now**, indistinguishable from "not cited". Check Vercel logs for `[google-ai] API error` before any refactor.
- **`src/lib/availability.ts:27-34`** — hardcoded personal schedule (Israel July 13–Aug 24 = UTC+3, else UTC-4; ignores DST). Intentional per its comments, feeds customer-facing support copy. Has no tests despite `now` being injectable.
- **`src/lib/ahrefs.ts:27-28`** — module-level in-memory cache (state at import). Fine on serverless (per-instance), but a naive "move to shared util" refactor could change caching semantics.
- **`src/lib/checkout.ts:9-25`** — six `STRIPE_PRICE_*` env vars read at **import time** with `!` assertions; a missing var silently yields `undefined` price IDs (checkout fails downstream at Stripe) rather than failing fast.
- **`src/lib/encrypt.ts`** — no validation that `ENCRYPTION_KEY` decodes to 32 bytes; `decrypt` throws on malformed input. Publishing credentials depend on this key — rotating/losing it bricks all stored WordPress connections.
- **`src/sanity/lib/image.ts:6`** — `imageUrlBuilder` constructed at import with possibly-empty `projectId`; safe only because blog pages guard with `isSanityConfigured` before rendering images. Don't remove that guard.
- **Phantom dependencies:** `sanity` (imported in `sanity.config.ts`, `src/sanity/schemas/*`, `src/sanity/lib/image.ts`) and `@portabletext/types` (imported in `src/sanity/lib/portableText.ts`) are **not declared in package.json** — they resolve transitively through `next-sanity`. A lockfile refresh could break the build. Add both as direct dependencies.

## Unused dependencies

Grepped `src/**`, `scripts/**`, and root configs (`next.config.ts`, `sanity.config.ts`, `eslint.config.mjs`) for `from '&lt;pkg&gt;'` / `require('&lt;pkg&gt;')`:

| Package | Evidence | Verdict |
|---|---|---|
| `axios` | Zero matches anywhere (all HTTP in the codebase is native `fetch`) | **Remove** |
| `zod` | Zero matches | **Remove** |
| `react-hook-form` | Zero matches | **Remove** |
| `@hookform/resolvers` | Zero matches | **Remove** |
| `@stripe/stripe-js` | Zero matches (client checkout uses server-generated redirect URLs; server uses `stripe`) | **Remove** |
| `@tiptap/extension-table-cell`, `@tiptap/extension-table-header`, `@tiptap/extension-table-row` | Never imported directly; `ArticleEditor.tsx:17` imports `Table, TableRow, TableCell, TableHeader` all from `@tiptap/extension-table`, whose own `dist/index.d.ts` exports all four | **Remove** (run a build to confirm) |
| `pg` | Only `scripts/_apply-migration.mjs:2` — dev tooling, never app runtime | **Move to devDependencies** |
| `openai` | Used — `api/keywords/research`, `api/articles/generate-brief`, `api/articles/generate-draft` | keep |
| `mammoth` | Used — `(dashboard)/articles/import/page.tsx:6` | keep |
| `marked` | Used — `articles/[id]/page.tsx`, `ArticleEditor.tsx`, `api/articles/[id]/publish/route.ts` | keep |
| `@sanity/vision`, `@vercel/functions`, `posthog-js`, `lucide-react` | All verified in use | keep |

## Top 3 for the handoff

1. **`checkArticleLimit` `team`-plan bug** (`src/lib/usage.ts:146`) — the only finding that looks like it breaks paying users today. Verify against prod data.
2. **Silent Gemini failure** (`src/lib/google-ai.ts:28`) — verify via logs; deprecated model + swallowed errors.
3. **Dependency purge** — 8 removable packages plus 2 phantom deps to add; one `npm run build` validates the lot.</result>
<usage><subagent_tokens>134127</subagent_tokens><tool_uses>65</tool_uses><duration_ms>5755043</duration_ms></usage>
</task-notification>

**Claude:** The `src/lib` audit is back too — it found a likely **live billing bug** (`checkArticleLimit` doesn't map the legacy `team` plan, so those subscribers may get article limit 0), a possibly silently-failing Gemini integration, 8 removable npm dependencies, and 2 phantom dependencies that should be declared. Waiting on the API-routes and UI audits to finish before compiling the full report.

## Michael

<task-notification>
<task-id>a46e1ee7d673c8496</task-id>
<tool-use-id>toolu_013DaVBdCGb5XW2YHMK5SqDh</tool-use-id>
<output-file>C:\Users\ozzy5\AppData\Local\Temp\claude\C--Users-ozzy5-OneDrive-Documents-Byline\474e0a6a-8fd2-418b-a920-c1d21573f832\tasks\a46e1ee7d673c8496.output</output-file>
<status>completed</status>
<summary>Agent "Audit API routes" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>All files audited. Here is the full report.

---

# API Route Audit — Byline (root: `C:\Users\ozzy5\OneDrive\Documents\Byline`)

All paths below are relative to that root. 53 route files audited: 50 under `src/app/api/`, plus `src/app/auth/signout/route.ts`, `src/app/auth/callback/route.ts`, and `src/app/(auth)/callback/route.ts`. Every claim below was verified by reading the file.

## 1. Auth matrix

**41 of 50 API routes** call `supabase.auth.getUser()` and return 401 when unauthenticated, and all user-data queries in them are additionally scoped with `.eq('user_id', user.id)` (belt-and-suspenders with RLS). Those are fine.

### Routes WITHOUT an auth check

| Route | Verdict | Evidence / notes |
|---|---|---|
| `api/billing/webhook` | **Intentional** — verifies Stripe signature via `stripe.webhooks.constructEvent` (line 123). Service-role client appropriate here. | Correct. |
| `api/cron/check-ai-visibility` | **Intentional** — checks `Authorization: Bearer ${CRON_SECRET}` (lines 6-10). Matches `vercel.json` cron entry. | Correct. Handler body is a stub (see slop). |
| `api/waitlist` | **Intentional** public lead capture, but the GHL webhook URL is **hardcoded** in source (line 3) and unauthenticated spam can enroll arbitrary emails. | Acceptable for a form endpoint; move URL to env. |
| `api/audit` (POST) | **Intentional** public free-tool, but two issues: (a) **SSRF-ish open crawler + unmetered Anthropic spend** — anyone can make it crawl 30 pages of any URL and burn Haiku tokens with zero rate limiting; (b) **trusts client-supplied `userId`** (line 266) — `loadEnrichment(userId)` queries `saved_keywords`/`articles` for that id via the cookie-based anon client. Safe only if RLS is on for those tables; if RLS were ever relaxed this leaks another user's keywords/article titles into the AI prompt. | Needs rate limiting; derive userId from session instead of body. |
| `api/audit/lead` | **Intentional** public lead capture (email regex only). | OK. |
| `api/free-tools/analyze` | **Intentional** public free-tool. Same unmetered-Anthropic-spend + arbitrary-URL-fetch exposure as `api/audit`. | Needs rate limiting. |
| `api/meta/event` | **Accidentally wide-open.** No auth, no origin check, no callers anywhere in the repo (see Dead routes). Anyone can pump arbitrary conversion events (with arbitrary value/currency/email) into your Meta CAPI dataset, poisoning ad optimization. | Delete or lock down. |
| `api/billing/founder-spots` | **Intentional** public counter. Uses service client but only returns an aggregate count — no data exposure. | OK. |
| `api/affiliates/apply` | **Intentional** public form. Uses service client to insert into `affiliate_leads` — reasonable (table closed to anon), but there is no rate limiting/honeypot, so it's a spam sink. | OK / low. |
| `src/app/auth/signout` | Intentional — signout only. | OK. |
| `src/app/auth/callback` | Intentional — OAuth/OTP exchange. **But see open-redirect bug below.** | |
| `src/app/(auth)/callback` | Dead duplicate (see Dead routes). | |

### Service-role client usage review
`createServiceClient` appears in 7 API routes. Justified in: `billing/webhook` (no user session), `billing/founder-spots` (cross-user count), `support/cancel` (documented: RLS has no user UPDATE policy on subscriptions), `keywords/research` + `articles/generate-draft` (global `keyword_cache` table), `affiliates/apply` (anon insert). `articles/[id]/check-ai-visibility` uses it for `article_ai_citations`/`article_ai_visibility` writes *after* verifying ownership via the user client — acceptable, though user-scoped RLS policies would be cleaner.

### Auth-adjacent bugs found

1. **Open redirect in `src/app/auth/callback/route.ts`.** The OTP branch sanitizes `next` (`safeNext`, line 49) but the OAuth `code` branch redirects to `${origin}${next}` with the **raw** `next` param (line 142). A crafted link like `/auth/callback?code=...&amp;next=.evil.com` redirects a freshly-authenticated user to `https://&lt;yourdomain&gt;.evil.com`. One-word fix: use `safeNext` at line 142. Risk: **needs-testing** (real but requires a valid code flow).
2. **No `middleware.ts` exists anywhere in the project** (verified by glob), yet `src/lib/supabase/server.ts` line 21 comments "middleware handles session refresh." Supabase SSR token refresh from Server Components therefore never persists; sessions rely on route handlers refreshing cookies. Worth flagging to the incoming dev. Risk: low (works today, fragile).

## 2. Top duplication blocks (extraction candidates)

1. **Auth boilerplate** — `const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })` — verbatim in **35 files** (42 occurrences; multi-method routes repeat it per handler: `keywords/saved` has it 4x, `articles/[id]` 3x). ~4 lines each, ~170 lines total. Extract to `requireUser()` helper returning `{ supabase, user } | NextResponse`.
2. **`(supabase as any)` + eslint-disable pairs** — **119 occurrences across 36 route files** (peak: `generate-draft` 20, `keywords/research` 12, `billing/webhook` 7). Root cause: stale generated Supabase types. Regenerating `src/lib/supabase/types.ts` kills ~240 lines of noise and restores type safety in one shot. Highest-value single cleanup in the codebase.
3. **LLM JSON-extraction helper** — the identical `parseAnalysis`/`parseJSON` function (fenced-block → outermost-braces → raw, ~14 lines) is copy-pasted in 4 files (`audit`, `free-tools/analyze`, `articles/[id]/links`, `articles/analyze`), with 4 more ad-hoc variants of the same idea in `keywords/angles` (line 50), `outline-chat` (line 66), `articles/[id]/image-prompts` (`parseConcepts`), `brand/onboard` (indexOf braces). One `extractJson()` in `src/lib` replaces all 8.
4. **`new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })` module-level client** — **12 route files**. Trivial `src/lib/anthropic.ts` singleton.
5. **JSON body parse try/catch → 400 "Invalid JSON"** — 6 files verbatim, and inconsistently absent elsewhere: `keywords/saved`, `articles/generate-brief`, `search-console/*`, `brand/save` call `request.json()` bare, so malformed JSON throws an unhandled 500 instead of a 400.
6. Smaller repeats: `asConstraintList` duplicated verbatim in `generate-brief` (132) and `generate-draft` (123); the markdown-strip "contentPreview" block duplicated in `articles/[id]/meta-description` (25-30) and `image-prompts` (77-82); the keyword_cache read/upsert block duplicated between `keywords/research` (130-181) and `generate-draft` (296-349); the SSE-stream + `send()` scaffold duplicated across `audit`, `free-tools/analyze`, `articles/analyze`.

## 3. Per-file slop findings

| File | Lines | Finding | Action | Risk |
|---|---|---|---|---|
| `api/articles/generate-draft/route.ts` | 92-108 | **Dead branch + likely broken feature.** `if (GROWTH_PRICE_ID \|\| AGENCY_PRICE_ID)` is always true (both are hardcoded string constants), so the plan-name fallback else-branch is unreachable. Worse: `stripe_price_id` is selected (line 61) but **never written anywhere in src/** (webhook upsert omits it — verified by grep), so `priceId` is always null → `runPolishPass` is always false → **Growth/Agency users never get the polish pass they pay for**. | Gate on `activeSub.plan` (`pro`/`agency`), delete price-ID constants | needs-testing |
| `api/articles/generate-draft/route.ts` | whole file | 603 lines, 20 `any`-cast disables, four AI passes inline. Also swallows expansion/polish failures silently (`catch {}` at 387, 540) — acceptable by design but undocumented in response (`pass_count` doesn't reveal polish state). | Split passes into lib functions when regenerating types | safe |
| `api/cron/check-ai-visibility/route.ts` | 19-36 | Cron is a **stub**: returns "awaiting domain field migration" with `checked: 0`. But `brand_profiles.website_url` already exists and is used by the per-article route — the TODO references a `domain` column that was implemented as `website_url`. Weekly cron currently does nothing. | Implement or remove from vercel.json | low |
| `api/meta/event/route.ts` | all | Unused route (no callers) + unauthenticated event injection (see auth matrix). Returns raw `err.message` in 500 body. | Delete | safe |
| `api/waitlist/route.ts` | 3 | Hardcoded GHL webhook URL with account/trigger IDs committed to source. | Move to env var | safe |
| `api/audit/route.ts` | 289-291 | `console.log('[audit] crawled …')` debug spam on every public request. | Remove | safe |
| `api/keywords/research/route.ts` | 144 | `console.log('Cache hits: …')` debug spam. | Remove | safe |
| `api/affiliates/apply/route.ts` | 30 | `console.log('[affiliate] new application:', email)` — PII logged on every submit. | Remove | safe |
| `api/audit/lead/route.ts` | 37-39 | `console.log('[audit-lead] email=…')` — PII in logs, comment says "Logs the lead server-side" as if it were storage; the lead is **only** persisted in GHL — a GHL outage silently loses leads (helpers "never throw"). | Persist to DB too, or accept | low |
| `api/articles/route.ts` (POST) | 29-47 | Free-tier limit check duplicated ad-hoc instead of using `checkArticleLimit` from `src/lib/usage.ts` (used by generate-brief/analyze). Paid per-plan article limits are NOT enforced at creation, only at brief generation — inconsistent but arguably fine. | Unify on lib helper | low |
| `api/keywords/[id]/route.ts` (DELETE) | 78-84 | Child `keywords` deleted by `project_id` only (no user scoping) — safe because ownership was verified 10 lines up, but relies on that check staying put. | Comment or FK cascade | safe |
| `src/app/auth/callback/route.ts` | 61-99 vs 103-143 | OTP and OAuth branches are ~40-line near-duplicates (sub lookup, profile lookup, GHL push, routing). Plus the `next`/`safeNext` bug (see auth section). | Extract shared `routeAuthenticatedUser()`; fix line 142 | needs-testing |
| `api/billing/checkout/route.ts` | 16 | `origin` taken from the request `Origin` header and embedded in the returned signup/checkout URL — header is client-controlled. Low impact (client already controls its own navigation) but sloppy. | Prefer `NEXT_PUBLIC_APP_URL` | low |
| Response-shape inconsistency | — | Error key is `{error}` everywhere, but success shapes vary: `{ok:true}` (publish, waitlist, brand connect), `{success:true}` (keywords/saved PATCH/DELETE, search-console, links/apply), `{received:true}` (webhook, meta/event). Free-tools/analyze + articles/analyze use bare `new Response(JSON.stringify(...))` without Content-Type in the 4xx paths while siblings use `NextResponse.json`. Streaming routes signal errors in-band three different ways: `{type:'error'}` NDJSON events (audit/analyze), plaintext `\n\n[Error: …]` (support/chat, keywords/discover, agent), and HTTP status (everything else). | Standardize when convenient | safe |
| `api/support/*`, `api/search-console/*`, `api/publish/*` | — | Clean. Comments are explanatory rather than narrative; error handling is deliberate (mapped 502/504/400s). No action. | — | — |

**Console usage overall:** 45 calls across 18 route files. Most are legitimate `console.error` in webhook/cron/OAuth paths; the four flagged above are debug/PII spam.

## 4. Dead route candidates (grep evidence)

| Route | Evidence | Verdict |
|---|---|---|
| `src/app/(auth)/callback/route.ts` (URL `/callback`) | Zero references to `/callback` in src; signup/login both use `${origin}/auth/callback` (`SignupForm.tsx:55`, `login/page.tsx:59`). `src/lib/support-kb.json:457` explicitly calls it "a duplicate older route". It's also a worse version (no plan-carry, no GHL). | **Dead — delete.** Leaving it live means an alternate confirmation path that skips checkout redirect + GHL onboarding if anyone ever hits it. |
| `api/meta/event` | No `api/meta` string anywhere in src, public/, or root HTML files. | **Dead — delete** (also a liability, see auth). |
| `api/billing/subscription-status` | No `subscription-status` reference outside the route itself (searched src, public, *.html). | **Dead — delete.** |
| `api/articles/[id]/check-ai-visibility` | No frontend caller found anywhere in src (searched `check-ai-visibility`). File is modified in the working tree alongside `keywords/page.tsx`, so it may be a feature-in-progress. | **Dead today — confirm with owner before deleting.** |
| `api/waitlist` | Only caller is `waitlist.html` — an untracked static file in the repo root, not part of the Next app build. | **Dead in-app**; keep only if that HTML is hosted somewhere that posts to production. |

Everything else has at least one verified frontend caller (counts from the grep sweep: articles subroutes called from `(dashboard)/articles/[id]/page.tsx`, publish from settings/connections, etc.).

## 5. Cron / webhook safety — verified

- `api/cron/check-ai-visibility`: exact-match check of `Authorization` against `Bearer ${CRON_SECRET}` before any work. Correct (note: if `CRON_SECRET` env is unset the expected value is `"Bearer undefined"` — still not guessable, but add a presence check).
- `api/billing/webhook`: rejects missing `stripe-signature` (400), verifies with `constructEvent` + `STRIPE_WEBHOOK_SECRET`, returns 400 on verification failure, 500 on critical DB failure so Stripe retries, and handlers are idempotent (upserts). This is the best-engineered file in the API surface.

## Top 5 recommendations for the handoff

1. Fix the `next` open redirect in `src/app/auth/callback/route.ts:142` (one word).
2. Fix or remove the broken polish-pass gating in `generate-draft` (paying Growth/Agency users are silently not getting the feature).
3. Delete the four dead routes, `(auth)/callback` first.
4. Regenerate Supabase types (kills 119 `any`-casts) and extract a `requireUser()` helper (kills 42 auth blocks).
5. Add rate limiting to the three public AI endpoints (`audit`, `free-tools/analyze`, `meta/event`-if-kept) — they are unmetered token/spend sinks.</result>
<usage><subagent_tokens>170763</subagent_tokens><tool_uses>89</tool_uses><duration_ms>5749766</duration_ms></usage>
</task-notification>

**Claude:** The API audit is back with the biggest findings yet: an **open-redirect bug in the auth callback**, a **broken feature gate that means Growth/Agency subscribers never get the article polish pass they pay for**, four dead routes (one an unauthenticated Meta conversion-event injector), and 119 `(supabase as any)` casts fixable in one shot by regenerating Supabase types. One agent left (pages/components) — full compiled report next.

## Michael

<task-notification>
<task-id>ace69e3d5dd84cefb</task-id>
<tool-use-id>toolu_01SsZT2D4HGmgracvjpntYsH</tool-use-id>
<output-file>C:\Users\ozzy5\AppData\Local\Temp\claude\C--Users-ozzy5-OneDrive-Documents-Byline\474e0a6a-8fd2-418b-a920-c1d21573f832\tasks\ace69e3d5dd84cefb.output</output-file>
<status>completed</status>
<summary>Agent "Audit pages/components" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>All major claims verified directly. Compiling the final report.

# Byline UI Audit — src/app (excl. api) + src/components

Scope: 78 files, ~17,950 lines. All findings below verified against the working tree (line numbers current as of this audit). Three verified rendering/correctness bugs surfaced along the way — flagged inline.

---

## 1. Top 10 Largest Files

| # | File | Lines | What it does | Split verdict |
|---|------|-------|--------------|---------------|
| 1 | `src/app/(dashboard)/articles/[id]/page.tsx` | 2,399 | Article detail: editor host, scores, link recs, 3-mode AI agent panel, WP publish modal, free-tier gating | **Split urgently.** `'use client'`, ~45 useState/useRef hooks, 7 inline components, 4 mount-time fetch effects, ~1,300 lines JSX. Extract `AgentPanel` (L1838–2254) + `useAgentStream` hook, `ScoresTab` (L1483–1643), `LinksTab` (L1645–1835), `FeaturedImageConcepts` (L1312–1433), `WpPublishModal` (L2256–2359), `FreeTierLimitModal` (L2361–2396), `lib/scoreFixes.ts` (L39–110). Gets it to ~600 lines. |
| 2 | `articles/new/page.tsx` | 1,123 | 5-step article wizard + quick-write + free-tier gate | **Split** per step; ~25 hooks; mixes Supabase queries, billing checks, SSE parsing, all 5 steps' JSX. |
| 3 | `brand/page.tsx` | 971 | Four UIs in one component: loading, quick-start form, streaming AI onboarding chat, profile view + edit modal | **Split** into `QuickStartForm` (L351–542), `BrandChat` (L546–738), `ProfileView` (L744–880), `EditProfileModal` (L883–968); 16 useState hooks spanning unrelated page states. |
| 4 | `keywords/[id]/page.tsx` | 787 | Keyword project detail: auto-research, polling, sortable table, save-to-folder, fake-progress toast | **Split.** 21 useState hooks; extract `KeywordTable`, `SaveToFolderMenu`, `ResearchToast`, `useKeywordProject` state machine. |
| 5 | `keywords/page.tsx` | 719 | Project list + full-screen 3-flow "New Research" overlay (chooser / direct form / AI discovery chat) | **Split.** The 300-line overlay (L413–716) is its own state machine; the streaming chat duplicates brand/page.tsx (see D3). |
| 6 | `(marketing)/audit/page.tsx` | 682 | Lead-magnet content-gap audit landing: hero form, NDJSON stream, email gate, 4 static SEO sections | **Split.** Route file itself is `'use client'`, so this SEO landing page **cannot export metadata** (and doesn't) — unlike ao/geo siblings which wrap a client component in a server page. |
| 7 | `ao-analyzer/_components/AoAnalyzerClient.tsx` | 682 | AO-score lead-magnet analyzer | **Merge with #9** — ~90% identical clone (see D1). |
| 8 | `content-audit/page.tsx` | 672 | Dashboard content-gap audit: client loads brand/keywords/articles, streams NDJSON, caches in localStorage + DB | **Split.** 5 useEffects forming fragile auto-run choreography; extract stream consumer, cache layer, 3 sub-components. |
| 9 | `geo-analyzer/_components/GeoAnalyzerClient.tsx` | 618 | GEO-score analyzer | **Merge with #7.** |
| 10 | `articles/import/page.tsx` | 608 | Paste/.docx import → streamed analysis → save | **Borderline OK** — most coherent big file; move `htmlToMarkdown` to lib and share the NDJSON reader. |

Also notable: `pricing-cards.tsx` (487), `dashboard/page.tsx` (460, the only large server component — well-architected), `src/app/page.tsx` (434).

---

## 2. Verified Bugs (found during audit — worth fixing before handoff)

1. **SupportWidget Rules-of-Hooks violation** — `src/app/_components/SupportWidget.tsx` L23–28: `if (isChatPage) return null` sits *before* the `useState` calls. Navigating between a chat route and a non-chat route changes the hook count between renders. Confirmed by direct read.
2. **Broken Tailwind class in 3 files** — `bg-[rgba(184,115,51,0.08)]0` (trailing `0`, invalid class) at `src/app/page.tsx:252` (homepage mockup dot invisible), `articles/[id]/page.tsx:2132` (streaming cursor invisible), `keywords/[id]/page.tsx:778` (toast progress bar has no fill). Residue of an indigo→copper find/replace (leftover `fill-indigo-500` at keywords/[id] L682 confirms).
3. **Unreachable rename-folder button** — `keywords/saved/page.tsx` L226: pencil button is `opacity-0 group-hover:opacity-100` but no ancestor has the `group` class (folder header L192–195). Feature is invisible in the UI.
4. **Plan-copy contradictions (verified via grep):** homepage L332 promises Growth "**unlimited articles**" while `pricing-cards.tsx` L54 says "**30 articles per month**"; homepage L311 says Starter has "**5 agent sessions**" vs pricing L37 "**10 keyword sessions**". `FounderBanner.tsx` L67/92 and `lib/support-kb.json` carry further hand-maintained copies. Most likely of anything here to generate refund complaints.

---

## 3. Duplication Clusters

**D1. AoAnalyzerClient vs GeoAnalyzerClient — ~90% identical copy-paste clones (headline finding).** Identical interfaces (both L16–37), `ScoreCircle`/`StatusBadge`/`PriorityBadge`, 9-hook state block, and a verbatim ~60-line NDJSON submit/stream handler differing only in `type: 'ao'` vs `'geo'`. `audit/page.tsx` is a third copy of the reader loop, email-gate overlay, nav, footer, loading card, and error banner; `audit/results/[id]/page.tsx` re-inlines the same types + hand-copied ScoreCircle markup (4th copy). One drift bug: GEO's lead POST sends `result` (L124), AO's doesn't (L133) — AO leads likely never get a shareable report. **Extraction:** one `AnalyzerClient` + config, `useNdjsonStream()`, `MarketingNav`, `MarketingFooter`, `EmailGateOverlay`, shared badges — kills ~1,300 lines.

**D2. NDJSON/SSE stream reader loop written ~7 times:** audit L152–192, AO L174–218, GEO L165–209, `articles/[id]` L1019–1040, `articles/import` L154–191, `content-audit` L203–239, plus raw-SSE variants in `articles/new` L527–545, `brand` L176–214, `keywords` L96–145.

**D3. Streaming-chat engine duplicated:** `brand/page.tsx` `fireAgentMessage` (L176–214) vs `keywords/page.tsx` `streamDiscovery` (L96–145) — identical reader loop, identical extract-XML-tagged-JSON endgame, identical fallback string `'Something went wrong. Please try again.'`. Chat-bubble markup also duplicated (brand L587–599 vs keywords L608–627 — same widget, one in Tailwind, one in style objects).

**D4. Small utilities copy-pasted:**
- `DifficultyBar` verbatim: `keywords/[id]` L47–58 vs `keywords/saved` L13–24 (only `w-16` vs `w-14`).
- `timeAgo` **three times, three behaviors**: `content-audit` L76–84, `dashboard` L27–40, `connections-section` L17–29.
- Score-color 80/60 threshold 4×: `articles/[id]` L113 + L1512, `articles/page` L19, `import` L76–78; a 70/40 variant 3× in the analyzers + results page.
- `(supabase as any)` + eslint-disable: **~30 call sites across 12 files** (dashboard alone has 7). Fix the generated Supabase types once, delete all.

**D5. Primary button recipe** `bg-[#B87333] … hover:bg-[#A0622A]` appears **~35×** across articles/keywords/brand/marketing files; dashboard and connections do the same button via `style={{ background: '#B87333' }}`. No shared `&lt;Button&gt;` exists. Same story for the red error banner (`bg-red-50 border-red-200…` — 5× inside `articles/[id]` alone, L1252–1271 is the same block three times consecutively), the centered `Loader2` page loader (8+ sites), the dashed empty-state card (4 sites), and the spinner-swap button ternary (~18× in `articles/[id]` alone; 82 `animate-spin` occurrences across 23 files).

**D6. Marketing chrome:** verbatim footer (`© 2025 Byline`) in audit/AO/GEO/affiliates; the text-logo markup hand-built 4 ways; `(marketing)/layout.tsx` is a pass-through (verified — 3 lines), so every marketing page carries its own header/footer. Homepage/pricing use a *different* footer (`© {new Date().getFullYear()} Peacock Creative Services LLC`) — the 2025 ones are stale.

**D7. Plan definitions in 4+ places:** `pricing-cards.tsx` `PLANS` (L25–80), homepage preview (L303–357), `admin-data.ts` `priceLabel` (L88–93: 'Starter'/'Growth'/'Multi-Brand'), `FounderBanner.tsx`, plus support-kb.json. Free-tier caps hardcoded client-side: cap of **3** agent turns written 6 ways in `articles/[id]` (L1166, 1170, 1174, 2375…), cap of **1** free article duplicated at `new/page.tsx` L326 + L385. Extract `lib/plans.ts`.

---

## 4. Per-File Slop Findings (path · finding · action · risk)

| File | Finding | Action | Risk |
|---|---|---|---|
| `_components/SupportWidget.tsx` | Hooks-order bug L23–28; dead expression L218 `{msg.content \|\| (streamingThis ? '' : '')}` (both branches `''`); stale comment L159–161 describing mobile-only hiding that doesn't exist; inline-style theming unlike rest of app | Move early-return below hooks; delete dead branches | **needs-testing** (bug fix) |
| `articles/[id]/page.tsx` | Dead wiring: `getWordCountRef` declared L231, passed L1464, never invoked; lying comment L1059 ("surface error briefly" — only console.error); indigo leftovers L1844, L2090; emoji-prefix protocol strings; watchdog `90_000` + stream-updater block duplicated verbatim between `sendAutoMode`/`sendPatchMode` (~330 lines, ~60% shared); `'free'` compared 6×; state-group narrating comments L205–300 | Extract hooks/components per §1; delete dead ref | safe (deletions) / needs-testing (split) |
| `articles/new/page.tsx` | Indigo leftovers L66, L75; light-theme banners on dark UI L623, L682, L727, L1096; unused fetched fields `cpc`/`competition`/`cluster` (selected L269, never rendered); hardcoded "GPT-4o" in UI copy L832, L1087 (repo also ships `google-ai.ts` — possibly inaccurate claim); free-tier check duplicated in-file | Fix copy; remove unused selects | safe |
| `articles/import/page.tsx` | `ScoreColor` L75–79 is a fake component (returns a className string, called as `${ScoreColor({score})}` L486); dead `readerRef` (assigned L155, never read); hand-rolled regex `htmlToMarkdown` L8–44 (no links/images/tables) | Rename to `scoreColor()`; delete ref; use turndown | safe |
| `articles/[id]/ArticleEditor.tsx` | Six mutable-ref props (L79–84) imperative API forcing parent to keep editor mounted-hidden; inline `&lt;style&gt;` L191–195; autosave writes `(supabase as any)` directly while parent uses API routes for same table | Consider `useImperativeHandle`; low priority | low |
| `brand/page.tsx` | No-op classes L695, L961 `hover:text-[var(--cream-dim)]` on already-cream-dim text; light-theme `bg-red-50`/`green-50` blocks L427, L511, L635–638, L947; ~11 banner/section narrating comments; duplicate empty-form literal L110–111 = L128–129 | Sweep classes; extract per §1 | safe |
| `keywords/[id]/page.tsx` | `handleResearch` L166–223 has **no try/catch** — network throw strands `researching=true` and toast forever; `handleSaveSelected` L232–247 fires N parallel POSTs, no error handling; fake timer-driven progress stages L178–179 (7s/14s); light-theme `COMPETITION_COLORS` L31–35, `divide-gray-50` L613 | Add catch; batch endpoint | low → needs-testing |
| `keywords/page.tsx` | Direct client-side Supabase **inserts** L221–231, L250–261 (bypasses API layer) but deletes via API; `window.confirm` L273 + bare `alert()` L280; violet light-theme accents L418–419, L610–611; state-mirrored-into-refs workaround L64–67; ~40 inline style objects while sibling uses Tailwind for same tokens | Unify data access; sweep colors | low |
| `keywords/saved/page.tsx` | Fire-and-forget writes: `handleDelete` L64–68 and `handleRenameFolder` L112–116 never check `res.ok` — UI desyncs silently from DB; `handleWriteArticle` L90–100 ignores results of two direct Supabase updates; no-op class L150; rename button unreachable (bug #3) | Add res.ok checks; add `group` class | low |
| `content-audit/page.tsx` | Copy says "Recovering your audit…" on first run (L336, L415); "Import" labels for a crawl (L387, L396); `DrBadge` tooltip "DataForSEO" L31 vs heading "Ahrefs Domain Rating" L482 — stale after Ahrefs→DataForSEO swap (commit 8c471...); `brand!.competitors` assertion L486 two lines after optional-chaining it L475; entire initial load is client-side useEffect with exhaustive-deps disables (L171, L275) | Fix copy/labels; server-fetch initial data | safe (copy) |
| `dashboard/page.tsx` | Keyword counts computed by selecting **all** rows and counting in JS L149–157, immediately after using `{ count: 'exact', head: true }` correctly L94; `user!.id` L75; plan string `'free'` L113; two full page layouts in one function | Use count queries; extract `FreeDashboard` | safe |
| `settings/connections/connections-section.tsx` | Pointless `async function init() { await load() }` wrapper L60–65; duplicate error-banner markup L149–154 vs L165–170; all-inline-style file among Tailwind siblings. Otherwise the cleanest client file (consistent try/catch/finally) | Minor cleanup | safe |
| `(marketing)/audit/page.tsx` | Unused import `ChevronRight` L6; dead state value `unlockStatus === 'sent'` set L111 never read; gap-card JSX pasted 3× in-file (L417–436, L452–469, L482–489); no `metadata` export possible (client route); unverifiable claim "Analyzed 10,000+ URLs" L381 | Server/client split; delete dead code | safe / needs-testing (split) |
| `Ao/GeoAnalyzerClient.tsx` | Redundant twin booleans `unlocked` + `emailSubmitted` always set together (AO L136–137, GEO L127–128); dead `'sent'` status both files; free-item gate thresholds differ silently (analyzers `slice(0,2)` vs audit `slice(0,3)`) | Merge per D1 | needs-testing |
| `(billing)/pricing/pricing-cards.tsx` | Dead `error` state — only ever set to `null` (L118, L155) yet rendered L305–309; real errors use `alert('…Check the console.')` L142, L162 (user-hostile); `'Loading…'` text swap vs spinners everywhere else; "trained on" claim L424 drifts from homepage's "grounded in" L102–103 | Wire error state; fix copy | safe |
| `src/app/page.tsx` | Broken class L252 (bug #2); off-palette `border-blue-200`/`bg-blue-200` L256–259 in dark mockup; raw `&lt;img&gt;` L82–83; placeholder `href="#"` social links L425–426; `GuaranteeLine` component exists L14–20 but the same sentence is re-hardcoded as text L361 | Fix class + palette | safe |
| `(marketing)/audit/results/[id]/page.tsx` | `priorityMap.high = 'bg-red-100 text-red-700'` L67 while the 3 live pages render high-priority as copper — same data, different semantics; hardcoded "Starter plan from $49/mo" L189; selects `email` (PII) L48 for a share page but never renders it; `✓` char L166 vs lucide icons everywhere else; malformed stored `result` JSON would throw unhandled at L59 | Share extracted badge components; drop email from select | safe |
| `(admin)/admin/_lib/admin-data.ts` | Best-factored large file. Five `as any` escapes; `getTopAccounts` selects all `articles` + `agent_memory` rows to count in JS L286–290; churn iterates every canceled sub ever L168–170; plan labels hardcoded (D7) | Count queries; shared plans module | low |

**Not slop (worth telling the dev):** zero `console.log` in scope (verified by grep); **zero raw inline `&lt;svg&gt;`** — icons are uniformly lucide-react; only 3 TODOs; no commented-out code blocks found; all `'use client'` directives are on files that genuinely use hooks (no redundant ones found).

---

## 5. Dead Component Candidates

**None.** Grep-verified every export in `src/components/` and `src/app/_components/`:

| Component | Imported by |
|---|---|
| `AnglePicker` | `keywords/page.tsx` L8 |
| `PostHogProvider` | `layout.tsx` L8 |
| `SupportWidget` | `(dashboard)/layout.tsx` L5 |
| `NavLinks` | `page.tsx`, audit, ao-analyzer, geo-analyzer |
| `FounderBanner`, `TestimonialsSection` | `page.tsx` (+ pricing-cards for Testimonials) |
| `ThemeScript`, `AnalyticsScripts`, `AnalyticsPageView` | `layout.tsx` L5–7 |
| `ThemeToggle` (→ `useTheme`) | `DashboardSidebar.tsx` L11 |
| `PortableTextBody` | `blog/[slug]/page.tsx` L14 |

Dead *values* exist instead (listed per-file above): `getWordCountRef`, `readerRef`, `unlockStatus 'sent'` ×3, pricing's `error` state, unused `cpc/competition/cluster` selects, unused `ChevronRight` import.

---

## 6. Inconsistency Summary

1. **Server vs client data fetching:** `dashboard/page.tsx`, `articles/page.tsx`, `settings/page.tsx` prove the server-component pattern works; brand, keywords ×3, content-audit, and articles/[id] all client-fetch the same tables in `useEffect` (grep-verified: `@/lib/supabase/client` in 6 page files), producing spinner screens and exhaustive-deps disables.
2. **Three-to-four styling dialects, often in one file:** Tailwind arbitrary values (`text-[var(--cream)]`), inline `style={{}}` objects (keywords, dashboard, connections, SupportWidget), raw hexes (**396 occurrences of the 4 brand hexes across 28 files** — grep-verified) that duplicate the CSS variables already defined in `globals.css` L15–46, plus a JS `COPPER` const in articles/[id]. Zero `dark:` utility usage despite a theme system.
3. **Light-theme residue on a dark app:** `bg-red-50`/`green-50`/`amber-50`/`violet-50`/`gray-50`/indigo classes stranded in ~10 dashboard files (pre-redesign leftovers) vs correctly dark-adapted `bg-red-900/30` elsewhere.
4. **Four error-handling styles:** try/catch + banner (connections, brand) · no-catch fetches that strand loading state (keywords/[id]) · fire-and-forget ignoring `res.ok` (saved) · native `alert()`/`window.confirm` (keywords, saved, pricing).
5. **Data-access split:** same tables written via direct browser Supabase in some files and via `/api/*` routes in others — sometimes within one function (`saved/page.tsx` reads via API, writes via client Supabase).
6. **Loading-state modeling:** independent booleans vs string unions vs nullable unions vs `'Loading…'` text — no convention.

**Highest-leverage extractions for the incoming dev:** `lib/plans.ts` (kills the pricing contradictions), typed Supabase client (kills ~30 `as any`), `useNdjsonStream` hook, merged `AnalyzerClient`, shared `Button`/`ErrorBanner`/`EmptyState`/`Spinner`/`DifficultyBar`/`timeAgo`, and splitting `articles/[id]/page.tsx`.</result>
<usage><subagent_tokens>95907</subagent_tokens><tool_uses>34</tool_uses><duration_ms>20355303</duration_ms></usage>
</task-notification>

**Claude:** All four audits are complete. Now I'll compile everything into a single prioritized cleanup document in the repo for the handoff, then summarize here.

> `Write: CLEANUP_AUDIT.md`

> `Write: C:/Users/ozzy5/.claude/projects/C--Users-ozzy5-OneDrive-Documents-Byline/memory/cleanup-audit-2026-07.md`

> `Edit: C:/Users/ozzy5/.claude/projects/C--Users-ozzy5-OneDrive-Documents-Byline/memory/MEMORY.md`

> `Read: C:/Users/ozzy5/.claude/projects/C--Users-ozzy5-OneDrive-Documents-Byline/memory/MEMORY.md`

> `Edit: C:/Users/ozzy5/.claude/projects/C--Users-ozzy5-OneDrive-Documents-Byline/memory/MEMORY.md`

**Claude:** Audit complete. Four parallel deep-dives covered `src/lib`, all 50+ API routes, the entire UI layer, and repo hygiene — every finding was verified by actually reading the code and grepping for consumers. The full prioritized report is now in [CLEANUP_AUDIT.md](CLEANUP_AUDIT.md) at the repo root. **No code was changed** — this is a live product, so everything is staged as recommendations with risk tags.

## The things that can't wait (P0)

1. **Leaked live credentials.** `run-byline-workflows.bat` and `debug-ghl.bat` contain your actual GoHighLevel PIT token and a long-lived Firebase refresh token, hardcoded. Neither file is gitignored — one `git add .` from being committed. **Rotate both tokens**, then get these files out of the repo.
2. **PII in the repo root.** Two lead CSVs with real names, emails, and LinkedIn URLs are sitting unignored in the project folder.
3. **Open redirect in the auth callback.** [route.ts:142](src/app/auth/callback/route.ts:142) redirects to the raw `next` param on the OAuth path — the sanitized `safeNext` already exists three lines of code away. One-word fix.
4. **Two billing bugs hurting paying customers.** `checkArticleLimit` in [usage.ts](src/lib/usage.ts) doesn't map the legacy `team` plan, so those subscribers get an article limit of **0**. And in [generate-draft](src/app/api/articles/generate-draft/route.ts), the Growth/Agency "polish pass" is gated on a `stripe_price_id` column that nothing ever writes — **paying users never receive the feature**.
5. **Pricing copy contradicts itself publicly** — homepage promises Growth "unlimited articles"; the pricing page says 30/month. Refund-complaint fuel.
6. **`api/meta/event` is unauthenticated, has zero callers, and lets anyone inject fake conversion events** into your Meta ad optimization. Delete it.

## The slop, quantified

- **~150 `(x as any)` casts** across 48 files, all traceable to one root cause: the generated Supabase `Database` type exists but was never applied to the clients. Regenerating types is the single highest-value cleanup — it deletes ~300 lines of noise in one pass.
- **~1,300 lines of pure copy-paste**: the AO and GEO analyzers are 90% identical 600+ line clones (with a drift bug — AO leads never get their report link). The NDJSON stream reader is hand-written 7–9 times, the LLM JSON parser 8 times, the auth boilerplate 42 times, the copper button recipe ~35 times.
- **`articles/[id]/page.tsx` is 2,399 lines with ~45 hooks** — the report includes an exact extraction plan to get it to ~600.
- **8 removable npm packages** (axios, zod, react-hook-form, etc. — zero imports anywhere) and 2 phantom deps (`sanity`, `@portabletext/types`) that should be declared before a lockfile refresh breaks the build.
- **~20 root files verified safe to delete** (MD5-matched duplicates, patches already in commit `63ba408`, debug dumps) and a dozen marketing docs that belong outside the repo.
- Small verified UI bugs: a broken Tailwind class from the indigo→copper find/replace in 3 files, an invisible rename-folder button, a React hooks-order violation in SupportWidget, and a weekly cron that runs every Monday and does nothing.

Also worth saying: plenty is genuinely healthy — the Stripe webhook is well-engineered, auth checks are consistent on 41/50 routes, TypeScript is strict with no config escape hatches, and there are no dead components or commented-out code graveyards.

The report ends with a suggested execution order (creds today → safe deletions this week → Supabase types before any other refactor). One caution before cleanup starts: there's **uncommitted WIP in the working tree** (the Gemini AI-visibility feature) that should be committed or parked first. If you want, I can start executing — the P0 fixes and the safe-deletion pass are each about an hour of work.

## Michael

ok start the fixes
flag anything that needs to be retested

**Claude:** Starting the fixes now. I'll work in this order: (1) credential/PII hygiene and safe deletions, (2) P0 code fixes, (3) dependency cleanup, (4) build to validate, then commit in logical chunks with explicit pathspecs so I don't sweep up your in-flight Gemini WIP. At the end I'll give you a retest checklist.

First, syncing with remote per the repo's git rules:

> `PowerShell: Pull latest master with rebase`

> `PowerShell: Check if local master is behind or ahead of remote`

> `PowerShell: Verify duplicate HTML files are byte-identical`

> `PowerShell: Verify all three patches are already applied to HEAD`

> `PowerShell: Move PII, secrets, and marketing docs out of the repo to Byline-local-docs`

> `PowerShell: Delete verified duplicates, applied patches, debug dumps, zips, and one-off scripts`

> `PowerShell: Wait for concurrent session's index.lock to clear, then git rm the migration script`

> `PowerShell: Delete one-off migration script on disk (stage later)`

> `Read: src/app/auth/callback/route.ts`

> `Read: src/lib/usage.ts`
