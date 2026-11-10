-- Score over time (DECISIONS 39).
-- tracked_pages: pages a user asked us to re-check on a schedule.
-- audit_snapshots: every recorded run, with everything it fetched, so any two
-- runs can be re-scored side by side on the current engine.
-- Run by hand in the Supabase SQL editor (DECISIONS 20). Safe to re-run.

create table if not exists public.tracked_pages (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  url            text not null,
  tool           text not null default 'geo' check (tool in ('geo', 'ao')),
  active         boolean not null default true,
  interval_days  smallint not null default 30 check (interval_days between 7 and 90),
  created_at     timestamptz not null default now(),
  last_run_at    timestamptz,
  next_run_at    timestamptz not null default now(),
  last_error     text,
  unique (user_id, url, tool)
);

create index if not exists tracked_pages_due_idx on public.tracked_pages (next_run_at) where active;

create table if not exists public.audit_snapshots (
  id                 uuid primary key default gen_random_uuid(),
  tracked_page_id    uuid references public.tracked_pages(id) on delete cascade,
  user_id            uuid references auth.users(id) on delete cascade,
  url                text not null,
  final_url          text,
  tool               text not null check (tool in ('geo', 'ao')),
  recorded_at        timestamptz not null,
  engine_version     text not null,
  content_hash       text,
  retrievable_score  smallint,
  score_withheld     boolean not null default false,
  citable_band       text,
  report             jsonb not null,
  -- Brotli-compressed, base64 AuditSnapshot (src/lib/geo-audit/snapshot.ts).
  snapshot           text not null,
  created_at         timestamptz not null default now()
);

create index if not exists audit_snapshots_page_idx on public.audit_snapshots (tracked_page_id, recorded_at desc);
create index if not exists audit_snapshots_user_idx on public.audit_snapshots (user_id, recorded_at desc);

-- Users read and manage their own tracked pages and read their own snapshots.
-- Snapshots are written only by the server (service role).
alter table public.tracked_pages enable row level security;
alter table public.audit_snapshots enable row level security;

drop policy if exists "own tracked pages" on public.tracked_pages;
create policy "own tracked pages" on public.tracked_pages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "read own snapshots" on public.audit_snapshots;
create policy "read own snapshots" on public.audit_snapshots
  for select using (auth.uid() = user_id);

notify pgrst, 'reload schema';
