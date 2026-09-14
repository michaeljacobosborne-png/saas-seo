ALTER TABLE public.brand_profiles
  ADD COLUMN IF NOT EXISTS voice_fingerprint jsonb,
  ADD COLUMN IF NOT EXISTS voice_status text NOT NULL DEFAULT 'none';
