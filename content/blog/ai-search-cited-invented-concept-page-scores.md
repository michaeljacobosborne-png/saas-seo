---
title: "A Study Found AI Search Cited an Invented Concept Within a Week. What Does a Page Score Tell You?"
slug: "ai-search-cited-invented-concept-page-scores"
excerpt: "Fudan researchers published posts about a concept they made up, and eight of ten AI search platforms cited it within seven days. Where the posts lived mattered more than how many there were. Here is what that leaves a page score able to say."
seoTitle: "Study: AI Search Cited a Made-Up Concept. What Page Scores Say"
seoDescription: "A Fudan University study found eight of ten AI search platforms cited an invented concept within a week. What it means for page scores, placement and client advice."
publishedAt: "2026-11-09T09:00:00.000Z"
author: michael-osborne
categories: []
---

A page score tells you whether a page is ready to be fetched and quoted. It cannot
tell you whether an engine will cite the page. A study from Fudan University,
posted to arXiv on 8 October 2026, shows how wide that gap is. The researchers
published posts about a concept they had made up, and eight of ten AI search
platforms cited it within seven days.

Where the posts were published decided more than how many there were. For
anyone who scores pages, this is what the result means for that work.

## What did the Fudan study test?

The paper is "From Public Posts to AI-Search Citations: Measuring the Fragility of
AI Search" (arXiv 2610.11932), by Qi Liu and five co-authors. It has three parts.
The team mapped where ten AI search platforms take their citations from, tested how
hard it is to publish on those sources, and ran controlled experiments with marked
content.

The mapping covered 17,211 citation instances across 6,356 unique source domains.
On each platform the top 20 domains accounted for between 20.5% and 70.8% of
citations. Of 22 publication platforms tied to cited domains, 15 had low or medium
barriers for both account setup and posting.

For the experiment, the authors wrote posts about a fictional concept and seeded
them with fabricated details. They checked first that no platform gave an informative
answer on the topic. Then they asked each platform questions about it daily for a
week. Search Engine Journal covered the paper on 19 October 2026.

### How often did answers carry the planted markers?

Eight of ten platforms cited the invented concept inside a week. Qwen and DeepSeek
were the two that did not. For the four English-language platforms, the share of
answers carrying a planted marker varied from zero to over half.

| Platform | Answers carrying a planted marker |
| --- | --- |
| Grok | 53.3% |
| ChatGPT | 10.0% |
| Google AI | 6.1% |
| Perplexity | 0.0% |

A marker is a phrase, term or figure the authors planted in their posts, such as an
invented abbreviation or statistic. Rates count answers from each platform's first
citation onward. Source: Liu et al., Table III, fabricated-concept topic.

Perplexity cited the posts and carried none of the planted markers. Grok carried
them in more than half its answers. One experiment, one set of posts, and the
platforms disagree with each other. That is the argument in
[One AI Visibility Score Cannot Be True](/blog/one-ai-visibility-score-cannot-be-true),
reached from a different direction.

### What does the study not show?

Every topic was fictional, so the study says nothing about real brands. It ran as a
single campaign in March and April 2026, and the authors say rates may drift as
platforms change. The question panel was designed by the researchers, because real
AI search logs are not public.

## Why did placement matter more than volume?

In paired tests, one article on a platform the engines favour had a larger citation
effect than more than 20 matched posts on platforms they favour less. Forty posts on
a self-hosted WordPress site drew no citations within a week.

Volume did something too. Across ten platforms, citation instances rose from 24 at
one post to 128 at 20 posts. That is a 5.3 times rise for a 20 times increase in
posting. Each volume level used a different topic, so the authors call it an
association. They also say there is no general rule for converting low-preference
posts into the value of one high-preference post.

For a practitioner the consequence is plain. Two matched posts on two hosts got
different outcomes. A score computed from the page alone cannot forecast that, and
Byline does not try.

## Does a high page score still matter?

Yes, for the conditions the page controls. On 2 November 2026 Byline ran its engine
(version 2026.14) on our own homepage. Retrievable came back 98 out of 100 and
Citable came back Strong. Access scored 30 out of 30: the three AI search crawlers
we probe were served the page, the fourth was permitted by robots.txt, and the
baseline browser request returned HTTP 200.

