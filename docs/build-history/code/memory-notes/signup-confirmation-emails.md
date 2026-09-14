---
name: signup-confirmation-emails
description: Signup confirmation emails are 100% Supabase-sent; mailer_autoconfirm is OFF so email signups are hard-blocked until the link is clicked
metadata: 
  node_type: memory
  type: project
  originSessionId: 9f67c4ba-530b-4e64-9756-cb09b2d8e865
---

Email/password signup (`src/app/(auth)/signup/SignupForm.tsx`) calls `supabase.auth.signUp({ emailRedirectTo })`. The app does NO application-level confirmation email send — delivery is entirely Supabase's GoTrue mailer. `src/lib/email.ts` (Resend) is wired only to support flows (cancellation), never signup.

Supabase `/auth/v1/settings` (Jun 2026): `email:true`, `disable_signup:false`, `mailer_autoconfirm:false`, `google:true`, `github:true`. Because autoconfirm is OFF, every email signup MUST receive + click a confirmation link before sign-in. If delivery fails the user is fully blocked; OAuth (Google/GitHub) bypasses it.

Beta tester Abraham L hit exactly this: confirmation email never arrived ("Always"), had to use Google OAuth. Textbook signature of Supabase's built-in (non-production, rate-limited ~few/hr) email service. FIX: enable Supabase Custom SMTP (Dashboard → Auth → SMTP) — point it at Resend (host smtp.resend.com, user `resend`, pass = RESEND_API_KEY, which already exists in env). SMTP config is dashboard-only; not readable from app env or service key.

**Why:** missing confirmation emails block all email signups, not just one tester.
**How to apply:** verify Custom SMTP is enabled in the Supabase dashboard before assuming app code is at fault. Related: [[supabase-service-role-key-stale]].