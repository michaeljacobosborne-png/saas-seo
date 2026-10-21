# Generator rework: what it produces now

Date: 2026-10-05. Implements all twelve changes in `generator-audit-2026-10-02.md`, approved by Michael 2026-10-04. Governing rule, stated in every writing prompt and enforced in code: **the article keeps only real citable information, or information the user supplied directly for that piece.**

## What changed
- Prompts moved to `src/lib/generator/prompts.ts`, with tests.
- Removed:
  - "Industry benchmarks show…"
  - "What We Found After Testing… even if based on secondary sources"
  - "add a case study" to reach length
  - "add statistics" in expansion
  - one stat per H2
  - "never a definition" intros and 80–120-word hooks
  - "start with the # H1"
  - "exactly N words"
- `evidence-guard.ts` runs on every draft. Any of the following without a supplied source becomes a visible `[ADD EVIDENCE: …]`:
  - figures and unnamed authority
  - sources nobody supplied, and quotes
  - case studies
  - stand-in products ("Tool A") and their table values
  - brand superlatives and brand product facts
- Structure repairs that move text without rewriting it:
  - body H1 removed
  - the brief's planned answer put first if the draft opens on a heading
  - an over-long opening split after its answer
  - bare question lines made into ### headings
- Rule of three and banned words are found deterministically, then rewritten (two rounds).
- Engine gate: the draft is scored with `buildDraftReport`, then gets one targeted block-edit revision covering the failing structure checks and any supplied evidence the draft left out. The revision is kept only if Retrievable does not drop.
- New "Evidence for this article" field when generating, stored as `brief.user_evidence`. `brief.generation_report` records every replacement.
- The blog renderer drops a leading body H1 and demotes others, for existing posts.

## Before and after (Byline's own brand profile, no author set)
Before: the five published posts (audit 2026-10-02, live engine). After: the final pipeline run on 2026-10-04/05, scored by the draft engine. The draft score covers structure only, so the numbers are indicative, not like-for-like.

| | Before | After |
|---|---|---|
| Invented statistics | 4 of 5 posts | 0 in final runs (guard caught 8 stand-in-product claims in one) |
| Invented product facts | "$99/month" for Byline | none survive; "integrates with Google Analytics" was caught |
| Duplicate H1 | 4 of 5 | none |
| Direct answers | 2/10 on 3 of 5 | 10/10 on all 3 final runs |
| Retrievable | 82–96 (live) | 80, 84, 87 (draft) |
| Rhetorical triads | 29, 21, 10, 9, 3 | 0–2 left after the rewrite |
| Supplied evidence used | no mechanism | Ahrefs figure quoted with its link |

Samples: `C:\Users\ozzy5\Documents\byline-audits\generator-samples\`.

## Known limits
- Claims without a figure ("structured data can significantly boost visibility") are not caught. The guard checks provenance markers, not truth.
- Runs vary: one intermediate run scored 53 before the opening and heading repairs.
- Citable stays Weak or Absent without an author, owned terms or supplied evidence. That is correct: the generator cannot manufacture these.
- Writer-supplied evidence counts as one item, so a second fact in the same text can still be left out.
- The comparison article's table is mostly placeholders when no products are supplied. Honest, but not publishable until filled.
