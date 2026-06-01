-- Add missing columns to brand_profiles
alter table public.brand_profiles
  add column if not exists avoid_topics text[] default '{}',
  add column if not exists content_goals text,
  add column if not exists unique_selling_points text,
  add column if not exists brand_story text;
