-- Add AI scoring results to articles
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS scores jsonb;
