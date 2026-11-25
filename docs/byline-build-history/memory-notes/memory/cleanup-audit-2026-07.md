---
name: cleanup-audit-2026-07
description: "Full-repo cleanup audit (2026-07-02) lives in CLEANUP_AUDIT.md at repo root; P0s include leaked GHL/Firebase tokens in .bat files, auth-callback open redirect, team-plan article limit bug, polish-pass never runs"
metadata: 
  node_type: memory
  type: project
  originSessionId: 474e0a6a-8fd2-418b-a920-c1d21573f832
---

On 2026-07-02 a full 4-agent codebase audit was compiled into `CLEANUP_AUDIT.md` (repo root, untracked). Key unresolved P0s at time of writing:

- GHL PIT token + Firebase refresh token hardcoded in `run-byline-workflows.bat` / `debug-ghl.bat` — need rotation.
- Lead CSVs with PII in repo root, not gitignored.
- Open redirect: `src/app/auth/callback/route.ts:142` uses raw `next` instead of `safeNext`.
- `checkArticleLimit` in `src/lib/usage.ts` doesn't alias `team`→`agency` → limit 0 for legacy team subs.
- `generate-draft` polish pass gated on `stripe_price_id` which is never written → Growth/Agency never get it.
- Plan copy contradictions (homepage "unlimited articles" vs pricing "30/month").

Check `CLEANUP_AUDIT.md` for status before re-auditing; items may have been fixed since.
