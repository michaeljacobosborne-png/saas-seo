ALTER TABLE brand_profiles
  ADD COLUMN IF NOT EXISTS avoid_topics text,
  ADD COLUMN IF NOT EXISTS tone_examples text,
  ADD COLUMN IF NOT EXISTS content_goals text;

-- Needed for upsert-on-conflict in /api/brand/save
CREATE UNIQUE INDEX IF NOT EXISTS brand_profiles_user_id_idx ON brand_profiles (user_id);
