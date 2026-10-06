---
title: "Your Edge Decides Which AI Crawlers See Your Pages, Not Your robots.txt"
slug: "which-ai-crawlers-your-site-actually-serves"
excerpt: "Retrieval crawlers and training crawlers are different bots with different consequences, and most sites have never checked which ones their edge refuses. Here is how to check, and how to avoid the false positive that trips up most tools."
seoTitle: "Which AI Crawlers Does Your Site Actually Serve? How to Check"
seoDescription: "How to test whether AI retrieval crawlers can fetch your pages, why robots.txt does not answer the question, and the baseline request that prevents a false block."
publishedAt: "2026-10-06T09:00:00.000Z"
author: michael-osborne
categories: []
---

A site can block the crawlers that would cite it while still serving the ones
that only train on it. That is the wrong way round, it happens by accident, and
nothing in your analytics will tell you it happened.

The check takes a few minutes. Almost nobody runs it.

## Two kinds of AI crawler, two different consequences

**Retrieval crawlers** fetch a page so a model can answer a question about it
now, usually with a link back. OAI-SearchBot, Claude-SearchBot and
PerplexityBot are in this group. If one of these is refused, you are not in the
answer. That is a lost citation.

**Training crawlers** fetch a page to absorb it into a model's weights. GPTBot,
ClaudeBot and CCBot are in this group. Blocking them is an editorial and
commercial decision with no bearing on whether you get cited next week.

These are separate decisions with separate costs, and the controls people reach
for do not always keep them separate.

### Which operators actually split their crawlers

Amazon, Anthropic, Meta and OpenAI run distinct crawlers for search and
training, so the distinction is real and enforceable for them.

Google, Apple and Microsoft do not. Cloudflare calls these **mixed-use
crawlers**: one bot doing both jobs. Googlebot, Applebot and Bingbot each
collect pages for a search index and for model training. Refuse the training
behaviour by refusing the bot and you lose the search index with it.

This is the part most crawler advice gets wrong. There is no single rule that
covers both groups, because the two groups are built differently.

## What changed at Cloudflare, and when

Three dates matter, and they are commonly collapsed into one.

**1 July 2025.** Cloudflare marked what it called Content Independence Day. It
began blocking AI crawlers by default for domains newly onboarding to the
network, moved from an opt-out to an opt-in model, and opened a private beta of
Pay Per Crawl. More than a dozen large publishers endorsed it at launch.

**1 July 2026.** The single "Block AI bots" toggle was replaced. Every customer,
free plans included, can now manage AI traffic by behaviour across three
independent controls: Search, Agent and Training. Cloudflare's own documentation
defines Search as collecting or indexing content "so it can answer questions
about it later", Agent as acting "in real time on a person's behalf", and
Training as crawling "to train or fine-tune a model". Each can be set to allow,
block, or block only on pages that carry ads.

**15 September 2026.** New defaults landed for newly onboarding domains, and a
fourth Training setting appeared: Disallow AI Training. It writes a no-training
preference into robots.txt, keeps mixed-use crawlers Cloudflare labels
Accountable indexing for search, and blocks every other training crawler. Block
now cuts off mixed-use crawlers too, search included. The legacy toggle was
deprecated and existing settings were migrated automatically.

So the controls do now separate retrieval from training. That is an improvement
on the position a year earlier. It is also why checking matters more, not less:
the setting your site is running was probably chosen under the old model, and
the migration mapped it for you rather than asking.

### The numbers Cloudflare publishes about its own network

Fewer than 1% of Cloudflare sites block Search bots. Around 17% enable some
mechanism to block training. Cloudflare sits in front of more than 20% of the
web, so that second figure covers a large number of domains that made a training
decision and may not have revisited it since the controls changed twice.

## Why robots.txt cannot answer the question

robots.txt is a request. It is not a mechanism.

Three things break the assumption that reading the file tells you what happens.

Enforcement happens at the edge. A CDN or WAF rule can refuse a request before
it ever reaches your origin, and that rule does not appear in robots.txt. Your
file can permit a crawler that your edge then turns away.

