# Map free tier user experience and plan gates

- Session `b3561354-821f-4ca7-9bcf-664d4bd445e4`
- 2026-06-16 09:35 to 2026-06-16 09:38
- Branch: `master`  |  Claude Code 2.1.170

**Files touched (16):** `ARCHITECTURE.md`, `src/app/auth/callback/route.ts`, `src/app/(dashboard)/layout.tsx`, `src/lib/usage.ts`, `src/app/(marketing)/audit/page.tsx`, `src/app/(dashboard)/dashboard/page.tsx`, `src/app/api/articles/[id]/agent/route.ts`, `src/app/api/articles/generate-draft/route.ts`, `src/app/api/articles/generate-brief/route.ts`, `src/app/(auth)/signup/SignupForm.tsx`, `src/app/api/keywords/discover/route.ts`, `src/app/(billing)/welcome/page.tsx`, `src/app/api/brand/onboard/route.ts`, `supabase/migrations/013_add_free_tier.sql`, `src/app/api/articles/route.ts`, `src/app/(billing)/pricing/page.tsx`

---


## Michael

I need to understand exactly what the current free tier user experience looks like, step by step. Do NOT make any changes — research only.

Read ARCHITECTURE.md first for context, then trace:

1. What happens immediately after a free user confirms their email and lands in the app?
   - Where does the auth callback redirect them?
   - What does the dashboard show them if they have no subscription / account_type = 'free'?

2. What does the /audit page do for logged-out vs free-tier logged-in users?
   - Is there a public /audit route? What does it show?
   - Does a free-tier user get to see their audit results if they came from the lead magnet?

3. What plan limits exist for free users?
   - Article generation: allowed or blocked?
   - Keyword research: allowed or blocked?
   - Brand onboarding: allowed or blocked?
   - Content audit: allowed or blocked?

4. Where exactly is the paywall triggered?
   - Which routes redirect to /pricing?
   - What does /pricing look like for someone coming from the free tier?

5. Read src/app/auth/callback/route.ts to see the redirect logic after email confirm.

6. Read src/app/(dashboard)/layout.tsx to see the subscription gate logic.

7. Read the free/plan-gating code — check src/lib/plans.ts or similar, and any middleware or layout checks for plan limits.

Report everything you find — the full step-by-step path a free-tier user currently walks through, and where the walls are.

**Claude:** I'll start by reading ARCHITECTURE.md for context, then trace the free-tier path through the key files. Let me kick off the research in parallel.

> `Read: ARCHITECTURE.md`

> `Glob: src/app/auth/callback/route.ts`

> `Glob: src/app/(dashboard)/layout.tsx`

> `Glob: src/lib/plans*.ts`

> `Glob: src/**/audit/**`

**Claude:** ARCHITECTURE.md gives strong context. Note `/audit` is under `(marketing)` (public), and plan limits live in `src/lib/usage.ts`. Let me read the core files.

> `Read: src/app/auth/callback/route.ts`

> `Read: src/app/(dashboard)/layout.tsx`

> `Read: src/lib/usage.ts`

> `Read: src/app/(marketing)/audit/page.tsx`

**Claude:** Now let me check the dashboard page (what a free user sees), the article generation routes, and the agent gate.

> `Read: src/app/(dashboard)/dashboard/page.tsx`

> `Read: src/app/api/articles/[id]/agent/route.ts`

> `Glob: src/app/api/articles/generate-*/route.ts`

> `Glob: src/app/(dashboard)/**/page.tsx`

**Claude:** Important finding emerging: the dashboard layout hard-redirects free users to `/pricing`, yet the agent route and usage lib contain free-tier allowances. Let me verify the other gates and the signup→free path to resolve this tension.

> `Read: src/app/api/articles/generate-draft/route.ts`

> `Read: src/app/api/articles/generate-brief/route.ts`

> `Glob: src/app/api/keywords/discover/route.ts`

> `Glob: src/app/(auth)/signup/**`

> `Glob: src/app/welcome/**`

**Claude:** Let me read the signup form (plan=free path), the keyword discover gate, and confirm whether `/welcome` exists.

> `Read: src/app/(auth)/signup/SignupForm.tsx`

> `Read: src/app/api/keywords/discover/route.ts`

> `Glob: src/app/**/welcome/**`

**Claude:** Let me check the keyword discover gate, the `/welcome` page, and where `checkKeywordSessionLimit` is enforced.

> `Grep: checkKeywordSessionLimit|KEYWORD_SESSION_LIMIT|account_type|incrementKeywordSession`

> `Read: src/app/(billing)/welcome/page.tsx`

> `Grep: account_type|checkArticleLimit|checkKeywordSessionLimit|brandProfiles|brand_profiles`

> `Read: src/app/api/brand/onboard/route.ts`

**Claude:** One crucial thing to verify: the `profiles.account_type` DEFAULT is `'paid'`. So does a free signup actually become `'free'`? Let me find where (if anywhere) account_type is set to `'free'` on signup.

> `Grep: account_type.*free|'free'|"free"|handle_new_user|DEFAULT 'paid'|DEFAULT 'free'`

