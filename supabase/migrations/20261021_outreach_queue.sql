-- Michael's daily action queue: social posts, outbound messages, comments and
-- replies he sends himself. Replaces byline-queue.md as the source of truth.
-- Read and written only by the owner-gated /admin/today page through the
-- service role, so RLS is on with no policies (no client access at all).
-- Applied by hand in the Supabase SQL editor on 2026-10-21 (DECISIONS 20).
-- This is the version that was run; checked against the live columns.

create table if not exists public.outreach_queue (
  id            text primary key,                       -- stable, never reused (OB-01, F-X3, ...)
  type          text not null check (type in ('social post', 'outbound message', 'comment', 'reply')),
  account       text not null,
  platform      text not null,
  target        text,
  parts         jsonb not null default '[]'::jsonb,      -- [{label, text, part, alt, statedChars}]
  warning       text,
  note          text,
  rests_on      text,
  engine        text,                                   -- engine version the evidence rests on, or 'n/a'
  status        text not null default 'pending'
                check (status in ('pending', 'done', 'withdrawn', 'superseded')),
  due_date      date,
  closes_on     date,                                   -- a window that expires; these go first
  priority      smallint not null default 3 check (priority between 1 and 5),
  after_ids     text[] not null default '{}',           -- must not show until all of these are done
  needs_rerun   boolean not null default false,         -- warning asks for a re-run before posting
  sort_order    integer,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create index if not exists outreach_queue_status_idx on public.outreach_queue (status);
create index if not exists outreach_queue_completed_idx on public.outreach_queue (completed_at);

alter table public.outreach_queue enable row level security;
