---
title: "Can AI Search Quote Google's Own Guide to AI Features? A Page Teardown"
slug: "google-ai-features-guide-retrievable-citable-teardown"
excerpt: "I ran Byline's engine on Google's AI features guide on 10 November 2026. It scored 81 out of 100 for retrievability as reported, 76 after one correction, and Weak for citability. Here is what the page does well and what it leaves off."
seoTitle: "Google AI Features Guide Teardown: Retrievable vs Citable"
seoDescription: "A teardown of Google's AI features and your website guide with Byline's engine: 81/100 retrievability as reported, Weak citability, and a footer line the engine misread."
publishedAt: "2026-11-13T09:00:00.000Z"
author: michael-osborne
categories: []
---

Yes. An engine can reach Google's guide to AI features, read it without JavaScript and lift clean passages from it. Byline's engine scored the page 81 out of 100 for retrievability on 10 November 2026. I think that number is 5 points too high, for a reason I explain below, so I read it as 76. The engine rated citability Weak, because nothing in the passages names a person or a publisher that a quoted line could point back to.

This is a score of one page. It says nothing about how often any AI system cites Google's documentation, and Byline does not measure that.

I picked this page because the question behind it has real demand. Site owners ask how to appear in AI Overviews and AI Mode, and Google's guide to AI features is the page Google wrote to answer them. Anyone can open it. Every number below can be checked against the live page or reproduced with the free [GEO analyzer](https://bylineseo.com/geo-analyzer).

**Run details.** URL: https://developers.google.com/search/docs/appearance/ai-features. Run at 04:06 UTC on 10 November 2026 with engine version 2026.15. Raw HTML fetch, from one network. The page's visible footer reads "Last updated 2025-12-10 UTC", so a re-run should match unless Google edits it.

## What does Google's guide actually tell site owners?

It tells them there is nothing special to do. The page states that the best practices for SEO remain relevant for AI Overviews and AI Mode, that there are no additional requirements to appear, and that no other special optimizations are necessary. It adds that a page must be indexed and eligible to show in Search with a snippet, and that there are no additional technical requirements.

It also says you do not need new machine readable files, AI text files or markup, and that no special schema.org structured data is needed.

I take Google at its word on what Google's own systems need. This teardown asks a different question. Google's guide describes what makes a page eligible to appear in its features. The audit asks whether any retrieval system can read the guide itself, and whether a passage lifted from it says who stands behind it.

## What did the audit score?

Retrievable is a number out of 100. Citable is a band. They are never blended.

| Pillar | Score | What drove it |
| --- | --- | --- |
| Access | 30 of 30 | All four AI search crawlers permitted; no noindex; canonical matches |
| Parseability | 17 of 25 | 1,058 words in raw HTML; 48% of body text in the main content region; structured data 5 of 8 |
| Chunkability | 20 of 25 | Heading hierarchy 10 of 12; block length 5 of 5 |
| Extractability | 14 of 20 as reported | Direct answers 10 of 10 as reported; question coverage 2 of 6 |
| Retrievable total | 81 of 100 as reported | 76 after the correction below |

The citable signals came back like this.

| Signal | Reading | Evidence |
| --- | --- | --- |
| Named authorship | Absent | No byline in the markup; no About or team page linked from the page |
| Entity resolution | Absent | No Organization declared; the only structured data is a BreadcrumbList |
| Brand-claim proximity | Strong | "Google" appears in 6 of 8 substantive sections |
| Original evidence | Absent | No sourced figures or named methodology found |
| Proprietary terms | Weak | One repeated term, "Search Console", five times |
| Freshness and provenance | Absent | No published or modified date in the markup |

## Can crawlers reach it?

All of them. The probe sent six crawler user-agents to the page. OAI-SearchBot, Claude-SearchBot and PerplexityBot each got HTTP 200 and at least 180,000 bytes. ClaudeBot, GPTBot and CCBot, which are training crawlers, got the same. A baseline browser request returned HTTP 200 as well, so no row is a false positive from a failed baseline.

The page needs no JavaScript to read. The raw HTML holds 1,058 words, with 11 real heading elements and 18 paragraph elements inside an identifiable content region. The engine flagged one thing here. Only 48% of the body text sits in the main content region, against a target of 60%. That target is Byline's, not Google's. The rest is navigation and footer.

This row records what the origin served to a request presenting each user-agent, from our network, at one moment. It is evidence about fetchability. It says nothing about whether any AI system has retrieved, indexed or cited the page.

## Where does the page lose points?

Question coverage scored 2 of 6. Two headings open with a question word and are not phrased as questions: "How AI features work in Search" and "How to appear in AI features". A reader who types "how do AI features work in Search" is better matched by a heading in that form. That is a cheap fix and it is entirely on the author's side.

The outline is clean otherwise. A single H1 states the topic. Four H2 sections follow it, with six H3 subsections beneath them, and no level is skipped. The engine's target for a page meant to be chunked is six or more H2 sections, so the heading hierarchy check came back 10 of 12. Seven sections pair a heading with 40 or more words of prose, against a target of eight. Two thirds of the sections fall in the 40 to 180 word range that quotes cleanly.

Structured data scored 5 of 8. The page declares one JSON-LD block, a BreadcrumbList. It declares no Organization, LocalBusiness or Person, so the markup does not say who publishes the page. Google's guide says no special markup is needed to appear in its features. That statement is about Google Search. Other retrieval systems are a separate matter, and the audit reports the absence without claiming it costs the page anything.

