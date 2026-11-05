ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS target_word_count integer DEFAULT 1200;
