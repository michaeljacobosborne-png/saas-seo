-- Add keyword research fields to keywords table
alter table public.keywords
  add column if not exists cpc numeric(10,2),
  add column if not exists keyword_difficulty integer,
  add column if not exists cluster text;
