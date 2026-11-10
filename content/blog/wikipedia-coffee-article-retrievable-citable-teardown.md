---
title: "Is Wikipedia's Coffee Article Easy for AI Search to Quote? A Page Teardown"
slug: "wikipedia-coffee-article-retrievable-citable-teardown"
excerpt: "I ran Byline's engine on Wikipedia's Coffee article on 2 November 2026. It scored 87 out of 100 for retrievability and Adequate for citability. Here is what the page does well, where it scores zero, and what a practitioner can copy."
seoTitle: "Wikipedia Coffee Article Teardown: Retrievable vs Citable"
seoDescription: "A teardown of Wikipedia's Coffee article with Byline's engine: 87/100 retrievability, Adequate citability, a zero on question headings and a ClaudeBot 403."
publishedAt: "2026-11-06T09:00:00.000Z"
author: michael-osborne
categories: []
---

Yes. An engine can reach the English Wikipedia article on coffee, read it without
JavaScript and lift clean passages from it. Byline's engine scored it 87 out of 100
for retrievability on 2 November 2026. It rated citability Adequate, because little
inside the passages ties them back to a publisher or a person. The report's own
summary line was "Easy to use, hard to credit."

This is a score of one page. It says nothing about how often any AI system cites
Wikipedia, and Byline does not measure that.

