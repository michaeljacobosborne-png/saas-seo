# Redesign audit page as lead magnet landing page

- Session `f8186714-ceeb-4cd5-bd04-1c64650133e7`
- 2026-06-17 13:36 to 2026-06-17 13:49
- Branch: `master`  |  Claude Code 2.1.170

**Commits made:**

- `Redesign /audit as brand-consistent lead magnet page`

**Files touched (7):** `src/app/(marketing)/audit/page.tsx`, `src/app/page.tsx`, `src/app/_components/NavLinks.tsx`, `src/app/globals.css`, `src/app/_components/TestimonialsSection.tsx`, `src/app/layout.tsx`, `src/app/(marketing)/layout.tsx`

---


## Michael

Rebuild `src/app/(marketing)/audit/page.tsx` as a proper lead-magnet landing page. This is the primary top-of-funnel page for Byline (app.bylineseo.com) — a free content-gap audit tool that captures emails before upselling to the paid product.

## Step 0 — Read before writing
Read these files in full before touching anything:
1. `src/app/(marketing)/audit/page.tsx` — current page (preserve ALL functional logic: streaming, results parsing, email capture, blurred gaps, error handling). Do NOT break anything that currently works. Only the visual design and marketing copy need to change.
2. `src/app/page.tsx` — homepage for design reference (colors, fonts, component patterns)
3. `src/app/_components/NavLinks.tsx` — auth-aware nav component to reuse
4. Check if `src/app/_components/TestimonialsSection.tsx` exists — import it if it does
5. Check if there's a shared Footer component anywhere in `src/app/_components/`
6. Read `src/app/globals.css` (first 100 lines) for CSS variables

## Design System (light mode variant)
The marketing site uses a dark copper/cream theme. The audit page should be the LIGHT MODE variant:
- Background: `#FDFAF6` (very light warm cream) with section variants using `#F7F3EC`
- Text: `#1C1917` primary, `#57534E` secondary (warm stone)  
- Accent / CTA buttons: `#B87333` (copper) with white text
- Borders: `#E7E0D6` (warm gray)
- Playfair Display for ALL display headings (H1, H2, section titles) — import via `next/font/google`
- DM Sans for body text — import via `next/font/google`
- The current page imports these fonts inline — check if they're already imported in globals.css or layout; if not, add font imports at the top of the file using `next/font/google`

## Page Structure

### 1. Nav (top)
Use `NavLinks` component inside a `<nav>` bar. Style it: white/cream background, copper logo text "byline", `border-b border-[#E7E0D6]`.

### 2. Hero Section
Full-width section, bg `#FDFAF6`. Center-aligned.
- Eyebrow label: "Free Content Gap Audit" — small, copper, uppercase, letter-spaced
- H1 (Playfair Display, ~52px desktop): "See Exactly Where Your Content Strategy Is Losing"
- Subheadline (DM Sans, ~18px, stone-600): "Byline maps your published content against real search demand and shows you the gaps your competitors are filling — in under 60 seconds."
- Then immediately below: the URL input form + Run Audit button (this IS the above-the-fold CTA)

The URL input should be prominent: wide input with copper border on focus, copper "Run Audit →" button.

### 3. How It Works (3 steps) — BELOW the hero/form
Section bg `#F7F3EC`. Heading (Playfair): "How the Audit Works"
Three columns, each with a copper number (01, 02, 03), a short heading (DM Sans, semibold), and 2–3 sentence explanation:

**01 — We crawl your sitemap**
Enter your domain and we pull every page you've published. No login needed — we use your sitemap to see exactly what content you've built.

**02 — We map content against search intent**
Every page gets matched against real keyword clusters. We're not just counting words — we're analyzing whether your content covers the queries that actually drive traffic in your niche.

**03 — You get a prioritized gap report**
The audit surfaces content topics with real search demand that your site doesn't cover. Each gap is scored by opportunity — so you know exactly what to build next.

### 4. Why This Matters — narrative section
Section bg `#FDFAF6`. Left-aligned, max-width container. Heading (Playfair): "Most content strategies are based on guesses"

Body copy (DM Sans):
"Your team picks topics based on what feels right — what the CEO mentioned in a meeting, what a customer asked about last week, what a competitor wrote about last month.

Meanwhile, your competitors are methodically filling every intent cluster in your niche. And Google is rewarding them for it.

