# Plan: Byline's own site against Byline's own engine

Status: PLAN ONLY, nothing changed yet (2026-10-02). For review before any edit.
Measured with `scripts/save-audit.ts`; full reports are in `C:\Users\ozzy5\Documents\byline-audits\` (see INDEX.md).

## What was measured

| Page | Retrievable | Citable |
|---|---|---|
| bylineseo.com/blog (index), 2026-09-30 | 59 | Weak |
| bylineseo.com/blog (index), 2026-10-02 | 59 | Weak |
| Home (app.bylineseo.com) | 79 | Adequate |
| byline-vs-surfer-seo | 96 | Adequate |
| how-to-test-your-content-against-chatgpt-and-perplexity | 95 | Adequate |
| discover-the-best-ai-seo-tools… | 87 | Adequate |
| maximize-your-seo-strategy… | 85 | Adequate |
| discover-the-most-effective-surfer-seo-alternative | 82 | Adequate |

**There is no before/after yet.** The 2026-09-30 "before" run was taken after the structured data, the Person node and the author rename were already live, so both runs measure the same site. The real before/after starts from today's runs: re-audit the same eight URLs after the fixes below.

**The 59 is the blog index, not the blog.** It is a listing page with 206 words and no sections, so it scores low on structure by nature. The posts themselves score 82–96. The index is still worth fixing (item 6), but it is not evidence the posts are weak.

## Citability signals across all five posts

| Signal | Posts | Why |
|---|---|---|
| Named authorship | adequate ×5 | The byline and the Person node render ("Michael Jacobs"), but no experience is stated next to the name. **The rename works on the live pages.** |
| Entity resolution | weak ×5 | The Organization node has no `sameAs`. The engine reads Organization `sameAs` only, and the four profiles sit on the Person. |
| Brand-claim proximity | strong ×2, adequate ×1, absent ×2 | Two posts never name Byline inside a section that makes a claim. |
| Original evidence | adequate ×5 | Figures are present, but see item 1: most are unsourced. |
| Proprietary terms | adequate ×1, weak ×1, absent ×3 | Generic vocabulary. |
| Freshness and provenance | strong ×5 | Dates are present. |

## Fixes, in priority order

### 1. Unsourced statistics and results claims (credibility; do first)
Four of five posts state figures with no source link, and two state results claims about Byline users or named-but-unlinked case studies:
- surfer-seo-alternative: "Our users have seen … 200% traffic growth" (a heading); "A 2023 G2 user satisfaction report found 68%…"; "BrightLocal found 82%…"; "HubSpot found 70%…"
- best-ai-seo-tools: "A case study involving a tech startup showed a 50% increase…"; "According to a 2023 study by DataForSEO, 73% of marketers…" (this 73% also appears in the /blog card excerpt)
- maximize-your-seo-strategy: "HubSpot found … 20% increase in engagement"; "30% increase in search engine rankings"; "15% faster response time"; "40% improvement…"
- byline-vs-surfer-seo: "2024 HubSpot survey, 75%…"; "SparkToro … 59%…"; "BrightEdge … 58%…"; "Gartner … 25%…"; only the two pricing pages are linked.
- how-to-test (the strongest post): Ahrefs 28.3%, BrightEdge 68% and others. Check whether each is linked.

**Fix:** for every figure, find the primary source and link it, or delete the sentence. Delete any claim about Byline users' results unless it is backed by real customer data Michael can stand behind. Several of these read like model output from before decision 9; treat them as unverified until proven otherwise. This is the one item where doing nothing is worse than a lower score: a citability company publishing invented statistics is the exact objection decision 2 says we have to beat.

**Engine note (separate from this plan):** `original-evidence` currently rewards any figure whether or not it is sourced. These posts are scoring "adequate" partly on statistics that may be invented. Worth a decision: should an unlinked third-party statistic count as evidence? See "Engine findings" below.

### 2. Duplicate H1 on 4 of 5 posts
The Sanity body repeats the title as an `h1` block, and the page template already renders the title as the H1. Costs 2–3 Retrievable points per post (Heading hierarchy 9/12).
**Fix (code):** in `src/app/blog/_components/PortableTextBody.tsx`, render body `h1` blocks as `h2`, and drop one that repeats the title. The draft pipeline (`scripts/publish-draft.ts`) already does this for new posts.
**Fix (content):** remove the duplicate block from the four posts in Studio.

### 3. Author credentials next to the name (named authorship → strong)
The Sanity author document has a bio, but the post page does not render it, and the Person JSON-LD has no `jobTitle` or `description`.
**Fix:** render an author box on posts (name, one line of real experience, link to the profiles), and add `jobTitle`/`description` to the Person node in `src/lib/structured-data.ts`. The wording must be true; it must not be phrased to match the engine's credential patterns. Michael supplies the one-line credential.

### 4. Organization sameAs (entity resolution → adequate or better)
The Organization node has no `sameAs` because Byline has no company profiles that I know of. The four profiles are Michael's own and belong on the Person, not the Organization.
**Needs Michael:** does Byline have, or want, any company profiles (LinkedIn company page, an X account for Byline, a Product Hunt, G2 or Crunchbase listing)? Adding real ones is a config change in `structured-data.ts`. Do not point the Organization at personal profiles to lift the score.

### 5. Brand-claim proximity on two posts
how-to-test and surfer-seo-alternative never name Byline inside the sections that make claims.
**Fix (content):** where Byline is genuinely the subject of a claim, name it in that sentence. Do not add it to sections where it does not belong.

### 6. The /blog index (59)
- 206 words with no sections, so no Chunkability or Extractability to speak of.
- The canonical points to app.bylineseo.com from bylineseo.com (−2): the host split.
**Fix:** a short intro under the H1 that says what the blog covers and for whom (two or three self-contained sentences); optionally two or three question-phrased sections, but only if they carry real content.
**Needs Michael:** the domain decision. bylineseo.com serves pages with a canonical pointing at app.bylineseo.com. Either redirect bylineseo.com → app (or the reverse), or accept the split.

### 7. Homepage (79)
- No content-level schema type. Add FAQPage only if a real visible FAQ is added, or otherwise a Service/Product description.
- No question headings.
- No first-party figures.
- No proprietary terms.
**Fix:** a short visible FAQ answering real questions ("What is a Retrievable score?", "Does Byline measure whether ChatGPT cites me?" — answer: no, and here is why), which also restates the positioning (decision 2). First-party figures only where they are true, e.g. counts from the audit archive once it has volume.

## Engine findings exposed by auditing ourselves
Not part of this plan's edits; recorded so they are not lost.
- `entity-resolution` ignores the Person node's `sameAs`, so a site that resolves its author perfectly still reads "weak" without company profiles. Arguably correct (the signal is about the brand entity), but the detail text should say Person `sameAs` was seen and is not what this signal measures.
- `original-evidence` cannot tell a sourced statistic from an invented one. Candidate: count a figure as evidence only when an outbound link or citation sits in the same block; report unsourced figures as a finding.
- The free-tool rate limit and the archive script both treat bylineseo.com and app.bylineseo.com as different domains. That is fine for now, but it matters for longitudinal comparison.

## How we will know it worked
Re-run `npx tsx scripts/save-audit.ts <url>` for the same eight URLs after each batch, and compare against today's rows in INDEX.md. Items 2 and 3 should move Retrievable on the posts by about 3 points and Citable named authorship to strong. Item 1 may lower "original evidence" where unsourced figures are removed. That is the honest outcome, and it should be reported as such.
