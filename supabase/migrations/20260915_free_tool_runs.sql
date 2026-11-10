-- Rate limiting for the free GEO/AO analyzers.
--
-- The route is unauthenticated, so the only thing between it and a scripted loop
-- is this table. Serverless instances share no memory, so the counter has to
-- live in Postgres.
--
-- Identity is ip|hash(user-agent) — a speed bump against scripting, not an
-- authentication system. Nothing here is personal data beyond a coarse IP, and
-- rows are disposable; prune anything older than a few days on a schedule.

create table if not exists public.free_tool_runs (
  identity    text        not null,
  day         date        not null,
  tool        text        not null default 'geo',
  run_count   integer     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (identity, day, tool)
);

create index if not exists free_tool_runs_day_idx on public.free_tool_runs (day);

-- Service role only. This is never read from the browser.
alter table public.free_tool_runs enable row level security;

-- Atomic increment. Returns the new count so the caller can decide in one round
-- trip whether this run is over the limit — doing it as select-then-update would
-- race under concurrent requests from the same identity.
create or replace function public.increment_free_tool_run(
  p_identity text,
  p_day date,
  p_tool text default 'geo'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  insert into public.free_tool_runs (identity, day, tool, run_count)
  values (p_identity, p_day, p_tool, 1)
  on conflict (identity, day, tool)
  do update set run_count = free_tool_runs.run_count + 1,
                updated_at = now()
  returning run_count into new_count;

  return new_count;
end;
$$;

revoke all on function public.increment_free_tool_run(text, date, text) from public;
revoke all on function public.increment_free_tool_run(text, date, text) from anon;
