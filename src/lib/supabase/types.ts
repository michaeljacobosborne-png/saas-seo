export type BrandVoice = 'professional' | 'friendly' | 'authoritative' | 'conversational' | 'witty' | 'inspirational'

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
  created_at: string
  updated_at: string
}

export interface KeywordProject {
  id: string
  user_id: string
  brand_profile_id: string | null
  name: string
  seed_topic: string | null
  status: 'pending' | 'researching' | 'complete' | 'error'
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
  word_count: number | null
  status: 'draft' | 'brief_ready' | 'generating' | 'complete' | 'published'
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
        Insert: Omit<KeywordProject, 'id' | 'created_at'>
        Update: Partial<Omit<KeywordProject, 'id' | 'created_at'>>
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
        Insert: Omit<Article, 'id' | 'created_at' | 'updated_at'>
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
