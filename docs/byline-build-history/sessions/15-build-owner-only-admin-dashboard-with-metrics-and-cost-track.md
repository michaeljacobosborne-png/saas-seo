# Build owner-only admin dashboard with metrics and cost tracking

- Session `e1104202-b409-4d67-8438-5f7f4d080e54`
- 2026-06-18 13:42 to 2026-06-18 14:35
- Branch: `master`  |  Claude Code 2.1.170

**Files touched (24):** `ARCHITECTURE.md`, `src/app/(dashboard)/layout.tsx`, `src/lib/stripe.ts`, `src/lib/usage.ts`, `src/lib/supabase/service.ts`, `src/app/(dashboard)/dashboard/page.tsx`, `src/app/api/articles/generate-brief/route.ts`, `src/app/api/articles/generate-draft/route.ts`, `src/app/api/articles/[id]/agent/route.ts`, `src/app/api/keywords/research/route.ts`, `src/lib/keyword-intent.ts`, `package.json`, `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md`, `supabase/migrations/013_add_free_tier.sql`, `src/proxy.ts`, `supabase/migrations/20260618_usage_events.sql`, `src/app/(admin)/layout.tsx`, `src/app/(admin)/admin/_lib/admin-data.ts`, `src/app/(admin)/admin/_components/MetricCard.tsx`, `src/app/(admin)/admin/_components/UsageTable.tsx`, `src/app/(admin)/admin/_components/TopAccountsTable.tsx`, `src/app/(admin)/admin/page.tsx`, `C:/Users/ozzy5/.claude/projects/C--Users-ozzy5-OneDrive-Documents-Byline/memory/usage-events-migration-manual-apply.md`, `C:/Users/ozzy5/.claude/projects/C--Users-ozzy5-OneDrive-Documents-Byline/memory/MEMORY.md`

---


## Michael

Build an internal admin dashboard for Byline at `/admin`. This is owner-only — protected so only michaeljacobosborne@gmail.com can access it. Build it on the same Next.js app (no subdomain needed).

## Step 0 — Read before writing
1. Read `ARCHITECTURE.md` — get the DB schema, Stripe integration details, existing API patterns
2. Read `src/app/(dashboard)/layout.tsx` — understand the existing auth/subscription gating pattern
3. Check if Stripe SDK is already imported anywhere: `grep -r "stripe" src/lib --include="*.ts" -l` — read that file
4. Check `src/app/api` for any existing admin or stats routes
5. Read `next/dist/docs/` routing guide briefly to confirm route group conventions for this Next.js version

## Architecture

### Route structure
```
src/app/(admin)/
  layout.tsx          ← auth gate: only michaeljacobosborne@gmail.com
  admin/
    page.tsx          ← main dashboard (server component)
    _components/
      MetricCard.tsx
      UsageTable.tsx
      TopAccountsTable.tsx
```

### Admin auth gate (`(admin)/layout.tsx`)
- Get Supabase session server-side
- If no session OR `user.email !== 'michaeljacobosborne@gmail.com'` → redirect to `/login`
- Otherwise render children

## Dashboard sections to build

### Section 1 — Business metrics (top cards)
Pull from Stripe + Supabase:

**Stripe queries (use existing Stripe SDK instance):**
- Active MRR: sum `plan.amount * quantity` for all active subscriptions
- Total active paid subscribers: count of active subscriptions
- New paid subscribers this month: subscriptions with `created` >= start of current month
- Churned this month: canceled subscriptions where `canceled_at` >= start of current month
- Plan breakdown: count by price ID (Starter vs Pro)

**Supabase queries:**
- Total registered users: `SELECT count(*) FROM profiles`
- Free users: `SELECT count(*) FROM profiles WHERE account_type = 'free'`
- New signups this week: `profiles` where `created_at >= now() - interval '7 days'`
- New signups this month: same but 30 days

Display as a row of metric cards: MRR | Active Paid | Free Users | Total Users | New This Month | Churned This Month

### Section 2 — Feature usage (current month)
Pull from Supabase using existing tables (no new schema yet):

