ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS is_founder BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_subscriptions_is_founder ON subscriptions(is_founder);
