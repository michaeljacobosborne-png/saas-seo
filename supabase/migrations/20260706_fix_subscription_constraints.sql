-- Fix subscriptions plan constraint to include 'team' (renamed from 'agency')
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_plan_check
  CHECK (plan IN ('starter', 'pro', 'agency', 'team'));

-- Fix subscriptions status constraint to include 'canceled' (Stripe uses this spelling)
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('active', 'cancelled', 'canceled', 'past_due', 'trialing', 'unpaid'));

-- Add article creation wizard columns
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS creation_stage TEXT NULL;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS concept_topic TEXT NULL;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS concept_angle TEXT NULL;