That result describes the page. It says nothing about how many engines cite
app.bylineseo.com this week, and the Fudan results explain why it cannot. The host's
standing with each engine sits outside the page.

The same run rated one Citable signal, Original evidence, as weak, because the
figures on the page lacked linked sources. A Strong band is a summary. The signals
underneath it can still carry work.

A page score also cannot tell you whether a claim is true. In the experiment,
answers carried invented terms and figures from the posts. Byline's Citable band reads signals
such as named authorship and whether the brand sits next to its claims, which tell
you who stands behind a passage. Nothing in a page score confirms that the passage
is correct.

## Which question does each kind of check answer?

A page check cannot answer a sampling question. They are different instruments.

| Question | What can answer it |
| --- | --- |
| Can a retrieval crawler fetch the page? | A crawler probe with a baseline request, such as Byline's Access checks |
| Can a passage be lifted cleanly? | Chunkability and Extractability checks on the served HTML |
| Does a lifted claim carry a name? | Citable signals: named authorship, brand-claim proximity |
| Do engines favour this host? | Repeated sampling of answers across engines from a fixed prompt panel |
| Did an engine cite the page this week? | The same sampling, repeated over time |
| Is the claim true? | A person who checks it |

Byline answers the first three. The fourth and fifth need a prompt panel and
repeated runs, and the Fudan team said plainly that their panel was designed rather
than drawn from real usage. Byline reports carry a standing line stating that the
score assesses content readiness, and the table is the reason that line exists.

## What should you tell a client who wants to seed posts elsewhere?

The study offers no evidence on real brands, so it cannot support the plan. Google's
spam policies, last updated on 28 August 2026, list "attempting to manipulate
generative AI responses in Google Search" as spam. The study shows how cheap the
tactic is: a $14 package delivered 13 posts, and one platform cited a post with the
authors' markers within an hour.

Cheap and effective on invented topics does not establish safe or effective for a
client's name. The decision belongs to the client, and it carries a policy risk the
study did not measure.

What you can offer without that risk is work on the conditions the page controls.
Check that retrieval crawlers are served, as covered in
[Your Edge Decides Which AI Crawlers See Your Pages](/blog/which-ai-crawlers-your-site-actually-serves).
Then make sure each section can stand alone when quoted and carries the brand name
with its claim. You can run the crawler check free at
[bylineseo.com/geo-analyzer](https://bylineseo.com/geo-analyzer).

:::faq
### Did the Fudan study test real brands?
No. Every topic in the controlled experiments was fictional, including the invented concept and a fabricated product. The authors say the tests do not show whether the pattern holds for real brands or products.

### Which platforms cited the invented concept?
Eight of ten did within seven days, including ChatGPT, Perplexity, Grok and Google AI. Qwen and DeepSeek were the two where the paper observed no first citation for that topic.

### Does a high Retrievable score make citation more likely?
Byline does not predict citation. Retrievable is a score out of 100 for how readily a page can be fetched and lifted from. It describes the page, and the Fudan results show the platform a post sits on shifts outcomes in ways a page score cannot see.

### How do I check whether my page is fetchable by AI crawlers?
Request a real content page once per crawler, presenting each crawler's user-agent, and compare against a plain browser request from the same network. The free crawler access check at bylineseo.com/geo-analyzer runs that comparison.
:::

## Sources

- Liu, Hong, Zhang, Chen, Li and Yang, "From Public Posts to AI-Search Citations: Measuring the Fragility of AI Search", arXiv:2610.11932, submitted 8 October 2026: [https://arxiv.org/abs/2610.11932](https://arxiv.org/abs/2610.11932)
- Matt G. Southern, "AI Search Tools Cited A Made-Up Concept Within A Week, Paper Finds", Search Engine Journal, 19 October 2026: [https://www.searchenginejournal.com/ai-search-tools-cited-a-made-up-concept-within-a-week-paper-finds/593472/](https://www.searchenginejournal.com/ai-search-tools-cited-a-made-up-concept-within-a-week-paper-finds/593472/)
- Google Search Central, Spam policies for Google web search, last updated 28 August 2026: [https://developers.google.com/search/docs/essentials/spam-policies](https://developers.google.com/search/docs/essentials/spam-policies)
- Byline audit of app.bylineseo.com, 2 November 2026, engine 2026.14, from Byline's own audit archive.
