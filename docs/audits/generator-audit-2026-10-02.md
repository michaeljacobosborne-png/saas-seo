# Byline's article generator, judged by Byline's own engine

Date: 2026-10-02. Diagnosis only; nothing in the generator has been changed.
Engine: live `runAudit` via `scripts/save-audit.ts`. Full reports are in `C:\Users\ozzy5\Documents\byline-audits\app.bylineseo.com\` (INDEX.md rows dated 2026-10-02).

Context (Michael, 2026-10-02): the five published posts are generator output he selected as representative while testing whether the generator could build a blog. They scored well on the old regex model, particularly on SEO. They are a legitimate test of what the generator produces. There is no before/after in these numbers: every run used today's engine on the current pages.

---

## Part 1: every published article

| Article | Retrievable | Citable | Gap | Biggest weaknesses, with evidence |
|---|---|---|---|---|
| byline-vs-surfer-seo | 96 | Adequate | Easy to use, hard to credit | (1) Two H1s: the body repeats the title. (2) Unsourced figures: "According to a 2024 HubSpot survey, 75% of content marketers…", plus SparkToro 59%, BrightEdge 58%, Gartner 25%; only two pricing pages are linked. (3) Entity resolution weak: the Organization has no sameAs. |
| how-to-test-your-content-against-chatgpt-and-perplexity | 95 | Adequate | Easy to use, hard to credit | (1) Opening paragraph is 497 chars (target ≤300). (2) Brand-claim proximity absent: "Byline" is in none of 14 substantive sections. (3) Proprietary terms absent. |
| discover-the-best-ai-seo-tools… | 87 | Adequate | Easy to use, hard to credit | (1) Direct answers 2/10: 436-char opener, no definition sentence. (2) Two H1s, only 4 H3s. (3) Unsourced or invented claims: "a 2023 study by DataForSEO, 73% of marketers…"; "A case study involving a tech startup showed a 50% increase…"; and a wrong product fact about Byline itself: "Byline SEO … Pricing starts at $99/month" (real: from $49). |
| maximize-your-seo-strategy… | 85 | Adequate | Easy to use, hard to credit | (1) Direct answers 2/10: 412-char opener, no definition sentence. (2) Two H1s; 44% of sections in the 40–180 band (target 65%). (3) "According to industry benchmarks, companies implementing AI tools have seen an average 30% increase in organic traffic within six months": the exact phrasing the draft prompt suggests (see Part 2). |
| discover-the-most-effective-surfer-seo-alternative | 82 | Adequate | Easy to use, hard to credit | (1) Direct answers 2/10: 704-char opener. (2) Brand-claim proximity absent. (3) Invented results heading: "Real Results: How Our Users Achieved 200% Traffic Growth", plus unrelated keyword-filler questions ("Is Wix Good for SEO?", "Are Internal Links Good for SEO?") on a comparison page. |

For reference: the /blog listing page scores 59 / Weak and the home page 79 / Adequate. Neither is generator output.

### The pattern: consistent, so a generator problem

| Weakness | Articles | Generator cause (Part 2) |
|---|---|---|
| Citable stuck at Adequate; Gap "easy to use, hard to credit" | 5/5 | No instruction produces attribution anchors: brand inside claims, first-party evidence, owned terms. |
| Entity resolution weak | 5/5 | Template, not generator (Organization has no sameAs). |
| Named authorship only adequate | 5/5 | Generator knows nothing about the author; template shows no credential. |
| Unsourced or invented statistics and results | 4/5 | Draft prompt licenses "Industry benchmarks show…"; brief prompt demands "testing" framing even from secondary sources; word-count rule says "add a case study". |
| Duplicate H1 | 4/5 | Draft prompt says "Start directly with the # H1"; the page template also renders the title as H1. |
| Opening paragraph too long, no definition (direct answers 2/10) | 3/5 (4/5 over 300 chars) | Prompt says the intro must "never [be] a definition"; the polish pass rewrites intros as 80–120-word hooks that "avoid defining the topic". |
| Sections outside 40–180 words | 2/5 below target | Brief sets ~250 words per H2 by default. |
| Brand absent from the sections that make claims | 2/5 absent, 1 adequate | No instruction to name the brand where a claim is made. |
| Proprietary terms absent or weak | 4/5 | No instruction; signature_angles is passed but not turned into named terms. |
| Rule-of-three triads | 5/5 (regex counts 29, 21, 10, 9, 3) | Banned in the prompt and still produced; the ban is not enforced. |

The best article (how-to-test, 95, 3 triads, sourced Ahrefs/Conductor figures, a "Short answer:" opener) differs in kind from the others. It looks either hand-edited or produced through a different path. The other four share every generator fingerprint above.

---

## Part 2: the generator

Files read end to end:
- `src/app/api/articles/generate-brief/route.ts` (brief, GPT-4o, temp 0.3)
- `src/app/api/articles/generate-draft/route.ts`:
  - pass 1: GPT-4o, temp 0.7
  - expansion pass, when under 85% of the target word count: GPT-4o-mini picks angles, plus DataForSEO keyword volumes, then GPT-4o expands
  - polish pass on Growth/Team: three intros and three conclusions, GPT-4o-mini picks one of each
- `src/lib/article-scoring.ts` (the regex rubric it was tuned against).

### What it optimises for today, and where that came from
Traditional SEO and keyword coverage first, then the old regex GEO/AEO rubric, then a human-sounding style:
- **SEO block:** keyword in H1, first 100 words and an H2; 8–12 secondary keywords; a fixed word count ("exactly N words"); FAQ and Key Takeaways sections. Keywords come from DataForSEO volume and difficulty.
- **"GEO"/"AEO" blocks:** a one-for-one copy of `computeGEO`/`computeAEO`: a definition per H2, a stat per H2, a FAQ with H3 questions, a 40–80-word direct-answer paragraph. It was written to pass nine regexes, not to be retrievable or citable.
- **Humanisation and anti-slop blocks:** added 2026-06-17 to make output read less like AI. Good intentions, but several rules fight the retrieval rules (see the conflicts below).

### Does it produce what the new engine rewards?

| Engine rewards | Generator today |
|---|---|
| Direct answer near the top (≤300 chars) and a plain definition | **Contradicted.** "Write the intro as a problem… never a definition"; the polish pass enforces 80–120-word hook intros that "avoid defining the topic". The AEO rule asks for a 40–80-word answer "within the first 200 words", so it often lands as paragraph 2 or 3, behind a long hook. |
| One H1, real heading hierarchy | **Breaks it.** It writes `# H1` into the body, which the template doubles. H3s appear mainly in FAQs (posts show 3–4 H3s; target 6+). |
| Sections of 40–180 words | **Works against it.** The brief defaults to ~250 words per H2, and "exactly N words" pressure adds bulk. |
| Question headings | **Partly.** FAQ H3s only. Body H2s are required to be claims ("must make a claim or imply a verdict"), which is good for argument and neutral for retrieval. |
| Lists and tables where they fit | **Lists yes, tables never.** No instruction mentions tables, even on comparison topics. |
| Named authorship | **Absent.** The prompt has no author; `expertise_notes` is used as "perspectives", never attributed to a named person. |
| Original evidence | **Inverted.** It asks for a stat in every H2 and allows invented ones ("Industry benchmarks show…"). Research data passed in is keyword volumes, not facts. The engine currently rewards these figures (see engine note below), which hides the problem. |
| Proprietary terms | **Absent.** No instruction; `signature_angles` is passed through but never turned into consistently named concepts. |
| Entity clarity / brand in claims | **Absent and sometimes wrong.** "Expert SEO content writer for {brand}" but no instruction to name the brand where it makes a claim. With no product facts supplied, it invents them ("Byline SEO… Pricing starts at $99/month"). Competitor names are banned, which forces vague comparisons. |

