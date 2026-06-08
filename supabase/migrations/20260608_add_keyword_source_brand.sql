-- Support manually-added keywords: track their source and owning brand.
alter table public.keywords
  add column if not exists source text not null default 'dataforseo',
  add column if not exists brand_id uuid references public.brand_profiles(id) on delete set null;