## Why was the retrievability score 5 points too high?

The Direct answers check scored 10 of 10. It awards 5 points for a self-contained opening paragraph and 5 for a definition-style sentence. The opening paragraph is real. It reads "This guide covers how AI features like AI Overviews and AI Mode work in Google Search from a site owner's perspective", and it runs 184 characters.

The definition-style sentence is the problem. The engine quoted this as its evidence: "Java is a registered trademark of Oracle and/or its affiliates." That line sits in the page's content footer, below the article, in the licence and trademark notice. It defines nothing about the topic. The engine's pattern matched a sentence that opens with a short subject and goes straight to "is a".

I do not accept that credit. Take the 5 points away and Direct answers is 5 of 10, Extractability is 9 of 20 and the total is 76. I have not changed the report. The 81 is what the engine printed on 10 November, and the 76 is my arithmetic from the rubric.

This is the same kind of limit I reported in the [Wikipedia teardown](/blog/wikipedia-coffee-article-retrievable-citable-teardown), where the engine read two ISBN-like numbers as contact details. A score is a reading made by software. Check the evidence line under any check you plan to act on.

## Why is citability Weak?

Citable reads whether a quoted passage carries something that points back to its source. On this page most passages carry nothing of the kind.

The brand name is there. "Google" appears inside 6 of 8 substantive sections, so a passage lifted from most of the page arrives with the publisher's name attached. That reading is Strong.

Everything else is absent or thin. No person is named on the page and no byline appears in the markup. No Organization is declared in structured data, so the publisher exists as text only. The engine found no sourced figures, no named methodology and no first-hand evidence. The page's only repeated distinctive term is "Search Console".

Freshness needs the most careful reading. The engine reports no published or modified date in the markup. The page does show a date: the footer reads "Last updated 2025-12-10 UTC". The date text is in the served HTML, the page carries no `time` element and its structured data holds no date. A person sees the date. A parser that looks for a machine readable one finds none. You can check this in under a minute:

`curl -s https://developers.google.com/search/docs/appearance/ai-features | grep -o 'Last updated [0-9-]* UTC' | sort | uniq -c`

`curl -s https://developers.google.com/search/docs/appearance/ai-features | grep -c '<time'`

`curl -s https://developers.google.com/search/docs/appearance/ai-features | grep -o '"@type": "[A-Za-z]*"'`

The first command returns the date text. The second returns 0. The third lists BreadcrumbList and ListItem and nothing else. Your network may get a different answer from ours. If a command returns nothing at all, check the HTTP status of the request before you read anything into it.

## What can a practitioner copy from this page?

The structure transfers. A one-sentence statement of purpose opens the page. The sections are short, each carries its own heading, and the heading levels descend in order. The page names its publisher inside the claims, so a lifted passage still points home. The sections of 40 to 180 words quote cleanly.

The gaps transfer too. Phrase some headings as the questions your readers ask. Declare who publishes the page in structured data. Put the update date in a `time` element or in Article markup, so the date a person sees is also the date a parser reads. Name a person where a person stands behind the page, and link to the page that says who that is.

All of these sit on your side of the page. That is the case for scoring a page at all: it tells you which of the conditions you control are met. It does not tell you what any engine will do next. For one page you can re-score after each change and compare the two runs, which is how you show that a change happened.

## What does this teardown not show?

It covers one page, on one day, from one network. The score describes content readiness. It is not a measurement of AI visibility, and it predicts nothing about citation.

It also says nothing about how Google's own systems treat the page. Google's guide says its AI features need no special markup, and I have no evidence either way on that point. A page with no byline and no machine readable date is a page the audit marks down. The audit cannot tell you whether that costs the page anything with a given engine.

:::faq
### Can AI search read Google's AI features guide?
Yes. On 10 November 2026 all six crawler user-agents tested were served the page with HTTP 200, and the raw HTML holds 1,058 words with a clean heading outline. That describes fetchability and parseability on one day from one network, and it does not show that any engine has used the page.

### What did Byline score Google's AI features guide?
Engine version 2026.15 reported 81 out of 100 for retrievability and Weak for citability. One check credited a footer trademark line as a definition, which is worth 5 points, so I read the retrievability score as 76.

### Does Google say you need special markup for AI Overviews?
No. The guide states that there are no additional requirements to appear in AI Overviews or AI Mode, no new machine readable files or markup, and no special schema.org structured data. That is Google's statement about its own features, and the audit reports on a separate question: whether the page can be read and credited by any retrieval system.

### Why is citability Weak on a page from Google?
Citable reads whether a passage carries an attribution anchor. The page names Google in 6 of 8 substantive sections but shows no author, declares no Organization and carries no date in its markup.

### Can I run the same check on my own site?
Yes. The free GEO analyzer at bylineseo.com/geo-analyzer runs the same engine on any public URL and reports each pillar and signal with its evidence.
:::

## Sources

- Byline audit of developers.google.com/search/docs/appearance/ai-features, 10 November 2026, 04:06 UTC, engine version 2026.15 (Byline's own audit archive).
- Google Search Central, [AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)
- Byline, [GEO analyzer](https://bylineseo.com/geo-analyzer)
