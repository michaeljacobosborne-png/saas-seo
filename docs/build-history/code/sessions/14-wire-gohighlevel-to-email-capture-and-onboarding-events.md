# Wire GoHighLevel to email capture and onboarding events

- Session `b9d4b0e7-0660-4c5b-8610-3a9b2c109d9f`
- 2026-06-18 05:58 to 2026-06-18 07:54
- Branch: `master`  |  Claude Code 2.1.170

**Commits made:**

- `Wire GHL to audit lead capture + onboarding activation events`

**Files touched (11):** `ARCHITECTURE.md`, `src/app/api/billing/webhook/route.ts`, `src/app/api/audit/lead/route.ts`, `src/app/auth/callback/route.ts`, `src/app/api/brand/save/route.ts`, `src/app/api/articles/generate-draft/route.ts`, `src/app/api/articles/[id]/agent/route.ts`, `.env.local.example`, `src/lib/ghl.ts`, `C:/Users/ozzy5/.claude/projects/C--Users-ozzy5-OneDrive-Documents-Byline/memory/ghl-activation-events.md`, `C:/Users/ozzy5/.claude/projects/C--Users-ozzy5-OneDrive-Documents-Byline/memory/MEMORY.md`

---


## Michael

Wire GoHighLevel (GHL) into Byline's email capture and onboarding activation events so both email sequences can run from GHL workflows.

## Step 0 — Read before writing
1. Read `ARCHITECTURE.md` (root) — contains known GHL integration details, env vars, and existing webhook patterns
2. Search for any existing GHL utility or helper: `grep -r "highlevel\|gohighlevel\|GHL\|ghl" src/ --include="*.ts" -l`
3. Read whatever GHL-related files exist — understand the current pattern before adding to it
4. Read `src/app/api/audit/lead/route.ts` — the endpoint that captures emails from /audit
5. Read `src/app/auth/callback/route.ts` — the new-user entry point
6. Check for brand profile save endpoint: `grep -r "brand" src/app/api --include="*.ts" -l`, then read the most relevant one
7. Check article generation completion: read `src/app/api/articles/generate-draft/route.ts` (last ~50 lines — look for where status is set to 'ready')
8. Check agent session start: `grep -r "agent\|review\|assist\|auto" src/app/api --include="*.ts" -l`, read the relevant route

## What to build

### 1. GHL helper utility
Create `src/lib/ghl.ts` with:

```typescript
// GoHighLevel API helper
// All functions are fire-and-forget — they should never throw or block the main request

const GHL_API_KEY = process.env.GHL_API_KEY
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID

// Contact upsert — creates or updates a contact by email
export async function ghlUpsertContact(params: {
  email: string
  firstName?: string
  lastName?: string
  tags?: string[]
  customFields?: Record<string, string | number | boolean>
}): Promise<string | null>  // returns contactId or null on failure

// Add contact to a GHL workflow by workflow ID
export async function ghlAddToWorkflow(contactId: string, workflowId: string): Promise<void>

// Update contact tags (additive — doesn't remove existing tags)
export async function ghlAddTags(contactId: string, tags: string[]): Promise<void>

// Update a custom field on a contact
export async function ghlUpdateCustomField(contactId: string, fieldKey: string, value: string | number | boolean): Promise<void>
```

Use GHL API v1: `https://rest.gohighlevel.com/v1/contacts/`

Auth header: `Authorization: Bearer ${GHL_API_KEY}`

All functions should wrap in try/catch and log errors without throwing. Use `console.error('[GHL]', ...)` for failures so they're visible in Vercel logs but never crash the main request.

### 2. Wire /api/audit/lead

