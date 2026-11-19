---
title: "How We Chose Every Site in Our AI Search Readiness Study, Before Showing a Single Result"
slug: "how-we-chose-the-sites-in-our-ai-search-readiness-study"
excerpt: "Most AI search surveys give a number and no method. Here is ours, published before the findings: the exact queries, the named list, the only permitted exclusions, the 91% qualification rate that undercuts our own framing, and the biases we already know about."
seoTitle: "AI Search Readiness Study Method: How the Sites Were Chosen"
seoDescription: "The pre-registered method for Byline's AI search readiness study: 13 exact search queries, a named G2 list with its capture date, the only permitted exclusions, and every known bias."
publishedAt: "2026-11-20T09:00:00.000Z"
author: michael-osborne
categories: []
---

Byline has run a study of AI search readiness on 150 chosen sites, and this
article does not contain a single result from it. It contains
how the 150 were chosen: the search queries, the named list, the only reasons a
site can be removed, and the weaknesses we already know the sample has. It is
published first on purpose, so that the findings can be judged against a method
that was fixed before anyone saw them.

The category has no shortage of surveys. Many give a headline percentage and say
little about who was counted. A number is only as good as the rule that produced
the population behind it, so the rule comes first.

## Why publish the method before the findings?

Because a method written after the results is a method shaped by the results. If a
site that scores badly can be dropped for being unreachable, and a site that scores
well never is, the study finds what its authors hoped to find without anyone
telling a lie.

The selection rule for this study was written on 8 November 2026, before any site
in it was audited. It fixes the question, both populations and the reasons a site
may be dropped. It contains this sentence: "No site is ever dropped for its result.
Not for scoring badly, not for scoring well, not for being boring."

The audit has since been run. The results have not been published, and nothing in
this article draws on them.

We cannot give you an independent timestamp for the 8 November file. What we can
give you is its text, its file hash, and the dates below. The hashes are in the
last section, so that when the files are released alongside the findings, anyone
can check that they are the files described here.

## What question does the study ask?

Do the firms that sell AI search readiness have sites that are themselves
retrievable and citable, and how do they compare with the companies they sell
into?

Two populations answer it. Population A is marketing agencies that publicly sell
generative engine optimisation (GEO), answer engine optimisation (AEO) or AI
search optimisation as a service. Population B is B2B software companies taken in
order from a named public ranking.

Each site gets one audit on a single pinned version of Byline's engine, 2026.15,
with the version recorded on every row because scores from different versions are
not comparable. The audit reads the homepage, follows up to three linked pages
(About, blog and case studies) for the Citable signals, and sends a crawler probe.
It runs from a server in Virginia, in the United States, so that every site is
asked from the same place. What is reported:

- the Retrievable score distribution for each population, and the four pillars
  (Access, Parseability, Chunkability, Extractability) separately;
- the Citable band distribution, with named authorship and original evidence
  broken out, because those are the two signals most often missing;
- access findings: whether robots.txt permits a crawler that the origin then
  refuses, whether a 200 response is really a JavaScript challenge, whether one
  vendor's crawler is served while another's is refused, and whether a plain
  browser request is refused too, in which case nothing about the crawler rows can
  be attributed;
- how many sites had too little readable content to be scored at all.

The browser-baseline comparison is explained in
[Your Edge Decides Which AI Crawlers See Your Pages](/blog/which-ai-crawlers-your-site-actually-serves).

This is an assessment of content readiness. It is not a measurement of AI
visibility, and nothing in the study says whether any site is cited.

## How were the agencies found?

By a fixed set of searches, run on one day, in one order. The rule: an agency
qualifies only if its own website carries a page that offers GEO, AEO or AI search
optimisation as a service to clients. A dedicated service page qualifies. A blog
post about the topic does not. A page describing the agency's own use of AI does
not.

Thirteen queries were run on 8 November 2026, in this order, and results were
taken in the order returned:

| ID | Exact query string |
|---|---|
| Q1 | `generative engine optimization services agency` |
| Q2 | `answer engine optimization services agency AEO` |
| Q3 | `"generative engine optimization" services page agency ChatGPT visibility` |
| Q4 | `AI search optimization agency services` |
| Q5 | `GEO agency UK generative engine optimisation services` |
| Q6 | `LLM visibility optimization agency services get cited in ChatGPT` |
| Q7 | `"answer engine optimisation" agency services UK Australia Canada` |
| Q8 | `GEO services ecommerce SaaS agency "AI visibility" retainer service page` |
| Q9 | `digital marketing agency "AEO" "GEO" services India Europe` |
| Q10 | `"ChatGPT SEO" OR "Perplexity optimization" services agency hire` |
| Q11 | `"generative engine optimization" agency Germany Netherlands Spain services` |
| Q12 | `answer engine optimization service local business agency healthcare law firm` |
| Q13 | `"AI Overviews optimization" OR "AEO services" agency pricing packages` |

