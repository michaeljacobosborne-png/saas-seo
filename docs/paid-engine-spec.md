# Paid-product engine: bringing the real analyzer into the editor

**Status:** phases 1–2 built and deployed 2026-09-30 (`src/lib/geo-audit/adapt-markdown.ts`,
`draft-report.ts`, `GET /api/articles/[id]/draft-report`, `scripts/draft-report.ts`). Not yet
shown in the editor: phase 3 waits on the §7 product decisions. Decided: separate draft-time
denominator (45); `MIN_ASSESSED_SHARE` stays 0.6. Deviation from §2.2: the adapter renders
markdown with `marked` (already a dependency, a real GFM parser) and runs the live
`extractPage()` on the result, which removes adapter/extractor divergence by construction.
**Branch:** merged to `master`.
**Author:** written from the code as it stands at master `4a19e20`, not from assumption.

---

## 0. Why this exists

The free GEO analyzer at `/audit` runs `src/lib/geo-audit/` — deterministic
scoring, three factor states, evidence on every finding, a two-score model,
withheld scores when the evidence is thin. 165 tests hold it in place.

The paid product does not use any of it.

Paid GEO and AEO scores come from `src/lib/article-scoring.ts`: nine regular
expressions over a markdown string. `computeGEO` is five checks worth 20 points
each — a definition in the first 500 words, three or more H2s, a stat keyword,
an FAQ heading, 1,500+ words. `computeAEO` is four checks — H3 questions (40),
a 40–80 word paragraph (30), lists (15), takeaways (15). No evidence, no
unverified state, no withholding, binary pass/fail, and a round number that
looks more precise than it is.

**So a paying customer currently gets worse analysis than an anonymous free
user.** That is the finding that should drive the sequencing below. It is not a
missing feature at the end of a roadmap; it is an inversion, and it should close
early. Phases 1 and 2 close it. Phases 3 and 4 build on top of a product that is
no longer upside-down.

A secondary consequence worth naming: the two engines disagree about the same
content by construction. A customer who publishes a Byline article scoring
GEO 80 and then runs that URL through the free tool can be told something quite
different. Today nobody has noticed because nobody does both. Outreach makes
people do both.

---

## 1. Invariants carried forward

These are the nine from `ARCHITECTURE.md § Invariants`, which `npm test`
enforces for the free engine. **They apply unchanged to the paid engine.** Where
draft-time work stresses one, that is noted.

1. **Scoring is deterministic and in code. The model cannot set a score, status
   or grade.** It writes recommendation prose from already-scored factors and
   nothing else. This is the one the editor will push hardest against, because
   an editor invites "ask the AI to rate my draft". The answer stays no. The
   model may explain a score; it may never produce one.
2. **Three factor states only** — `present` / `absent` / `unverified`. Partial
   presence is the score's job. An unrecognised status must never default to
   "needs work".
3. **`status` is always derived** from the score ratio via `deriveStatus()`.
4. **Unverified factors are `scored: false`, report `score: 0`, and are excluded
   from totals.** Draft-time work leans on this constantly (§3). The UI shows
   `—`, never `0/15`.
5. **Score maths:** `rawScore = Σ scored factor.score`, normalised over
   `assessedMaxScore`; withheld below `MIN_ASSESSED_SHARE` (0.6). Every consumer
   checks `scoreWithheld` before displaying `score`. See §3.2 — as written this
   withholds on every draft, and that is a real design problem to solve, not a
   threshold to quietly lower.
6. **Every finding carries `evidence[]`** — `{ url, kind, snippet }`. At draft
   time there is no URL; §2.4 covers what goes in that slot.
7. **Dates compare against `opts.now`**, never a hard-coded year.
8. **No unsupported promises.** `sanitiseImpact()` drops impact lines containing
   a digit or a guarantee claim. This is a heuristic assessment of content
   readiness, **not** a measurement of AI visibility, and **nothing in the paid
   UI may claim otherwise** — including the marketing-adjacent surfaces in §4.3
   that currently do.