The content that drives compounding organic traffic isn't the content you think you need. It's the 40–60 topics that sit one step outside your current coverage — the adjacent questions your audience is already searching for that you've never answered.

A content gap audit is the difference between a content calendar built on instinct and one built on data. Most teams skip it because it's tedious to do manually. Byline does it in under a minute."

### 5. The Audit Tool — results section
This is where the existing functional component renders. When the audit has run, results appear here. Keep the exact same functional logic:
- Streaming progress indicator
- Quick wins section
- Top 3 content gaps (visible)
- Remaining gaps (blurred/locked behind email capture)
- Email capture form (Resend API, collecting email before unlocking)
- Error states

Style the results section to match the light-mode brand: white cards with `#E7E0D6` borders, copper accents on headings and badges, stone text.

### 6. What You Get — feature grid
Section bg `#F7F3EC`. Heading (Playfair): "What the Audit Tells You"
Three cards:

**Quick Wins**
Low-competition content gaps you can start filling this week. Topics with real search demand and manageable competition scores.

**Strategic Opportunities**  
High-value topics worth a full content build-out. These are the pieces that compound — articles that earn links and rank for dozens of long-tail variants.

**Competitive Intelligence**
See what your rivals rank for that you don't. The audit cross-references your content map against common competitor signals to surface the clearest gaps.

