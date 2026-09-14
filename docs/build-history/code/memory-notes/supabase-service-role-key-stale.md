---
name: supabase-service-role-key-stale
description: SUPABASE_SERVICE_ROLE_KEY in .env.local returns gateway 401 (stale/revoked); anon key works — breaks server-side admin + DB diag scripts
metadata: 
  node_type: memory
  type: project
  originSessionId: 9f67c4ba-530b-4e64-9756-cb09b2d8e865
---

As of Jun 2026 the `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (new `sb_secret_…` format, len 41) returns an empty-body **401 at the gateway** on both `/rest/v1/*` and `/auth/v1/admin/*`. The publishable/anon key (`sb_publishable_…`) works fine against `/auth/v1/settings` and REST, so it's not a TLS/network issue — the secret key value is stale or revoked.

Impact: any server-side feature using the service role key (admin user ops, notification/welcome flows, the untracked `scripts/diagnose-paid-subs.ts` / `fix-paid-users.ts`) will 401 locally. It does NOT cause missing signup emails (those are Supabase-mailer-sent, see [[signup-confirmation-emails]]).

Also note: direct DB host `db.<ref>.supabase.co` is **IPv6-only** (AAAA, no A record) — `pg` connections fail with ENOTFOUND from IPv4-only networks. Use the IPv4 pooler connection string for direct SQL.

**Why:** a revoked service key silently breaks privileged server paths and blocks DB/admin diagnostics.
**How to apply:** re-copy the current secret key from the Supabase dashboard into `.env.local` (and Vercel) before relying on service-role calls.