9. **Report discriminator is `tool`, not `type`.**

Two of these the user has called out specifically, so to be unambiguous: **the
model never sets a score**, and **nothing claims actual AI visibility**. Every
phase below is written to keep both true, and both should be test-enforced in
the paid path the same way they are in the free one.

---

## 2. Phase 1 — The adapter

**Goal:** turn a markdown draft into the same `ExtractedPage` the engine already
consumes, so `scoreRetrievability()` and `assessCitability()` run unchanged.

New file: `src/lib/geo-audit/adapt-markdown.ts`, exporting
`adaptMarkdown(md: string, meta: DraftMeta): ExtractedPage`.

### 2.1 What is reused

Everything downstream. `score-retrievability.ts`, `assess-citability.ts`,
`gap.ts`, `scoring.ts`, `narrate.ts`, `types.ts` — no changes. That is the whole
point of the adapter shape: the engine does not learn about drafts, the draft
learns to look like a page.

`extract.ts` helpers are reused directly where they operate on text rather than
on cheerio nodes — `normalise()` (including its private-use-area stripping),
the statistics detector, and the `ContentBlock` construction rules. Reuse these
rather than reimplementing, or the two paths will drift on exactly the edge
cases that took the longest to get right.

### 2.2 What is new

A markdown parser and the field mapping. Recommend `remark`/`mdast` over a
regex pass — the engine's whole premise is that we parse structure properly
rather than pattern-match at it, and hand-rolled markdown regex would reintroduce
the class of bug the rewrite removed. `remark-parse` + `remark-gfm` gets tables
and strikethrough; both are already transitive dependencies in most Next
toolchains, to be confirmed at build time rather than assumed.

### 2.3 Fidelity: what markdown gives us, and what it cannot

This is the part worth being concrete about, because it decides §3 entirely.

**Recovered faithfully — arguably better than from HTML:**

| `ExtractedPage` field | Source | Note |
|---|---|---|
| `headings` | ATX/setext | Cleaner than HTML. No CSS-class ambiguity — a `##` is an H2, full stop. This is the bug class that broke the old free engine, and markdown is immune to it. |
| `paragraphs`, `mainText`, `bodyText`, `wordCount` | text nodes | No nav/footer/cookie-banner contamination to strip. |
| `lists`, `tables` | list/GFM table nodes | Exact. |
| `links`, `outboundCitations` | inline + reference links | Exact; external classification by hostname as today. |
| `boldTerms` | `**` / `__` | Exact. |
| `blocks` (`ContentBlock[]`) | heading→content tree | Reconstructed from the mdast tree. Feeds Chunkability and brand-proximity. |
| `statistics` | regex over text | Same detector, same results. |

**Partially recovered — usable, with lower confidence than the HTML path:**

- `images` — alt text is present and that is what we score; `src` is often a
  placeholder or relative path in a draft. Score alt, ignore src.
- `testimonials` — the HTML detector (`findFeedbackSections`) works by finding
  the smallest element containing both a feedback marker and a role attribution,
  which depends on element nesting markdown does not have. A blockquote plus a
  following attribution line is a weaker but workable proxy. Expect lower
  recall; report `unverified` rather than `absent` when ambiguous.
- `dates` — only prose dates ("updated March 2026"). No `dateModified`. See
  below.

**Not recoverable at all — these belong to the publication layer:**

| Field | Why |
|---|---|
| `url`, `canonical` | The draft has no URL yet. |
| `metaDescription` | Does not exist pre-publish; not a column on `articles`. |
| `lang`, `metaRobots` | Emitted by the CMS template. |
| `structuredData`, `structuredDataTypes`, `jsonLdBlocks` | Schema markup is the template's job. A draft never carries JSON-LD, so a draft can never be scored on it. |

`title` is the one genuine borderline: `articles.title` exists as a column, so
the adapter can populate it from the record rather than the markdown. Do — but
mark it as coming from the draft record, because the published `<title>` is the
template's to mangle and they routinely differ.

