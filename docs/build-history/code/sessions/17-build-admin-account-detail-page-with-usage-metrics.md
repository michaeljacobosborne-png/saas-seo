# Build admin account detail page with usage metrics

- Session `ca144059-0206-4a9d-aecd-9ed877907b64`
- 2026-06-18 20:16 to 2026-06-18 20:18
- Branch: `master`  |  Claude Code 2.1.170

**Commits made:**

- `Admin: fix MRR for coupons + add account detail page`

**Files touched (7):** `src/app/(admin)/admin/_lib/admin-data.ts`, `src/app/(admin)/admin/page.tsx`, `src/app/(admin)/admin/_components/TopAccountsTable.tsx`, `src/lib/supabase/service.ts`, `src/app/(admin)/admin/_components/UsageTable.tsx`, `src/app/(admin)/admin/accounts/[id]/page.tsx`, `supabase/migrations/003_add_subscriptions.sql`

---


## Michael

The admin dashboard MRR fix is already written in `src/app/(admin)/admin/_lib/admin-data.ts` and `src/app/(admin)/admin/page.tsx`. Your job is to:

1. Read the current state of those files to understand what's done
2. Build the account detail page (new file)
3. Commit everything and push

## Step 1: Read current state
Read these files:
- `src/app/(admin)/admin/_lib/admin-data.ts`
- `src/app/(admin)/admin/page.tsx`
- `src/app/(admin)/admin/_components/TopAccountsTable.tsx` (if it exists)

## Step 2: Build the account detail page

Create `src/app/(admin)/admin/accounts/[id]/page.tsx`

This is a server component (no `"use client"`). Use `force-dynamic`.

Data to show for a given userId:
1. **User header** — email, signup date, account type (free/paid), plan name, MRR after coupons
2. **Articles summary** — count by status (draft/ready/published)
3. **Agent sessions** — count of `agent_memory` rows where `memory_type = 'article'` for this user
4. **Token & cost breakdown by feature** — group `usage_events` by `feature`, sum `input_tokens`, `output_tokens`, `cost_usd`
5. **30-day usage timeline** — group `usage_events` by `created_at::date` for last 30 days, show date + calls + cost
6. **All usage events** — show a simple table of all `usage_events` for this user (most recent first, limit 100)

### Data fetching pattern

Use the service-role Supabase client (bypasses RLS):
```typescript
import { createServiceClient } from '@/lib/supabase/service'
const svc = createServiceClient()
// cast as any to avoid TS type battles:
const p = svc as any
```

For user info (email + signup date): use `svc.auth.admin.getUserById(id)` which returns `{ data: { user }, error }`.

For Stripe MRR: import and call `getStripeMetrics` from `../_lib/admin-data` — it returns `customerMrr` map. Also query `subscriptions` table: `p.from('subscriptions').select('stripe_customer_id, status, plan_name').eq('user_id', id)`.

For articles: `p.from('articles').select('status').eq('user_id', id)`.

For agent sessions: `p.from('agent_memory').select('id', { count: 'exact', head: true }).eq('user_id', id).eq('memory_type', 'article')`.

For usage_events:
```typescript
const { data: usageRows } = await p
  .from('usage_events')
  .select('feature, model, input_tokens, output_tokens, cost_usd, created_at')
  .eq('user_id', id)
  .order('created_at', { ascending: false })
  .limit(500)
```

### Feature labels (reuse from page.tsx):
```typescript
const FEATURE_LABELS: Record<string, string> = {
  brief_gen: 'Brief generation',
  draft_gen: 'Draft generation',
  agent_review: 'Agent — review',
  agent_assist: 'Agent — assist',
  agent_auto: 'Agent — auto',
  keyword_research: 'Keyword research',
  audit: 'Content audit',
}
```

### Auth check
The `/admin` layout already gates by email — no need for extra auth check in this page.

### Styling
Match the admin dashboard look:
- Dark background: `bg-[var(--ink-bg)]` or `style={{ background: 'var(--ink-bg)' }}`
- Cards: `style={{ background: 'var(--ink-card)', border: '1px solid rgba(184,115,51,0.12)' }}`
- Copper accent: `text-[var(--copper)]` or `#B87333`
- Headings: cream `text-[var(--cream-faint)]`, smaller: `text-[var(--cream-dim)]`

