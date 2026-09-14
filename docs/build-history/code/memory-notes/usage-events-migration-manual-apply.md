---
name: usage-events-migration-manual-apply
description: /admin cost tracking needs migration 20260618_usage_events.sql run in Supabase before usage_events writes/reads work
metadata: 
  node_type: memory
  type: project
  originSessionId: e1104202-b409-4d67-8438-5f7f4d080e54
---

The `/admin` dashboard's cost-tracking section depends on the `usage_events` table from `supabase/migrations/20260618_usage_events.sql`. The direct DB host (`db.<ref>.supabase.co`) is IPv6-only and unreachable from the dev sandbox (`getaddrinfo ENOTFOUND`), so the migration must be pasted into the **Supabase SQL editor** — same as [[publishing-migration-manual-apply]] and other manual migrations.

Until applied: `/admin` renders fine and the cost section shows an "apply migration" note (the data layer returns `tableMissing`). The four instrumented routes (generate-brief, generate-draft, [id]/agent, keywords/research) call `logUsageEvent()` which fails softly (logs, never throws) when the table is absent.

`usage_events.user_id` references **auth.users(id)**, not `profiles(id)` (the original spec was wrong — routes log the auth uid).
