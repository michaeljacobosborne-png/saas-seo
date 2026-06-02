-- ============================================================
-- CATCH-UP MIGRATION: Apply all columns that may be missing
-- Run this in Supabase SQL editor if articles fail to generate
-- ============================================================

-- Migration 010: target_word_count on articles
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS target_word_count integer DEFAULT 1200;

-- Migration 012: pass_count on articles (kept for schema completeness even though code no longer writes it)
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS pass_count integer DEFAULT 1;

-- Migration 015: article creation wizard stage columns
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS creation_stage TEXT NULL;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS concept_topic TEXT NULL;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS concept_angle TEXT NULL;

-- Fix subscriptions plan constraint to include 'team' (renamed from 'agency')
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_plan_check
  CHECK (plan IN ('starter', 'pro', 'agency', 'team'));

-- Fix subscriptions status constraint to include 'canceled' (Stripe uses this spelling)
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('active', 'cancelled', 'canceled', 'past_due', 'trialing', 'unpaid'));

-- Migration 006: agent_memory table
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
CREATE POLICY IF NOT EXISTS "Users can manage own agent memory" ON public.agent_memory FOR ALL USING (auth.uid() = user_id);

-- Migration 007: research_brief on keyword_projects
ALTER TABLE public.keyword_projects ADD COLUMN IF NOT EXISTS research_brief jsonb;

-- Migration 008: saved_keywords table
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
CREATE POLICY IF NOT EXISTS "Users manage own saved keywords" ON public.saved_keywords FOR ALL USING (auth.uid() = user_id);

-- Migration 009: keyword_cache table + last_researched_at
CREATE TABLE IF NOT EXISTS public.keyword_cache (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword text UNIQUE NOT NULL,
  volume integer,
  difficulty integer,
  cpc numeric(10,2),
  intent text,
  related_keywords jsonb,
  fetched_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '90 days')
);
CREATE INDEX IF NOT EXISTS keyword_cache_keyword_idx ON public.keyword_cache (keyword);
CREATE INDEX IF NOT EXISTS keyword_cache_expires_idx ON public.keyword_cache (expires_at);
ALTER TABLE public.keyword_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Authenticated users can read keyword cache" ON public.keyword_cache FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "Service role can write keyword cache" ON public.keyword_cache FOR ALL USING (true);

ALTER TABLE public.keyword_projects ADD COLUMN IF NOT EXISTS last_researched_at timestamptz;

-- Migration 011: brand_profiles extra fields
ALTER TABLE public.brand_profiles ADD COLUMN IF NOT EXISTS avoid_topics text;
ALTER TABLE public.brand_profiles ADD COLUMN IF NOT EXISTS tone_examples text;
ALTER TABLE public.brand_profiles ADD COLUMN IF NOT EXISTS content_goals text;
CREATE UNIQUE INDEX IF NOT EXISTS brand_profiles_user_id_idx ON brand_profiles (user_id);

-- Migration 013: profiles table for account type tracking
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_type text NOT NULL DEFAULT 'paid',
  agent_turns_used jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Migration 014: brand expertise fields
ALTER TABLE public.brand_profiles ADD COLUMN IF NOT EXISTS expertise_notes text;
ALTER TABLE public.brand_profiles ADD COLUMN IF NOT EXISTS signature_angles text;
ALTER TABLE public.brand_profiles ADD COLUMN IF NOT EXISTS avoid_phrases text;
ALTER TABLE public.brand_profiles ADD COLUMN IF NOT EXISTS expertise_skipped boolean NOT NULL DEFAULT false;

-- 20260601: additional brand profile fields
ALTER TABLE public.brand_profiles ADD COLUMN IF NOT EXISTS unique_selling_points text;
ALTER TABLE public.brand_profiles ADD COLUMN IF NOT EXISTS brand_story text;
