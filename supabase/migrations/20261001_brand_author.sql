-- Decision 5 (docs/DECISIONS.md): the author byline is part of the draft and is
-- scored from the brand profile. These columns hold it. Nullable: a profile
-- without an author scores named-authorship as absent, with a prompt to add one.
-- Apply manually in the Supabase SQL editor (the direct DB host is IPv6-only).

alter table public.brand_profiles
  add column if not exists author_name text,
  add column if not exists author_credentials text,
  add column if not exists author_url text;

comment on column public.brand_profiles.author_name is 'Byline author shown on published articles; feeds named-authorship at draft time.';
comment on column public.brand_profiles.author_credentials is 'One line of experience or specialism stated alongside the author name.';
comment on column public.brand_profiles.author_url is 'Author profile page or canonical profile URL.';
