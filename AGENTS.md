<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Architecture reference (required reading)

Before starting any feature work, check whether `ARCHITECTURE.md` exists in the repo root. If it does, read it — it contains the DB schema, all API routes, plan limits, known gotchas, and deployment conventions. This file is gitignored and local-only.

After completing a session that adds API routes, modifies the DB schema, or builds a new feature: update the relevant section(s) of `ARCHITECTURE.md` before committing. Keep it current — stale docs cause bugs.

## Git safety rules (required for every session)

1. **Always pull before committing.** Run `git pull --rebase origin main` before staging any files. If there are conflicts, resolve them before proceeding — do not force-push.
2. **Never force-push main.** Push with `git push origin main` only. If it's rejected, pull and rebase, then retry.
3. **One session commits at a time.** If another session has an `index.lock`, wait for it to finish or ask the user to stop the conflicting session before proceeding.
4. **Verify your diff before committing.** Run `git diff --stat HEAD` after staging to confirm you're only committing what you intend — no accidental regressions.
5. **Commit author must be `michaeljacobosborne@gmail.com`.** Vercel rejects deploys from other authors. Always use: `git -c user.email=michaeljacobosborne@gmail.com -c user.name="Michael Osborne" commit ...`
