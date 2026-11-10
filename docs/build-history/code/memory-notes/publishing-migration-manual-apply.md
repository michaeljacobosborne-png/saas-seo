---
name: publishing-migration-manual-apply
description: WordPress publishing needs migration 20260615 applied manually in Supabase before it works
metadata: 
  node_type: memory
  type: project
  originSessionId: 51759a70-05ac-43df-bad7-12b43cef5940
---

The WordPress publishing integration (shipped commit 765a610, 2026-06-15) depends on
`supabase/migrations/20260615_add_publishing.sql`, which creates the
`publishing_connections` table and adds `published_url`/`published_at`/`wp_post_id`/`publish_channel`
columns to `articles`.

**Why:** Supabase migrations in this repo are NOT auto-applied on deploy — the file header says
to run it manually in the Supabase dashboard SQL editor. Same pattern as [[keywords-manual-add-migration]].

**How to apply:** Paste the migration SQL into the Supabase SQL editor (or `npm run migrate` if
`SUPABASE_DB_URL` is set). Until then, every `/api/publish/*` and `/api/articles/[id]/publish`
call will 500 on the missing table/columns. Also requires `ENCRYPTION_KEY` (32-byte hex) in env.
