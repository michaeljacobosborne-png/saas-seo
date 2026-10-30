CREATE TABLE IF NOT EXISTS public.keyword_cache (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword text UNIQUE NOT NULL,
  volume integer,
  difficulty integer,
  cpc numeric(10,2),
  intent text,
  related_keywords jsonb,
  fetched_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '90 days')
);
CREATE INDEX IF NOT EXISTS keyword_cache_keyword_idx ON public.keyword_cache (keyword);
CREATE INDEX IF NOT EXISTS keyword_cache_expires_idx ON public.keyword_cache (expires_at);
-- Public read for authenticated users (no RLS needed — keyword metrics are public data)
ALTER TABLE public.keyword_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read keyword cache" ON public.keyword_cache FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Service role can write keyword cache" ON public.keyword_cache FOR ALL USING (true);

ALTER TABLE public.keyword_projects ADD COLUMN IF NOT EXISTS last_researched_at timestamptz;
