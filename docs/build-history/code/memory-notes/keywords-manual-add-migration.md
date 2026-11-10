---
name: keywords-manual-add-migration
description: Manual keyword-add endpoint depends on a Supabase migration adding source/brand_id columns
metadata: 
  node_type: memory
  type: project
  originSessionId: c96d9e73-8db9-4f2a-8de6-1b8eab5c08f4
---

The manual keyword-add feature (`POST /api/keywords/[id]`, added 2026-06-08) inserts `source: 'manual'` and `brand_id` into `public.keywords`. Those columns are created by migration `supabase/migrations/20260608_add_keyword_source_brand.sql`.

**Why:** the base `keywords` table (in `supabase/schema.sql`) has no `source`/`brand_id` columns; only migrations add extra keyword columns.

**How to apply:** run `npm run migrate` (`npx supabase db push`) against the live DB after deploy, or the manual-add POST will 500. Vercel deploys do NOT auto-run Supabase migrations.
