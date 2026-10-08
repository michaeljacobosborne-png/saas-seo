# Fix brand profile data loss on chat re-run

- Session `a4d6e1c0-885c-490d-b6ac-68fc5cfc3ab4`
- 2026-06-16 06:37 to 2026-06-16 07:05
- Branch: `master`  |  Claude Code 2.1.170

**Files touched (5):** `ARCHITECTURE.md`, `src/app/api/brand/onboard/route.ts`, `src/app/api/brand/save/route.ts`, `src/app/(dashboard)/brand/page.tsx`, `supabase/schema.sql`

---


## Michael

Beta tester Anthony L reported a data-loss bug: when he returned to the brand profile page and ran the AI chat a second time to add more details, it wiped his entire existing profile and created a new one from scratch. He lost all his previous work.

The bug: the brand onboarding AI chat always treats the conversation as a fresh setup. It should detect whether the user already has a brand profile and switch into UPDATE mode instead of REPLACE mode.

**Step 1 — Read ARCHITECTURE.md**
```
type ARCHITECTURE.md 2>nul
```

**Step 2 — Find the brand profile page and API**
Locate:
- The brand profile page (likely `src/app/(dashboard)/brand/page.tsx` or similar)
- The API route that handles brand profile saves (look for `/api/brand` routes)
- The AI chat route that handles the brand profile conversation
- The Supabase table/column that stores brand profile data

```
dir src\app\(dashboard)\brand\ /s /b 2>nul
dir src\app\api\brand\ /s /b 2>nul
```

**Step 3 — Understand the current flow**
Read the brand page, API route, and any relevant chat/agent logic to understand:
- When does the profile get saved/overwritten?
- Does the chat API receive the existing profile as context?
- Is the save operation an INSERT or UPSERT?

**Step 4 — Implement the fix**

The fix has two parts:

**Part A — Detect existing profile in the UI**
In the brand page component, if the user already has a brand profile (non-empty data), show a banner/notice before they start the chat:
- "You already have a brand profile. This chat will update your existing profile, not replace it."
- Or even simpler: a confirmation dialog before starting a new chat session if profile data already exists

**Part B — Make the save operation non-destructive**
The brand profile chat save should:
1. Load the existing profile data first
2. Merge/update the new values on top of the existing ones (UPSERT with merge, not REPLACE)
3. Never delete fields that weren't explicitly changed in this session

The cleanest implementation:
- In the brand profile save API, do a `SELECT` first to get the existing profile
- Then do a targeted `UPDATE` of only the fields that were modified in this session
- If no existing profile, do a fresh `INSERT`

OR, if the chat is a full conversation that produces a complete profile object:
- Keep the same UPSERT but show the user a diff/preview before saving
- Add: "Here's what will change in your profile — confirm?" before the save

**Part C — Add a "last updated" timestamp**
Add a `profile_updated_at` display on the brand page so users know when they last saved.

**Step 5 — Commit on master directly** (this is a small targeted fix)
```
git pull --rebase origin master
git add <changed files>
git diff --stat HEAD
git -c user.email=michaeljacobosborne@gmail.com -c user.name="Michael Osborne" commit -m "Fix brand profile: prevent overwrite on re-run, update mode for existing profiles"
git -c user.email=michaeljacobosborne@gmail.com -c user.name="Michael Osborne" push origin master
curl -X POST "https://api.vercel.com/v1/integrations/deploy/prj_DkQtXvVAVjzwC5qH2RqPfOG7vktr/HCPNWt1KoS"
```

IMPORTANT:
- Commit author MUST be michaeljacobosborne@gmail.com
- Read ARCHITECTURE.md first to understand the DB schema and existing brand profile structure
- The fix must be non-destructive — never delete existing brand profile data
- Don't touch files unrelated to the brand profile flow

**Claude:** I'll start by reading ARCHITECTURE.md and locating the brand profile files.