Candidates came from the returned links and from agency names inside the returned
pages. A name seen in a third-party roundup was never treated as evidence: it was
resolved to a domain and verified on its own.

Verification followed four steps for every candidate. Fetch the homepage and record
whether it is reachable. Fetch the service page. Apply the rule. Extract a verbatim
quote of 10 to 25 words from the fetched page that proves the client offer. A
search snippet was never accepted as evidence.

## Why does the 91% qualification rate undercut our own framing?

Because the study's premise was that selling AI search readiness makes an agency a
meaningful group to measure. The count says the label separates almost no one.

114 agencies were examined, meaning at least one of their pages was fetched. 104
qualified and 10 were excluded. Among candidates that reached verification, 91%
qualified.

By late 2026, a GEO or AEO service page is close to universal among the agencies
that surface for these queries. "Agency that sells GEO" is nearly the same set as
"agency that ranks for GEO queries". That weakens the idea that the study samples
an unusual, self-selected group, and the findings will have to be read with that in
mind.

## What were the only permitted exclusions, and what was excluded?

The rule names four reasons a site may leave the study, and every drop is counted
and reported:

1. The domain does not resolve.
2. The homepage returns a 404 or a 5xx on every attempt across the run window.
3. The site duplicates one already in the population.
4. For Population A only: on inspection, the GEO or AEO page does not exist or does
   not offer the service to clients.

Nobody was removed for being small, unimpressive, or likely to react badly to being
contacted. Solo operators, a one-page productised shop and agencies whose only
evidence was a line item on a combined services page all stayed in.

The ten excluded agencies, with their reasons:

| Number | Reason |
|---|---|
| 3 | Software products with self-serve plans and a login, not agencies |
| 2 | Named in syndicated newswire rankings, but no website could be found for either |
| 1 | Domain parked and for sale |
| 1 | Publishes "top GEO agencies" roundups but sells no GEO service |
| 1 | A video production business that only publishes an article about AEO firms |
| 1 | A one-person practice whose only client offer sits inside an About page (borderline, excluded for consistency) |
| 1 | Could not be verified: homepage and service page both returned a bot-verification interstitial on every attempt |

The last row does not fit the rule cleanly. "Could not verify" is not one of the
four permitted reasons. It is logged as a verification failure, not a judgement
that the agency does not qualify, it is flagged for a manual re-check, and it is
counted here rather than hidden. Bot-detection bypass was not attempted.

The two agencies that could not be found are worth a sentence of their own. Both
were named in press-release-style "top GEO providers in Europe" items syndicated
across newswire-style sites. Syndicated rankings of this kind are unreliable
sourcing.

## How was the SaaS population chosen?

From one named public list, taken strictly in its published order. The list is G2's
2026 Best Software Awards, Best Global Software Companies, announced on 18 February
2026. It was captured on 9 November 2026, a day after the selection rule was
written and before any site was audited. The rule for the population is
reproducible by anyone with a browser: open the list, take companies in the order
G2 prints them from rank 1, and stop at rank 50. Do not skip, reorder or
substitute.

Three things about that list matter.

**It stops at rank 50, not 100.** The pre-registered target was 100 companies in
each population. G2 serves the full list behind bot protection for automated
clients, and the readable text ended part-way down, with ranks 1 to 54 available.
Rather than transcribe ranks 55 to 100 from a second-hand reprint, which would
weaken provenance and risk transcription errors, the population was cut at a clean
rank 50, all of it from the primary source. Ranks 51 to 100 were not examined. That
is a scope limit, not an exclusion.

**Four companies were excluded.** Google (rank 2) is a consumer internet
conglomerate whose B2B software, Workspace, lives on a different host. Microsoft
(rank 21) is a mixed consumer and business storefront. PayPal (rank 31) is a
payments network. Upwork (rank 40) is a labour marketplace that sells access to a
market, not software. All four fall under the one criterion that is not purely
mechanical: is the company's primary business selling subscription software to
businesses? That left 46. Re-including all four gives a 50-row population and
changes nothing else in the method.

