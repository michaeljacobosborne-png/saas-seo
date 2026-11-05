ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS pass_count integer DEFAULT 1;
