# Are audit reports ready to send to prospects cold? (2026-10-04)

Judgement call, not a test. Eight UK/US SEO agencies and consultancies audited live with `scripts/save-audit.ts`; reports are in `C:\Users\ozzy5\Documents\byline-audits\` (INDEX.md, rows dated 2026-10-04).

| Site | Retrievable | Citable | Note |
|---|---|---|---|
| builtvisible.com | 64 | Adequate | |
| seerinteractive.com | 77 | Adequate | |
| portent.com | 65 | Adequate | crawler-UA requests refused (see issue 2) |
| ipullrank.com | 75 | Strong | our probe hit their rate limit |
| thisisgain.com (vertical-leap.uk redirects here) | 69 | Adequate | |
| screamingfrog.co.uk | 79 | Adequate | |
| aira.net | not run | — | refuses all automated requests (HTTP 403) |
| (verticalleap.uk) | not run | — | wrong domain; vertical-leap.uk used instead |

## Verdict
**Not yet, for this audience.** SEO agencies are the most expert readers a GEO report will ever have. The core of each report is sound:
- clear scores, evidence on every finding, the scope line
- accurate entity and sameAs findings
- concrete recommendations

But every report contains at least one thing an SEO will use to dismiss the whole document. Fixing issues 1, 3 and 4 is a few hours of engine work. Issue 2 needs a decision. Issue 5 is a choice of which page to audit.

## Issues, worst first
1. **The Gap contradicts the report (3 of 6).** builtvisible, portent and gain get "Start with access … Fixing attribution on content an engine cannot reach or parse has no effect". Two of those three score Access 30/30. Their low score comes from Chunkability. The low-both copy in `gap.ts` assumes access is the problem; it should name the actual lowest group. A reader will spot this in the first paragraph. *Bug; no decision needed.*
2. **A crawler "block" that is probably the prospect's bot verification (portent).** The ordinary browser request got 200, and every request carrying a crawler user-agent got 403 with no CDN signature. The likeliest cause is Portent rejecting crawler user-agents from IPs that are not the crawler's published ranges, which is correct security that real OAI-SearchBot traffic would pass. The report scores it 4/14 and makes "Resolve AI crawler access blocks" its #1 high-priority fix; the IP-verification caveat is buried. Sent to Portent, this reads as us not understanding bot verification. *Decision needed:* when crawler-UA requests are refused but the baseline is served and there is no CDN fingerprint, report "unverified (likely IP-based crawler verification; confirm in your server logs)" instead of scoring it as a block?
3. **Template leaks and sloppy output.** "only 1 of [X] sections" in builtvisible's recommendations (narration placeholder); "Contact details are published on the page ()" with empty brackets on portent; a phone number fragment "1491 415070" on screamingfrog. *Bugs.*
4. **Silly "proprietary terms."** Screaming Frog's distinctive terms are "Continue Reading" and "San Diego"; Portent's is "Wallaroo Media". The detector picks up repeated Title Case UI labels and place names, which makes the Citable section look automated in the bad sense. *Bug: stop-list UI phrases and places, or require the term to appear in body prose.*
5. **Homepage rubric applied to agency homepages.** "Expand the homepage to 1,200+ words", "rephrase 4 headings as questions", "add Article schema to the homepage" (portent). These are right for an article and naive for a homepage, and agencies will say so. *Choice:* audit a prospect's blog or insight article for outreach (the engine is built for content pages), or make the rubric page-type aware.
6. **Named authorship misses obvious names.** iPullRank: "a first-person bio … but no name is attached". Mike King's name and photo are on the site, and the quoted testimonial names "Mike's team". The detector only reads Person JSON-LD and a few bio patterns. Experts will notice.
7. **Our probe trips rate limits** (iPullRank and Portent returned 429 to some crawler-UA requests). Harmless, but the prospect's logs will show requests labelled GPTBot/ClaudeBot from our IP. Worth one line in the outreach so it does not look like impersonation.
8. **Homepage freshness "absent"** (seer): homepages rarely carry dates; marking it absent is noise on a homepage.

## What reads well and is worth leading with
- Crawler access with HTTP evidence is concrete and verifiable, provided issue 2 is fixed.
- Entity resolution and sameAs findings were accurate on every site.
- Brand-claim proximity ("GAIN does not appear inside any of the 10 substantive sections") is the kind of finding nobody else produces.
- The scope line ("not a measurement of AI visibility") protects credibility with exactly this audience.

## Recommendation
Fix 1, 3 and 4 (about 3–5h). Decide 2. Audit a content page rather than the homepage for outreach. Then re-run these six and re-read before anything goes to a prospect.