> `Grep: account_type`

> `Read: supabase/migrations/013_add_free_tier.sql`

> `Grep: account_type`

> `Grep: account_type`

**Claude:** The resolution is clear now — migration 013's trigger sets `account_type='free'` for **every** new signup (the Stripe webhook later flips paid users to `'paid'`). Let me confirm the `/pricing` page behavior and the free-cap details in the articles route to complete the picture.

> `Read: src/app/api/articles/route.ts`

> `Glob: src/app/**/pricing/**`

> `Read: src/app/(billing)/pricing/page.tsx`

**Claude:** I now have the complete picture. Here is the full trace.

---

# Free-tier user experience — full trace

## The headline finding (read this first)

There are **two layers that contradict each other**:

1. **Per-feature code** throughout the app carefully implements a generous free tier: 1 free article, 3 free agent "review" turns per article, starter-level keyword sessions, free brand onboarding, etc.
2. **The dashboard layout gate** (`src/app/(dashboard)/layout.tsx`) **redirects every free user to `/pricing` before they can load a single dashboard route.**

Because a genuine free user has `account_type = 'free'` **and** no subscription row, layer 2 wins. **The free-tier feature code is effectively dead/unreachable** — a free user can never reach `/dashboard`, `/articles`, `/keywords`, `/brand`, or `/content-audit`. They bounce to `/pricing` every time.

The one thing a free (or anonymous) user *can* actually use is the **public `/audit` lead-magnet page**, which lives in the `(marketing)` group and has no auth gate.

---

## 1. After a free user confirms their email

