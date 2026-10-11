# Free AI visibility tools: do they query an AI engine?

Date: 2026-10-11
Status: evidence file. Not committed. Sources read on 2026-10-11 unless stated.

## Claim tested

"Of ten free tools marketed as reporting what AI engines say about your brand, none query an AI engine, and five say so in their own documentation."

No evidence for this claim survived from earlier work. This file tests it from scratch.

## Verdict (short)

**The claim fails.** Of ten free tools selected, five state in their own documentation that they send prompts to named AI engines or models, and two more say they draw on a stored database of real engine answers. Only three are page-only or simulated, and only two of those say so plainly in their own documentation. The claim must not be used in any form.

## Method

### Selection

1. Ran four web searches on 2026-10-11 (US web search) and recorded every free tool returned on page one:
   - `free AI visibility checker brand ChatGPT Perplexity`
   - `free GEO checker tool`
   - `LLM visibility checker free`
   - `AI brand visibility free tool`
2. Ran three follow-up searches to confirm tools that recurred in roundups: `HubSpot AI Search Grader free`, `Semrush free AI search visibility checker`, `best free AI visibility checker tools 2026`, plus `Mangools AI Search Grader free`, `texta.ai free AI visibility checker`, `Frase free AI visibility checker tool`.
3. Included a tool if: it is free to run at least once, it is marketed as showing how AI engines (ChatGPT, Perplexity, Gemini, AI Overviews, Claude, Copilot) see, mention, cite or rank a brand or site, and it appeared in the searches above. Preferred tools from large, well-known vendors and tools that appeared in more than one search or roundup.
4. Excluded: Byline; paid-only or trial-only products (SE Visible, Writesonic, Trakkr, Hoverify); browser extensions; pay-per-run marketplace actors (Apify); the Texta checker (its tool URL returned HTTP 404 on 2026-10-11); Frase (considered as an eleventh; its docs say its free checker "probes ChatGPT for the free result", which would add one more QUERIES ENGINE row).

### Evidence rules

- Only a vendor statement, or output that visibly shows engine answers, counts as evidence that a tool queries an engine.
- Every quote below was checked verbatim against the HTML of the page, downloaded on 2026-10-11.
- No accounts were created, no email entered, no forms submitted. No tool was run. All classifications rest on vendor documentation. Anything not stated by the vendor is labelled **inference**.

### Classifications

- **QUERIES ENGINE**: vendor says it sends prompts to named engines or models.
- **ENGINE DATA (STORED)**: vendor says results come from a stored set of real engine prompts and answers, not a live call per check. This is not "page-only": it reports real engine output.
- **PAGE-ONLY**: vendor says it analyses your site (schema, crawler access, llms.txt, content).
- **SIMULATED/ESTIMATED**: vendor says scores are estimated or model-generated without querying the engines.
- **UNCLEAR**: no evidence either way.

## Results

| # | Tool | Vendor | Free, no signup? | Classification | Vendor says it does not query / is an estimate? |
|---|------|--------|------------------|----------------|------|
| 1 | Free AI Visibility Checker | Ahrefs | Yes | QUERIES ENGINE | No |
| 2 | AI Search Visibility Checker | Semrush | Yes, 3 per day | ENGINE DATA (STORED) | Partly: some metrics labelled estimates |
| 3 | AI Search Grader | HubSpot | Yes for check; short form for full results | QUERIES ENGINE | Partly: Share of Voice labelled estimated |
| 4 | AI Search Grader | Mangools | Yes, 3 models; 3 more need a free account | QUERIES ENGINE | No |
| 5 | AI visibility checker | RightBlogger | Yes | QUERIES ENGINE | No |
| 6 | AI Brand Visibility Checker | Backlinko | Vendor says yes (not tested) | QUERIES ENGINE | No |
| 7 | AI Visibility Checker | ContextBolt | Yes, 2 checks; email for full report | ENGINE DATA (STORED) | No (says Perplexity, Claude, Gemini are not covered) |
| 8 | Free AI Visibility Checker | SEOcrawl | Yes | SIMULATED/ESTIMATED | **Yes, explicit** |
| 9 | Free AI Visibility Checker | Pixelmojo | No: email verification code | PAGE-ONLY | **Yes, explicit** |
| 10 | Free GEO Checker | LightSite AI | Yes | PAGE-ONLY | Implicit only: describes a site score, no explicit disclaimer |

### 1. Ahrefs, Free AI Visibility Checker

- URL: https://ahrefs.com/free-ai-visibility (read 2026-10-11)
- Marketing: "See how your brand shows up in AI search results from ChatGPT, Gemini, Perplexity, Copilot, and Google AI Overviews."
- Method, vendor statement: "We query ChatGPT, Gemini, Perplexity, Copilot, and Google AI Overviews with search-backed prompts".
- Free: "No signup, no credit card, no limit on how many brands you can check."
- Classification: **QUERIES ENGINE** (vendor statement).
- Note, inference: the page also says "Results in seconds" and that Ahrefs "monitors hundreds of millions of search-backed prompts every month". The free check likely reads from that monitored dataset (Brand Radar) rather than making a fresh call per check. Either way it reports real engine answers.

