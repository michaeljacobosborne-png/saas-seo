# Supabase Setup

## 1. Create a Supabase project

Go to [supabase.com](https://supabase.com), create a new project, and wait for it to finish provisioning.

## 2. Run the schema

In your Supabase dashboard, go to **SQL Editor** and paste the full contents of `schema.sql`, then click **Run**.

This creates four tables with Row Level Security enabled:
- `brand_profiles` — persistent brand memory (core feature)
- `keyword_projects` — keyword research sessions
- `keywords` — individual keywords within a project
- `articles` — content drafts and published pieces

## 3. Get your API keys

In the Supabase dashboard go to **Project Settings → API**:

| Key | Where to find it |
|-----|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` / `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key (keep secret — server-side only) |

## 4. Copy to .env.local

```bash
cp .env.local.example .env.local
```

Fill in the values from step 3 plus your OpenAI API key and (later) Google Ads credentials.

## 5. Enable Email Auth

In Supabase dashboard → **Authentication → Providers**, make sure **Email** is enabled. For production, configure a custom SMTP provider and disable email confirmation during development (Auth → Settings → "Confirm email").