Some crawlers ignore the file. Measurement by TollBit, reported in August 2026,
put 15% of AI page fetchers in Europe as reaching URLs that were disallowed. A
permissive file and a compliant crawler are two separate assumptions.

Some names in the file are not crawlers at all. Google-Extended and
Applebot-Extended are control tokens with no user-agent behind them. Nothing
identifies itself that way. Googlebot and Applebot do the fetching. Sending a
request with a user-agent nothing uses, then reporting the response as if it
described Gemini, is fabricated evidence. Those two can only be read from
robots.txt, never probed.

Cloudflare is blunt about the limits of the file it now writes on customers'
behalf. From its 15 September post: "A robots.txt directive alone cannot solve
this problem. Anyone can publish one, but it cannot identify who is crawling,
determine why they are crawling, or stop a crawler that ignores it."

There is a fourth case worth stating, because it is the one RFC 9309 settles. If
robots.txt returns a 5xx or times out, a compliant crawler must treat that as
disallow-all. An unreadable file is a block, not a pass. Observing that your
origin would have served the crawler proves nothing about whether it will ask.

## Two real cases, and what each one teaches

Both of these are observations from audit runs, dated, and both are checkable by
anyone.

### Reddit: the two signals disagree

Run on 30 September 2026. Reddit's robots.txt disallowed `/` for the `*` group,
which reads as a refusal to all four retrieval crawlers. The origin said
something else. OAI-SearchBot, Claude-SearchBot and PerplexityBot were each
served HTTP 200. GPTBot got HTTP 403 with no CDN fingerprint, meaning the
application itself refused it. ClaudeBot and CCBot were rate limited at 429,
which is congestion, not policy.

Read only the file and you conclude that retrieval is blocked. Read only the
origin and you conclude it is open. The honest answer is that the two signals
point in opposite directions, and which one wins depends on whether a given
crawler reads the file.

The other finding on that run is worth noting separately. The page returned
almost no readable text in raw HTML, because the content renders with
JavaScript. Major AI crawlers do not execute JavaScript, so being served the
page and being able to read it are also two different things.

### The New York Times: the false positive

Run on 30 September 2026. Every crawler user-agent got HTTP 403 from Fastly,
refused at the edge before reaching the origin. Six for six. That looks
conclusive.

It is not, and here is the reason. An ordinary browser request from the same
network also got 403. The refusal is about the requesting network, not about the
user-agent. Every row has to be reported as unknown rather than blocked.

This is the case that separates a measurement from a guess. A tool that fires
crawler user-agents without also firing a plain browser request cannot tell
"this site refuses GPTBot" apart from "this site refuses datacentre IPs". Both
produce the same 403. One is a finding you should act on and the other is an
artefact of where the request came from. Most tools will report both as a block.

## How to check your own site

The method is four steps, and the third is the one people skip.

1. Read your robots.txt and note what it says for the retrieval crawlers,
   separately from the training crawlers. Treat the Extended tokens as
   robots.txt-only.
2. Request one of your real content pages once per crawler, presenting that
   crawler's published user-agent. Record the status code and the response size.
3. Request the same page with an ordinary browser user-agent from the same
   network. This is your baseline. If the baseline fails, every crawler result is
   unknown and the run tells you nothing.
4. Check whether the served HTML actually contains your content, or an empty
   shell that fills in after JavaScript runs.

Then reconcile. A 403 with no CDN signature is usually your application. A 403
carrying a CDN fingerprint is a rule at the edge. A 429 is rate limiting and
should be re-run before you treat it as settled. A 200 with eight kilobytes of
markup and no prose is a rendering problem wearing a success code.

