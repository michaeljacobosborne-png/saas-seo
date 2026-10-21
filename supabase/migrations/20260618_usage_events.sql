-- Per-AI-call cost tracking. One row per model invocation across the app
-- (brief/draft generation, the article agent, keyword research). Powers the
-- /admin cost-tracking section (total cost, cost by feature, cost by model,
-- gross-margin estimate).
CREATE TABLE IF NOT EXISTS usage_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- References auth.users(id), NOT profiles(id). Every route logs `user.id` (the
  -- Supabase auth uid), which equals profiles.user_id — profiles.id is a separate
  -- surrogate key. FK'ing to profiles(id) (as the original spec did) would reject
  -- every insert. auth.users(id) matches the convention used by articles/subscriptions.
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  feature TEXT NOT NULL, -- 'brief_gen' | 'draft_gen' | 'agent_review' | 'agent_assist' | 'agent_auto' | 'keyword_research' | 'audit'
  model TEXT NOT NULL,   -- 'gpt-4o' | 'gpt-4o-mini' | 'claude-sonnet-4-6' | 'claude-haiku-4-5'
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_events_user_id ON usage_events(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_feature ON usage_events(feature);
CREATE INDEX IF NOT EXISTS idx_usage_events_created_at ON usage_events(created_at);

-- Writes come exclusively from server routes using the service-role client
-- (which bypasses RLS), and reads happen only in the owner-gated /admin page
-- via the same service-role client. Enable RLS with no policies so the table is
-- closed to anon/authenticated callers by default.
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
