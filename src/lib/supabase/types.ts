export type BrandVoice = 'professional' | 'friendly' | 'authoritative' | 'conversational' | 'witty' | 'inspirational'

export interface Subscription {
  id: string
  user_id: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  plan: 'starter' | 'pro' | 'agency'
  billing_interval: 'monthly' | 'annual'
  status: 'active' | 'cancelled' | 'past_due' | 'trialing'
  current_period_end: string | null
  cancel_at_period_end: boolean
  created_at: string
  updated_at: string
}

export interface BrandProfile {
  id: string
  user_id: string
  brand_name: string
  website_url: string | null
  industry: string | null
  target_audience: string | null
  brand_voice: BrandVoice | null
  tone_notes: string | null
  competitors: string[]
  primary_keywords: string[]
  avoid_topics: string | null
  tone_examples: string | null
  content_goals: string | null
  created_at: string
  updated_at: string
}

export interface KeywordProject {
  id: string
  user_id: string
  brand_profile_id: string | null
  name: string
  seed_topic: string | null
  folder: string | null
  status: 'pending' | 'researching' | 'complete' | 'error'
  research_brief: Record<string, unknown> | null
  last_researched_at: string | null
  created_at: string
}

export interface SavedKeyword {
  id: string
  user_id: string
  keyword: string
  volume: number | null
  difficulty: number | null
  cpc: number | null
  intent: string | null
  folder: string
  has_article: boolean
  article_id: string | null
  created_at: string
}

export interface Keyword {
  id: string
  project_id: string
  keyword: string
  avg_monthly_searches: number | null
  competition: string | null
  competition_index: number | null
  selected: boolean
  created_at: string
}

export interface ArticleScoreCriteria {
  label: string
  points: number
  max: number
  passed: boolean
}

export interface ArticleScores {
  seo: { score: number; breakdown: Record<string, ArticleScoreCriteria> }
  readability: { score: number; breakdown: Record<string, { label: string; value: number }> }
  geo: { score: number; breakdown: Record<string, { label: string; passed: boolean }> }
  aeo: { score: number; breakdown: Record<string, { label: string; passed: boolean }> }
  ranking_prediction: { timeline: string; confidence: 'low' | 'medium' | 'high' }
  traffic_prediction: { at_rank_1: number; at_rank_3: number; at_rank_5: number; at_rank_10: number }
}

export interface Article {
  id: string
  user_id: string
  brand_profile_id: string | null
  keyword_project_id: string | null
  title: string | null
  target_keyword: string | null
  supporting_keywords: string[]
  brief: Record<string, unknown> | null
  content: string | null
  meta_description: string | null
  word_count: number | null
  target_word_count: number | null
  status: 'draft' | 'brief_ready' | 'generating' | 'complete' | 'published'
  scores: ArticleScores | null
  published_url: string | null
  created_at: string
  updated_at: string
}

// Supabase v2 Database generic type — must include all required shape fields
export type Database = {
  public: {
    Tables: {
      brand_profiles: {
        Row: BrandProfile
        Insert: Omit<BrandProfile, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<BrandProfile, 'id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      keyword_projects: {
        Row: KeywordProject
        Insert: Omit<KeywordProject, 'id' | 'created_at'> & { research_brief?: Record<string, unknown> | null }
        Update: Partial<Omit<KeywordProject, 'id' | 'created_at'>>
        Relationships: []
      }
      saved_keywords: {
        Row: SavedKeyword
        Insert: Omit<SavedKeyword, 'id' | 'created_at'>
        Update: Partial<Omit<SavedKeyword, 'id' | 'created_at'>>
        Relationships: []
      }
      keywords: {
        Row: Keyword
        Insert: Omit<Keyword, 'id' | 'created_at'>
        Update: Partial<Omit<Keyword, 'id' | 'created_at'>>
        Relationships: []
      }
      articles: {
        Row: Article
        Insert: Omit<Article, 'id' | 'created_at' | 'updated_at' | 'scores'> & { scores?: ArticleScores | null }
        Update: Partial<Omit<Article, 'id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