### What it produces that the engine penalises or cannot credit
- Duplicate H1 (Retrievable, Chunkability −2 to −3).
- Long hook openers with no definition (Retrievable, Extractability up to −8).
- Sections over 180 words (Chunkability −2).
- Generic vocabulary with no owned terms (Citable).
- Brand only in chrome, not in claims (Citable).
- Figures the engine counts but a reader cannot verify. This is a credibility liability the score does not show, and the most serious finding in this document.

### AI tics: rule of three
Still emitted, at scale. The system prompt bans manufactured triads ("RULE OF THREE BAN") and the expansion prompt repeats it, but nothing checks the output. Regex counts of "X, Y, and Z" in the published articles: 29, 21, 10, 9 and 3. A spot check on the 29 shows mostly rhetorical triads ("priced, structured, and designed"; "costs more, requires more steps, and assumes more context-switching"), alongside some genuine three-item lists. The prompts themselves model the pattern: three H1 options, three competitor gaps, three intro and three conclusion options, "Features, Workflow, and Pricing" headings. A prompt instruction alone has not removed it.

### Integrity problems in the prompts (fix regardless of scores)
1. `generate-draft` GEO rule: "Real stats preferred; if unavailable, use framing like 'Industry benchmarks show...'". This licenses invented statistics. Decision 9 already records this class of failure.
2. `generate-brief`: comparison topics "MUST include a section like 'What We Found After Testing'… framed as original research or testing, even if based on secondary sources". This instructs misrepresenting secondary sources as first-hand testing.
3. `generate-draft` word-count rule: "If content runs short, add a… case study". With no case-study material supplied, the model invents one.
4. The expansion pass says "add real examples, statistics" but supplies only keyword volumes, so any statistic it adds is invented.

