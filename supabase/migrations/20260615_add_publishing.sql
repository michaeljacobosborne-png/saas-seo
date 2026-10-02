-- Publishing integration: external CMS connections (WordPress first) + article
-- publish metadata.
--
-- NOTE: Apply this manually in the Supabase dashboard SQL editor. Do NOT run it
-- against the live DB from a session.

create table if not exists publishing_connections (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users not null,
  platform     text not null,
  site_url     text not null,
  display_name text,
  credentials  text not null,  -- AES-256-CBC encrypted JSON string
  status       text default 'active',
  last_tested  timestamptz,
  created_at   timestamptz default now(),
  unique(user_id, platform, site_url)
);

alter table publishing_connections enable row level security;

create policy "users own their connections"
  on publishing_connections for all
  using (auth.uid() = user_id);

alter table articles
  add column if not exists published_url   text,
  add column if not exists published_at    timestamptz,
  add column if not exists wp_post_id      integer,
  add column if not exists publish_channel text;
