-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────
-- brand_profiles
-- ─────────────────────────────────────────────
create table public.brand_profiles (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  brand_name        text not null,
  website_url       text,
  industry          text,
  target_audience   text,
  brand_voice       text,
  tone_notes        text,
  competitors       text[] default '{}',
  primary_keywords  text[] default '{}',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.brand_profiles enable row level security;

create policy "Users can view their own brand profiles"
  on public.brand_profiles for select
  using (auth.uid() = user_id);

create policy "Users can insert their own brand profiles"
  on public.brand_profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own brand profiles"
  on public.brand_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own brand profiles"
  on public.brand_profiles for delete
  using (auth.uid() = user_id);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger brand_profiles_updated_at
  before update on public.brand_profiles
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────
-- keyword_projects
-- ─────────────────────────────────────────────
create table public.keyword_projects (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  brand_profile_id  uuid references public.brand_profiles(id) on delete set null,
  name              text not null,
  seed_topic        text,
  status            text not null default 'pending' check (status in ('pending', 'researching', 'complete', 'error')),
  created_at        timestamptz not null default now()
);

alter table public.keyword_projects enable row level security;

create policy "Users can view their own keyword projects"
  on public.keyword_projects for select
  using (auth.uid() = user_id);

create policy "Users can insert their own keyword projects"
  on public.keyword_projects for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own keyword projects"
  on public.keyword_projects for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own keyword projects"
  on public.keyword_projects for delete
  using (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- keywords
-- ─────────────────────────────────────────────
create table public.keywords (
  id                    uuid primary key default uuid_generate_v4(),
  project_id            uuid not null references public.keyword_projects(id) on delete cascade,
  keyword               text not null,
  avg_monthly_searches  integer,
  competition           text,
  competition_index     numeric(5,2),
  selected              boolean not null default false,
  created_at            timestamptz not null default now()
);

alter table public.keywords enable row level security;

-- Keywords are accessed via project ownership
create policy "Users can view keywords in their projects"
  on public.keywords for select
  using (
    exists (
      select 1 from public.keyword_projects kp
      where kp.id = keywords.project_id
        and kp.user_id = auth.uid()
    )
  );

create policy "Users can insert keywords in their projects"
  on public.keywords for insert
  with check (
    exists (
      select 1 from public.keyword_projects kp
      where kp.id = keywords.project_id
        and kp.user_id = auth.uid()
    )
  );

create policy "Users can update keywords in their projects"
  on public.keywords for update
  using (
    exists (
      select 1 from public.keyword_projects kp
      where kp.id = keywords.project_id
        and kp.user_id = auth.uid()
    )
  );

create policy "Users can delete keywords in their projects"
  on public.keywords for delete
  using (
    exists (
      select 1 from public.keyword_projects kp
      where kp.id = keywords.project_id
        and kp.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────
-- articles
-- ─────────────────────────────────────────────
create table public.articles (
  id                   uuid primary key default uuid_generate_v4(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  brand_profile_id     uuid references public.brand_profiles(id) on delete set null,
  keyword_project_id   uuid references public.keyword_projects(id) on delete set null,
  title                text,
  target_keyword       text,
  supporting_keywords  text[] default '{}',
  brief                jsonb,
  content              text,
  word_count           integer,
  status               text not null default 'draft' check (status in ('draft', 'brief_ready', 'generating', 'complete', 'published')),
  scores               jsonb,
  published_url        text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.articles enable row level security;

create policy "Users can view their own articles"
  on public.articles for select
  using (auth.uid() = user_id);

create policy "Users can insert their own articles"
  on public.articles for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own articles"
  on public.articles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own articles"
  on public.articles for delete
  using (auth.uid() = user_id);

create trigger articles_updated_at
  before update on public.articles
  for each row execute function public.set_updated_at();