---

## Part 3: changes to the generation prompts, ordered by impact

Impact is on Retrievable and Citable as the engine measures them, with the integrity items first because they are wrong regardless of score.

1. **Stop inventing evidence (integrity; Citable original-evidence stays honest).**
   - Remove "Industry benchmarks show…".
   - Remove the "testing even if secondary" framing.
   - Remove "add a case study" and the expansion pass's "add statistics".
   - Replace with: use only figures present in supplied research, with the source named and linked. Otherwise write the claim without a number, or insert `[ADD EVIDENCE: …]` for the writer.
   - Pairs with an engine change: count a figure as evidence only when it is sourced.
2. **Answer first, then hook (Retrievable Extractability, up to +8).**
   - Invert the intro rule. The first paragraph is a ≤300-character direct answer that includes a plain "X is…" definition; the hook comes second.
   - Change the polish pass to keep that first paragraph and only rewrite what follows it.
3. **No H1 in the body (Retrievable Chunkability, +2 to +3).** Generate from `##` down; the template owns the H1. Also fix the renderer to demote a body H1, for existing content.
4. **Named author and real credential (Citable named authorship → strong).** Pass `author_name`/`author_credentials` (now on the brand profile). Attribute first-hand perspectives from `expertise_notes` to the named author where true. Never invent experience.
5. **Brand inside claims, and real product facts (Citable brand-proximity).**
   - Instruct: name the brand in the sentence that makes a claim about it.
   - Supply a verified product-facts block (pricing, features) and forbid stating product specifics that are not in it.
   - Stop describing the user's own brand in the third person as one tool among a list.
6. **Owned terms (Citable proprietary terms).** Turn `signature_angles` into one or two named concepts the article uses consistently. Forbid coining names for generic ideas.
7. **Section size 40–180 words (Retrievable Chunkability).** Brief default from ~250 to ~120–160 words per H2. Long sections split under H3s, aiming for 6+ H3s on a 1,500+ word article.
8. **Tables where the content is comparative.** Commercial/comparison intent → a comparison table is required; elsewhere, use a table where values are compared side by side.
9. **Question headings in the body, not just the FAQ.** Allow, or require for informational intent, 2–4 H2/H3s phrased as the question a reader types, answered in the first sentence beneath. This keeps the brief's "headings must argue" rule for the rest.
10. **Enforce the rule-of-three ban instead of only stating it.**
    - Add a deterministic post-check for "X, Y, and Z" in generated text and a targeted rewrite pass for the offending sentences.
    - Stop the prompts themselves modelling triads: vary option counts and list lengths.
11. **Relax "exactly N words".** Length pressure is the main source of filler, long sections and invented case studies. Target a range, and let a shorter, complete article stand.
12. **Score the draft with the real engine before returning it.** `buildDraftReport` is deterministic and free. Use it as a gate: one targeted revision pass on the failing judged-now checks. Never let the model set the score.

Estimate for 1–12: 14–22h including prompt changes, the post-check, the engine evidence change, and re-generating three test articles to measure the effect against this table.
