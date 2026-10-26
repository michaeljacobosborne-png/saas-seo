-- A queue item can wait on someone else (a connection request, a reply, a
-- blog post going live). Blocked items never take a slot on today's list; the
-- page shows them in a "Waiting on others" section with the reason.
-- Run by hand in the Supabase SQL editor (DECISIONS 20).

alter table public.outreach_queue drop constraint if exists outreach_queue_status_check;
alter table public.outreach_queue add constraint outreach_queue_status_check
  check (status in ('pending', 'done', 'withdrawn', 'superseded', 'blocked'));

alter table public.outreach_queue add column if not exists blocked_reason text;
alter table public.outreach_queue add column if not exists blocked_at timestamptz;