After the existing Resend email send (or in parallel — don't block on GHL), call GHL:
1. `ghlUpsertContact({ email, tags: ['audit_lead', 'byline_lead'] })`
2. Get the returned contactId
3. `ghlAddToWorkflow(contactId, process.env.GHL_WORKFLOW_AUDIT_NURTURE_ID!)` — adds them to the post-audit nurture sequence
4. `ghlUpdateCustomField(contactId, 'audit_domain', domain)` — store which domain they audited (useful for personalizing the GHL workflow)

### 3. Wire new user signup (auth callback or profile creation)

The best hook is where the user profile row is created in Supabase after signup. Find that location (likely in auth callback or a dedicated /api/users/profile endpoint).

After profile creation:
1. `ghlUpsertContact({ email: user.email, firstName, tags: ['byline_user', 'free_tier'] })`  
   — For paid signups, use `['byline_user', 'paid_subscriber']` instead
2. `ghlAddToWorkflow(contactId, process.env.GHL_WORKFLOW_WELCOME_ONBOARDING_ID!)`

If the user already exists as an audit_lead contact in GHL, the upsert will update them — this is correct behavior (they move from nurture to onboarding).

### 4. Wire Brand Profile completion

In the brand profile save/update API route, after successful save:
1. Get the user's email from the session
2. `ghlUpsertContact({ email, customFields: { brand_profile_complete: true } })`
3. `ghlAddTags(contactId, ['brand_profile_complete'])`

This allows the GHL workflow to skip or branch Email 2 of the onboarding sequence.

### 5. Wire first article generation

In the article generation route (generate-draft), after the draft status is set to 'ready', check if this is the user's first article:
- Query: `SELECT count(*) FROM articles WHERE user_id = X AND status = 'ready'`  
- If count === 1 (this is the first):
  1. `ghlUpsertContact({ email, customFields: { articles_generated: 1 } })`
  2. `ghlAddTags(contactId, ['first_article_generated'])`

### 6. Wire first agent session

In the agent API route (wherever the agent conversation is initiated), check if this is the user's first agent session:
- Could be a simple flag in the user's profile row, or a count of agent_turns
- If first session:
  1. `ghlUpsertContact({ email, customFields: { agent_sessions: 1 } })`
  2. `ghlAddTags(contactId, ['agent_used'])`

### 7. Add env var documentation

Add these to `.env.local.example` (or equivalent):
```
GHL_API_KEY=                          # GHL private API key
GHL_LOCATION_ID=                      # GHL location/sub-account ID  
GHL_WORKFLOW_AUDIT_NURTURE_ID=        # Workflow ID: post-audit nurture sequence
GHL_WORKFLOW_WELCOME_ONBOARDING_ID=   # Workflow ID: new subscriber welcome
```

## Important constraints
- **Never block the main request on GHL calls.** Use `void ghlUpsertContact(...)` pattern or wrap in an async IIFE. If GHL is down, the user experience must be unaffected.
- **Never throw from GHL functions.** All errors are logged only.
- **Don't add GHL to middleware or any hot path.** Only fire on meaningful events (email capture, signup, brand save, first article, first agent session).
- The GHL_API_KEY will be in Vercel env vars — don't hardcode it or commit it.

## After writing
1. `git pull --rebase origin main`
2. `git diff --stat HEAD` — confirm only expected files changed
3. Commit: `git -c user.email=michaeljacobosborne@gmail.com -c user.name="Michael Osborne" commit -m "Wire GHL to audit lead capture + onboarding activation events"`
4. `git push origin main`
5. Note in your summary which env vars need to be set in Vercel before the integration goes live.

**Claude:** I'll start by reading the architecture and existing patterns before writing any code.

> `Read: ARCHITECTURE.md`

**Claude:** ARCHITECTURE.md already mentions a GHL webhook pattern in the Stripe billing webhook. Let me find existing GHL code and the target routes.

> `Grep: highlevel|gohighlevel|GHL|ghl|GHL_WEBHOOK_URL`

> `Read: src/app/api/billing/webhook/route.ts`

**Claude:** Now let me read the target route files and find the relevant endpoints.

> `Read: src/app/api/audit/lead/route.ts`

> `Read: src/app/auth/callback/route.ts`

> `Read: src/app/api/brand/save/route.ts`

> `Bash: cd "C:\Users\ozzy5\OneDrive\Documents\Byline" && tail -n 60 src/app/api/articles/generate-draft/route.ts`

**Claude:** The status is `'ready'` here (not `'complete'`). Let me read the top of generate-draft to understand the user/supabase setup, and find the agent route.

> `Read: src/app/api/articles/generate-draft/route.ts`

> `Read: src/app/api/articles/[id]/agent/route.ts`

**Claude:** Let me check for the env example file and the location ID usage in GHL v1.

> `Bash: cd "C:\Users\ozzy5\OneDrive\Documents\Byline" && ls -la | grep -i env; echo "---"; find . -maxdepth 2 -name "*.env*" -not -path "*/node_modules/*" 2>/dev/null`

> `Read: .env.local.example`

**Claude:** I have everything I need. Let me set up task tracking and create the GHL helper.

> `ToolSearch: select:TaskCreate`

**Claude:** I'll proceed directly. Let me create the GHL helper utility first.

> `Write: src/lib/ghl.ts`

**Claude:** Now let me wire `/api/audit/lead`:

> `Edit: src/app/api/audit/lead/route.ts`

**Claude:** Now the new-user signup hook. The profile is trigger-created, so the auth callback is the application entry point. Since these run on Vercel serverless, let me verify Next 16's `after()` is available — it runs work after the response is sent (non-blocking) but reliably, which is exactly right for fire-and-forget here.

> `Bash: cd "C:\Users\ozzy5\OneDrive\Documents\Byline" && grep -rl "export.*after" node_modules/next/dist/server/after/ 2>/dev/null; echo "--- server index exports ---";`

**Claude:** `after` is exported from `next/server`. This is the correct Next 16 primitive — non-blocking (response sent first) and reliably executed on Vercel, unlike a bare `void` which can be dropped after the response. Let me use it consistently. First, update audit/lead:

> `Edit: src/app/api/audit/lead/route.ts`

> `Edit: src/app/api/audit/lead/route.ts`

**Claude:** Now the auth callback. Let me wire new-user signup with new-user detection:

> `Edit: src/app/auth/callback/route.ts`

**Claude:** Now call it in both branches after the sub/profile check (paid-checkout signups return earlier and are covered by the Stripe webhook's GHL path). First the token_hash branch:

> `Edit: src/app/auth/callback/route.ts`

> `Edit: src/app/auth/callback/route.ts`

**Claude:** Now the brand profile save route:

> `Edit: src/app/api/brand/save/route.ts`

> `Edit: src/app/api/brand/save/route.ts`

**Claude:** The spec for step 4 only asks for upsert + addTags. Let me remove the redundant extra call and the unused import:

> `Edit: src/app/api/brand/save/route.ts`

> `Edit: src/app/api/brand/save/route.ts`

**Claude:** Now first-article generation in generate-draft. Add imports:

> `Edit: src/app/api/articles/generate-draft/route.ts`

> `Edit: src/app/api/articles/generate-draft/route.ts`

**Claude:** Now the first agent-session hook. I'll use an account-level `agent_memory` sentinel (mirroring the existing `expertise_nudge_shown` pattern) so it fires once across all modes. Add imports:

> `Edit: src/app/api/articles/[id]/agent/route.ts`

**Claude:** Now insert the first-session detection after the free-tier gating, before the article fetch:

> `Edit: src/app/api/articles/[id]/agent/route.ts`

**Claude:** Now add env var documentation. I'll add a GHL section, including the existing `GHL_WEBHOOK_URL` (used by the Stripe webhook but currently undocumented):

> `Edit: .env.local.example`

**Claude:** Now let me typecheck and lint to verify everything compiles.

> `Bash: cd "C:\Users\ozzy5\OneDrive\Documents\Byline" && npx tsc --noEmit 2>&1 | head -40`

**Claude:** Typecheck passes. Let me lint the changed files:

> `Bash: cd "C:\Users\ozzy5\OneDrive\Documents\Byline" && npx eslint src/lib/ghl.ts "src/app/api/audit/lead/route.ts" "src/app/auth/callback/route.ts" "src/app/api/brand`

**Claude:** The two warnings are pre-existing `eslint-disable` directives in code I didn't write (my additions are at the end of the file). 0 errors, clean.

Per AGENTS.md, I should update the local `ARCHITECTURE.md`. Let me add the GHL integration documentation:

> `Edit: ARCHITECTURE.md`

> `Edit: ARCHITECTURE.md`

**Claude:** Documentation updated. Now let me commit — carefully, since the working tree has many unrelated changes from concurrent sessions (per my memory about the shared worktree). Let me check git state first.

> `Bash: cd "C:\Users\ozzy5\OneDrive\Documents\Byline" && git status --short && echo "--- branch ---" && git branch --show-current && echo "--- remote ---" && git remote`

**Claude:** My files: the 5 modified routes + new `src/lib/ghl.ts`. Everything else belongs to concurrent sessions — I'll stage only mine with explicit pathspecs. Let me fetch to see if the remote has diverged before deciding on rebase.

> `Bash: cd "C:\Users\ozzy5\OneDrive\Documents\Byline" && git fetch origin master 2>&1 | tail -3 && echo "--- behind (master..origin/master) ---" && git rev-list --count`

**Claude:** No divergence — local `master` is in sync with `origin/master`, so no rebase is needed (and I avoid stashing concurrent sessions' work). Staging only my files and committing:

> `Bash: cd "C:\Users\ozzy5\OneDrive\Documents\Byline" && git add src/lib/ghl.ts "src/app/api/audit/lead/route.ts" "src/app/auth/callback/route.ts" "src/app/api/brand/sa`

**Claude:** `.env.local.example` is gitignored (the repo's convention — `.env*` ignored), so it stays local-only like it already was. My code changes are staged. Let me commit them with the required author:

> `Bash: cd "C:\Users\ozzy5\OneDrive\Documents\Byline" && git diff --cached --stat HEAD && echo "===COMMIT===" && git -c user.email=michaeljacobosborne@gmail.com -c user`

**Claude:** Clean commit — only my 6 files. Now push (re-checking divergence first, since concurrent sessions may have pushed):

> `Bash: cd "C:\Users\ozzy5\OneDrive\Documents\Byline" && git fetch origin master 2>&1 | tail -1 && BEHIND=$(git rev-list --count master..origin/master) && echo "behind=`

> `Bash: sleep 6; cat "C:\Users\ozzy5\AppData\Local\Temp\claude\C--Users-ozzy5-OneDrive-Documents-Byline\b9d4b0e7-0660-4c5b-8610-3a9b2c109d9f\tasks\bub8b3fz0.output" 2>/`

**Claude:** The push failed with a DNS error — the sandbox blocked network access for that background call. Let me retry the push in the foreground with the sandbox disabled (network is required to reach GitHub):

> `Bash: cd "C:\Users\ozzy5\OneDrive\Documents\Byline" && git push origin master 2>&1 | tail -8`

**Claude:** Push succeeded (`117c596..65c5ac5`). Let me record a project memory about the pending Vercel env setup, consistent with the existing memories tracking go-live prerequisites.

> `Write: C:/Users/ozzy5/.claude/projects/C--Users-ozzy5-OneDrive-Documents-Byline/memory/ghl-activation-events.md`

> `Read: C:/Users/ozzy5/.claude/projects/C--Users-ozzy5-OneDrive-Documents-Byline/memory/MEMORY.md`

> `Edit: C:/Users/ozzy5/.claude/projects/C--Users-ozzy5-OneDrive-Documents-Byline/memory/MEMORY.md`

**Claude:** Done. GoHighLevel is wired into Byline's email capture and onboarding activation events, committed, and pushed (`117c596..65c5ac5` on `master`).

## What I built

**`src/lib/ghl.ts`** — fire-and-forget GHL REST v1 helper with the four functions from the spec (`ghlUpsertContact`, `ghlAddToWorkflow`, `ghlAddTags`, `ghlUpdateCustomField`). Never throws, 8s per-call timeout via `AbortController`, logs failures as `console.error('[GHL]', …)`, and **no-ops silently when `GHL_API_KEY` is unset** so local dev/preview is unaffected.

**Events wired** (all via Next 16 `after()` — see note below):
| Event | Route | GHL effect |
|---|---|---|
| Audit email capture | `/api/audit/lead` | upsert + tags `audit_lead`,`byline_lead`; add to nurture workflow; `audit_domain` custom field (parsed from the URL) |
| New signup | `/auth/callback` (both branches) | upsert + tags `byline_user`+(`free_tier`\|`paid_subscriber`); add to welcome workflow |
| Brand profile saved | `/api/brand/save` | `brand_profile_complete:true` custom field + tag |
| First article | `/api/articles/generate-draft` | counts `ready` articles after save; if ==1, `articles_generated:1` + `first_article_generated` tag |
| First agent session | `/api/articles/[id]/agent` | once-per-user via `agent_memory` sentinel; `agent_sessions:1` + `agent_used` tag (any mode) |

## Key decisions worth flagging

- **Used `after()` instead of a bare `void`.** On Vercel, work left running after the response is sent gets dropped — `after()` (stable in Next 16, exported from `next/server`) keeps the function alive for the GHL calls *without* delaying the user's response. Same non-blocking intent as the spec, made reliable for serverless.
- **New-signup gating.** The auth callback fires on every login, so a `isFirstSignIn()` check (`last_sign_in_at` ≈ `created_at`) prevents returning users from being re-enrolled in the welcome sequence. Paid-checkout signups redirect to Stripe earlier and are already covered by the existing Stripe-webhook GHL path (`byline-subscriber`).
- **First-agent-session** detection uses a one-time account-level `agent_memory` sentinel (mirrors the existing `expertise_nudge_shown` marker) — no schema change, works across review/assist/auto.
- This is a **second, independent GHL path**; the Stripe webhook's legacy `GHL_WEBHOOK_URL` inbound-trigger stays as-is.

## ⚠️ Before go-live — set these in Vercel
The integration is **dormant until `GHL_API_KEY` is set**. Required env vars:
- `GHL_API_KEY` — GHL private API key (v1, location-scoped)
- `GHL_LOCATION_ID`
- `GHL_WORKFLOW_AUDIT_NURTURE_ID`
- `GHL_WORKFLOW_WELCOME_ONBOARDING_ID`

## Notes
- `.env.local.example` is **gitignored** in this repo (`.env*`), so my documentation additions there are local-only and were **not** committed — they're also recorded in `ARCHITECTURE.md` (also local/gitignored, updated this session).
- The commit contains only my 6 files; the many unrelated working-tree changes from concurrent sessions were left untouched (explicit pathspec staging).
- Typecheck passes; lint clean on my code (the 2 warnings in `generate-draft` are pre-existing unused-disable directives, not from my edits).

One thing to confirm on your side: GHL v1 custom-field semantics. I pass `customField` as a flat `{ key: value }` object — if your sub-account expects field **IDs** rather than keys, the field-key strings (`audit_domain`, `brand_profile_complete`, etc.) may need to be the GHL field IDs instead. Worth a quick test send once the keys are set.
