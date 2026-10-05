# Byline build backlog

Created 2026-10-05. Ordered by priority; nothing starts until the item above it is done unless noted. The reasoning behind the items lives in `docs/DECISIONS.md`. Day-to-day progress is in Michael's status file (`Documents\byline-status.md`).

**Authoritative copy:** `master` on GitHub (`michaeljacobosborne-png/saas-seo`). Locally that is the worktree `C:\dev\byline-crawler`. `C:\dev\Byline` is on an older feature branch (`geo-analyzer-accuracy`) and does NOT have these docs. A readable mirror of the decision log is kept at `C:\Users\ozzy5\Documents\byline-DECISIONS.md`.

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

## 3. Group 4: mobile
- Done in code: article toolbar, agent panel, headers, tables at 375px. Push and live verification pending.

## 4. Group 2: coherence
- SEO/Readability panel audit (decision 28). The two piles have been reported; awaiting approval of the piles, the additions, and whether SEO becomes a pass/fail checklist with no number.
- Agent "top issues" should come from the weakest Retrievable/Citable items, not the old SEO breakdown.
- Direct answers evidence must quote the paragraph it describes.
- Folded in:
  - Heading hierarchy shows +4 in the projection with no Fix button.
  - The brief meta description came out at 99 characters.
  - A competitor-gap note becomes a heading verbatim.

## 5. Sanity tables (approved by Michael)
- Build a custom table object in the post body schema (header row + data rows), not the plugin.
- Render it as semantic `<table><thead><th>`, never a div grid.
- Convert markdown tables in the drafting pipeline into the block.
- Verify by running a published page through our engine: the table must be credited under extractability.
- Record the reasoning in DECISIONS.md.

## 6. Group 3: presentation and data
- The card shows 78/100 next to "45 of 100".
- An empty meta description field scores 10/10 (the check reads the brief, not the field).
- Readability scores 100 while missing its own targets (resolved by item 4).
- Wrong keyword shown on the dashboard.
- Word count differs between the list and the panel.
- /articles/new briefly shows "Brand profile missing".

## 7. Later
- MCP build (decisions 21–27; docs/mcp-server-spec.md): compare and history as the centrepiece, an unmetered usage tool, outputSchema, a claude.ai directory listing.
- Score-over-time storage (decision 29).
- Generator follow-ups: hype in brief titles; writer evidence handled per item.
- Prospect-report readiness fixes (docs/audits/prospect-report-readiness-2026-10-04.md).