### 2.4 Evidence without a URL

Invariant 6 requires `{ url, kind, snippet }` on every finding. At draft time
there is no URL. Rather than weaken the type, set
`url: 'draft:<article-id>'` and add evidence kinds that carry a **line number**
in the snippet prefix, so the editor can scroll to the finding. This keeps the
invariant intact, keeps one `Evidence` type across both paths, and makes the
draft-time report strictly more actionable than the published one — the customer
can jump to the exact line.

### 2.5 Effort

**2–3 days.** One day for the parser and mapping, one for the fidelity edge
cases above, half a day of tests. Test strategy: take existing HTML fixtures,
hand-write the markdown equivalent, assert the adapter produces the same
Chunkability and Extractability scores from both. That equivalence test is the
adapter's real specification and should be written first.

### 2.6 Per-run cost

**Zero marginal cost.** No fetch — the content is already in hand. No model
call. Pure CPU, single-digit milliseconds. The adapter itself never becomes a
cost line.

### 2.7 Risks

- **Low.** The adapter is pure, synchronous and fully testable, with no network
  and no model.
- The one real risk is silent divergence: the adapter produces a subtly
  different `ContentBlock` split than `extract.ts`, and the two paths disagree
  about the same content. The equivalence tests in §2.5 are the mitigation, and
  they are not optional.
- Markdown in the wild is messier than markdown in tests — raw HTML blocks
  inside markdown are legal and common. Decide explicitly: parse embedded HTML
  via the existing cheerio path, or ignore it and report the section as
  partially unverified. Recommend the latter for v1; it is honest and cheap.

---

## 3. Phase 2 — What a draft-time report says

**Goal:** an honest report on something that is not yet a page.

### 3.1 What can and cannot be assessed pre-publication

Mapping §2.3 onto the engine's four Retrievability groups:

| Group | Max | Draft-time | Why |
|---|---|---|---|
| **Access** | 30 | **Entirely unverifiable** | robots.txt, AI-crawler policy, sitemap, status codes are properties of the *domain*, not the draft. Nothing in a markdown file can inform any of it. |
| **Parseability** | 25 | **Largely unverifiable** | JSON-LD validity, metadata, canonical — all template-emitted. |
| **Chunkability** | 25 | **Fully assessable** | `chunk-hierarchy` (12), `chunk-sections` (8), `chunk-lengths` (5) all read the heading tree and block lengths, which markdown gives us exactly. |
| **Extractability** | 20 | **Fully assessable** | `extract-answers` (10), `extract-questions` (6), `extract-density` (4) read text, questions, lists and tables. |

**This is the structural finding of the whole spec, so it should not be buried:
assessable draft-time points total 45 of 100. `MIN_ASSESSED_SHARE` is 0.6.
Feeding a draft through `scoreRetrievability()` unchanged therefore withholds
the score on every single draft, forever.** The engine would be behaving exactly
as designed and returning nothing useful.

The wrong fix is lowering the threshold — that weakens the guarantee on the free
path, which is the one facing prospects. The right fix is that **draft-time
Retrievability is scored over its own denominator of 45**, normalised to 0–100,
and labelled as what it is: structure only. `MIN_ASSESSED_SHARE` then applies
within that denominator, so a draft too thin to assess still withholds
correctly.

That is an engineering recommendation with a product decision attached, and the
product half is Michael's — see §7.

Citability degrades much more gracefully, because it is banded rather than
summed, so an unverified signal costs nothing structurally:

| Signal | Draft-time |
|---|---|
| `brand-proximity` | **Fully assessable** — measured per block over body text. |
| `original-evidence` | **Fully assessable** — statistics, tables, first-party data in the body. |
| `proprietary-terms` | **Fully assessable** — coined terms in the body. |
| `named-authorship` | **Unverified** unless the adapter injects the author from the brand profile. Product decision: is the byline the draft's or the template's? |
| `entity-resolution` | **Largely unverified** — depends on Organization/Person JSON-LD and `sameAs`. |
| `freshness-provenance` | **Unverified** — needs `dateModified`/`datePublished`. |

