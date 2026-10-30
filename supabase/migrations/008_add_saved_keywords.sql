CREATE TABLE IF NOT EXISTS public.saved_keywords (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  keyword text NOT NULL,
  volume integer,
  difficulty integer,
  cpc numeric(10,2),
  intent text,
  folder text NOT NULL DEFAULT 'General',
  has_article boolean DEFAULT false,
  article_id uuid REFERENCES public.articles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.saved_keywords ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own saved keywords" ON public.saved_keywords FOR ALL USING (auth.uid() = user_id);
