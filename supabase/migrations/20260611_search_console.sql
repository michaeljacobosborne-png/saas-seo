-- Google Search Console integration: per-brand OAuth connection + selected property.
-- One connection per brand profile (UNIQUE(brand_profile_id)). Tokens are stored
-- so we can refresh + query the Search Console API on the user's behalf. RLS scopes
-- every row to its owner.

CREATE TABLE IF NOT EXISTS search_console_connections (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  brand_profile_id uuid REFERENCES brand_profiles NOT NULL,
  access_token text NOT NULL,
  refresh_token text,
  token_expiry timestamptz,
  property_url text,  -- e.g. 'https://bylineseo.com/'
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(brand_profile_id)
);

ALTER TABLE search_console_connections ENABLE ROW LEVEL SECURITY;

-- USING governs read/update/delete visibility; WITH CHECK is required for INSERT/UPSERT
-- to succeed, so include both — a USING-only policy silently blocks inserts.
DROP POLICY IF EXISTS "Users manage own GSC connections" ON search_console_connections;
CREATE POLICY "Users manage own GSC connections" ON search_console_connections
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
