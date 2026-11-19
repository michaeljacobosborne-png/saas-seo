---
title: "We Audited 148 Sites, Then Found Our Own Scoring Engine Was Wrong. Our First Fix Was Wrong Too."
slug: "we-found-our-own-ai-search-scoring-engine-was-wrong"
excerpt: "Byline's brand-claim proximity check told Wikipedia's Coffee article that its name appeared in 2 of 42 sections. The true answer was zero. Here are the three defects, how a self-contradicting report gave them away, what the fix changed across 148 audited sites, and the part we have not fixed."
seoTitle: "We Found Our Own AI Search Scoring Engine Was Wrong"
seoDescription: "Byline's brand-claim proximity check named one brand and counted another, counted menus as claims, and credited other companies' names. What we found, what the fix moved, and what stays broken."
publishedAt: "2026-11-24T09:00:00.000Z"
author: michael-osborne
categories: []
---

Byline's engine told Wikipedia's Coffee article that its brand name appeared inside
2 of 42 substantive sections. The true answer is zero. The check that produced the
number, brand-claim proximity, had three defects, and we found them only because
one report contradicted itself. They are fixed in engine version 2026.16, and
scores from earlier versions are not comparable with it.

Before that fix, we had already audited 148 sites for a study. The part that makes
this uncomfortable to publish is what happened next. Measured across those sites,
the defect moved no brand-proximity band on any of the 138 we could re-score. And
the first version of our fix did move some, all downward, and all of them wrongly.

## What did the engine say about Wikipedia?

On 16 November 2026, Byline re-ran Wikipedia's Coffee article on engine 2026.15.
The retrievability score had not changed since the 2 November run (87 out of 100).
The brand-claim proximity line read:

> "Contributors to Wikimedia projects" appears inside only 2 of 42 substantive
> sections. Most sections carry no attribution anchor of their own.

That sentence looked plausible and was not true. The string "Contributors to Wikimedia
projects" appears once in the page's HTML, inside the JSON-LD that credits the
article's author. It appears in no section of the body at all.

## How did we catch it?

By reading two lines of the same report that could not both be right. The
Structured data validity check said:

> No Organization, LocalBusiness or Person type is declared, so the markup does not
> say who publishes this.

The Entity resolution signal, reading the same JSON-LD, said:

> An Organization entity is declared as "Contributors to Wikimedia projects".

One of them had to be wrong, so we went looking, and the brand line failed the same
check. No test had caught it. A reader who saw both lines in one report would
reasonably have concluded the tool was broken, and they would have been right.

## What were the three defects?

**1. The report named one brand and counted another.** The check searched for
several names at once: the declared organisation, the domain's own name and the
title suffix. For Wikipedia that meant "Wikimedia Foundation" and "Wikipedia". The
sentence printed only one name, and it was not the one that matched. The two
sections it counted matched "Wikipedia", not the name it displayed. A report that
prints one name and counts another is misleading its reader.

**2. Page furniture was counted as claim text.** The two sections that matched
"Wikipedia" were the page-tools menu, which carries a link called "Abstract
Wikipedia", and the hidden category list, which carries "Wikipedia indefinitely
move-protected pages". Neither is a claim. Both sit inside the page's main content
region, so the engine read them as body text. Brand-claim proximity exists to ask
whether a lifted passage would carry the brand's name with it. A menu link cannot
be lifted as a passage.

**3. Other organisations' names counted as the site's own brand.** The engine read
every Organization declared anywhere in the markup as a candidate brand, including
the author credit, which is how "Contributors to Wikimedia projects" ended up as
the displayed name. The same logic would count a partner, a sponsor or a client
named in the markup. A site does not earn brand proximity by mentioning another
company.

All three ran in the same direction. Each could only make a site look as if its
brand sat beside its claims more often than it did.

## What did the fix change?

Engine 2026.16 changes five things.

- The finding now lists every name it counts, so what is printed and what is counted
  are the same thing.
- Text inside a nav, an aside or a category, tag or breadcrumb list no longer counts
  as claim text. A genuine claim in a list item or a heading still counts.
- A brand is the site's own organisation: a node of its own, or the declared
  publisher, copyright holder or parent. An author credit, a membership, a sponsor,
  a client or a partner is not.
- Structured data validity and Entity resolution now use one definition of "an
  Organization is declared", so they cannot disagree. Where the only organisation
  declared is an author credit, both lines say so.
- The engine version moved from 2026.15 to 2026.16.

On the Wikipedia page, brand-claim proximity now reads zero of 42 sections and the
band is absent, not weak. Structured data validity moves from 5 of 8 to 8 of 8,
which adds three points to the retrievability score. That is the one change that
ran the other way: the contradiction had been taking points off a page that does
declare its publisher.

## How much did it matter across the 148 audited sites?

We measured it rather than assume. Pages change, so comparing old scores against new
ones would mix the engine's effect with the sites' own edits. Instead we fetched
the homepages again and scored each one on both engine versions side by side, from
identical HTML.

Of the 148 audited sites, 138 could be compared. Nine could not be fetched again
and one returned no readable text on the day. The comparison also showed how much
the measurement itself moves: 24 of the 138 differed on some signal or score
between the study run and a re-run on the same engine five days later, because the
pages had changed or were served differently to a different location. That is why
the side-by-side design matters.

Then the result, in two parts.

**The first version of the fix was wrong.** It excluded every header and footer
element and every Organization that was not the publisher. On the study sites it
moved three brand-proximity bands, every one downward. We went looking at why each
moved, and all three movements were errors. Two were real brand mentions: a
section's intro paragraph sitting inside a header element, and a closing call to
action sitting inside a footer element, both inside the main content region, where
the HTML standard ties a footer to its nearest section and ARIA in HTML treats a
header or footer inside main, article or section as that section's own, not the
page's banner or footer.
The third was a declared parent organisation's name, which is the same company. The
new engine had made three sites look less branded than they were. A false absence
is the worse error, because it is a finding someone might act on.

