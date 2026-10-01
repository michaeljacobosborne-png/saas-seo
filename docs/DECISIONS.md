# Byline — decision log

**Every significant decision gets appended here, newest at the top. Sessions must read this file before proposing changes.** If a proposal contradicts an entry, say so explicitly and argue against the entry's "revisit if" condition rather than silently reversing it.

Format: title, date, decision, what drove it (with evidence), what would make us revisit it.

---

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
