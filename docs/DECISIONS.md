# Byline — decision log

**Every significant decision gets appended here, newest at the top. Sessions must read this file before proposing changes.** If a proposal contradicts an entry, say so explicitly and argue against the entry's "revisit if" condition rather than silently reversing it.

Format: title, date, decision, what drove it (with evidence), what would make us revisit it.

---

## 28. The SEO and Readability panels keep only checks with a real basis
**Date:** 2026-10-04 (Michael, from signed-in pass findings 5 and 10)
**Decision:** Audit every check in the editor's SEO and Readability panels and sort them into two piles:
- Keep genuine, verifiable constraints with a technical basis: title presence and length, meta description presence and length, canonical, indexability, internal linking, image alt text, and similar.
- Remove invented thresholds whose target cannot be justified with a source: heading-count targets, word-count targets, keyword-density-style checks and the like.
Retuning a conflicting target is not acceptable. The two piles are reported, with reasons for borderline checks, before anything is removed. The goal is a smaller panel that is right rather than a fuller one that contradicts the engine.
**Drivers:** The old panel wanted 2–4 H2s while Retrievable wants 6+, so following the product's own advice lowered the new score (finding 5). "2–4 H2 headings" is folklore with no evidence; picking a different number would only move the conflict. Readability showed 100/100 while its own metrics missed target (finding 10), the same problem.
**Revisit if:** a removed check can be shown, with a citable source, to affect indexing, retrieval or citation.

## 29. No ranking prediction; a projected score on our own rubric instead
**Date:** 2026-10-04 (Michael, from signed-in pass finding 11)
**Decision:** Ranking Prediction ("4–6 months to top 10, High confidence") and the traffic-per-position estimates are removed outright, not softened. They are replaced by a projected score: "fix these specific findings and Retrievable goes from X to Y". The projection is computed by the deterministic scorer on our own rubric, and lists each contributing finding with the points it would add. It is never expressed as time, traffic, position, or likelihood of being cited.
**Longer term:** the real replacement is score over time. Retrievable and Citable get plotted across months once monthly re-runs exist, annotated with what changed and when. That is the honest answer to "is this working" and the argument for a monthly subscription. Design for it now rather than retrofitting it: every stored score must carry engine version, date and the content state it scored, so the series can be drawn and annotated later.
**Drivers:** A months-to-top-ten forecast with a confidence level is a guarantee and contradicts the core invariant (nothing claims results we cannot measure). Arithmetic on our own rubric is fully defensible, specific, and entirely in the user's control.
**Revisit if:** never for ranking or traffic forecasts. The projection itself is revisited if the rubric changes in a way that makes a projected score misleading.

## 21–26. MCP server decisions (docs/mcp-server-spec.md §7), answered 2026-10-04