### 2. Semrush, AI Search Visibility Checker

- URL: https://www.semrush.com/free-tools/ai-search-visibility-checker/ (read 2026-10-11)
- Method, vendor statement: "The tool draws from a database of 26M+ prompts and responses across ChatGPT, Gemini, AI Mode, and AI Overviews."
- Freshness: "Semrush also updates key AI visibility data daily".
- Free: "three times per day for free, without registering or creating an account."
- Estimates: Audience Reach is "An estimate of how many people see your brand mentioned across AI platforms each month."
- Classification: **ENGINE DATA (STORED)**. Real engine prompts and responses, gathered by Semrush, not a live call for your check (the page does not claim a live call).

### 3. HubSpot, AI Search Grader

- URL: https://www.hubspot.com/ai-search-grader (read 2026-10-11)
- Marketing: "reveals what ChatGPT, Perplexity, and Gemini say about you based on their training data."
- Method, vendor statement: "The tool queries GPT-5.4 mini, Perplexity, and Gemini simultaneously".
- Free: page title says "No Account Required"; FAQ says "complete a short form to access your full results." Not tested whether the form asks for an email.
- Classification: **QUERIES ENGINE** (vendor statement). Note: the vendor frames answers as coming from "training data", which suggests the call is to a model API, not the consumer product with live web search (partly inference). Share of Voice is described as an estimated percentage.

### 4. Mangools, AI Search Grader

