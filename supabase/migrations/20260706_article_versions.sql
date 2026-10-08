-- Article version history for rollback and forking
CREATE TABLE IF NOT EXISTS public.article_versions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id  uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content     text NOT NULL,
  word_count  integer,
  label       text,         -- e.g. "Before Auto mode", "Manual save"
  trigger     text DEFAULT 'manual',  -- 'manual' | 'agent_auto' | 'agent_assist'
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.article_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own article versions"
  ON public.article_versions FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS article_versions_article_id_idx
  ON public.article_versions (article_id, created_at DESC);
