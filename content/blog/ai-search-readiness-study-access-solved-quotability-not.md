---
title: "Access Is Mostly Solved, Quotability Is Not: What 148 Homepages Showed About AI Search Readiness"
slug: "ai-search-readiness-study-access-solved-quotability-not"
excerpt: "Byline audited 148 homepages, 102 agencies that sell AI search optimisation and 46 software companies. Crawlers were let in almost everywhere. None of the 136 scored sites earned full marks for being easy to quote, and the best came within two points."
seoTitle: "AI Search Readiness Study: 148 Homepages Audited, Results"
seoDescription: "Byline's AI search readiness study of 148 homepages: AI crawler access was nearly solved, but none of 136 scored sites reached full marks for chunkability. Limits and method included."
publishedAt: "2026-11-26T09:00:00.000Z"
author: michael-osborne
categories: []
---

Byline audited the homepages of 148 sites for AI search readiness. For these
sites, on this measure, getting in was nearly solved and being quotable was not.
Crawler access cost the sites 4.3% of the points they lost. Chunkability, how
easily a page can be split into passages an answer engine could lift, cost 40.3%,
and not one of the 136 scored sites earned full marks for it. The best came
within two points.

Before any of that is read as a finding about the web, the limits come first,
because they decide what the numbers can carry.

## What does this study measure, and what does it not?

It measures what each site's servers returned to one request from one place, at
one time. It does not measure whether any AI engine retrieved, cited or ranked
any of these sites. No citation or visibility data was collected. Readiness is
not visibility.

The specific limits:

- **One vantage.** Every request came from a server in Virginia, in the United
  States, on Amazon's network. A site that serves one thing to Virginia and
  another to London or Tel Aviv is recorded as what Virginia saw. Seven sites
  were flagged as possibly serving a localised version, and five agencies declare
  a German, Polish or Spanish page language. Excluding the flagged sites moves no
  headline figure by more than a point or two.
- **Claimed identities, not real crawlers.** The probe sent each vendor's
  published user-agent string for six crawlers: three used for AI search
  (OAI-SearchBot, Claude-SearchBot, PerplexityBot) and three used for training
  (GPTBot, ClaudeBot, CCBot). It did not come from those vendors' own IP ranges.
  A site that refuses a claimed crawler from a stranger's address may be doing
  bot verification as designed. The real crawlers, on their own ranges, were not
  tested in either direction.
- **One pass.** The audit ran once, on 12 November 2026, over about two hours.
  There are no repeat measurements. Some rate-limit responses (HTTP 429) are
  partly the study's own request rate: about ten sites had also received repeated
  smoke-test requests from the same server earlier that day.
- **A rubric of our own.** The Retrievable score is Byline's. Its four pillars
  carry different weights (Access 30, Parseability 25, Chunkability 25,
  Extractability 20), so how many points a pillar loses depends partly on how
  heavily we weighted it. The rubric has had no outside validation, and the
  engine has been wrong on hand checks before. These rows were not hand-verified.
- **Neither population is random.** Both are described below.
- **A mixed engine version.** The harness ran on engine 2026.15. After a defect
  was found and fixed, 140 of the 148 rows were re-scored on 2026.16 and 8 rows
  were not, so 8 rows still carry 2026.15 scores. The pack is mixed and says so
  on every row. Among the 140 re-scored rows, no Citable band changed, and one
  agency's Retrievable score moved from 67 to 70.

## Who was audited?

The method was fixed on 8 November 2026, before any site was audited, and the
selection rule and both method records are released with this article.

**Population A** is 104 marketing agencies that publicly sell generative engine
optimisation (GEO), answer engine optimisation (AEO) or AI search optimisation,
found with 13 fixed search queries. Of those, 102 were audited. **Population B**
is software companies taken in order from G2's 2026 Best Global Software
Companies list, ranks 1 to 50, minus four that are not software businesses,
leaving 46, all audited.

That is 148 audited sites. Of them, 136 were scored (97 agencies, 39 software
companies). The other 12 are withheld: for 5 agencies and 7 software companies
the engine could not assess the page, either because the content only appears
after JavaScript runs or because the page request was refused. A withheld site is
not scored as zero and is left out of every distribution below. Counting
withheld rows as zero on access would pull the access figures down, to 93% for
agencies and 85% for software companies, which is why they are excluded rather
than imputed.

No site is named, in either population. Every site in the study is notified
before publication.

## Two sites could not be audited, and here is why

Two agencies in the file were never audited. Both are published as unresolved,
not dropped, because the selection rule names four reasons a site may be dropped
and neither of these is among them.

One returned HTTP 307 on all three attempts, from a challenge page served by a
bot-protection service. It is a JavaScript interstitial that computes a cookie
and reloads, with no redirect target. The study's request cannot pass it.

The other returned 200 from a plain request outside the United States, then hung
up the connection on all three attempts from the Virginia server. It is reachable
from one place and not from another, which is itself evidence for the first limit
above: the vantage matters.

Dropping either would amend the rule after the results were known, so neither is
dropped.

## How many sites could crawlers reach?

