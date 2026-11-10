-- Outreach lifecycle on the action page.
-- blocked: waiting on someone else (a connection request, a blog going live).
-- sent / awaiting_reply / replied / no_reply: the life of an outbound message
-- or comment after it goes out, so a sent message cannot silently disappear.
-- Run by hand in the Supabase SQL editor (DECISIONS 20). Safe to re-run.
-- Written 2026-10-26, widened 2026-10-27 to cover the lifecycle in one run.

alter table public.outreach_queue drop constraint if exists outreach_queue_status_check;
alter table public.outreach_queue add constraint outreach_queue_status_check
  check (status in ('pending', 'done', 'withdrawn', 'superseded', 'blocked',
                    'sent', 'awaiting_reply', 'replied', 'no_reply'));

alter table public.outreach_queue add column if not exists blocked_reason text;
alter table public.outreach_queue add column if not exists blocked_at timestamptz;
alter table public.outreach_queue add column if not exists sent_at timestamptz;
alter table public.outreach_queue add column if not exists follow_up_on date;
alter table public.outreach_queue add column if not exists replied_at timestamptz;
alter table public.outreach_queue add column if not exists reply_note text;

notify pgrst, 'reload schema';