### 21. OAuth 2.1 is the target auth; API keys only as a cheap side effect
**Decision:** Build the MCP server on OAuth 2.1 (the MCP authorization spec), so it works as a claude.ai custom connector. A personal-API-key path may exist for developers and Claude Code, but only where it falls out of the same principal/entitlement layer at little cost. OAuth is what must work.
**Drivers:** The target user works in claude.ai Projects (decision 4's driver), where only OAuth connectors work. Shipping keys first and redoing it later is rework. This is the 31–48h path rather than 21–32h, accepted.
**Revisit if:** claude.ai starts accepting header-based credentials for custom connectors.

### 22. Crawler access test is free; audit, stored audits and comparison are paid
**Decision:** `check_crawler_access` is free. `run_audit`, `get_audit`/`list_audits` (stored history) and `compare_audits` are paid. Comparison is never free.
**Drivers:** The crawler test is cheap and is the clearest first value moment (the same reasoning as onboarding). Longitudinal comparison is the thing no competitor can do (decision 8), so it is the paid core.
**Revisit if:** free-to-paid conversion from MCP users is negligible.

### 23. Quotas: a happy medium, metered from day one
**Decision:** Generous enough to feel useful, not so generous that volume or abuse becomes the cost. Every call is metered regardless of plan. The exact numbers are proposed in the spec (§4) and await Michael's confirmation.
**Drivers:** About $0.001 per audit, so the real risk is volume and abuse, not per-call cost.

### 24. Include score_draft
**Decision:** `score_draft` ships: deterministic draft scoring for content written in Claude.
**Drivers:** It is the bridge between a practitioner's own Claude workflow and Byline's framework, at zero model cost.

### 25. Endpoint on a subdomain: mcp.bylineseo.com
**Decision:** The MCP server is served at `mcp.bylineseo.com`.
**Drivers:** A stable, product-named address independent of the app's host split.
**Needs:** a DNS record and a Vercel domain on the project (Michael).

### 26. MCP usage is recorded, never emailed
**Decision:** MCP calls and audits are recorded against the account and visible to Michael (admin), but never enter a GHL email, tag or nurture flow.
**Drivers:** Someone wiring up a developer tool is not a lead and must not be emailed as one.

### 27. MCP is a feature of existing plans for now, built to become its own product
**Date:** 2026-10-04
**Decision:** The MCP server is a feature of existing paid plans, not a separate product, for now. It is built with the explicit intention that it may become its own product later. Requirements:
- Every entitlement check routes through one place (`src/lib/mcp/entitlements.ts`), so moving MCP onto its own plan is a configuration change, not a rewrite.
- Usage is metered per account AND per key/client from the start, per tool, with enough detail (tool, target domain, outcome, duration, model cost) to price MCP separately later. Plan-level totals alone would make that impossible.
- The MCP surface depends only on the geo-audit library and the data layer, never on dashboard-specific code, so it can be split out without untangling.
- No plan names or tier assumptions in tool responses or error messages. Wording comes from the same entitlement module.
**Drivers:** Agencies can keep their own systems and workflows while Byline supplies the data and tracking underneath, which is the positioning the research pointed at (decisions 3–4).
**Revisit if:** meaningful MCP usage comes from accounts that do not use the dashboard, or agencies ask to buy the data layer without the rest of the product. Those signals mean it has become its own thing.

## 20. Manual SQL is always sent as plain text in the message
**Date:** 2026-10-01
**Decision:** Any SQL Michael must run by hand in the Supabase SQL editor is pasted in full, as plain text, in the reply at the moment the migration is created. A file path or a "see the repo" pointer is never enough on its own. Long SQL is split across messages rather than summarised. The status file notes each migration as pending until he confirms it is applied.
**Drivers:** Michael applies migrations from the Supabase SQL editor, often away from the repo, and could not find the migration files last time. The direct database host is IPv6-only, so these migrations cannot be applied from the dev machine.
**Revisit if:** migrations become automatically applied (for example by a CI step with database access).

## 13–19. Paid engine product decisions (docs/paid-engine-spec.md §7), answered 2026-10-01

### 13. Two scores in the editor, matching the free tool
**Decision:** The paid editor shows two scores, Retrievable (a number) and Citable (a band), as the free tool does. They are never blended into one number.
**Drivers:** The publish loop only pays off if the draft-time and published measurements are visibly the same kind of thing. A customer who runs a published article through the free tool must see the same framework the editor showed. Citability is heuristic, so a single blended number would be false precision.
**Revisit if:** customers consistently fail to understand two scores in usability testing.

### 14. GEO and AEO name the tools; Retrievable and Citable name the scores
**Decision:** The tools and pages stay titled GEO and AEO. The scores inside the product are Retrievable and Citable. Category terms live on the outside; the framework is the vocabulary inside. Apply this consistently in UI copy (`src/lib/score-labels.ts` holds the score names).
**Drivers:** People search for GEO and AEO and expect those words on the tool. Inside, two vocabularies for one concept is a support cost, so the scores use the framework's names everywhere.
**Revisit if:** search demand shifts to different category terms.

### 15. Drafts get their own breakdown; unpublishable checks are "not yet assessable", never missing marks
**Decision:** The draft breakdown reads as "what can be judged now" and "what is judged at publication". Anything that belongs to the domain or the published page (crawler access, server rendering, structured data, entity markup, publication dates) is reported as not yet assessable, with the reason. It is never a zero, a failure or a deduction. The 45-of-100 scope is stated inline, not in a tooltip.
**Drivers:** Michael: do not make it seem a draft will fail or succeed on things that are not there yet. Stating what cannot be known before publication is the differentiator, and hiding it would contradict the rest of the product.
**Revisit if:** usability testing shows the inline scope text is unread. Then shorten it; do not hide it.

### 16. No migration notice and no side-by-side period
**Decision:** Skip the score-change announcement and any old/new side-by-side display. Supersedes the earlier same-day answer to announce it, which was given before it was clear there are no active users.
**Drivers:** There are no active users whose numbers would move, so a notice would be addressed to nobody. The draft notice in `docs/notices/score-change-notice.md` is kept only as reference.
**Revisit if:** paying users exist before the new scores ship. Then announce rather than migrate quietly, because silently lowering numbers contradicts a product that sells honest measurement.

### 17. The byline is part of the draft, but a profile claim is an intention, not evidence
**Decision:**
- At draft time, named authorship is scored from the brand profile's author (`author_name`, `author_credentials`, `author_url`, migration `20261001_brand_author.sql`).
- The live audit must verify that the byline actually renders on the published page.
- A profile that claims an author while the published pages show none is itself a finding, and is reported as one.
**Drivers:** It is actionable at draft time, and entity consistency is a live concern for this product (see 10). Michael: it is not enough that a byline exists in the brand profile; it has to appear on the live articles. Evidence is what is on the page.
**Revisit if:** never, for "evidence is what is on the page". How the check detects a byline can change.

### 18–19. Rendering entitlement and live re-audit limits: post-MVP
**Decision:** Decision 6 (is JavaScript rendering a paid entitlement, and on which plan) and decision 7 (live re-audits per plan per month) are deferred until after MVP. Until then, paid runs stay raw-HTML only (see 6) and there is no publish-loop re-audit.
**Revisit if:** the publish loop (spec phase 4) is scheduled.

## 12. Draft-time score uses its own denominator; MIN_ASSESSED_SHARE stays 0.6
**Date:** late Sept 2026 (recorded 2026-09-30)
**Decision:** The paid engine scores drafts over a separate 45-point denominator (Chunkability 25 + Extractability 20), normalised to 0–100 and labelled structure-only. `MIN_ASSESSED_SHARE` is not lowered.
**Drivers:** Only 45 of the live engine's 100 Retrievability points are assessable before publication (Access and Parseability belong to the domain and the CMS template). Fed through the live totals, every draft would be withheld forever. Lowering the threshold would weaken the guarantee on the free tool, which is what prospects see.
**Revisit if:** the draft number and the post-publication number diverge enough that customers read them as contradicting each other.

## 11. Rate-limit bypass for the signed-in owner only
**Date:** 2026-09-30
**Decision:** The free tool's 3 runs/day limit is lifted only for the owner account, verified via `supabase.auth.getUser()` with a confirmed email. Everyone else keeps 3/day. Never an IP allowlist or a header anyone could send.
**Drivers:** Michael demos to prospects from one connection and hit the wall after three runs. An unauthenticated bypass on a public endpoint is how people end up with a bill.
**Revisit if:** other staff need to demo, or signed-in customers need a higher cap (then key it on user id, still authenticated).

## 10. Author identity consolidates on Michael Jacobs
**Date:** late Sept 2026
**Decision:** The canonical author name everywhere is "Michael Jacobs". LinkedIn deliberately stays "Michael Osborne", bridged by an explicit schema.org `sameAs` declaration rather than name matching.
**Drivers:** The Amazon author history cannot move without losing reviews and ranking, so everything else conforms to it.
**Revisit if:** the Amazon catalogue stops mattering commercially.

## 9. Scoring stays deterministic in code
**Date:** Sept 2026
**Decision:** The model writes prose only and can never set a score, status or grade. Scoring is additive internally and presented as deductions.
**Drivers:** The original engine let the model invent scores. It produced an 11-out-of-10 freshness score labelled "needs work", and recommended publishing fabricated traffic statistics.
**Revisit if:** never, for scores. Model-written prose can expand.

## 8. The gate
**Date:** Sept 2026
**Decision:** The free tool shows the score plus a few recommendations. Email unlocks the rest, plus a free monthly re-run.
**Drivers:** The re-run is the retention hook. Run at volume, it becomes a longitudinal dataset no competitor has, because everyone else sells one-shot audits or expensive monitoring. Cost is about $0.0011 per run.
**Revisit if:** email capture rate or re-run engagement is poor, or per-run cost rises materially.

## 7. GEO and AEO get separate pages, one engine
**Date:** Sept 2026
**Decision:** GEO and AEO get separate pages with two report presenters over one scoring core. Do not fork the scoring logic.
**Drivers:** People search the two terms separately.
**Revisit if:** search demand converges on one term.

## 6. Free tool is raw HTML only; rendering is paid
**Date:** Sept 2026
**Decision:** Free runs fetch raw HTML. JavaScript rendering is a paid entitlement. Content that only appears after rendering is reported as a finding, not offered as a setting.
**Drivers:** GPTBot and PerplexityBot do not execute JavaScript, so raw HTML is what those crawlers actually see, which makes raw the honest default. Rendering on every free run creates a per-run cost floor that scales with traffic. The rendered-only finding is the natural upsell.
**Revisit if:** the major AI crawlers start executing JavaScript.

## 5. Services as a capped wedge
**Date:** late Sept 2026
**Decision:** Done-for-you GEO work, for cash flow and as a live controlled environment for testing the repositioned product on real sites.
- Fixed scope, hard cap. Every engagement feeds the product and produces a case study.
- Offer: Citability Baseline, $2,500, ten business days, a day-45 re-test. No implementation, no retainer, no outcome guarantee.
- Sold to agencies that lack GEO capability.
- Capped at three engagements a month; evaluate after five.
**Drivers:** Cash flow, plus real-site testing the product cannot get otherwise.
**Risk recorded:** services revenue is valued at far lower multiples than SaaS ARR, against a roughly two-year exit horizon.
**Revisit if:** services crowd out product work, or after the fifth engagement.

## 4. Build an MCP server
**Date:** late Sept 2026
**Decision:** Expose Byline's data layer through an MCP server, so practitioners can use it from inside their own Claude workflow.
**Drivers:** Sophisticated practitioners keep their own Claude workflow and will pay for the data layer underneath it. The "overly hand-holding" beta feedback points the same way. Research shows a good skill chain beats a generation-first SaaS at producing content. It cannot do repeated sampling, twelve months of comparable history, or auditable client artefacts. This turns the sharpest criticism received into a product decision rather than a design problem.
**Revisit if:** practitioners won't pay for data access without the UI, or MCP adoption among the target market stalls.

## 3. Target market is freelance and in-house SEOs, not agencies
**Date:** late Sept 2026
**Decision:** The product's buyer is the freelance or in-house SEO. Agencies are the route to first services clients, which is a different thing from being the product's buyer.
**Drivers:** Agencies typically have their own SOPs, which is what the beta feedback demonstrated.
**Revisit if:** agencies show product (not services) buying intent at meaningful volume.

## 2. Positioning wording
**Date:** late Sept 2026
**Decision:** "Byline tells you, with evidence, whether AI systems can retrieve and cite your pages, and proves it changed." Explicitly NOT "an AI visibility platform", which is the crowded and discredited version.
**Drivers:** Semrush's own experiment found AI Mode citations of unchanged pages peaking at 59% and falling to 26% in three weeks. Forrester found 57% of buyer objections are disbelief rather than price. The objection to beat is disbelief.
**Revisit if:** buyer interviews show disbelief is no longer the main objection.

## 1. Reposition to GEO/AEO first, with measurement as the spine
**Date:** late Sept 2026
**Decision:** Byline is a GEO and AEO product that also handles traditional SEO, not an SEO content tool with GEO bolted on. Generation is demoted to a supporting feature.
**Drivers:**
- An agency head who beta tested it said a well-structured Claude project already did what his team needed, and that Byline felt overly hand-holding.
- Five beta testers all described Byline as an SEO article generator. Not one mentioned visibility or measurement.
- Every "this is useful" moment in the survey was the generated article, which is the commoditised half.
**Revisit if:** measurement proves to have materially lower willingness to pay than production tooling.
