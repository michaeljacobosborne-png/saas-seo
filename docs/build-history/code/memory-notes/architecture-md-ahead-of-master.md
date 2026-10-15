---
name: architecture-md-ahead-of-master
description: ARCHITECTURE.md documents an article-versioning/History system that master does NOT have
metadata: 
  node_type: memory
  type: project
  originSessionId: 56a9eaec-9695-4c81-8016-28b9bbe10829
---

The local `ARCHITECTURE.md` (gitignored) describes features from the unmerged `vercel/install-vercel-web-analytics-w-254ap5` branch as if they exist in master — notably an article-versioning/snapshot system (`saveSnapshot`, `article_versions` table, `trigger: 'manual'|'agent_auto'|'agent_assist'`, a History panel, "Before Auto mode" snapshots). **None of that exists in master** — there is no `saveSnapshot`, no `article_versions` migration, no History UI.

**Why:** the branch diverged ~102 commits; the doc tracks the branch's richer state, not master's actual code.

**How to apply:** don't wire new features into a versioning/snapshot API on master — it isn't there. When I ported Auto agent mode (2026-06-10), I adapted it to use TipTap `setContent` via `replaceContentRef` + autosave + native editor undo (⌘/Ctrl+Z) as the revert path, instead of the branch's snapshot/History revert. Verify any doc claim against `src/` before relying on it. Related: [[shared-worktree-clobber]].