- URL: https://mangools.com/ai-search-grader (read 2026-10-11)
- Method, vendor statement: "Our free tool then generates highly relevant prompts tailored to the information you provide." and "The tool tests each prompt across seven different AI models".
- Models named: ChatGPT (GPT-5 Nano), Mistral Small and Llama 3.3 are "Free for all users"; DeepSeek, Claude (Haiku 4.5) and Gemini (2.5 Flash Lite) are "For logged-in users only". (The page's structured data says "six" models; the visible text says seven.)
- Estimates: the score weights each model by its "approximate market presence".
- Classification: **QUERIES ENGINE** (vendor statement). Note: these are small API models, not the consumer ChatGPT, Gemini or Claude products, and the page does not say web search is on.

### 5. RightBlogger, AI visibility checker

- URL: https://rightblogger.com/ai-visibility-checker (read 2026-10-11)
- Method, vendor statement: "We ask ChatGPT and Perplexity" and "Each question goes to both, live, with web search on".
- Free: "Free, no signup. Takes about a minute."
- Limits: "The checker is a one-time snapshot: three questions on two AI platforms."
- Classification: **QUERIES ENGINE** (vendor statement). The clearest live-query statement in the set.

### 6. Backlinko, AI Brand Visibility Checker

- URL: https://backlinko.com/tools/ai-visibility-checker (read 2026-10-11)
- Marketing: "Does AI recommend your brand or your competitor?"
- Method, vendor statement: "This AI brand visibility checker runs 150 live queries about your category and analyzes the responses."
- Free: structured data says "150 live queries. No signup." One search summary described it as newsletter-gated; not verified, no form was submitted.
- Classification: **QUERIES ENGINE** (vendor statement). Engines named: ChatGPT, Gemini, Perplexity.

### 7. ContextBolt, AI Visibility Checker

- URL: https://contextbolt.com/tools/ai-visibility-checker/ (read 2026-10-11)
- Method, vendor statement: "We read a year of ChatGPT and Google AI answers and tell you if you are in them".
- Scope: "Perplexity, Claude and Gemini publish no answer log, so they can only be asked live".
- Free: "Two checks, no signup. Your email unlocks one full report".
- Limits: "A 0 means your brand did not appear in the sample of answers the checker reads."
- Classification: **ENGINE DATA (STORED)**. The free check does not call an engine live, by the vendor's own account, but it reports real recorded engine answers. It is candid about scope.

### 8. SEOcrawl, Free AI Visibility Checker

- URL: https://seocrawl.ai/ai-visibility-checker (read 2026-10-11)
- Marketing: "Free AI visibility estimate across ChatGPT, Claude, Gemini & Perplexity."
- Method, vendor statement: "A model estimates how your brand surfaces in AI answers across the major LLMs for your category queries".
- Disclaimer: "It is an estimate, not a live measurement."
- Free: "No sign-up required."
- Classification: **SIMULATED/ESTIMATED**. Says so explicitly.

### 9. Pixelmojo, Free AI Visibility Checker

- URL: https://www.pixelmojo.io/tools/free-ai-visibility-checker (read 2026-10-11)
- Marketing: "See whether ChatGPT, Claude, Perplexity, and Gemini can find, understand, and cite your brand."
- Disclaimer: "It does not ask AI models about your brand, so it shows whether your site is technically readable".
- Free: "free with a one-time email verification (a 6-digit code)". Not run.
- Classification: **PAGE-ONLY**. Says so explicitly. Note the headline marketing claim ("cite your brand") is broader than what the FAQ says the tool does.

### 10. LightSite AI, Free GEO Checker

- URL: https://www.lightsite.ai/generative-engine-optimization-checker (read 2026-10-11)
- Marketing: "It evaluates the same signals used by ChatGPT, Gemini, Claude, and Perplexity when deciding which brands to cite".
- Method, vendor statement: "The score measures how well your website communicates structured, machine-readable information to AI systems".
- Free: "completely free with no signup required."
- Classification: **PAGE-ONLY** (vendor describes a site analysis: schema, crawlability, entity clarity). No explicit statement that it does not query engines. Weakest fit to the selection criterion: it is marketed as AI search readiness more than as reporting what engines say.

## Tally

| Classification | Count | Tools |
|---|---|---|
| QUERIES ENGINE (vendor says it sends prompts) | 5 | Ahrefs, HubSpot, Mangools, RightBlogger, Backlinko |
| ENGINE DATA (STORED) (real engine answers, no live call claimed) | 2 | Semrush, ContextBolt |
| SIMULATED/ESTIMATED | 1 | SEOcrawl |
| PAGE-ONLY | 2 | Pixelmojo, LightSite |
| UNCLEAR | 0 | |

- Tools whose output rests on real engine answers (live or stored): **7 of 10**.
- Tools that do not touch engine answers at all: **3 of 10**.
- Tools whose own documentation explicitly says they do not query engines or that results are estimates: **2 of 10** (SEOcrawl, Pixelmojo). LightSite describes itself as a site score but has no explicit disclaimer. Semrush and HubSpot label individual metrics as estimates, but not the tool as a whole.

## Comparison with the claim

| Part of claim | Claimed | Found |
|---|---|---|
| Tools that query an AI engine | 0 of 10 | 5 of 10 by vendor statement, 7 of 10 using real engine answers |
| Tools that say so (do not query) in their own docs | 5 of 10 | 2 of 10 explicit |

**Verdict: the claim fails on both parts.** It is not a matter of wording. The biggest free tools (Ahrefs, Semrush, HubSpot, Mangools, Backlinko) say in their own documentation that they use real engine answers. Repeating the claim would be false and easy to disprove by any reader who opens the Ahrefs or RightBlogger page.

## What the evidence does support

1. **Some free "AI visibility" tools do not ask any AI engine.** Two say so in their own documentation: SEOcrawl ("an estimate, not a live measurement") and Pixelmojo ("does not ask AI models about your brand"). A third (LightSite) is a site-readiness score.
2. **"Queries an engine" often means a small API model, not the product your customers use.** Mangools' free tier queries GPT-5 Nano, Mistral Small and Llama 3.3. HubSpot queries GPT-5.4 mini and frames results as "based on their training data". Only RightBlogger says web search is on, and Ahrefs says "search-backed prompts". Whether an API model answer matches what a ChatGPT user sees is not established here (inference, not tested).
3. **Several report stored samples, not a live check of your brand.** Semrush (26M+ stored prompts and responses) and ContextBolt (a year of recorded answers) read from a database. A brand outside the sample can score 0, which ContextBolt states directly.
4. **Free checks are small snapshots.** RightBlogger: three questions on two platforms. Ahrefs: top 5 results per section. Vendors themselves call them one-time snapshots.

## How this can and cannot be worded publicly

**Cannot be used (false on this evidence):**
- "None of the free AI visibility tools query an AI engine."
- "Half of them admit it in their own documentation."
- Any count of the form "X of 10 do not query an engine" unless X is 3 and the list is published.

**Defensible, with this file as the source:**
- "Some free AI visibility checkers never ask an AI engine anything. One says its score is 'an estimate, not a live measurement'." (SEOcrawl; name it or link it if quoting.)
- "Not every 'AI visibility' score comes from AI answers. Some are site audits, some are model estimates, and some read stored samples. Check which kind you are looking at."
- "Free checkers that do query an engine often use a small API model or a handful of prompts. That is a snapshot, not what your customers see over time." (Keep "often" general; Mangools and HubSpot are the documented examples.)

**Suggested homepage sentence (defensible):**
"Some free AI visibility tools are site audits or estimates, not answers from the engines themselves." Use "some", not "many": on this evidence it is 3 of 10. Do not add "Byline tells you which is which": Byline does not classify other tools, so that sentence would be untrue.

**Positioning note:** the honest contrast is not "they don't query engines, we do". Ahrefs, Semrush and HubSpot do use engine answers. A defensible contrast must rest on something Byline actually does differently (for example, readiness of the page itself versus brand mention counts), stated without claims about competitors that this file does not support.

## Limitations

- Ten tools from one day of US web search. Search results vary by location and time.
- No tool was run. Classifications rest on vendor documentation, which can be inaccurate or out of date. A vendor saying it queries an engine was taken at its word.
- Backlinko's signup requirement and HubSpot's form fields were not verified, to avoid entering personal data.
- Re-check before reuse: vendor pages change often. Re-read each URL and update the dates.
