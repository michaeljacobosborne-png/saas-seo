-- Access alerts (score over time, the monitor). Run once by hand in the Supabase
-- SQL editor. Safe to run twice. Changes no existing data.

-- The last confirmed crawler access state for each tracked page, a change seen
-- once and waiting for a second check to confirm it, and when it was last checked.
alter table public.tracked_pages add column if not exists access_state jsonb;
alter table public.tracked_pages add column if not exists access_pending jsonb;
alter table public.tracked_pages add column if not exists access_checked_at timestamptz;

-- One row per confirmed change, so the page can show its access history and an
-- email is never sent twice for the same change.
create table if not exists public.access_alerts (
  id               uuid primary key default gen_random_uuid(),
  tracked_page_id  uuid not null references public.tracked_pages(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  detected_at      timestamptz not null default now(),
  kind             text not null,
  change_key       text not null,
  good             boolean not null default false,
  headline         text not null,
  detail           text not null,
  reproduce        text,
  emailed_at       timestamptz
);

create index if not exists access_alerts_page_idx on public.access_alerts (tracked_page_id, detected_at desc);

alter table public.access_alerts enable row level security;

drop policy if exists "read own access alerts" on public.access_alerts;
create policy "read own access alerts" on public.access_alerts
  for select using (auth.uid() = user_id);

notify pgrst, 'reload schema';