- Articles generated this month: `SELECT count(*) FROM articles WHERE created_at >= ...`
- Articles by status: brief_ready / draft_ready / published counts
- Agent sessions this month: count distinct (article_id, created_at date) from agent-related data — check schema for how agent turns are stored
- Audits run: check if audit runs are logged anywhere
- Keywords researched: check keyword_sessions or similar table

Display as a simple bar/number grid. Don't overengineer this — if a metric isn't in the DB yet, skip it with a "—" placeholder.

### Section 3 — Top accounts table
Columns: Email | Plan | Articles Generated | Agent Sessions | Member Since | MRR Contribution

Query:
```sql
SELECT 
  p.email,
  p.account_type,
  p.created_at,
  COUNT(DISTINCT a.id) as article_count,
  s.stripe_customer_id
FROM profiles p
LEFT JOIN articles a ON a.user_id = p.id
LEFT JOIN subscriptions s ON s.user_id = p.id
GROUP BY p.id, p.email, p.account_type, p.created_at, s.stripe_customer_id
ORDER BY article_count DESC
LIMIT 50
```

For MRR contribution per user: query Stripe for the customer's active subscription amount. Do this in a batch (fetch all customer IDs → one Stripe customers.list call or a Promise.all of subscription lookups for top 20 users). Don't fetch Stripe data for all 50 — just the top 20 by article count.

### Section 4 — Cost tracking (usage_events table — NEW)

**Migration:** Create `supabase/migrations/[timestamp]_usage_events.sql`:
```sql
CREATE TABLE IF NOT EXISTS usage_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  feature TEXT NOT NULL, -- 'brief_gen' | 'draft_gen' | 'agent_review' | 'agent_assist' | 'agent_auto' | 'keyword_research' | 'audit'
  model TEXT NOT NULL,   -- 'gpt-4o' | 'gpt-4o-mini' | 'claude-sonnet-4-6' | 'claude-haiku-4-5'
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_usage_events_user_id ON usage_events(user_id);
CREATE INDEX idx_usage_events_feature ON usage_events(feature);
CREATE INDEX idx_usage_events_created_at ON usage_events(created_at);
```

**Cost calculation helper** (`src/lib/usage.ts`):
```typescript
// Token pricing (as of mid-2025 — update as needed)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o':           { input: 2.50 / 1_000_000, output: 10.00 / 1_000_000 },
  'gpt-4o-mini':      { input: 0.15 / 1_000_000, output:  0.60 / 1_000_000 },
  'claude-sonnet-4-6':{ input: 3.00 / 1_000_000, output: 15.00 / 1_000_000 },
  'claude-haiku-4-5-20251001': { input: 0.80 / 1_000_000, output: 4.00 / 1_000_000 },
}

export function calcCostUsd(model: string, inputTokens: number, outputTokens: number): number

export async function logUsageEvent(params: {
  userId: string
  feature: string
  model: string
  inputTokens: number
  outputTokens: number
}): Promise<void>  // fire-and-forget, never throws
```

**Instrument these 4 routes** (the highest-cost ones — do these now, others can follow):

1. `src/app/api/articles/generate-brief/route.ts` — after the OpenAI call returns, call `logUsageEvent({ userId, feature: 'brief_gen', model: 'gpt-4o', inputTokens: completion.usage.prompt_tokens, outputTokens: completion.usage.completion_tokens })`

2. `src/app/api/articles/generate-draft/route.ts` — same pattern but `feature: 'draft_gen'`. Note this route uses streaming — use `usage` from the final stream chunk (OpenAI streaming responses include usage in the final chunk when `stream_options: { include_usage: true }` is set). Add that option to the OpenAI call and log after stream completes.

3. `src/app/api/articles/[id]/agent/route.ts` (or equivalent) — `feature: 'agent_' + mode` (review/assist/auto), log after response

4. `src/app/api/keywords/route.ts` (or equivalent) — if it uses Claude for intent analysis, log `feature: 'keyword_research'`, model: claude model used

