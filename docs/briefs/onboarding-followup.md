# Brief: onboarding testing and hardening (worktree C:\dev\byline-onboarding)

Branch `onboarding-followup`, cut from master `17b862e`. Read `docs/DECISIONS.md`, `C:\dev\Byline\ARCHITECTURE.md` and
`C:\Users\ozzy5\Documents\byline-status.md` (task 5) first.

## What is already live (do not rebuild)

The URL-first onboarding was built and deployed on 2026-09-30 in master `6deae09`:
- `src/app/(dashboard)/brand/_components/BrandOnboarding.tsx` is the UI. It asks for one URL, shows the crawler access
  card first, then a review form with 3 required fields (brand name, website, who you write for).
- `src/app/api/brand/derive/route.ts` streams NDJSON: access, then the profile read from markup, then the profile with
  Haiku suggestions.
- `src/lib/brand-derive.ts` holds the logic; `src/lib/brand-derive.test.ts` has the tests.
- The mergeStr residual is FIXED in `src/lib/brand-merge.ts`: a form save clears on empty, an agent save keeps on
  empty, and an absent key always keeps.

It has never been exercised in a real browser. That is the work.

## Work, in order

1. Browser end to end with a fresh test account.
   - Use a dev server on localhost with a test account created for this purpose. Record its credentials in a
     gitignored local file, not in chat.
   - Walk the flow: new user → /brand → URL → access card → review → save → /dashboard.
   - Then reload /brand. The profile view must show exactly what was saved.
2. Edit modal regression check. Clear a field (e.g. industry) in "Edit manually", save, reload. It must stay cleared.
   Then run "Update with Agent" and confirm unmentioned fields survive, which is the June data-loss fix.
3. Hostile sites. Try at least one of each and make each case end in a usable form with a clear message:
   - a Cloudflare-protected site that 403s our fetcher
   - a JS-only shell (e.g. a bare React SPA)
   - a site that times out
   - a non-HTML URL
   - a typo domain
   The access card must say unknown, never refused, when an ordinary browser request also fails.
4. Timeouts. `maxDuration` is 45s. Measure a slow site. If the model call can push past it, lower `max_tokens`
   or add an AbortSignal so the profile event still arrives.
5. Mobile layout at 375px. Check the access card rows, the evidence truncation and the collapsed optional section.
6. The "No website yet?" link must still reach the chat onboarding, and chat save must still work (agent-format
   payload).
7. Mid-scan edits. Type in a field while the scan is streaming. The later profile event must not overwrite it (a ref
   guards this; verify it).

## Invariants (absolute)

- Nothing claims AI visibility or citation. The access card reports what the origin served, with evidence, never a
  score.
- Suggestions are labelled as suggestions. A quote is shown only when it was verifiably on the page.
- Unknown is never presented as blocked.

## Git

- Commit here with the author `michaeljacobosborne@gmail.com` (see AGENTS.md).
- Pushing needs Michael's approval; the settings file makes it prompt.
- Do not touch `C:\dev\Byline` (Michael's uncommitted work lives there) or the other worktrees.
- Keep the status file's task 5 section current.
