-- Add folder column to keyword_projects for grouping
alter table public.keyword_projects
  add column if not exists folder text;
