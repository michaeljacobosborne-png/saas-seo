CREATE TABLE IF NOT EXISTS public.agent_memory (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  article_id uuid REFERENCES public.articles(id) ON DELETE CASCADE,
  memory_type text NOT NULL CHECK (memory_type IN ('account', 'article')),
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.agent_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own agent memory" ON public.agent_memory FOR ALL USING (auth.uid() = user_id);