I picked this page because anyone can open it. Every number below can be checked
against the live article or reproduced with the free
[GEO analyzer](https://bylineseo.com/geo-analyzer).

**Run details.** URL: https://en.wikipedia.org/wiki/Coffee. Run at 15:27 UTC on
2 November 2026 with engine version 2026.14. Raw HTML fetch, from one network. The
page changes often (its structured data gave a modified date of 1 November 2026), so
a re-run will not match to the point.

## What did the audit score?

Retrievable is a number out of 100. Citable is a band. They are never blended.

| Pillar | Score | What drove it |
| --- | --- | --- |
| Access | 30 of 30 | Search crawlers served the page; no noindex; canonical matches |
| Parseability | 22 of 25 | 16,570 words in raw HTML; structured data 5 of 8 |
| Chunkability | 21 of 25 | Heading hierarchy 12 of 12; block length 1 of 5 |
| Extractability | 14 of 20 | Direct answers 10 of 10; question coverage 0 of 6 |
| Retrievable total | 87 of 100 | |

The citable signals came back like this.

| Signal | Reading | Evidence |
| --- | --- | --- |
| Named authorship | Absent | No byline in the markup; no About or team page linked from the page |
| Entity resolution | Adequate | See the caveat below |
| Brand-claim proximity | Weak | "Wikipedia" appears in 2 of 42 substantive sections |
| Original evidence | Adequate | 4 figures with a linked source in the same section; 11 without a source, not counted |
| Proprietary terms | Adequate | Repeated terms such as "Red Sea" and "Ottoman Empire" |
| Freshness and provenance | Strong | Modified 2026-11-01; 568 outbound source links |

## Why does the page score full marks on access and structure?

Four AI search crawlers were permitted. Three of them were served the page when the
probe requested it with their own user-agent: OAI-SearchBot, Claude-SearchBot and
PerplexityBot each got HTTP 200 and at least 1,071,800 bytes. The fourth was permitted
by robots.txt. A plain browser request returned HTTP 200 as the baseline.

The page needs no JavaScript. The raw HTML holds 16,570 words, and 98% of the body
text sits in the main content region. The document exposes 49 real heading elements
and 96 paragraph elements.

The outline is clean. One H1 states the topic. Sixteen H2 sections divide it and 28
H3 sections sit under them. No heading level is skipped. Forty-one sections pair a
heading with 40 or more words of prose, so each can be quoted on its own.

The opening paragraph does the job an engine wants. Its first sentence reads "Coffee
is a beverage brewed from roasted, ground coffee beans." That is a definition that
opens with its subject, and the whole opening paragraph runs 262 characters.

## Where does the page lose points?

Block length scored 1 of 5. Only 35% of sections fall in the 40 to 180 word range the
engine targets, against a target of 65%. Long topic sections run well past the top of
that range.

Question coverage scored 0 of 6. No heading is phrased as a question a reader would
ask. The headings are labels such as "Etymology" and "History".

Structured data scored 5 of 8. The page declares one JSON-LD block of type Article.
It declares no Organization, LocalBusiness or Person type, so the markup does not say
who publishes it.

Each of these describes the page we inspected. None of them says anything about
whether an engine cites it.

## Why is citability only Adequate?

Citable reads whether a quoted passage carries something that points back to its
source. On this page most passages carry nothing of the kind.

A byline is one way a page names who stands behind it. Wikipedia uses a different
mechanism: a public edit history for each article, which sits on another URL. The
report found no person named on the inspected URL, and it found the word "Wikipedia"
inside only 2 of 42 substantive sections. A passage lifted from the middle of the
article would arrive with no name attached.

The page is strong on provenance. It carries 568 outbound source links and a recent
modified date. The report counted four figures with a source linked from the same
section. It set aside 11 further figures that had no linked source, crediting and
penalising neither.

One reading I do not trust. Entity resolution came back Adequate partly because the
engine found two contact details on the page. They are 13-digit numbers. A phone
number is an odd thing to find in an encyclopedia article about coffee, and one of the
two begins with 978, the prefix of an ISBN-13. That is a misread by the engine. Give
that signal no weight for this page.

## Does it matter that ClaudeBot got a 403?

The probe sent six crawler user-agents to the page. Five got HTTP 200. ClaudeBot got
HTTP 403, with no CDN fingerprint in the response, which means the application itself
refused the request. The report recorded robots.txt as allowing ClaudeBot. That is a
divergence between what the file says and what the origin did.

The report does not score this row. ClaudeBot is a training crawler, and blocking
training crawlers is a legitimate choice that does not remove a page from AI search.
Claude-SearchBot, the retrieval crawler, was served the page.

Two cautions apply. The row records what the origin did for a request presenting that
user-agent from our network at that moment. Some crawlers verify themselves by IP
range, so the real ClaudeBot may be treated differently. And I do not know why the
origin answered as it did. I am reporting the observation.

You can check it in under a minute. Run both of these and compare the codes. The first presents ClaudeBot's user-agent. The second is the baseline.

`curl -s -o /dev/null -w "%{http_code}\n" -A "Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)" https://en.wikipedia.org/wiki/Coffee`

`curl -s -o /dev/null -w "%{http_code}\n" -A "Mozilla/5.0" https://en.wikipedia.org/wiki/Coffee`

Your network may get a different answer from ours. The baseline request is what makes
the first result readable. If both fail, the run tells you nothing about crawlers. The
full method is in [Your Edge Decides Which AI Crawlers See Your Pages, Not Your robots.txt](/blog/which-ai-crawlers-your-site-actually-serves).

## What can a practitioner copy from this page?

The structure transfers. Open with a one-sentence definition of the subject. Keep a
single H1 and descend through H2 and H3 without skipping. Put real tables and lists
where values compare. Write sections that make sense when quoted alone. Link a figure
to its source in the same section as the figure.

The gaps transfer too. Phrase some headings as the questions your readers ask. Name a
person where a person stands behind the page. Declare who publishes it in structured
data. Keep the publisher's name inside the sections that make claims, so a lifted
passage still points home.

Most of these fixes are cheap and sit entirely on your side of the page. That is the
case for scoring a page at all: it tells you which conditions you control are met.

## What does this teardown not show?

It covers one article, on one day, from one network. The score describes content
readiness. It is not a measurement of AI visibility, and it predicts nothing about
citation.

A page with no question headings and no byline is a page the audit marks down. The
audit cannot tell you whether that costs the page anything with a given engine. One
article from one site is the wrong sample for deciding whether a signal matters. The
same limit appears in [One AI Visibility Score Cannot Be True](/blog/one-ai-visibility-score-cannot-be-true).

:::faq
### What did Byline score Wikipedia's Coffee article?
On 2 November 2026, engine version 2026.14 scored the English Wikipedia article on
coffee at 87 out of 100 for retrievability and Adequate for citability. Access scored
30 of 30. Question coverage scored 0 of 6.

### Does a high retrievability score mean AI search cites the page?
No. Retrievability says an engine can reach the page, parse it and lift a clean
passage from it. It does not say any engine has done so, and Byline does not predict
citation.

### Why does citability fall short on a page this well structured?
Citable reads whether passages carry an attribution anchor. The audit found no named
author on the inspected URL and found the word "Wikipedia" in 2 of 42 substantive
sections, so a lifted passage arrives with little that names its publisher.

### Can I run the same check on my own site?
Yes. The free GEO analyzer at bylineseo.com/geo-analyzer runs the same engine on any
public URL and reports each pillar and signal with its evidence.
:::

## Sources

- Byline audit of en.wikipedia.org/wiki/Coffee, 2 November 2026, 15:27 UTC, engine version 2026.14 (Byline's own audit archive).
- Wikipedia, Coffee: [https://en.wikipedia.org/wiki/Coffee](https://en.wikipedia.org/wiki/Coffee)
- Byline, [GEO analyzer](https://bylineseo.com/geo-analyzer)