**Other lists were considered and set aside.** Forbes Cloud 100 was rejected
because it covers only private, venture-backed companies, so every public software
company is excluded by construction. G2's Best Software Products list was rejected
because it ranks products, so one vendor appears many times and the de-duplication
choices would shape the population. G2's regional and segment variants were
rejected because each imports its own geography or momentum bias. Revenue-ranked
databases that would have given smaller companies were set aside without a hands-on
test, because they update continuously and a stranger could not reconstruct the
same snapshot later. That is a road not taken, and we say so.

## Why are the two populations different sizes, and does it matter?

Population A has 104 sites. Population B has 46. They also differ in kind, and the
size gap is the smaller part of that.

Population B is the most-reviewed software vendors on the largest B2B review
marketplace. It includes multi-billion-dollar public companies, and the smallest
names in it are still well-funded scale-ups. There is no small company in it.
Population A is dominated by small shops: a rough, low-confidence estimate from
team pages puts 3 as solo operators and 52 as small agencies of 2 to 20 people,
against 29 of 21 to 100 and 13 of more than 100.

The two populations are not matched on size, budget or in-house engineering
capacity. Any difference between them is confounded by that, and the study will not
present the comparison as a controlled one.

## What biases do we already know about?

All of these were recorded before the audit ran.

For the agencies:

- **The search surface is dominated by agency-published roundups.** Of about 125
  result links across the 13 queries, the clear majority were "best GEO agencies"
  lists published by agencies that sell GEO, often ranking themselves first. At
  least 18 agencies in the final list publish one. Agencies with a content habit
  are over-represented. Agencies that sell GEO without writing about the market are
  under-sampled, and agencies outside the reciprocal citing network are invisible
  to this method.
- **Geography skews to English-language and US markets.** By the country recorded
  for each agency, 56 of 104 are US, 17 UK, 9 India, 4 Australia, 4 Germany, 2
  Spain and 2 Ukraine, with single agencies in seven other countries and 3
  unknown. No Canadian-headquartered agency was found, despite Q7 naming Canada.
- **Size figures are inferences.** Only a handful of agencies publish a headcount.
  The sizes recorded are 3 solo, 52 small (2 to 20 people), 29 mid (21 to 100), 13
  large (more than 100) and 7 unknown, all low confidence.
- **The terminology is unstable.** GEO, AEO, AIO, LLM SEO and AI search
  optimisation are used as synonyms, as a hierarchy and as mutually exclusive
  categories, sometimes within one site. What an agency sells was coded from page
  content, never from the label.
- **It is a snapshot of a market still forming.** Many service pages carry 2026
  dates. A re-run in six months should be expected to differ.
- **Self-conferred credentials are common.** At least one agency markets self-awarded
  "verified" and "certified" status, and several sites embed content aimed at AI
  models rather than people. None of that was used as evidence.
- **Verticals are under-sampled except law.** Seven of the ten results for the one
  vertical query were legal-sector sellers. Other verticals almost certainly have
  equivalent clusters that one query did not reach.
- **Verification was done by one coder.** The verdicts were produced by AI agents
  working from the written rule, each required to return a verbatim quote. A second
  coder re-running the six borderline rows is advisable, and a replication using
  one fetch tool will fail on a different subset of sites. Expect 5 to 10% of a
  re-run to fail on transport rather than substance.

For the software companies:

- **Large-company skew, severe.** See the size section above.
- **Review-marketing bias.** Placement needs at least 10 verified reviews in the
  prior year and rewards satisfaction plus market presence, which favours companies
  that run funded review programmes, so companies with mature marketing operations.
  A population selected on a serious marketing team is the population most likely
  to have already done SEO work. That biases against finding SaaS companies
  unprepared.
- **The snapshot is load-bearing.** G2 reports that 34 of the 2026 top 100 are
  newcomers. The 2027 edition will be a materially different population.
- **Category skew.** HR, payroll and work-management software dominate, and
  developer tools, data infrastructure and vertical software are thin.
- **One row is self-confounding.** One company sells SEO and AI-visibility tooling,
  so its own homepage is not independent of the thing being measured.
- **Eight retained rows are flagged** as mixed consumer and business, or not pure
  SaaS. Dropping all eight leaves a 38-row conservative core, and a column in the
  data makes that filter a one-line change.

## Where does practice differ from the rule?

Four places, and none of them is hidden.

1. **The SaaS list was chosen after the rule was first written.** The rule left the
   list open. It was fixed on 9 November, a day later and before any audit.
2. **Population B is 46, not 100.** The reason is above.
3. **The rule says "one homepage audit".** The engine reads the homepage for
   Retrievable and follows up to three linked pages for the Citable signals, so the
   pages inspected per site range from one to four. This differs from the wording of
   the rule, and the published method will say so.