### 7. CTA Section
Section bg `#1C1917` (dark, matches the main site's dark theme — a visual bookend). 
Heading (Playfair, cream): "Ready to turn gaps into traffic?"
Subheadline (DM Sans, stone-400): "Run a free audit above — or sign up to generate your first article in under 60 seconds."
Two buttons: "Run Free Audit" (copper, scrolls to top/input) + "Start Free →" (links to `/signup` or `/?signup=true`)

### 8. Footer
Simple: copyright "© 2025 Byline", links: Privacy · Terms · Pricing · Login. Text stone-400, bg `#1C1917` or just a border-top on white.

## Technical requirements
- Keep the file `'use client'` — it already uses client-side state and streaming
- The URL input must auto-scroll to results when the audit starts running
- On mobile: single-column, full-width input, stacked sections
- The email capture flow must work exactly as before — do not touch the Resend API call logic
- Copper button hover: darken copper slightly (`#9A6228` or just `opacity-90`)
- All new sections must appear ONLY when no audit is running/has run OR always (the tool section is always there; marketing copy sections should stay visible even after an audit runs — they're above and below the results)

## After writing the file
1. `git pull --rebase origin main`
2. `git diff --stat HEAD` to verify scope  
3. Commit with: `git -c user.email=michaeljacobosborne@gmail.com -c user.name="Michael Osborne" commit -m "Redesign /audit as brand-consistent lead magnet page"`
4. Trigger deploy: `curl -X POST "$(grep VERCEL_DEPLOY_HOOK_URL .env.local | cut -d= -f2-)"`

If `.env.local` doesn't have the hook, the deploy hook is stored in Vercel env vars — just commit and push and note that deploy hook needs to be triggered manually.

Push with `git push origin main` (never force push).

**Claude:** I'll start by reading the current page and the reference files before making any changes.

> `Read: src/app/(marketing)/audit/page.tsx`

> `Read: src/app/page.tsx`

> `Read: src/app/_components/NavLinks.tsx`

> `Read: src/app/globals.css`

**Claude:** Now let me check for the TestimonialsSection, Footer component, and how fonts are loaded in the layout.

> `Glob: src/app/_components/*.tsx`

> `Glob: src/app/layout.tsx`

> `Glob: src/app/(marketing)/layout.tsx`

> `Read: src/app/_components/TestimonialsSection.tsx`

> `Read: src/app/layout.tsx`

> `Read: src/app/(marketing)/layout.tsx`

**Claude:** I have everything I need. Fonts (`--font-playfair`, `--font-dm-sans`) are already loaded globally in `layout.tsx`, body defaults to DM Sans, so I'll apply Playfair via the CSS variable. There's no shared Footer, so I'll build one inline. Now I'll rewrite the page, preserving all functional logic and restyling to light mode.

> `Write: src/app/(marketing)/audit/page.tsx`

**Claude:** I left a pointless `hasRun` variable and dead span. Let me remove both.

> `Edit: src/app/(marketing)/audit/page.tsx`

> `Edit: src/app/(marketing)/audit/page.tsx`

**Claude:** Now let me verify it compiles by running a typecheck/lint, then handle git.

> `Bash: cd "C:/Users/ozzy5/OneDrive/Documents/Byline" && npx tsc --noEmit -p tsconfig.json 2>&1 | head -40`

**Claude:** Typecheck passed (no errors). Now the git workflow. Let me check the branch, deploy hook, and stage only my file.

> `Bash: cd "C:/Users/ozzy5/OneDrive/Documents/Byline" && git branch --show-current && git remote -v | head -2 && (grep VERCEL_DEPLOY_HOOK_URL .env.local >/dev/null 2>&1`

**Claude:** Branch is `master`, no deploy hook in `.env.local`. The working tree has unrelated modified files from other sessions (per my memory of shared worktrees), so I'll stage only my file, commit it, then rebase with autostash to avoid disturbing others' work.

> `Bash: cd "C:/Users/ozzy5/OneDrive/Documents/Byline" && git add "src/app/(marketing)/audit/page.tsx" && git diff --cached --stat HEAD`

**Claude:** Only my file is staged. Now commit, then rebase with autostash and push.

> `Bash: cd "C:/Users/ozzy5/OneDrive/Documents/Byline" && git -c user.email=michaeljacobosborne@gmail.com -c user.name="Michael Osborne" commit -m "Redesign /audit as br`

> `Bash: cd "C:/Users/ozzy5/OneDrive/Documents/Byline" && git pull --rebase --autostash origin master 2>&1 | tail -20`

**Claude:** Already up to date. Now push.

> `Bash: cd "C:/Users/ozzy5/OneDrive/Documents/Byline" && git push origin master 2>&1 | tail -15`

**Claude:** Pushed successfully. Done.

## Summary

I rebuilt `src/app/(marketing)/audit/page.tsx` as a brand-consistent, light-mode lead-magnet landing page.

**Preserved (untouched) functional logic:**
- The streaming NDJSON audit fetch + reader loop, progress-step parsing, and final result/error handling
- Email capture (`sendReport` → `/api/audit/lead` Resend flow), all states (idle/sending/sent/error)
- `displayDomain` helper, blurred locked gaps, free vs. locked gap split, all CTA links and query params

**Redesigned (visual + copy only):**
1. **Nav** — `NavLinks` (auth-aware) in a cream `#FDFAF6` bar with copper "byline" logo and `border-b border-[#E7E0D6]`
2. **Hero** — copper eyebrow, Playfair H1 ("See Exactly Where Your Content Strategy Is Losing"), DM Sans subheadline, and the prominent URL input + "Run Audit →" form above the fold
3. **How the Audit Works** — 3 steps (01/02/03) on `#F7F3EC`
4. **Why This Matters** — left-aligned narrative on `#FDFAF6`
5. **The Audit Tool** — loading/error/results restyled to white cards, `#E7E0D6` borders, copper accents; the post-audit funnel uses the dark `#1C1917` theme as a brand bookend
6. **What the Audit Tells You** — 3 feature cards (Quick Wins / Strategic Opportunities / Competitive Intelligence) on `#F7F3EC`
7. **CTA** — dark `#1C1917` section with "Run Free Audit" (scrolls to + focuses the hero input) and "Start Free →"
8. **Footer** — dark, with Privacy · Terms · Pricing · Login

**Behavior added:** starting an audit smooth-scrolls to the results section (`resultsRef` + `scroll-mt-20`); the bottom "Run Free Audit" scrolls back up and focuses the input. Marketing sections stay visible regardless of audit state. Fonts reuse the globally-loaded `--font-playfair` / DM Sans CSS variables (already in `layout.tsx`), so no duplicate imports. Copper hover darkens to `#9A6228`. Mobile is single-column with full-width stacked inputs.

**Verification:** `npx tsc --noEmit` passed clean.

**Git:** staged only the audit page (other modified files belong to concurrent sessions — left untouched via autostash), committed as `michaeljacobosborne@gmail.com`, rebased onto `origin/master` (up to date), and pushed (`2f8ffbf..117c596`).

⚠️ **Deploy:** `.env.local` has no `VERCEL_DEPLOY_HOOK_URL`, so I couldn't trigger the hook. If Vercel's GitHub integration is connected, the push will auto-deploy; otherwise the deploy hook needs to be triggered manually from Vercel.
