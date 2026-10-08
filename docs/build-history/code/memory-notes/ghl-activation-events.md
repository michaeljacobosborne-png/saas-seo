---
name: ghl-activation-events
description: GHL REST v1 helper + activation events wired; env vars must be set in Vercel before go-live
metadata: 
  node_type: memory
  type: project
  originSessionId: b9d4b0e7-0660-4c5b-8610-3a9b2c109d9f
---

`src/lib/ghl.ts` (committed 2026-06-18) is a fire-and-forget GoHighLevel REST v1 helper (contact upsert / add-to-workflow / add-tags / update-custom-field). It **no-ops silently when `GHL_API_KEY` is unset**, so the integration is dormant until env vars are set.

Activation events wired (all via Next `after()`, never block the response): audit lead capture (`/api/audit/lead`), new-user signup (`/auth/callback`), brand profile save (`/api/brand/save`), first article (`/api/articles/generate-draft`), first agent session (`/api/articles/[id]/agent`).

**Before go-live, set in Vercel:** `GHL_API_KEY`, `GHL_LOCATION_ID`, `GHL_WORKFLOW_AUDIT_NURTURE_ID`, `GHL_WORKFLOW_WELCOME_ONBOARDING_ID`. (Separate from the legacy `GHL_WEBHOOK_URL` used by the Stripe webhook.)

This is a SECOND GHL path — the Stripe webhook still uses the inbound-webhook trigger (`GHL_WEBHOOK_URL`) for subscribe/cancel; they coexist. `.env.local.example` documents all of these but is gitignored (`.env*`), so docs live local-only and in `ARCHITECTURE.md`. See [[architecture-md-ahead-of-master]] for the doc-vs-master caveat.
