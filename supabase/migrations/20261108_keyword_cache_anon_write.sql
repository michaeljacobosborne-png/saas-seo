-- keyword_cache: remove the policy that lets anyone with the anon key write.
-- Run once in the Supabase SQL editor (DECISIONS 20). Safe to run twice.
--
-- THE BUG
-- 009_global_keyword_cache.sql line 17 creates:
--     CREATE POLICY "Service role can write keyword cache"
--       ON public.keyword_cache FOR ALL USING (true);
-- There is no TO clause, so the policy applies to every role, including `anon`.
-- FOR ALL covers SELECT, INSERT, UPDATE and DELETE. The name describes an
-- intention the SQL does not implement.
--
-- Confirmed by live probe 2026-11-06: an anonymous request read all 1,104 rows.
-- Anonymous insert, update and delete were also permitted.
--
-- WHY IT MATTERS
-- The table holds paid DataForSEO results and feeds users' keyword research.
-- It can be wiped, which costs money to rebuild, or poisoned with false search
-- volumes that customers then act on. The second is worse: nothing looks broken.
--
-- WHY DROPPING IT IS SAFE
-- The service role bypasses row level security entirely, so it never needed a
-- policy. Verified in app code on 2026-11-08: every read and write of this
-- table in src/app/api/keywords/research/route.ts goes through
-- `createServiceClient()` (the cache lookup at line 133 and the upsert at line
-- 178). Nothing reaches this table with the anon or authenticated client.
--
-- AFTER THIS RUNS
--   service role      unchanged, still reads and writes (bypasses RLS)
--   authenticated     still reads, via the policy kept below
--   anon              no policy applies, so no access at all

drop policy if exists "Service role can write keyword cache" on public.keyword_cache;

-- The authenticated SELECT policy from 009 is left alone (not dropped, not recreated),
-- so there is no moment when signed-in users lose read access.

-- UNDO, if dropping it turns out to break something.
-- This restores the hole, so only use it to buy time while a real fix is made.
--   create policy "Service role can write keyword cache"
--     on public.keyword_cache for all using (true);
