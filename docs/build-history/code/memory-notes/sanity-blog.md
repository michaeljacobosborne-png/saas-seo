---
name: sanity-blog
description: Byline blog is built on Sanity CMS; manual Sanity project + env vars still pending
metadata: 
  node_type: memory
  type: project
  originSessionId: fe712658-2e5f-4b21-ab86-eab9f361df18
---

The Byline app has a Sanity-powered blog (built 2026-06-08): public pages at `/blog` and `/blog/[slug]`, embedded Sanity Studio at `/studio` (gated behind Supabase admin auth). Schemas: post/author/category in `src/sanity/schemas`. ISR `revalidate: 3600`.

**Pending manual setup (Michael):** create a Sanity project at sanity.io/manage (or `npx sanity init`), then set `NEXT_PUBLIC_SANITY_PROJECT_ID` (+ optional `SANITY_API_READ_TOKEN`) in `.env.local` and on Vercel. Until `NEXT_PUBLIC_SANITY_PROJECT_ID` is set, the blog data layer no-ops (renders empty) by design via `isSanityConfigured` in `src/sanity/env.ts`, so builds stay green.

**Why:** the blog ships before the Sanity cloud project exists; the code is resilient to the missing project ID so deploys don't break.