> `Read: ARCHITECTURE.md`

**Claude:** Now let me look at the brand onboard route, brand save route, and the brand page.

> `Read: src/app/api/brand/onboard/route.ts`

**Claude:** Now the brand save route and the brand page:

> `Read: src/app/api/brand/save/route.ts`

**Claude:** Now let me find the brand page UI:

> `Glob: src/app/(dashboard)/brand/**`

> `Read: src/app/(dashboard)/brand/page.tsx`

**Claude:** Let me check the BrandProfile type and migrations to understand available columns and how migrations are applied.

> `Bash: cd "C:/Users/ozzy5/OneDrive/Documents/Byline" && grep -n "BrandProfile" -A 40 src/lib/supabase/types.ts | head -60`

**Claude:** `updated_at` is already in the type. Let me confirm the column exists and whether it auto-updates via trigger:

> `Bash: cd "C:/Users/ozzy5/OneDrive/Documents/Byline" && ls supabase/migrations/ 2>/dev/null | head -50; echo "---SEARCH brand_profiles in migrations---"; grep -rln "br`

> `Bash: cd "C:/Users/ozzy5/OneDrive/Documents/Byline" && grep -n "updated_at\|create table brand_profiles\|CREATE TABLE brand_profiles\|trigger\|TRIGGER" supabase/schem`

> `Read: supabase/schema.sql`

**Claude:** I now have a complete picture. Let me confirm the root cause and the secondary vector before editing.