**Account state at signup:** Migration `013_add_free_tier.sql` installs a trigger (`handle_new_user`) that inserts `account_type = 'free'` for **every** new auth user — free and paid alike. The Stripe webhook later flips paid users to `'paid'`; free signups stay `'free'`.
(Note: ARCHITECTURE.md line 56 claims the column DEFAULT is `'paid'` — that's **stale/wrong**. The trigger explicitly writes `'free'`, and the migration sets the column default to `'free'` too.)

**Redirect after confirm** (`src/app/auth/callback/route.ts`):
- Free signups carry **no** `plan`/`interval` params (SignupForm `callbackUrl()` returns the bare callback when `plan === 'free'` or absent), so `checkoutRedirect` is null.
- **Email-link branch** (`token_hash` + `type`, lines 20–27): on success → **`/pricing`** unconditionally.
- **OAuth/code branch** (lines 32–67): looks up subscription + `account_type`. A free user has `isFree = true`, `hasSub = false`. The "send to pricing" condition is `!hasSub && !isFree` → **false**, so it falls through to `${next}` = **`/dashboard`**.

So depending on signup method the immediate landing differs (`/pricing` for email confirm, `/dashboard` for OAuth) — **but it doesn't matter**, because:

**The dashboard never renders for them.** `src/app/(dashboard)/layout.tsx` (lines 13–33):
```
no active/trialing sub  →  load profile  →  if account_type === 'free' (or no profile) → redirect('/pricing')
```
Every `(dashboard)` route is wrapped by this layout, so a free user is immediately kicked to `/pricing`. They never see the dashboard, the onboarding checklist, the brand-setup gate, or the empty states — all of that (`dashboard/page.tsx`) is behind the wall.

There is no `/welcome` step for free users — `(billing)/welcome/page.tsx` is the **post-Stripe-checkout** poller (waits for the webhook to provision a paid account, then → `/dashboard`). Free users never hit it.

---

## 2. `/audit` — logged-out vs free logged-in

- **There is a public audit route:** `src/app/(marketing)/audit/page.tsx` (the `(marketing)` group is unauthenticated). Distinct from the in-app `(dashboard)/content-audit/page.tsx`.
- **Behavior is identical for logged-out and free logged-in users** — it doesn't check auth at all. Anyone enters a URL → `POST /api/audit` streams progress → results render client-side. No login required ("No email required. Results in ~10 seconds.").
- **Results shown:** scans the sitemap, shows page count, up to 3 **Quick Wins**, the **top 3 content gaps** in full, then **blurs the remaining gaps** behind a `Lock` overlay CTA ("N more gaps found… Write your first article free"). Plus an email-capture funnel (`POST /api/audit/lead`) to send "the full breakdown."
- **Lead-magnet → free signup bridge:** every CTA points to `/signup?plan=free&ref=audit` (or `?source=lead_magnet`). `ref=audit` stamps `source: 'lead_magnet'` into Supabase user_metadata; the `#1` gap keyword is stashed in `localStorage` (`byline_audit_intent`) to pre-fill the first article. **But** since the free user can't get past the dashboard layout, **they never reach `/articles/new` to consume that intent** — the bridge dead-ends at `/pricing`.

So: a free user from the lead magnet sees their **partial** audit on the public page, but does **not** get to see a full audit inside the app.

---

## 3. Plan limits for free users (as coded — mostly unreachable)

Free users resolve to **starter** tier limits in `src/lib/usage.ts` (`resolvePlan`: `accountType === 'free'` → `'starter'`). On top of that, several routes apply a stricter explicit free cap:

| Capability | Free-tier rule (as coded) | Where | Reachable by a real free user? |
|---|---|---|---|
| **Article creation** | Hard cap **1 article total** (`>= 1` → 403 `FREE_TIER_LIMIT`) | `api/articles/route.ts:35–46`; client mirror in `articles/new/page.tsx:382` (upgrade modal) | **No** — blocked by layout |
| **Brief generation** | `checkArticleLimit` → starter = **8/mo** | `api/articles/generate-brief/route.ts:15` | No |
| **Draft generation** | No explicit free gate; only reads `account_type` to **deny the polish pass** (Growth/Agency only) | `api/articles/generate-draft/route.ts` | No |
| **Article agent** | `review` mode allowed but capped at **3 turns/article**; `assist` and `auto` modes **403 for free** | `api/articles/[id]/agent/route.ts:54–75` | No |
| **Keyword research / discover** | Gated by keyword-session limit → starter = **10 sessions/mo** | `api/keywords/discover/route.ts:83`, `keywords/research` via `checkKeywordSessionLimit` | No |
| **Brand onboarding** | **Allowed for everyone** — no account_type gate; the only `account_type` logic is choosing whether to fire the "new free signup" Telegram ping | `api/brand/onboard/route.ts:142–182` | No (UI is behind layout) |
| **Content audit (in-app)** | No plan gate on `/api/audit` itself | `(dashboard)/content-audit` | No (UI behind layout) |
| **Public audit** | Fully open, top-3 gaps free, rest blurred | `(marketing)/audit` + `/api/audit` | **Yes** |

The signup form even advertises the intended free tier: *"Free plan includes 1 article and 3 AI review turns"* (`SignupForm.tsx:235`). That promise is currently undeliverable in-app.

---

## 4. Where the paywall is triggered

**The primary wall — `(dashboard)/layout.tsx:21–33`:** any logged-in user with no active/trialing subscription **and** `account_type === 'free'` (or no profile) → `redirect('/pricing')`. This is the gate that makes the entire free tier inaccessible.

**Secondary (API-level) walls** that would fire *if* a user got past the layout (e.g. a comped account, or `account_type` manually set to `'paid'` with no sub):
- `api/articles/route.ts` → 403 `FREE_TIER_LIMIT` after 1 article.
- `api/articles/[id]/agent/route.ts` → 403 on `assist`/`auto`, and after 3 review turns.
- `api/articles/generate-brief` → 403 `Article limit reached` (`upgradeUrl: '/pricing'`) past starter caps.
- `api/keywords/discover` & `research` → 429 `KEYWORD_SESSION_LIMIT` past the monthly session cap.
- Client-side upgrade modal in `articles/new/page.tsx`.

**`/pricing`** (`(billing)/pricing/page.tsx`): lives outside the dashboard group, so it's reachable. It loads the user's active sub (none, for free) and renders `PricingCards` with `currentPlan = null`, `hasActiveSubscription = false`. So a free user sees the **standard three-tier pricing table with no plan marked "current"** — there's no dedicated "you're on the free plan" state; it's just the public pricing page. Choosing a plan runs the logged-in checkout flow (`resolveCheckoutUrl`) straight to Stripe.

---

## 5. The step-by-step path a free user actually walks

1. Lands on public `/audit` (or homepage) → runs a free audit → sees top-3 gaps, rest blurred.
2. Clicks "Get started free" → `/signup?plan=free&ref=audit`.
3. Signs up (email or OAuth). Trigger creates profile `account_type='free'`. Source stamped `lead_magnet`; audit keyword stashed in localStorage.
4. Confirms email → `/auth/callback`:
   - email-link → `/pricing`;
   - OAuth → tries `/dashboard`.
5. If routed to `/dashboard` (or they navigate anywhere in the app), `(dashboard)/layout.tsx` sees no sub + `account_type='free'` → **`/pricing`**.
6. **Wall.** They cannot write their "1 free article," cannot run keyword research, cannot set up a brand, cannot run an in-app audit. Every door in the app redirects to `/pricing`.
7. `/pricing` shows the normal 3 tiers (no "current plan" highlight). Picking one → Stripe checkout → webhook flips `account_type` to `'paid'` + writes a sub → `(billing)/welcome` polls until provisioned → `/dashboard` (now allowed).

---

## Bottom line

The codebase contains a **fully-built free tier** (1 article, 3 review turns, starter keyword limits, free brand onboarding, lead-magnet keyword pre-fill) — but it is **completely gated off** by the single subscription check in `(dashboard)/layout.tsx`. As things stand, "free tier" means: **use the public `/audit` page, then hit a `/pricing` paywall the moment you try to do anything inside the app.** All the per-feature free allowances are unreachable for a real `account_type='free'` user.

If the intent is for free users to actually get their 1 free article, the layout gate at `src/app/(dashboard)/layout.tsx:32` is the line that contradicts it. (No changes made — research only, as requested.)