Three of six fully assessable, banded honestly, no denominator problem. **This
is the draft-time product**: Citability is where a writer has almost all the
control and currently gets none of the feedback, and it is the half the existing
`computeGEO`/`computeAEO` do not model at all.

### 3.2 A trap worth writing down

`Parseability` includes a **text-to-markup ratio** check. Markdown is nearly
pure text, so it would score a spurious perfect mark. Do not let that check run
on the adapter's output — mark it `unverified` explicitly. A check that is
accidentally flattering is worse than one that is missing, because it is
invisible. This is exactly the failure mode the free-engine rewrite existed to
remove, and it would walk straight back in through the adapter.

### 3.3 The headline number

The flagged product decisions, stated rather than made (§7 collects them):

- Does the editor show one draft-time number, or the two-score model?
- If two: "Structure 78 / Citable: Adequate" is honest and matches what the
  customer will later see at `/audit`. It also means the editor stops showing a
  single reassuring number, which is a real change to the product's feel.
- What replaces the current GEO and AEO bars — and do those names survive at
  all? The free tool says Retrievable/Citable. Two vocabularies for one concept
  across two surfaces of one product is a support cost.

The engineering recommendation, for what it is worth: **match the free tool's
vocabulary exactly.** The publish loop in §5 only pays off if the draft-time
number and the published number are visibly the same measurement.

### 3.4 Reused vs new

Reused: the entire scoring layer, `SignalBuilder`, `overallBand`, `gap.ts`,
`findScoreInconsistencies`, `findBandInconsistencies`.

New: a `DraftReport` variant of `AuditReport` (`tool: 'draft'`), the 45-point
denominator, the per-group `contentReadable`-style gating that marks
publication-layer checks unverified, and a "what we can't know until you
publish" panel — the draft-time analogue of chain-of-custody, and a natural
place to pre-sell the publish loop.

### 3.5 Effort

**3–4 days**, most of it in the honest-reporting details rather than the
scoring, plus the copy for the unverifiable panel.

### 3.6 Per-run cost

**Zero for scoring.** The cost question is prose. The editor re-scores on save,
so if recommendation narration runs per score, an article edited forty times
costs forty model calls. Mitigations, in order of preference: score
deterministically on every save and narrate only on explicit request; cache
narration keyed by a content hash; debounce hard. **Deterministic scoring must
never be gated behind the model call** — that is invariant 1 expressed as
architecture rather than policy.

### 3.7 Risks

- **Medium, and mostly product rather than technical.** The customer's article
  scores 78 today and 61 tomorrow under a stricter and more honest engine. That
  is correct and defensible, and it will still generate support tickets. Needs a
  migration note and probably an in-app explanation.
- The 45-point denominator is a genuine judgement call. It is defensible and it
  must be **visible** — the customer should be told the draft-time number covers
  structure and attribution only, and that Access and Parseability are scored
  after publication.
- `articles.scores` is typed `ArticleScores` with fixed `geo`/`aeo` keys. Either
  widen the type with an optional richer field, or migrate. Recommend widening:
  old rows keep rendering, same backwards-compatibility approach that worked for
  the audit rows.

---

## 4. Phase 3 — Wiring the editor

**Goal:** replace the two bars and the breakdown panels with evidence-backed
detail, and update **every** surface that reads these scores.

### 4.1 The complete inventory

Verified by grep across `src/`, not from memory. Eight surfaces:

