# SEO Studio

An AI-powered SEO content tool that combines persistent brand memory, Google Ads keyword data, and LLM-generated article drafts into a single workflow.

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript) |
| Styling | Tailwind CSS |
| Database / Auth | Supabase (Postgres + RLS + Auth) |
| AI | OpenAI API |
| Keyword Data | Google Ads Keyword Planner API (Phase 2) |
| Forms | react-hook-form + zod |
| Icons | lucide-react |

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Supabase

Follow the instructions in [`supabase/README.md`](supabase/README.md):

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Run `supabase/schema.sql` in the SQL editor
3. Copy your project URL and API keys

### 3. Configure environment

```bash
cp .env.local.example .env.local
# Fill in your Supabase URL, anon key, and OpenAI API key
```

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to `/login`.

## Project Structure

```
seo-saas/
├── supabase/
│   ├── schema.sql          # All tables + RLS policies
│   └── README.md           # Supabase setup guide
├── src/
│   ├── app/
│   │   ├── (auth)/         # Login, signup, OAuth callback
│   │   ├── (dashboard)/    # Protected app shell
│   │   │   ├── layout.tsx  # Sidebar navigation
│   │   │   ├── dashboard/  # Overview page
│   │   │   ├── brand/      # Brand profile form (WORKING)
│   │   │   ├── keywords/   # Keyword research (Phase 2)
│   │   │   └── articles/   # Article generation (Phase 3)
│   │   ├── api/
│   │   │   ├── keywords/research/     # Stub → Phase 2
│   │   │   └── articles/
│   │   │       ├── generate-brief/    # Stub → Phase 3
│   │   │       └── generate-draft/    # Stub → Phase 3
│   │   └── auth/signout/   # POST handler for sign out
│   ├── lib/supabase/
│   │   ├── client.ts       # Browser Supabase client
│   │   ├── server.ts       # Server Supabase client (RSC / Route Handlers)
│   │   └── types.ts        # TypeScript types for all DB tables
│   └── middleware.ts       # Route protection (redirects to /login)
└── .env.local.example
```

## What's Implemented vs Stubbed

### Working
- **Auth** — email/password sign up, sign in, sign out, OAuth callback
- **Middleware** — protects all `/dashboard`, `/brand`, `/keywords`, `/articles` routes
- **Dashboard** — overview page with brand-aware greeting
- **Brand Profile** — full CRUD form with:
  - Text fields: brand name, website, industry, target audience
  - Dropdown: brand voice (professional, friendly, authoritative, etc.)
  - Textarea: tone notes
  - Tag inputs: competitors, primary keywords (press Enter or comma to add)
  - Loads existing profile on mount, upserts on save
- **Database schema** — all 4 tables with RLS policies

### Stubbed (returns 501)
- `POST /api/keywords/research` — Google Ads Keyword Planner integration
- `POST /api/articles/generate-brief` — AI content brief generation
- `POST /api/articles/generate-draft` — AI article draft generation

## Roadmap

**Phase 2 — Keyword Research**
- Google Ads Keyword Planner API integration
- Seed topic → keyword ideas with search volume + competition
- Keyword selection and project management

**Phase 3 — Article Generation**
- Brief generation from brand profile + selected keywords
- Full article draft via OpenAI (brand voice aware)
- Article management and publishing workflow
