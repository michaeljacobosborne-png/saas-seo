-- Keyword session usage tracking.
-- One "keyword session" = one call to /api/keywords/discover OR /api/keywords/research.
-- Limits are per-plan (see PLAN_LIMITS in src/lib/usage.ts) and reset each calendar month.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS keyword_sessions_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS keyword_sessions_reset_at timestamptz;

-- Atomically increment a user's keyword-session counter, resetting it first when the
-- billing period (calendar month) has rolled over since the last recorded reset.
-- Returns the new used count after the increment. SECURITY DEFINER so it can write
-- profiles regardless of the caller's RLS context (callers pass their own user id).
CREATE OR REPLACE FUNCTION public.increment_keyword_sessions(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_start timestamptz := date_trunc('month', now());
  v_rolled_over boolean;
  v_used integer;
BEGIN
  SELECT keyword_sessions_reset_at IS NULL OR keyword_sessions_reset_at < v_period_start
    INTO v_rolled_over
  FROM public.profiles
  WHERE user_id = p_user_id;

  IF v_rolled_over IS NULL THEN
    -- No profile row (shouldn't happen — created on signup). Nothing to increment.
    RETURN 0;
  END IF;

  UPDATE public.profiles
  SET
    keyword_sessions_used = CASE WHEN v_rolled_over THEN 1 ELSE keyword_sessions_used + 1 END,
    keyword_sessions_reset_at = CASE WHEN v_rolled_over THEN v_period_start ELSE keyword_sessions_reset_at END
  WHERE user_id = p_user_id
  RETURNING keyword_sessions_used INTO v_used;

  RETURN v_used;
END;
$$;