| # | File | What it does |
|---|---|---|
| 1 | `src/lib/article-scoring.ts` | `computeGEO`, `computeAEO`. The source. |
| 2 | `src/app/api/articles/score/route.ts:48-56` | Calls both, assembles `ArticleScores`, persists. |
| 3 | `src/app/api/articles/analyze/route.ts:95-105` | Calls both again on the analyze path. **Two entry points computing the same scores — consolidate while we are here.** |
| 4 | `src/app/(dashboard)/articles/[id]/page.tsx:1504-1567` | The bars and the GEO/AEO Breakdown panels. The main event. |
| 5 | `src/app/(dashboard)/articles/page.tsx:143-145` | The AEO pill in the list. |
| 6 | `src/app/(dashboard)/articles/import/page.tsx` | Scores imported content. |
| 7 | `src/app/api/articles/[id]/agent/route.ts:158-168` | Reads `scores.{seo,geo,aeo}.breakdown` and builds a "weak areas" prompt section via `buildFailedList`. **Depends on the binary `passed: boolean` shape** — richer factors break it silently, and it is an AI path, so a silent break produces plausible-sounding wrong guidance rather than an error. |
| 8 | `src/lib/support-kb.json` | Customer-facing support answers describing GEO/AEO, including implementation detail ("stat detection uses regex for keywords like 'according to'…") and pointing at `/api/articles/score/route.ts`. **Stale the moment this ships.** |

