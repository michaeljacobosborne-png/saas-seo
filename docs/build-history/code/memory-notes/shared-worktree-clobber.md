---
name: shared-worktree-clobber
description: "Concurrent Claude sessions share one working tree; another session's git ops can silently revert your uncommitted edits to tracked files"
metadata: 
  node_type: memory
  type: project
  originSessionId: 92d7376b-bd5b-494a-bdd3-e21b75deadd1
---

When multiple Claude sessions run in this repo at once (e.g. a content-audit session plus a feature session), they share a SINGLE git working tree. The other session's `git add -A` + commit / checkout / reset can silently revert your *uncommitted* edits to tracked files mid-task. Untracked NEW files survive; modified tracked files get reverted to HEAD.

**Why:** observed 2026-06-08 — three feature-file edits were wiped while a content-audit session made several commits; only the new untracked files (AnglePicker.tsx, angles/route.ts, outline-chat/route.ts) survived.

**How to apply:**
- Commit your own work as soon as it builds — don't leave large uncommitted edits sitting while another session is active.
- Commit ONLY your files with an explicit pathspec: `git commit -m "..." -- path1 path2` (note `-m` BEFORE `--`). The repo's index often has unrelated pre-staged junk (zips, *-dump.txt, supabase/.temp) that you must NOT sweep in.
- Two more failure modes seen 2026-06-15 on `beta-fixes`: (1) when a SINGLE file holds both your edits and another session's edits, `git add <file>` stages BOTH — split out only your hunks (e.g. `git show HEAD:path > tmp`, re-apply just your edits, `git hash-object -w tmp` + `git update-index --cacheinfo`) so the working tree is never touched. (2) Your *staged* blob can get swept into ANOTHER session's `git commit` and pushed under their message. Before re-committing, run `git show <their-commit> -- yourfile` / `git cat-file -p origin/<branch>:yourfile` — your fix may already be on the remote, so a fresh commit would just be a duplicate.
- `beta-fixes` exists as both a local and `origin` branch; sessions push to it concurrently, so `git pull --rebase origin beta-fixes` resets your staged index. Verify your change landed on origin before assuming you still need to push.
- The real branch is `master` tracking `origin/master` (there is no `main`, despite AGENTS.md saying `origin main`). Pull/push use master.
- Check `git rev-list --left-right --count origin/master...HEAD` after `git fetch` to see if a rebase is actually needed before pushing.
