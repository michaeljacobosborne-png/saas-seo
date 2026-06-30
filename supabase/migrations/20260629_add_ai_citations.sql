CREATE TABLE IF NOT EXISTS article_ai_citations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  engine text NOT NULL CHECK (engine IN ('perplexity', 'google_aio')),
  keyword text NOT NULL,
  cited boolean NOT NULL DEFAULT false,
  citation_url text,
  sources jsonb DEFAULT '[]'::jsonb,
  checked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX article_ai_citations_article_id_idx ON article_ai_citations(article_id);
CREATE INDEX article_ai_citations_user_id_idx ON article_ai_citations(user_id);

CREATE TABLE IF NOT EXISTS article_ai_visibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  engine text NOT NULL CHECK (engine IN ('perplexity', 'google_aio')),
  week_start date NOT NULL,
  checks_run integer NOT NULL DEFAULT 0,
  citations_found integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(article_id, engine, week_start)
);

CREATE INDEX article_ai_visibility_article_id_idx ON article_ai_visibility(article_id);

ALTER TABLE article_ai_citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_ai_visibility ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own citation checks" ON article_ai_citations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can read own visibility" ON article_ai_visibility FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role can write citations" ON article_ai_citations FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can upsert visibility" ON article_ai_visibility FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can update visibility" ON article_ai_visibility FOR UPDATE USING (true);
