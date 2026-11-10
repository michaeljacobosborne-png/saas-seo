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
- DONE 2026-10-26, engine 2026.13 (DECISIONS 36): Original evidence counts only figures with a source linked from the same section; unsourced ones are neither credited nor penalised; bare outbound links no longer earn it.
- CLOSED 2026-10-27, not doing (DECISIONS 38): Retrievable's figures point stays as is; sourcing is Citable's question.

## 2. Engine: crawler check honesty (found 2026-10-05, reddit.com re-run)
- DONE 2026-10-26 (DECISIONS 36): a 200 whose body is a script-submitted form with no content is a JavaScript challenge, not "served" (reddit.com fixture).
- DONE 2026-10-26 (DECISIONS 36): a 429 with `x-ratelimit-used: 0` and nothing remaining is a refusal (reddit.com headers).
- These affect prospect reports and anything published from the crawler check.
- FIXED 2026-10-07: the opposite error. reCAPTCHA/hCaptcha/Turnstile markers labelled full pages with a protected contact form "a bot challenge, not the page" (screamingfrog.co.uk, varn.co.uk, withcandour.co.uk: every row, baseline included). Those markers now count only on a response under 30 KB. Divergence is no longer reported when the baseline was refused too. Any prospect reading from before this fix that says "bot challenge" must be re-run.
- Open (found 2026-10-07, outreach audits):
  - DONE 2026-10-26 (DECISIONS 36): every crawler is probed with and without Accept headers; disagreement makes the row unconfirmed (aira.net, zelst.co.uk, 2026-10-07).
  - DONE 2026-10-27 (DECISIONS 37): no em dashes left in user-facing engine strings.
  - FIXED 2026-10-07 (DECISIONS 32): authorship miss (varn, screamingfrog), legal-name brand matching (candour, zelst), own-CEO quote as client evidence (varn), "Continue Reading" and "San Diego" as coined terms (screamingfrog). Also fixed: zelst coined term and founder name, salt nav-as-testimonial, optimist CORE Framework, "strong" authorship from an agency award.

## 2a. Engine rubric faults found on our own homepage (2026-10-08)
- DONE 2026-10-11, engine 2026.11 (DECISIONS 33): heading hierarchy can reach 12/12; SoftwareApplication and WebApplication count as content-level types.
- DONE 2026-10-26 (DECISIONS 36): freshness evidence carries the URL of the page the date came from.

## 2b. Blog drafts (content/blog)
- DONE 2026-10-07: `which-ai-crawlers-your-site-actually-serves.md` Reddit section rewritten to the 5 October hand check (200s were a JS challenge, 429s a zero-allowance refusal). Its publishedAt is 2026-10-06, already past: set the real date before running without --dry-run.
- DONE 2026-10-07: `one-ai-visibility-score-cannot-be-true.md` Otterly figures restored as a table; converts to one table block, 7 rows x 5 columns, cells checked.
- Both dry-run clean. Only warning: inline code (`/`, `*`) renders as plain text, which reads fine.

## 3. Group 4: mobile: DONE, live (cb0cb4c), verified at 375px.

## 4. Group 2: coherence
- DONE, live (71450e4, cc31b9b): SEO panel reduced to SEO basics (decision 28), Readability removed, agent top issues from the draft report only, Heading hierarchy Fix button.
- DONE 2026-10-26 (DECISIONS 36): Direct answers evidence is labelled and quotes the paragraph or sentence it describes (typeamedia.net).
- DONE 2026-10-27, engine 2026.14 (DECISIONS 37): a definition must open with its subject; typeamedia.net's "becoming an agentic business is an evolution for us" no longer counts.
- DONE 2026-10-27: the brief's meta description is measured and rewritten when outside 150 to 160 (28 of 30 stored briefs missed); a competitor-gap note used as a heading is caught after writing and only that heading is rewritten.

## 5. Sanity tables: DONE, live (02c18aa, DECISIONS 30). Final check pending: run a published post that has a table through save-audit.

## 6. Group 3: presentation and data
- DONE 2026-10-27 (5867365): the draft card states the 45 structure points scaled to 100; the section ties raw points to the score.
- (Fixed in 71450e4: empty meta description no longer passes.)
- (Resolved: Readability removed.)
- DONE 2026-10-27 (5867365): dashboard shows "Keyword: <target>" and "Project: <name>" instead of the bare project name.
- DONE 2026-10-27 (5867365): one word counter matching the editor (checked on all 26 stored articles); link apply recounts. Six stored counts were stale; they correct on next edit (a backfill would reorder the list by updated_at).
- DONE 2026-10-27 (69fd80c): /articles/new no longer flashes "Brand profile missing" while loading; reads the first brand profile like the dashboard.

## 7. Later
- MCP build (decisions 21–27; docs/mcp-server-spec.md): compare and history as the centrepiece, an unmetered usage tool, outputSchema, a claude.ai directory listing.
- Score-over-time storage (decision 29).
- Generator follow-ups: hype in brief titles; writer evidence handled per item.
- Prospect-report readiness fixes (docs/audits/prospect-report-readiness-2026-10-04.md).