**Root cause:** `/api/brand/save` builds a payload with *every* column, defaulting anything not in the request to `null`/`[]`, then upserts on `user_id`. So when the agent re-run produces a partial `<brand_profile>` JSON (or the edit modal, which doesn't even expose the expertise fields), the upsert nulls out everything not present — wiping the profile. There's a secondary vector in `onboard`'s background `extractAndSaveBrandFacts`, which replaces the `competitors`/`primary_keywords` arrays with whatever Haiku re-derived.

`updated_at` already exists on `brand_profiles` with an auto-update trigger, so Part C needs no migration — just display.

Let me mark a chapter and implement.

> `mcp__ccd_session__mark_chapter`

**Claude:** Now Part B — the non-destructive save route:

> `Write: src/app/api/brand/save/route.ts`

**Claude:** Now the `onboard` route. First, make the background auto-extract non-destructive (it currently replaces the competitors/keywords arrays):

> `Edit: src/app/api/brand/onboard/route.ts`

**Claude:** Now add update-mode awareness to the `onboard` POST handler so the agent updates rather than restarts. Let me add an update prompt and wire it in:

> `Edit: src/app/api/brand/onboard/route.ts`

**Claude:** Now wire the update prompt into the system-prompt selection:

> `Edit: src/app/api/brand/onboard/route.ts`

**Claude:** Now the client page — Part A (update-mode banner), pass `isUpdate` to the API, and Part C (last-updated display). First, pass `isUpdate` through the fetch:

> `Edit: src/app/(dashboard)/brand/page.tsx`

> `Edit: src/app/(dashboard)/brand/page.tsx`

**Claude:** Now add the update-mode banner in the chat UI:

> `Edit: src/app/(dashboard)/brand/page.tsx`

**Claude:** Now Part C — show "last updated" on the profile view. Let me add a helper and display it in the header:

> `Edit: src/app/(dashboard)/brand/page.tsx`

**Claude:** Let me verify the edited regions of the onboard route are coherent:

> `Read: src/app/api/brand/onboard/route.ts`

**Claude:** Changes are coherent. Let me typecheck to catch any errors before committing:

> `Bash: cd "C:/Users/ozzy5/OneDrive/Documents/Byline" && npx tsc --noEmit 2>&1 | head -40`

**Claude:** Typecheck passes. Now let me commit and deploy per the task instructions. First, let me check git state before touching anything (the tree is shared and has unrelated dirty files):

> `Bash: cd "C:/Users/ozzy5/OneDrive/Documents/Byline" && git fetch origin master 2>&1 | tail -3; echo "--- behind/ahead ---"; git rev-list --left-right --count origin/m`

**Claude:** In sync with origin — no rebase needed. Let me stage only my three files explicitly (the tree has unrelated dirty files I must not touch):

> `Bash: cd "C:/Users/ozzy5/OneDrive/Documents/Byline" && git add "src/app/api/brand/save/route.ts" "src/app/api/brand/onboard/route.ts" "src/app/(dashboard)/brand/page.`

**Claude:** Exactly the three intended files. Let me confirm nothing else is staged, then commit:

> `Bash: cd "C:/Users/ozzy5/OneDrive/Documents/Byline" && echo "=== staged files ===" && git diff --cached --name-only && echo "=== commit ===" && git -c user.email=mich`

> `Bash: cd "C:/Users/ozzy5/OneDrive/Documents/Byline" && git push origin master 2>&1 | tail -8`

**Claude:** Pushed. Now trigger the Vercel deploy hook:

> `Bash: cd "C:/Users/ozzy5/OneDrive/Documents/Byline" && curl -s -X POST "https://api.vercel.com/v1/integrations/deploy/prj_DkQtXvVAVjzwC5qH2RqPfOG7vktr/HCPNWt1KoS" | h`

**Claude:** Deploy is queued (PENDING). Per AGENTS.md I should update the local `ARCHITECTURE.md` to reflect the changed route behavior:

> `Edit: ARCHITECTURE.md`

**Claude:** Done. Here's what was wrong and what I fixed.

## Root cause
`/api/brand/save` was a **REPLACE, not an UPDATE**. It built a payload containing *every* column, defaulting anything absent from the request to `null`/`[]`, then upserted on `user_id`. So when Anthony re-ran the chat, the agent produced a partial `<brand_profile>` and the upsert nulled out every field that wasn't in it — wiping the profile. (The edit modal had the same latent bug: it never sends the expertise fields, so manual edits silently erased `expertise_notes`/`signature_angles`/`avoid_phrases`.)

There was also a secondary data-loss vector: the `onboard` route's background auto-extract was **replacing** the `competitors`/`primary_keywords` arrays with whatever Haiku re-derived from that turn — so "add one competitor" could drop the rest.

## The fix (commit `f3c1fa6`, pushed to master, deploy triggered → PENDING)

**Part B — non-destructive save** (`api/brand/save/route.ts`)
- SELECTs the existing row first, then **merges**: a field is written only when the request carries a meaningful value (non-empty string / non-empty array / explicit boolean); otherwise the stored value is preserved. Insert path for brand-new users is unchanged.
- Same treatment applied to the `onboard` background auto-extract: strings only set when present, arrays **unioned** with the existing row.

**Part A — update mode**
- `onboard` now accepts `isUpdate`; when set it loads the current profile server-side and swaps in an update-oriented prompt that changes only what the user asks and carries everything else forward, instead of re-running the full 8-question setup.
- The brand page passes `isUpdate` and shows a banner in the chat: *"This chat updates your existing profile — it won't replace it. Anything you don't mention stays exactly as it is."*

**Part C — last updated**
- `brand_profiles.updated_at` already exists with an auto-update trigger (no migration needed), so I just surfaced a "Last updated …" line on the profile view.

Verified with `tsc --noEmit` (clean). Only the three intended files were committed; the unrelated dirty files in the shared tree were left untouched. I also updated the local `ARCHITECTURE.md` brand-routes section (gitignored, so not committed).

One deliberate trade-off worth flagging: because empty values now preserve rather than clear, a user can't blank a field to empty through the edit modal — they'd replace it with new text. Given the severity of the data-loss bug, erring toward preservation is the right default, but if you want explicit "clear this field" support in the manual editor I can add a sentinel for that.