4. **Our own harness was tested on some of these sites.** Between 9 and 12 November
   the study harness was smoke-tested on a handful of sites from both populations.
   Those rows are never study data and were written to separate directories.

One more difference is not a deviation but should be known. The agencies and the
companies were verified in a browser whose location was Israel, and several
homepages redirected by geography. The audit itself runs from the United States. The
population files record each site's global root address, and the study fixes one
vantage point so that every site is audited from the same place.

## What would change the method, and what never will?

Nothing in this method changes after the first audit. If it turns out to be wrong,
the honest step is to say so in the published piece and state what changed, not to
amend the file quietly. The same goes for the engine. The study is pre-registered on
engine 2026.15. If the engine changes before the findings are published, the piece
will say so, say what moved, and say which rows are affected.

The commitments that go with the findings:

- The results are published whichever way they fall, including the dull case where
  every site serves every crawler and the only finding is on citability.
- No site is named in the findings. Aggregates are public, and specifics are
  private.
- Every site in the study is told before publication that it is in it, and what its
  own row says. The notifications are paced over several days, and publication
  waits for the last one.

## How can anyone check that these files have not changed?

By hashing them once they are released. SHA-256 hashes of the five working files as
they stand on 19 November 2026, with the date each was last saved:

| File | Last saved | SHA-256 |
|---|---|---|
| Selection rule | 8 November 2026 | `575477df8ac51e5f21923da8730af390fdd734cac3f573e71222ede444cb7ab4` |
| Population A method record | 8 November 2026 | `7cfcc6b22a74d318a6bb1893b43b5453627fd685f3a79e25598787da69e7518d` |
| Population A site list (104 rows) | 8 November 2026 | `659b70607df0105a993baa2e1dfac81cba79e2addfc7d9b4aedd81d8eb9a7649` |
| Population B method record | 9 November 2026 | `4993de32db6b59238f20515e578c7e15ba5861649bda9acf2e7931227ea19401` |
| Population B site list (46 rows) | 9 November 2026 | `f90ef2481e5ef31b5d43c089d0a63de568156b9574819122f4cfdcd3df45a8a5` |

The selection rule states that it is published with the study. If any of these
files changes before then, the change will be published with the old hash beside
the new one.

One discrepancy is already known. The tallies of country and size in the
Population A method record were written before the final list was frozen and differ
slightly from the list itself, which is the source used above.

:::faq
### Is the study a random sample?
No. Population A is what a fixed set of 13 searches surfaced on one day, and Population B is the top 50 of a named list minus four companies that are not software businesses. Neither is random, and neither claims to represent all agencies or all SaaS companies.

### Why publish the method before the findings?
So that nobody can adjust the population after seeing which sites score well or badly. A rule fixed in advance, with permitted exclusions named, means the findings can be tested against it.

### Can a site be dropped because of its score?
No. A site can only be dropped for a reason the rule names: the domain does not resolve, the homepage returns a 404 or 5xx on every attempt, it duplicates another site, or, for agencies, it has no page selling the service. A site that fails for any other reason is reported with the reason and not removed silently.

### Why is the SaaS population 46 companies when the target was 100?
The source list is served behind bot protection and the readable text stopped partway down. Rather than copy the remaining ranks from a second-hand reprint, the population was cut at rank 50, all taken from the primary source, and four of those 50 were excluded as not being software businesses.

### Will the sites in the study be named?
No. The findings are published as aggregates, and every site is told before publication that it is included and what its own row says.

### Does the study measure whether AI systems cite these sites?
No. It assesses how ready each homepage is to be retrieved and cited. It does not measure AI visibility or whether any engine has cited any site.
:::

## Sources

- Byline, AI search readiness study: selection rule, written 8 November 2026, before any site was audited (Byline's own working file; hash above).
- Byline, Population A method record: 13 queries, verification procedure, counts, exclusion log and known biases, searched and verified 8 November 2026 (hash above).
- Byline, Population B method record: source list, capture date 9 November 2026, alternatives considered, counts, exclusions and known biases (hash above).
- G2, "G2's 2026 Best Software Awards", 18 February 2026: [https://company.g2.com/news/g2s-2026-best-software-awards](https://company.g2.com/news/g2s-2026-best-software-awards)
- G2, Best Global Software Companies, top companies list: [https://www.g2.com/best-software-companies/top-companies](https://www.g2.com/best-software-companies/top-companies)
- Byline's own audit archive and study harness record, engine 2026.15 (pinned).