The new-article flow (`articles/new/page.tsx:453`) calls `/api/articles/score`
rather than computing its own, so it inherits #2 and needs no scoring change —
but it carries its own completion copy at line 1105 ("SEO scores, and ranking
predictions") which falls under the §4.3 audit.

Number 7 is the one most likely to be missed and the most expensive to miss.
Number 8 is the one nobody thinks of, and it is customer-facing.

### 4.2 Reused vs new

Reused: `TwoScoreSection.tsx` already renders retrievability groups, citability
signals and the Gap with self-contained inline styles specifically so it could
be dropped into a second host. It was built for `/report` and
`/audit/results/[id]`; the editor can be its third host. Evidence rendering,
withheld handling and the `—`-not-`0` rule all come free.

New: editor-specific interaction — clicking a finding scrolls to the line
(§2.4), which the report pages have no equivalent of. `buildFailedList` needs
rewriting against the richer shape, and it should be given a test, because a
silently-wrong agent prompt is the worst failure mode in the inventory.

### 4.3 Copy audit

Invariant 8 applies to every surface touched. The paid UI has never been
audited against it — it predates the invariant. Budget time to read every string
in #4, #5 and #8 for AI-visibility claims and unsupported promises, and run the
`FORBIDDEN_GAP_CLAIMS` patterns from `gap.ts` over the paid copy as a test. The
support KB line "scores how well your article is structured to be cited" is on
the right side of the line; not everything around it will be.

### 4.4 Effort

**4–5 days.** The editor panel is the bulk. Add a day for the copy audit and
`buildFailedList`.

### 4.5 Per-run cost

Unchanged from Phase 2, assuming §3.6's caching. The consolidation of #2 and #3
removes a duplicated scoring path.

### 4.6 Risks

- **Highest-risk phase**, because it is the largest blast radius across live
  paid surfaces.
- #7 is a silent-failure path. Test it.
- `ArticleScores` is persisted JSON. Every consumer must tolerate both shapes
  during rollout. Same optional-field discipline as the audit rows.
- The list-view pill (#5) needs a decision for withheld scores — a blank pill
  is fine, `0` is not.

---

## 5. Phase 4 — The publish loop

**Goal:** draft scores well, gets published, the live engine audits the URL and
confirms it. The customer sees before and after.

This is the phase that makes the product coherent rather than merely accurate.
It is also the one that turns the §3.1 limitation into the feature: the draft
report says *"Access and Parseability are scored once this is live"*, and then
they are.

### 5.1 Shape

`articles.published_url` already exists — the hook is in place. On publish (or
on demand), run the existing live engine against that URL, store the result, and
show the delta: structure held, attribution held, and here is what only
publication could reveal — the crawler policy, the schema markup, the canonical.

### 5.2 Reused vs new

Reused: the entire live engine, unchanged. Rate limiting (`rate-limit.ts`),
promoted columns, `TwoScoreSection`.

New: a trigger (publish webhook, or a button — a button is cheaper and more
honest for v1), a table or columns linking an article to its published audit,
and the before/after view. Entitlement needs a decision: **rendering is gated as
`FREE_TIER_NO_RENDER` on the free path, and paid customers are exactly who
should get rendering.** This phase is where that gate earns its money, and where
the render provider (Firecrawl/ScrapingBee, both already adapter-ready in
`fetch.ts`) actually gets switched on.

### 5.3 Effort

**3–4 days** without rendering. Add 1–2 days and a vendor decision with it.

### 5.4 Per-run cost

**The only phase with a real per-run cost.** A live audit fetches the page plus
robots.txt plus llms.txt, capped at `MAX_FETCH_BYTES` (2MB), and makes one model
call for prose capped at `MAX_MODEL_INPUT_CHARS` (60,000). Comparable to a free
audit today. Rendering, if enabled, adds a per-page vendor charge — that is a
genuine unit-cost line against the subscription and needs a per-plan cap.
Recommend metering re-audits per plan from day one rather than retrofitting a
limit after someone loops it.

### 5.5 Risks

- Publishing is outside our control. The customer's CMS may not have deployed,
  may 404, may serve a shell. The engine already handles all three honestly
  (incomplete audit, score withheld) — do not paper over it with a retry that
  hides a genuine 404.
- The before/after invites the strongest version of the forbidden claim. The
  copy must say structure and attribution improved. It must not say the article
  is now being cited. `FORBIDDEN_GAP_CLAIMS` should be run over this surface's
  copy as a test, exactly as it is over the Gap.

---

## 6. Sequencing and totals

| Phase | Effort | Closes the inversion? |
|---|---|---|
| 1 — Adapter | 2–3 days | Prerequisite |
| 2 — Draft report | 3–4 days | **Yes** |
| 3 — Editor wiring | 4–5 days | Makes it visible |
| 4 — Publish loop | 3–4 days (+1–2 with rendering) | Extends it |

**12–16 working days**, plus rendering. Estimates assume the existing test
discipline holds; they do not assume anything goes wrong.

Phases 1 and 2 are the ones that matter most and carry the least risk. They are
also independently shippable behind a flag — the draft report can exist
alongside the old bars before Phase 3 replaces them. Recommend building 1 and 2,
reviewing a real draft report against a real article, and only then committing
to 3.

---

## 7. Open product questions — for the market-research session

These are decisions, not engineering unknowns. Flagging rather than guessing.

1. **One number or two in the editor?** Two is honest and matches `/audit`. One
   is what customers are used to and what the UI is built around.
2. **Do "GEO" and "AEO" survive as names in the paid product,** or does
   everything become Retrievable/Citable? Two vocabularies for one concept is a
   support cost; renaming is a migration and a marketing change.
3. **Is the draft-time denominator explained to the customer, or just the
   number shown?** Engineering recommends explaining it. It is a slightly worse
   first impression and a much better second one.
4. **Existing customers' scores will move, mostly down.** Announce, migrate
   quietly, or show both for a period?
5. **Is the byline part of the draft or the template?** Decides whether
   `named-authorship` is assessable at draft time (§3.1) — this is the highest
   single lever a writer has on Citability, so it matters more than it sounds.
6. **Does rendering become a paid entitlement now** (§5.2), and at which plan?
   It has a real per-page vendor cost.
7. **How many live re-audits per plan per month?** Needs a number before Phase 4
   ships, not after.
8. **Does the free tool stay deliberately weaker than the paid one,** or is the
   free tool the top of the funnel precisely because it is good? Currently it is
   the better product, which is the inversion this spec exists to close — but
   "close it by improving paid" and "close it by trimming free" are different
   businesses.

---

## 8. Note on this file's location

`docs/paid-engine-spec.md` is **not** gitignored and is safe to commit. Flagging
one interaction: the pending history purge targets `docs/build-history/`. If
that purge adds `docs/` wholesale to `.gitignore` rather than the narrow
`docs/build-history/` rule, this spec silently stops being tracked. Use the
narrow rule.