[Byline's free crawler access check](https://bylineseo.com/geo-analyzer) runs
exactly this, baseline included, if you would rather not script it.

### What to do with the answer

If retrieval crawlers are blocked and training crawlers are not, that is almost
always a misconfiguration rather than a decision, and it is the one worth fixing
first. In Cloudflare, that means Search set to allow. Check the rule that is
actually live, not the one you remember setting, because settings migrated
automatically in September 2026.

If you want to refuse training without losing search, the current mechanism is
Disallow AI Training rather than Block. Block now removes mixed-use crawlers
from search as well. One caveat from Cloudflare's own post: selecting Disallow AI
Training does not convey a no-training preference to Bing through robots.txt,
because Microsoft's support for that is targeted for early 2027.

If the baseline request fails, stop. You have not learned anything about
crawlers yet. Re-run from a different network before concluding anything.

If your pages serve no text without JavaScript, fix that before worrying about
access. Permission to fetch an empty shell is not worth much.

## What this check does not tell you

It tells you whether your origin served a request presenting a given user-agent,
from one network, at one moment. That is evidence about fetchability.

It is not evidence that any AI system has retrieved, indexed or cited the page.
Nothing you can run from outside those systems proves that.

Two limits are worth holding onto. Some crawlers verify themselves by IP range,
so a site that checks those ranges may treat the real crawler differently from
your probe, in either direction. And access is only the first condition. A page
can be perfectly fetchable and still be unusable, which is the difference
between retrievable and citable: whether an engine can lift an answer out of your
page, and whether anything in that answer points back to you. Access is the gate.
It is not the whole building.

:::faq
### Does blocking GPTBot hurt my AI visibility?
Not directly. GPTBot is OpenAI's training crawler. OAI-SearchBot is the one that
fetches pages to answer questions with a link back. Blocking GPTBot is a
decision about model training. Blocking OAI-SearchBot is a decision about
citations.

### Can I block AI training without losing search traffic?
For operators that run separate crawlers, yes. For Google, Apple and Microsoft,
one crawler does both jobs, so it depends on them honouring a stated preference
rather than on you refusing the bot. Cloudflare's Disallow AI Training setting
publishes that preference. As of September 2026 Microsoft had not yet
implemented robots.txt support for it.

### Why did a tool tell me my site blocks AI crawlers when it does not?
The most common cause is a missing baseline. Some sites refuse requests from
datacentre networks regardless of user-agent. Without a plain browser request
for comparison, that refusal is indistinguishable from a crawler-specific block,
and it gets reported as one.

### How often should I re-check?
After any change to your CDN, WAF or edge rules, and after any provider changes
its defaults. Cloudflare changed its AI controls twice between July 2026 and
September 2026 and migrated existing settings automatically, so a configuration
that was correct in June may not be the one running now.
:::

## Sources

- Cloudflare, "New options to manage AI traffic", 1 July 2026: [https://developers.cloudflare.com/changelog/post/2026-07-01-ai-traffic-options/](https://developers.cloudflare.com/changelog/post/2026-07-01-ai-traffic-options/)
- Cloudflare, Bots concepts, AI bot classification, last updated 1 July 2026: [https://developers.cloudflare.com/bots/concepts/bot/](https://developers.cloudflare.com/bots/concepts/bot/)
- Cloudflare, "Have it both ways: stay discoverable in search while disallowing AI training", 15 September 2026: [https://blog.cloudflare.com/accountable-mixed-use-ai-crawlers/](https://blog.cloudflare.com/accountable-mixed-use-ai-crawlers/)
- Cloudflare, Content Independence Day announcement, 1 July 2025: [https://blog.cloudflare.com/content-independence-day-no-ai-crawl-without-compensation/](https://blog.cloudflare.com/content-independence-day-no-ai-crawl-without-compensation/)
- RFC 9309, Robots Exclusion Protocol: [https://www.rfc-editor.org/rfc/rfc9309.html](https://www.rfc-editor.org/rfc/rfc9309.html)
- PPC Land, "Cloudflare drops planned Googlebot block for sites refusing AI training", 27 September 2026, for the TollBit figure and the settings migration detail: [https://ppc.land/cloudflare-drops-planned-googlebot-block-for-sites-refusing-ai-training/](https://ppc.land/cloudflare-drops-planned-googlebot-block-for-sites-refusing-ai-training/)
- Crawler probe observations for reddit.com and nytimes.com, 30 September 2026, from Byline's own audit archive.