**Add cost section to dashboard:**
Once the table exists and has rows, show:
- Total cost this month
- Cost by feature (table: feature | calls | total cost | avg cost/call)
- Cost by model
- Gross margin estimate: (MRR - total_cost_this_month) / MRR * 100

For now, if the table is empty (just created), show the section with $0.00 values and a note "Cost tracking active — data will appear as articles are generated."

## Design

Use the existing app's light/dark mode design system — check the dashboard layout for the correct sidebar/content structure and match it exactly. The admin page should look like any other dashboard page. No special styling needed.

Keep it all server-rendered — no client-side state. Use Suspense boundaries if any section might be slow (especially Stripe calls).

## After writing
1. `git pull --rebase origin main`
2. Apply the migration to the live DB:
   ```
   # Get the Supabase connection string from .env.local
   # Run: psql $DATABASE_URL -f supabase/migrations/[timestamp]_usage_events.sql
   ```
   If psql isn't available, note the SQL to run manually in Supabase dashboard
3. `git diff --stat HEAD` — verify scope
4. Commit: `git -c user.email=michaeljacobosborne@gmail.com -c user.name="Michael Osborne" commit -m "Add /admin dashboard — MRR, users, feature usage, cost tracking"`
5. `git push origin main`

If you hit schema questions (column names differ from what ARCHITECTURE.md says), read the actual table with `SELECT column_name FROM information_schema.columns WHERE table_name = 'X'` pattern — don't guess.

**Claude:** I'll start by reading the key files before writing any code, as the task instructs.

> `Read: ARCHITECTURE.md`

**Claude:** Now let me read the layout, Stripe/usage libs, and check existing API structure in parallel.

> `Read: src/app/(dashboard)/layout.tsx`

> `Read: src/lib/stripe.ts`

> `Read: src/lib/usage.ts`

> `Glob: src/app/api/**/route.ts`

**Claude:** No existing admin routes. Let me read the service client, an existing dashboard page for styling patterns, and the 4 routes I need to instrument.

> `Read: src/lib/supabase/service.ts`

> `Read: src/app/(dashboard)/dashboard/page.tsx`

> `Read: src/app/api/articles/generate-brief/route.ts`

**Claude:** Now let me read the other 3 routes to instrument: generate-draft, agent, and keywords/research.

> `Read: src/app/api/articles/generate-draft/route.ts`

> `Read: src/app/api/articles/[id]/agent/route.ts`

> `Read: src/app/api/keywords/research/route.ts`

**Claude:** Let me read a few more supporting files: keyword-intent (model + usage), package.json, the sidebar, and check the Next.js docs + migrations dir.

> `Read: src/lib/keyword-intent.ts`

> `Read: package.json`

> `Glob: supabase/migrations/*.sql`

> `Glob: node_modules/next/dist/docs/**/*rout*`

**Claude:** Let me confirm route-group conventions for Next 16, check env for DB connection, and verify the `profiles` schema (created_at presence).

> `Read: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md`

> `Read: supabase/migrations/013_add_free_tier.sql`

> `Bash: cd "C:\Users\ozzy5\OneDrive\Documents\Byline" && grep -iE "SUPABASE_DB_URL|DATABASE_URL|SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE_URL|POSTGRES" .env.local `

**Claude:** I now have everything I need on schema and patterns. Let me verify there's no middleware that would interfere with `/admin`, and confirm the Stripe price IDs / env naming.

> `Glob: src/middleware.ts`

> `Bash: cd "C:\Users\ozzy5\OneDrive\Documents\Byline" && grep -iE "STRIPE_PRICE|STRIPE_SECRET" .env.local | sed -E 's/=.*/=<redacted>/'`

> `Glob: **/middleware.{ts,js}`

> `Grep: x-pathname|matcher|export function middleware|export async function middleware`

> `Read: src/proxy.ts`