Nearly all of them. For the 136 scored sites, the Access pillar was worth 96.3%
of its points on average for agencies and 98% for software companies. Full marks
on access went to 77 of 97 agencies and 34 of 39 software companies.

Of all the points the 136 sites lost against the 100-point Retrievable scale,
access accounts for 4.3%. By the same count, parseability (whether the content
survives without running JavaScript, whether structured data is valid, whether
the markup is clean) accounts for 19.7%, extractability for 35.6%, and
chunkability for 40.3%.

On what this study can see, the door was open. Whether an engine then uses what is
behind it is the question the next sections are about.

## Why did no site earn full marks on chunkability?

Chunkability is worth 25 points and is the largest source of lost points. Agencies
scored 64.8% of it on average and software companies 57.2%. Of the 97 agencies,
27 scored under half of it, and 9 of the 39 software companies did.

Three checks make up the 25 points, and each is scored on the homepage:

- **Heading hierarchy (12 points).** Exactly one H1, enough H2 and H3 headings, no
  skipped levels, and a numbered sequence somewhere on the page. Average: 82% of
  the points. 58 of 136 sites earned full marks.
- **Self-contained sections (8 points).** At least eight sections that each have a
  heading and 40 or more words under it. Average: 56%. 43 of 136 sites earned full
  marks, 39 of them agencies against 4 software companies.
- **Block length distribution (5 points).** At least 65% of the page's text blocks
  between 40 and 180 words, long enough to say something and short enough to lift
  whole. Average: 25%. 4 of the 135 sites with this check scored earned full marks.

The block-length check is where the points go. It is also the check most likely to
be measuring what a homepage is for rather than a fault in it. Homepages are
written in short fragments: headlines, card copy, buttons, short proof points. A
page of mostly 20-word blocks is a normal homepage and a poor passage source, and
this study cannot say which of those two things it should be called.

### Is full marks on chunkability achievable?

Nothing in the scoring makes it unreachable. The highest chunkability score was
23 of 25, reached by six agencies. Each of those six earned full marks on heading
hierarchy and on self-contained sections, and 3 of 5 on block length. 23 sites
earned full marks on at least two of the three checks. Every single check has
been maxed by some site. No site has maxed all three at once.

The distribution is not clustered near the top. Across the 136 sites, 11 scored
under 10 of 25, and 105 scored between 12 and 21. A software company
did best at 20, and the next four were at 18.

So the accurate answer is that full marks is reachable and unreached. The gap
between the best homepage and the maximum is two points, and the gap between the
typical homepage and the maximum is about nine.

## What about the other half, Citable?

Retrievable asks whether an engine can fetch and read a page. Citable asks whether
the page gives an engine a reason to quote it as a source, using six signals read
across the homepage and up to three linked pages (About, blog, case studies).
Pages inspected per site ranged from 1 to 4, and the mix differs by population.

Of the 148 audited sites, 27 landed in the strong band, 80 adequate, 29 weak and
3 absent, with 9 that could not be verified. Two of the signals stood out:

- **Original evidence** (data, studies or first-hand results the site itself
  produced) was absent from 73 of 100 verified agencies and 31 of 39 verified
  software companies. No site, in either population, rated strong.
- **Named authorship** was absent from 23 of 100 verified agencies and 20 of 39
  verified software companies.

"Absent" here means not found on the 1 to 4 pages inspected by the engine's
heuristic, which is not the same as absent from the site.

## Do agencies score better than software companies?

On this sample, yes, and the comparison should not be taken further than the
sample allows. The median Retrievable score was 81 for the 97 agencies (middle
half 70 to 87, range 54 to 97) and 72 for the 39 software companies (middle half
66.5 to 75.5, range 48 to 89). The difference is unlikely to be chance
(Mann-Whitney z = 4.27, p = 0.00002).

The confound is in the sampling, and it arrives with the result. The agencies are
firms that chose to sell AI search optimisation and were found by searching for it,
so they have a commercial reason to look the part. The software companies are
large global businesses taken from a ranking, with enterprise bot protection and
heavily scripted pages. Neither group is random. Neither is the other's client
base, and no row links an agency to any customer. The study did not compare agencies
with their own clients, and it did not compare like with like. It compared two
groups that were each chosen for a different reason.

The pillar gaps are consistent with that. Software companies were ahead on access
(98% against 96.3%) and behind everywhere else: parseability 70% against 86%,
chunkability 57.2% against 64.8%, extractability 49.5% against 62%. The widest
single gaps were server-rendered content, where 53 of 97 agencies earned full
marks against 7 of 39 software companies, and question coverage, where 31 of 97
agencies earned full marks against 1 of 39.

None of that shows that agencies are better at the work. It shows that the two
samples differ, in a direction a plain reading of the selection would predict.

## Which sites refused the crawlers, and what do the two kinds of refusal mean?

Two different things hide inside "blocked", and the study can tell them apart.

**A site that says yes and serves no.** In 15 of the 148 probed sites (11 agencies,
4 software companies), robots.txt permitted the AI crawlers and the origin refused
the claimed crawler's request anyway. That is 12.0% of the 92 agencies and 11.8% of
the 34 software companies on which the crawler rows could be attributed, effectively
the same rate in both groups (Fisher p = 1). It is a divergence between what the
site says and what it does. It is not proof of an error: it may be a bot-management
product doing its job against a claimed crawler from the wrong address. Twelve
sites (9 agencies, 3 software companies) also served some of the six crawlers and
not others, which is a second kind of mismatch.