**The corrected fix moved no brand-proximity band on any of the 138 sites.** No
overall Citable band moved and no other signal moved. One Retrievable score moved,
by three points, the same contradiction fix that moved Wikipedia's.

We also sized two cruder tests first, one counting only text inside paragraphs and
one counting only the single displayed name. Between them they would have lowered
the band of roughly one site in five. We did not adopt them, because it would have deleted real claims written in
list items and headings, and the measurement above is the reason that decision
holds.

So the defect was real and invisible on the study sites. A likely reason is that
most sites name themselves in ordinary body copy, so a menu link or a partner's name
adds to a count without changing its band. Wikipedia's Coffee article is the case
where the count mattered, because none of its body paragraphs names the
publisher.

## What is still wrong?

Page furniture inside the main content region still counts toward the word count
and the Parseability pillar. That is a larger issue than the one we fixed, and we
have not fixed it.

Wikipedia's Coffee page reports 16,572 words of content in its raw HTML. The first
section of that count is the language switcher, which lists 210 languages. The
engine reads it as content because it sits inside the main region. The Retrievable
score for that page is therefore computed over a word count that includes a menu.
Cleaning it would move word counts and Parseability on every site, so it needs its
own version bump and its own measurement. Until then, treat the word count on a page with a long language or category list as overstated.

## What does version 2026.16 mean for earlier scores?

Brand-claim proximity from earlier versions is not comparable with 2026.16.
Parseability is not either, by up to three points on a page whose only declared
organisation is nested as the publisher.

For the study, the rows were produced on 2026.15 and the study was registered on
that version. We re-scored them on 2026.16 as described above. The findings, when
they are published, will state the version and say which rows differ between the
two.

Reports shared before this change keep the text they were issued with. They were
not re-scored, so an older shared report can still carry the old brand-proximity
wording.

A draft that quoted the "2 of 42" figure was withdrawn before it was posted. One
public post earlier had quoted a count of the same kind for a different homepage,
that its name appeared in 2 of its 10 substantive sections. We re-ran that page on
2026.16 and the count is the same.

## What should anyone take from a published scoring error?

That a score you cannot interrogate is a score you should not rely on, ours
included. Three checks cost nothing.

- Ask the tool to show the exact string it counted, and search the page for it.
- Read the report for two lines that disagree. A contradiction is cheap to find and
  expensive to explain away.
- Ask what happens to the number when you change the rule. We measured ours on
  identical pages and published that the effect was nearly nothing on 138 sites,
  because a fix that looks important and moves nothing is also a finding.

The check that caught this one was a person reading one report closely. The test
that now guards it uses the Wikipedia article as its fixture, so the page that
exposed the defect is the one that will keep it fixed.

:::faq
### What is brand-claim proximity?
It is one of six signals in Byline's Citable band. It asks how many substantive sections of a page contain the brand's own name in their body text, because a passage lifted from a section with no name carries no attribution. It is a property of the page and says nothing about whether any AI engine cites it.

### What did the first version of the fix get wrong?
It treated every header and footer element as page furniture and ignored Organizations that were not the declared publisher. On three study sites that removed real mentions of the site's own name, so their brand-proximity bands fell when they should not have. The corrected version moved none of the 138 comparable sites.

### Which engine version fixed it?
Version 2026.16. Scores and findings from 2026.15 and earlier are not comparable with it for brand-claim proximity, and for Parseability by up to three points where the only declared organisation is nested as the publisher.

### Is the word count on long pages still overstated?
Yes, on pages whose main content region contains a long menu, language list or category list, such as the Coffee article on Wikipedia. That is a known, unfixed issue and will be fixed with its own version change.

### Did the error affect the AI search readiness study?
Across the 138 study sites that could be compared, no brand-proximity band and no Citable band moved. One Retrievable score moved by three points. The study's findings will state the engine version and which rows differ.

### Does Byline measure whether AI engines cite a page?
No. It assesses whether a page can be retrieved and cited, in code, with the evidence under every finding. It does not measure AI visibility.
:::

## Sources

- Byline audit of en.wikipedia.org/wiki/Coffee, 16 November 2026, engine 2026.15, with the crawler probe from a United States server (Byline's own audit archive).
- Byline audit of en.wikipedia.org/wiki/Coffee, 2 November 2026, engine 2026.14: retrievability 87 out of 100, citability Adequate (Byline's own audit archive).
- Wikipedia, "Coffee", page HTML as fetched 16 November 2026, containing the JSON-LD author credit, the page-tools menu and the hidden category list: [https://en.wikipedia.org/wiki/Coffee](https://en.wikipedia.org/wiki/Coffee)
- Byline engine 2026.16 change record and regression tests, 17 November 2026, using the Wikipedia article as the fixture (Byline's own test suite).
- Byline study re-score, 148 audited sites, 138 compared on identical pages under engines 2026.15 and 2026.16, 17 November 2026 (Byline's own working file).
- WHATWG, HTML Living Standard, sections: a footer represents a footer for its nearest ancestor sectioning content element: [https://html.spec.whatwg.org/multipage/sections.html](https://html.spec.whatwg.org/multipage/sections.html)
- W3C, ARIA in HTML: a header or footer maps to the banner or contentinfo role only when it is not a descendant of article, aside, main, nav or section: [https://www.w3.org/TR/html-aria/](https://www.w3.org/TR/html-aria/)