**Claude:** I have a complete picture. Key facts confirmed: `profiles` has `created_at` and `id` (separate from `user_id`) but **no email** (emails come from `auth.users` via service-role admin API); the join key across tables is `user_id`; `proxy.ts` (Next 16's renamed middleware) won't block `/admin`. Let me set up tasks and build.

> `ToolSearch: select:TaskCreate`

> `TaskCreate: supabase/migrations/20260618_usage_events.sql with table + indexes`

> `TaskCreate: MODEL_PRICING, calcCostUsd, logUsageEvent (fire-and-forget via service client)`

> `TaskCreate: generate-brief, generate-draft, agent, keywords/research`

> `TaskCreate: (admin)/layout.tsx — owner-only email gate`

> `TaskCreate: page.tsx, MetricCard, UsageTable, TopAccountsTable, admin-data lib`

> `TaskCreate: npm build, apply SQL, update ARCHITECTURE.md, commit+push`

**Claude:** Now let me build. Starting with the migration and the cost helpers.

> `Write: supabase/migrations/20260618_usage_events.sql`

**Claude:** I spotted a real bug in the spec's migration: it references `profiles(id)`, but every route passes `user.id` (the **auth.users** id = `profiles.user_id`, not `profiles.id`). Inserting would violate that FK. Let me fix it to reference `auth.users(id)`, matching the convention used by `articles`/`subscriptions`.

> `Edit: supabase/migrations/20260618_usage_events.sql`

**Claude:** Now the cost helpers appended to `lib/usage.ts`:

> `Edit: src/lib/usage.ts`

**Claude:** All scaffolding is in place. Now instrument the 4 routes. Starting with **generate-brief**:

> `Edit: src/app/api/articles/generate-brief/route.ts`

> `Edit: src/app/api/articles/generate-brief/route.ts`

> `Edit: src/app/api/articles/generate-brief/route.ts`

**Claude:** Now **generate-draft** — accumulate token usage across all OpenAI calls (pass 1, expansion, polish), split by model. First the import:

> `Edit: src/app/api/articles/generate-draft/route.ts`

> `Edit: src/app/api/articles/generate-draft/route.ts`

**Claude:** Now the expansion-angles (mini) and expansion (gpt-4o) calls:

> `Edit: src/app/api/articles/generate-draft/route.ts`

> `Edit: src/app/api/articles/generate-draft/route.ts`

**Claude:** Now the polish-pass calls (intro/conclusion generation on gpt-4o, winner selection on gpt-4o-mini):

> `Edit: src/app/api/articles/generate-draft/route.ts`

> `Edit: src/app/api/articles/generate-draft/route.ts`

**Claude:** Now log the accumulated usage after the final save (the GHL block already uses `after()`):

> `Edit: src/app/api/articles/generate-draft/route.ts`

**Claude:** Now the **agent route** — capture Claude usage via `finalMessage()` in each stream branch:

> `Edit: src/app/api/articles/[id]/agent/route.ts`

> `Edit: src/app/api/articles/[id]/agent/route.ts`

> `Edit: src/app/api/articles/[id]/agent/route.ts`

**Claude:** Now the **review** (default) stream:

> `Edit: src/app/api/articles/[id]/agent/route.ts`

**Claude:** Now **keywords/research** — instrument the clustering call. First the import and `clusterKeywords` return shape:

> `Edit: src/app/api/keywords/research/route.ts`

> `Edit: src/app/api/keywords/research/route.ts`

**Claude:** All 4 routes instrumented. Let me update task progress and build the admin layout + dashboard.

> `ToolSearch: select:TaskUpdate`

> `TaskUpdate`

> `TaskUpdate`

> `TaskUpdate`

> `TaskUpdate`

**Claude:** Now the admin layout auth gate:

> `Write: src/app/(admin)/layout.tsx`

**Claude:** Now the admin data layer. This is the core — Stripe + Supabase aggregate queries via the service-role client:

> `Write: src/app/(admin)/admin/_lib/admin-data.ts`

**Claude:** Now the presentational components — matching the dashboard's ink/copper theme. MetricCard first:

> `Write: src/app/(admin)/admin/_components/MetricCard.tsx`

> `Write: src/app/(admin)/admin/_components/UsageTable.tsx`

> `Write: src/app/(admin)/admin/_components/TopAccountsTable.tsx`

**Claude:** Now the main dashboard page with Suspense boundaries and per-request Stripe deduplication via React `cache`:

> `Write: src/app/(admin)/admin/page.tsx`

> `TaskUpdate`

> `TaskUpdate`

> `TaskUpdate`

**Claude:** Let me typecheck the new/modified code before building:

> `Bash: cd "C:\Users\ozzy5\OneDrive\Documents\Byline" && npx tsc --noEmit -p tsconfig.json 2>&1 | head -50`

**Claude:** Typecheck passes. Now the full `next build` (what Vercel runs — includes eslint):

> `Bash: cd "C:\Users\ozzy5\OneDrive\Documents\Byline" && npm run build 2>&1 | tail -60`

**Claude:** Build succeeded. Let me confirm the `/admin` route registered and there were no warnings:

> `Bash: cd "C:\Users\ozzy5\OneDrive\Documents\Byline" && npm run build 2>&1 | grep -iE "admin|error|warn|failed|✓ Compiled|Compiled successfully" | head -30`

**Claude:** The first build succeeded (it printed the full route manifest, which only happens on success). The EPERM is a transient OneDrive/Windows file-lock from running two builds back-to-back, not a code error. Let me run one clean build and capture the route list head to confirm `/admin` registered:

> `Bash: cd "C:\Users\ozzy5\OneDrive\Documents\Byline" && rm -rf .next 2>/dev/null; npm run build 2>&1 | grep -nE "/admin|Compiled successfully|Failed to compile|Type er`

**Claude:** Build compiles cleanly and `/admin` is registered as a dynamic route. Now let me apply the migration to the live DB. I'll use the `pg` client (already a dependency) with `SUPABASE_DB_URL` from `.env.local`, via a throwaway script in the temp dir so it's never committed:

> `Bash: cat > "$TEMP/apply_usage_events.mjs" <<'EOF'`

**Claude:** The temp script couldn't resolve `pg` (outside `node_modules`). Let me place it in the repo root so resolution works, and delete it immediately after:

> `Bash: cd "C:\Users\ozzy5\OneDrive\Documents\Byline" && cat > "_tmp_apply.mjs" <<'EOF'`

**Claude:** As the memory note predicted, the direct DB host is unreachable from here (`ENOTFOUND` — IPv6-only). The migration must be applied manually in the Supabase SQL editor, consistent with this project's other migrations. The code already degrades gracefully until then (the cost section shows an "apply migration" note). Let me record this, then update docs.

First, ARCHITECTURE.md — add the `usage_events` table:

> `Edit: ARCHITECTURE.md`

**Claude:** Now add an Admin Dashboard section and note the cost instrumentation:

> `Edit: ARCHITECTURE.md`

**Claude:** Now save a memory about the migration manual-apply requirement (persistent project fact, like the other migration notes):

> `Write: C:/Users/ozzy5/.claude/projects/C--Users-ozzy5-OneDrive-Documents-Byline/memory/usage-events-migration-manual-apply.md`

> `Read: C:/Users/ozzy5/.claude/projects/C--Users-ozzy5-OneDrive-Documents-Byline/memory/MEMORY.md`

> `Edit: C:/Users/ozzy5/.claude/projects/C--Users-ozzy5-OneDrive-Documents-Byline/memory/MEMORY.md`

**Claude:** Docs and memory updated. Now to commit. Let me check git state, confirm the temp file is gone, and verify branch/remote before staging only my files:

> `Bash: cd "C:\Users\ozzy5\OneDrive\Documents\Byline" && git rev-parse --abbrev-ref HEAD && echo "---lock---" && ls .git/index.lock 2>/dev/null || echo "no lock" && ech`

> `Bash: cd "C:\Users\ozzy5\OneDrive\Documents\Byline" && git fetch origin master 2>&1 | tail -3 && echo "---behind/ahead---" && git rev-list --left-right --count HEAD..`

**Claude:** Local and remote `master` are identical (0/0), so no rebase needed. Let me stage only my files with explicit pathspecs and verify the staged scope:

> `Bash: cd "C:\Users\ozzy5\OneDrive\Documents\Byline" && git add \`

**Claude:** Staged scope is exactly my 12 files — no stray pre-existing changes included. Now commit with the required author and push to `master`:

> `Bash: cd "C:\Users\ozzy5\OneDrive\Documents\Byline" && git -c user.email=michaeljacobosborne@gmail.com -c user.name="Michael Osborne" commit -m "Add /admin dashboard `

> `Bash: cd "C:\Users\ozzy5\OneDrive\Documents\Byline" && git push origin master 2>&1 | tail -8`

**Claude:** Pushed successfully (`65c5ac5..eb134c8`). Let me close out the task list.

> `TaskUpdate`

**Claude:** Done. Built and shipped the owner-only `/admin` dashboard.

## What I built

**Auth gate** — [`src/app/(admin)/layout.tsx`](src/app/(admin)/layout.tsx): server-side session check, redirects to `/login` unless `user.email === 'michaeljacobosborne@gmail.com'`. Confirmed `proxy.ts` (Next 16's renamed middleware) doesn't gate `/admin`, so the layout is the sole guard.

**Dashboard** — [`src/app/(admin)/admin/page.tsx`](src/app/(admin)/admin/page.tsx), `force-dynamic`, four `<Suspense>` sections so slow Stripe calls don't block the shell:
- **Business metrics** — MRR (monthly-normalized, annual ÷ 12), active paid, free/total users, new this month/week, churned this month + plan breakdown table.
- **Feature usage** — articles this month, status buckets, agent sessions, keyword projects (audits show `—`, no log table exists).
- **Top accounts** — top 50 by articles generated; MRR resolved for the top 20.
- **Cost tracking** — total cost, gross margin, cost-by-feature and cost-by-model tables.

**Data layer** — [`_lib/admin-data.ts`](src/app/(admin)/admin/_lib/admin-data.ts): cross-user aggregates use the **service-role client** (RLS would otherwise scope to the owner's own rows); emails/signup dates come from `auth.users` via `admin.listUsers()` since `profiles` has no email column. Stripe is fetched once and deduped across sections with React `cache()`.

**Cost tracking** — migration [`20260618_usage_events.sql`](supabase/migrations/20260618_usage_events.sql) + `calcCostUsd`/`logUsageEvent` in [`src/lib/usage.ts`](src/lib/usage.ts). Instrumented all 4 routes (generate-brief, generate-draft, agent, keywords/research), with token usage accumulated across the draft pipeline's multiple model calls.

## Two corrections to the spec
- **Migration FK was wrong**: the spec referenced `profiles(id)`, but every route logs `user.id` (the auth uid = `profiles.user_id`; `profiles.id` is a separate surrogate key). FK'ing to `profiles(id)` would reject every insert. I pointed it at `auth.users(id)`, matching `articles`/`subscriptions`.
- **generate-draft isn't streaming** (spec assumed it was) — it's plain completions, so I read `completion.usage` directly.

## Verified
- `tsc --noEmit` clean; `next build` compiles, `/admin` registered as a dynamic route.
- Committed only my 12 files (verified staged scope), author `michaeljacobosborne@gmail.com`, pushed to `master`.

## ⚠️ One manual step remaining
The migration **could not be applied from here** — the direct DB host is IPv6-only/unreachable from this environment (`getaddrinfo ENOTFOUND`, exactly as your prior memory noted). **Paste `supabase/migrations/20260618_usage_events.sql` into the Supabase SQL editor.** Until then, `/admin` works fully — only the cost section shows an "apply migration" note (the code returns `tableMissing` gracefully, and `logUsageEvent` fails soft). I recorded this in ARCHITECTURE.md and memory.

Note: ARCHITECTURE.md is gitignored (local-only), so its updates weren't committed — that's by design per your project convention.