### Back link
Include a `<Link href="/admin">← Back to dashboard</Link>` at the top.

### Link from top accounts table
After creating the page, update `src/app/(admin)/admin/_components/TopAccountsTable.tsx` (or wherever the top accounts table is rendered — might be inline in page.tsx) to make the email a clickable link: `<Link href={`/admin/accounts/${account.userId}`}>{account.email}</Link>`.

If TopAccountsTable.tsx is a `"use client"` component it can't use `<Link>` from next/link directly — make it an anchor tag instead: `<a href={`/admin/accounts/${account.userId}`}>`.

## Step 3: Commit and push

```bash
git pull --rebase origin main
git diff --stat HEAD
git -c user.email=michaeljacobosborne@gmail.com -c user.name="Michael Osborne" commit -m "Admin: fix MRR for coupons + add account detail page"
git push origin main
```

Do NOT run `tsc --noEmit` or any TypeScript compilation check — it may time out or fail due to missing env vars. Just commit and push; Vercel will catch any type errors.

**Claude:** I'll start by reading the current state of the files to understand what's already done.

> `Read: src/app/(admin)/admin/_lib/admin-data.ts`

> `Read: src/app/(admin)/admin/page.tsx`

**Claude:** Now let me read the TopAccountsTable component and the service client to understand the patterns.

> `Read: src/app/(admin)/admin/_components/TopAccountsTable.tsx`

> `Read: src/lib/supabase/service.ts`

> `Read: src/app/(admin)/admin/_components/UsageTable.tsx`

**Claude:** The `TopAccountsTable` is a server component (no `"use client"`), so I can use `next/link` `<Link>`. Now let me build the account detail page.

> `Write: src/app/(admin)/admin/accounts/[id]/page.tsx`

**Claude:** Now update `TopAccountsTable.tsx` to make the email a clickable link. It's a server component, so I'll use `next/link`.

> `Edit: src/app/(admin)/admin/_components/TopAccountsTable.tsx`

> `Edit: src/app/(admin)/admin/_components/TopAccountsTable.tsx`

**Claude:** Let me verify the `params` pattern and `plan_name` column against the actual codebase before committing.

> `Grep: params`

> `Grep: plan_name`

**Claude:** `params` as Promise is confirmed. Let me verify the `subscriptions` table columns since `plan_name` only appears in my new file.

> `Grep: subscriptions`

> `Read: supabase/migrations/003_add_subscriptions.sql`

**Claude:** The migration shows the column is `plan`, not `plan_name`. Let me check `schema.sql` for the current definition — it may differ.

> `Grep: plan|CREATE TABLE subscriptions`

**Claude:** Confirmed: the actual column is `plan` (values `starter`/`pro`/`agency`), not `plan_name`. Querying `plan_name` would error the whole select and make every account show as Free. I'll deviate from the task's literal column name to match the real schema.

> `Edit: src/app/(admin)/admin/accounts/[id]/page.tsx`

> `Edit: src/app/(admin)/admin/accounts/[id]/page.tsx`

> `Edit: src/app/(admin)/admin/accounts/[id]/page.tsx`

**Claude:** Now let me check the git state before committing — branch is `master` per memory, and there are many unrelated modified/untracked files I must not sweep in.

> `Bash: cd "C:\Users\ozzy5\OneDrive\Documents\Byline" && git branch --show-current && git remote -v | head -2 && git log --oneline -1`

**Claude:** Branch is `master` (the task's `main` references are wrong for this repo — memory confirms master). The working tree has unrelated modified/untracked files, so I'll stage only my four paths explicitly, commit, then rebase and push.

> `Bash: cd "C:\Users\ozzy5\OneDrive\Documents\Byline" && git add "src/app/(admin)/admin/_lib/admin-data.ts" "src/app/(admin)/admin/page.tsx" "src/app/(admin)/admin/_com`

**Claude:** Staged exactly the four intended files. Now commit, then rebase and push.

> `Bash: cd "C:\Users\ozzy5\OneDrive\Documents\Byline" && git -c user.email=michaeljacobosborne@gmail.com -c user.name="Michael Osborne" commit -m "Admin: fix MRR for co`
