# Byline build backlog

Created 2026-10-05. Ordered by priority; nothing starts until the item above it is done unless noted. The reasoning behind the items lives in `docs/DECISIONS.md`. Day-to-day progress is in Michael's status file (`Documents\byline-status.md`).

**Authoritative copy:** `master` on GitHub (`michaeljacobosborne-png/saas-seo`). Locally that is **`C:\dev\Byline`, on `master`**: the only working folder since the 2026-10-06 consolidation (the old worktrees were removed after their branches were pushed). Run `git pull` there before starting. A readable mirror of the decision log is kept at `C:\Users\ozzy5\Documents\byline-DECISIONS.md`.

Parked, deliberately not merged: `park/geo-analyzer-accuracy-uncommitted` (Gemini AI-citation checking: a product decision, see the commit message) and `park/recovered-stash` (June WordPress-publishing work).

## 1. Group 1: integrity (signed-in pass, 2026-10-04)
- Done and live:
  - Fix button no longer fabricates or attributes figures to the brand.
  - Agent summary can't enter the body (two routes closed).
  - Fixes are targeted, not full rewrites.
  - Generator keeps only citable or user-supplied facts.
  - Ranking and traffic predictions replaced by a projected score (decision 29).
- Open: Original evidence must stop rewarding uncited numbers. A proposal is awaiting approval: only linked figures count, unsourced ones are neither credited nor penalised, with an optional matching rule for Retrievable's figures point and an engine version bump to 2026.11.

## 2. Engine: crawler check honesty (found 2026-10-05, reddit.com re-run)
- A 200 whose body is a JavaScript challenge is reported as "served". Detect challenge pages (same body as the baseline challenge, a self-submitting form, no content).
- A repeated 429 with `x-ratelimit-used: 0` is labelled "rate limited, not a policy block". Label it as a refusal.
- These affect prospect reports and anything published from the crawler check.
- FIXED 2026-10-07: the opposite error. reCAPTCHA/hCaptcha/Turnstile markers labelled full pages with a protected contact form "a bot challenge, not the page" (screamingfrog.co.uk, varn.co.uk, withcandour.co.uk: every row, baseline included). Those markers now count only on a response under 30 KB. Divergence is no longer reported when the baseline was refused too. Any prospect reading from before this fix that says "bot challenge" must be re-run.
- Open (found 2026-10-07, outreach audits):
  - Some origins (aira.net, zelst.co.uk) serve or refuse a crawler UA depending on the other request headers: 200 with Accept/Accept-Language, 403 without. The probe's verdict is therefore about our request shape, not the crawler. Report such rows as unconfirmed, or probe twice with different header sets and report only what agrees.
  - FIXED 2026-10-07 (DECISIONS 32): authorship miss (varn, screamingfrog), legal-name brand matching (candour, zelst), own-CEO quote as client evidence (varn), "Continue Reading" and "San Diego" as coined terms (screamingfrog). Also fixed: zelst coined term and founder name, salt nav-as-testimonial, optimist CORE Framework, "strong" authorship from an agency award.

## 2b. Blog drafts (content/blog)
- DONE 2026-10-07: `which-ai-crawlers-your-site-actually-serves.md` Reddit section rewritten to the 5 October hand check (200s were a JS challenge, 429s a zero-allowance refusal). Its publishedAt is 2026-10-06, already past: set the real date before running without --dry-run.
- DONE 2026-10-07: `one-ai-visibility-score-cannot-be-true.md` Otterly figures restored as a table; converts to one table block, 7 rows x 5 columns, cells checked.
- Both dry-run clean. Only warning: inline code (`/`, `*`) renders as plain text, which reads fine.

## 3. Group 4: mobile: DONE, live (cb0cb4c), verified at 375px.

## 4. Group 2: coherence
- DONE, live (71450e4, cc31b9b): SEO panel reduced to SEO basics (decision 28), Readability removed, agent top issues from the draft report only, Heading hierarchy Fix button.
- Open: Direct answers evidence must quote the paragraph it describes; the brief meta description came out at 99 characters; a competitor-gap note became a heading verbatim.

## 5. Sanity tables: DONE, live (02c18aa, DECISIONS 30). Final check pending: run a published post that has a table through save-audit.

## 6. Group 3: presentation and data
- The card shows 78/100 next to "45 of 100".
- (Fixed in 71450e4: empty meta description no longer passes.)
- (Resolved: Readability removed.)
- Wrong keyword shown on the dashboard.
- Word count differs between the list and the panel.
- /articles/new briefly shows "Brand profile missing".

## 7. Later
- MCP build (decisions 21–27; docs/mcp-server-spec.md): compare and history as the centrepiece, an unmetered usage tool, outputSchema, a claude.ai directory listing.
- Score-over-time storage (decision 29).
- Generator follow-ups: hype in brief titles; writer evidence handled per item.
- Prospect-report readiness fixes (docs/audits/prospect-report-readiness-2026-10-04.md).