**A site that serves nothing to the measurer.** In 22 sites (10 agencies, 12
software companies), the plain baseline request, one that claims to be an ordinary
browser, was itself refused or unanswered: 15 with HTTP 403, 3 with 202, 2 with 429
and 2 with no response. That is 9.8% of agencies against 26.1% of software
companies (Fisher p = 0.013, unadjusted). When the baseline is refused, nothing
about that site's crawler behaviour can be attributed, so all 22 have no usable
crawler rows. Of the 22, 11 were withheld and 11 were scored anyway, because the
audit's own page request was a separate request that succeeded.

This corrects a tidier story. The two groups did not differ detectably in how often a site's
robots.txt and its server disagree. They differ in how often a site refused the
measurement outright, and that is the real difference between them.

## The two failure modes, and what a score can honestly claim

The two modes are different problems, and both are about what a measurement
observed.

The first is a mismatch that can be seen. When robots.txt permits a crawler and the
origin refuses it, both facts are on record, the disagreement is the finding, and a
reader can check it.

The second cannot be seen from outside. When a site refuses the request used to
measure it, a score computed anyway describes something the measurement did not
observe. This study reported those sites as withheld or as unattributable, and
did not turn them into a confident number. A score for a site that refused the
request is a statement about a page that was not read, and any method that
produces one is reporting something it did not observe.

The chunkability result is the other kind of failure entirely. There the request
succeeded and the page was read in full, and the page still was not built for
quoting. That one is the site's own doing and the site's own to fix.

## What does this study not say?

It does not say that any AI engine retrieved or cited a site. It does not say
agencies are better than software companies. It does not say the refusals are
errors, or that real crawlers are refused. It does not say what Europe or Asia
sees. It does not say the scores are stable: this was one run. And it does not say
the rubric is neutral between pillars. A different weighting would move the shares
of lost points, though not the fact that no site cleared chunkability.

The pre-registration is what protects the findings that are here. The rule was
written before the audit, no site was dropped for its result, and the two sites
that could not be audited are published as unresolved, with reasons.

:::faq
### Does the study show which sites AI engines cite?
No. It measures what each homepage's server returned to one request from one place, and how ready the page is to be retrieved and quoted. No citation or visibility data was collected, and readiness is not visibility.

### How many sites were audited and how many were scored?
148 were audited: 102 agencies and 46 software companies. 136 were scored (97 agencies, 39 software companies). 12 were withheld because the engine could not assess the page, and a withheld site is excluded, not scored as zero.

### Did any site earn full marks for chunkability?
No. The highest of 136 was 23 of 25, reached by six agencies. Each earned full marks on heading hierarchy and self-contained sections and 3 of 5 on block length. 23 sites earned full marks on at least two of the three checks, and none on all three.

### Are agencies better prepared than software companies?
Agencies had the higher median Retrievable score, 81 against 72, but the two groups were chosen differently and neither is random. Agencies are firms that sell this service and were found by searching for it. Software companies are large global firms from a ranking. The study cannot say agencies do the work better.

### Does "blocked" mean the AI crawlers were refused?
Not necessarily. The probe sent each vendor's claimed user-agent string from a server in Virginia, not from the vendors' own address ranges, so a refusal can be a site correctly distrusting an unverified crawler. 15 sites had robots.txt permit the crawlers while the origin refused the request, and 22 refused even a plain browser-style request.

### Why are two agencies not audited?
One serves a JavaScript bot challenge that returns HTTP 307 with no redirect target. The other responds from outside the United States and hangs up on every attempt from the Virginia server. Neither fits a reason for dropping a site in the pre-registered rule, so both are published as unresolved.

### Which engine version scored the sites?
Mixed. 140 rows were scored on 2026.16 and 8 on 2026.15. No Citable band moved when the 140 were re-scored, and one agency's Retrievable score moved from 67 to 70.
:::

## Sources

- Byline, AI search readiness study: selection rule, written 8 November 2026, before any site was audited (Byline's own working file, released with this article).
- Byline, Population A method record: 13 queries, verification procedure, counts, exclusion log and known biases, searched and verified 8 November 2026.
- Byline, Population B method record: source list, capture date 9 November 2026, counts, exclusions and known biases.
- Byline, study analysis pack, 148 audited rows, engine 2026.16 (140 rows) and 2026.15 (8 rows), crawler probe run from a United States server on 12 November 2026.
- Byline, per-check score data from the stored study reports, 136 scored rows.
- G2, Best Global Software Companies, top companies list: [https://www.g2.com/best-software-companies/top-companies](https://www.g2.com/best-software-companies/top-companies)
- Related Byline reading: [which AI crawlers your site actually serves](/blog/which-ai-crawlers-your-site-actually-serves) and [the Retrievable and Citable teardown of Google's AI features guide](/blog/google-ai-features-guide-retrievable-citable-teardown).
