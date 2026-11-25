# Byline — decision log

**Every significant decision gets appended here, newest at the top. Sessions must read this file before proposing changes.** If a proposal contradicts an entry, say so explicitly and argue against the entry's "revisit if" condition rather than silently reversing it.

Format: title, date, decision, what drove it (with evidence), what would make us revisit it.

---

## 47. Password reset: our own email, the token is spent on submit, the request never says who has an account
**Date:** 2026-11-24 (branch `password-reset`; not deployed until Michael has looked)
**Decision:**
- Login has a "Forgot your password?" link to `/forgot-password`. The request posts to `/api/auth/forgot-password`, which answers identically for an address with an account and one without, and does the lookup, token and send after the response so timing does not tell either. Rate limited per address (3/day) and per caller (10/day) through the existing Postgres counter, `tool` values `pwreset-email` and `pwreset-ip`; no migration.
- The token comes from the Supabase admin `generateLink({ type: 'recovery' })`, and the email is sent by us through Resend from the configured sender, not by Supabase's mailer. Reason: the Supabase default template is unbranded and its default SMTP is tightly rate limited, and the browser PKCE flow breaks when the link is opened on a different device from the one that asked.
- The link is `/reset-password?token_hash=...&type=recovery`. Opening it spends nothing; the token is verified only when the new password is submitted to `/api/auth/reset-password` (a mail scanner that opens the link does not use it up). On success the person is signed in and the account's other sessions are ended. An expired, used or missing token shows one plain message with a button to request a new link.
- The link's host is built only from our own hosts (app.bylineseo.com, localhost, `saas-seo-*.vercel.app` previews), never from an unknown Host header.
- Minimum 8 characters, on reset and now on the signup form (the Supabase project's own server-side minimum is not visible from the repo and may still accept 6 from a direct API call).
- A failed transactional send is never silent. `sendEmail` reports every failure (key unset, provider refusal, network error) as a greppable `[EMAIL-SEND-FAILED]` log line (recipient domain only) and a Telegram message to Michael, at most two a day, via `src/lib/email-alert.ts`. Telegram because the failing channel is email. The customer still sees the neutral message. This covers every sender of `sendEmail`: password reset, cancellation confirmations, access alerts.
- The login page now shows `?error=confirmation_failed` and `?error=auth_callback_failed` as plain explanations, and offers "send the confirmation email again" (Supabase `auth.resend`) after a failed confirmation or an "Email not confirmed" sign-in. A resend does not carry a paid signup's plan through to checkout; the callback then routes by account type.
- **Change password (Settings, Account section).** Needs the current password (checked on a separate client whose session is ended at once; 10 checks a day per account), minimum 8, ends the other sessions, cancels any pending email change, and emails the account address that it happened with what to do if it was not them.
- **Change email (Settings, Account section).** Needs the current password. Submitting changes nothing: a confirmation link goes to the NEW address and only using it switches the account (a button on `/confirm-email-change`, so a scanner opening the link switches nothing). The OLD address is emailed at once, naming the new one, with a cancel link (`/cancel-email-change`, 3 days) that kills every pending confirmation; once the switch has happened it emails the old address again. The old address keeps signing in until the switch. The answer to the request is the same whether or not another account holds the new address, and if one does, confirming says only that the address cannot be used.
- **Built on our own signed tokens, not Supabase's native email change, and needs NO migration.** Probed on the live project with a throwaway user: native change here runs in secure mode (both addresses must confirm), sends from Supabase's unbranded mailer, and the admin `generateLink` route for it did not verify reliably. So the token (HMAC, key derived from the service key, 1 hour to confirm) carries the user, the old and new address and a counter in `app_metadata.email_change_epoch` that only the server writes. It is single use because the account's email must still equal the old one, and a cancel, a password change or a completed change bumps the counter. The switch itself is the admin `updateUserById`. Rotating the service key invalidates pending links and nothing else.
- Accounts that sign in with Google or GitHub (no email identity) see a note instead of the forms: their email belongs to the provider, and "Forgot your password?" sets a password if they want one.
- The legacy `/callback` route is deleted. Nothing in the repo linked to it (the 2026-11 audit already called it a dead duplicate). Confirmation emails sent before this still contain that URL, so `next.config.ts` redirects `/callback` to `/auth/callback` with the query kept; there is no route file left to rot.
- **Sender and keys (2026-11-24).** All app mail now goes from `Byline SEO <support@send.bylineseo.com>` with reply-to hi@bylineseo.com (the root domain is not verified on the branded Resend account, so the old `SUPPORT_EMAIL_FROM` on the root was dead and can be deleted from Vercel). Two Resend accounts existed, one personal (root domain, Supabase SMTP) and one branded (`send.bylineseo.com`); use one key per system, named for where it lives. `vercel env pull` writes the placeholder `[SENSITIVE]` for sensitive variables, so those never reach a local machine. The access-alert code marked alerts emailed even when the send failed; it now marks only on success. Full notes: `docs/EMAIL-AND-ENV.md`. Proven locally: reset sent by the app arrived in a Gmail inbox, SPF/DKIM/DMARC pass, link worked once, old password and other sessions ended, reuse showed the used-link message; the access-alert path sent from the same sender.
- **Link host (2026-11-25).** `resetOrigin` decides the site every account-email link points at, and both the reset link and the "request a new one" line in the same email now come from it. In production (`VERCEL_ENV=production` and `NODE_ENV=production`) it is always `https://app.bylineseo.com`, whatever host the request arrived on, including the apex, a deployment URL or an attacker-set Host header. Only a Vercel preview, so a branch can be walked end to end, or a local server may use its own host, and then only if it is one of ours. Found when a preview send showed a preview link beside a hardcoded production line in one email: two mechanisms, now one. Tested through the real route for production, preview and an unknown host.
**Drivers:** paying customers had no way back in short of emailing Michael. Found while he tried to reach a preview account.
**Known limit, by design as specified:** the old address is warned and can cancel, but the new address alone completes the change. Someone who has taken over a signed-in session AND knows the password AND controls the new inbox can finish before the owner reads the warning, after which only support can reverse it. If that is not acceptable, the stronger option is to also require a click from the old address (or a short cooling-off before the switch is allowed). Not done; Michael to decide.
**Found, not fixed here:** the Supabase signup email template cannot be read or edited from the repo. Cold local builds hit the same intermittent Turbopack "next/font/google queries have exactly one entry" failure as Vercel once in three runs (Google Fonts fetch at build time); the fix would be self-hosting the fonts.
**Revisit if:** reset volume or abuse outgrows the per-address limit, or Supabase custom SMTP and a branded template are set up and make our own sender redundant.

---

## 44. Solo and Pro are metered on pages monitored alone: the domain cap goes
**Date:** 2026-11-19 (approved by Michael; supersedes the domain numbers in decision 42)
**Decision:**
- **Solo $49: 15 pages monitored, any domains. Pro $129: 100 pages monitored, any domains.** Agency $599 keeps its 20-domain limit alongside 500 pages, because serving twenty client domains is a feature there, next to unbranded reports, not a ceiling.
- `PlanLimits.domains` is `number | null`. null means no cap, and so does an absent value: `checkTrackedPageAllowance` only compares against a number, never against null or undefined (`size >= null` is `size >= 0`, which would refuse every account). A test covers null, a missing key and undefined.
- Enforced where tracked pages are created (POST `/api/tracked-pages`): the page limit on every plan, the domain limit on Agency only. A page-limit refusal states the limit and never names a tier: "Your subscription monitors up to 15 pages, and you are monitoring 15. Stop monitoring one to add another, or see https://app.bylineseo.com/pricing."
- The pricing cards, the pricing FAQs and their FAQPage markup, and the support knowledge base no longer mention domains for Solo or Pro. The Solo tagline changed from "One site you answer for" to "The pages you answer for", because that line was the domain cap in other words. The line for larger operations ("More than 500 pages or 20 domains") is Agency's and stays.
- `PLAN_MODEL` in `src/lib/mcp/entitlements.ts` has no domain concept (it meters MCP capabilities). The app limits, domains included, live in `src/lib/plans.ts`, which is where this changed. The only other "domain" limit in code is the MCP per-target rate budget (`DOMAIN_BUDGET`, 6 calls per 10 minutes per target site), which is an abuse limit and untouched.
- Existing accounts: nobody loses anything, because the change only removes a restriction. Checked against the 14 subscription rows (7 Pro, 6 Agency, 1 Solo, every plan value recognised): none has a smaller domain allowance, and none of the Solo or Pro accounts is refused a new domain.
**Drivers:** two limits per plan meant the one that bit was not the one anyone was watching. A freelancer tracking three pages across three client sites used three of fifteen pages and still hit Solo's one-domain wall, on the cheapest plan, having used a fifth of what they paid for. Solo exists for freelancers and in-house SEOs; one domain served the in-house half and excluded the freelance half.
**Not changed here:** the Stripe product descriptions (docs/stripe-reprice-checklist.md suggests "15 pages, 1 domain") live in Stripe and need the same edit by hand.
**Revisit if:** Pro's 100 pages is no longer a sufficient meter on its own, for example one customer monitoring pages across hundreds of sites at Pro's price.

---

## 43. Engine 2026.16: a finding names what it counted; page furniture is not claim text; a brand is the site's own organisation
**Date:** 2026-11-17 (found by re-running en.wikipedia.org/wiki/Coffee on 2026.15; approved by Michael the same day)
**Decision:**
- **What is printed is what is counted.** Brand-claim proximity lists every distinct name it searches for (`BrandNames.counted`): the display name first, then any other name of the site's own ("Wikipedia" beside "Wikimedia Foundation"). A name and its stripped or extended forms ("Candour Agency Ltd", "Candour"; "Elsner", "Elsner Technologies") are one name. The sentence is no longer allowed to print one name and count another.
- **Page furniture is not claim text.** Each section carries `claimText`, which excludes anything inside a `nav`, an `aside`, a `role` landmark, or a category, tag or breadcrumb list (`PAGE_FURNITURE` in extract.ts, built on the same landmark definition as `CHROME_ELEMENTS`, which the engine already uses when a page has no content region). A `header` or `footer` inside the content region is NOT furniture: by the HTML spec it is that section's own header or footer, and on two study sites a section intro sat in a header and a closing call to action in a footer inside `<main>`. Brand proximity reads `claimText`; a genuine claim in a list item or a heading still counts. `mainText`, `wordCount` and every Retrievable pillar still read the unpruned region, so Retrievable does not move for this. Known gap, not fixed here: inside a `<main>` the unpruned region still includes that furniture (en.wikipedia.org/wiki/Coffee counts its 210-language switcher in its 16,572 words). Pruning it would move word counts and Parseability on every site and needs its own version bump.
- **A brand is the site's own organisation.** Only an Organization that is a node of its own, or the `publisher`, `copyrightHolder` or `parentOrganization` of the page, counts (`ownOrganizations`). An author credit ("Contributors to Wikimedia projects"), a member-of, sponsor, client or partner does not. Taglines ("AI, Ecommerce & Digital Transformation") are not names. This one definition now drives the brand, Entity resolution, Structured data validity and the score-geo schema factor.
- **Structured data validity and Entity resolution agree.** Validity awards its 3 entity points when an own Organization is declared anywhere, nested included, and says which one. When Organizations appear only as author or partner, both lines say "only as author ... not as the publisher".
**Why (evidence, en.wikipedia.org/wiki/Coffee, 16 Nov 2026, 2026.15):**
- "Contributors to Wikimedia projects appears in 2 of 42 sections": that string is on the page once, in the JSON-LD. The 2 sections matched "Wikipedia", in the page-tools menu ("Abstract Wikipedia") and in the hidden category list. Correct: 0 of 42, absent.
- "No Organization is declared" (validity) beside "An Organization entity is declared as ..." (entity), both from the same JSON-LD, which declares the author and the publisher nested in the Article.
- **The first version over-corrected, caught by explaining the rows it moved.** The first 2026.16 commit (b53834a) excluded every `header` and `footer` and every non-publisher Organization, and moved 3 of the study's brand-proximity bands, all down. Two were a section intro and a call to action inside a header and a footer in `<main>`; one was a declared parent organisation's name. All three were the site's own name, so those bands were wrongly lowered. Fixed the next day (5fc00a9), with three more regression tests that failed on the first version.
- Measured on the study (138 sites re-scored on identical fresh pages, old and new engine side by side; 10 not comparable: 9 not refetchable, 1 returning no readable text today): **no brand-proximity band moved, no overall Citable band moved, no other signal moved**, and Retrievable moved on one row (flow-agency 67 to 70, Parseability +3, from the validity contradiction). An earlier paragraphs-only estimate of about one site in five was a proxy for a rule that was not adopted, and is wrong for the rule that was.
- Tests: src/lib/geo-audit/wikipedia-coffee.test.ts, with the page as the fixture (scripts, styles and images stripped).
- **Row stamps (found 19 Nov, after a pack went out labelled 2026.15 with 2026.16 numbers in it).** A study row the re-score covered now carries `engineVersion: 2026.16`, `originalEngineVersion: 2026.15` and a `rescore` record (basis, whether the page differed between the 12 Nov run and the re-score, what changed). A row it could not cover stays 2026.15 and says why. The analysis header lists rows by version and says MIXED when there is more than one. The first pack, which stamped every row 2026.15, is retained as `byline-study-2026.16-SUPERSEDED-stale-stamps` and must not be used. Built by `scripts/study/build-rescored-pack.mjs` from `regenerate-citability.mts`, which records the engine version and git commit of both trees and refuses to compare two equal versions.
**PRIOR SCORES ARE AFFECTED.** Brand-claim proximity (none of the 138 re-scored study rows moved; Wikipedia Coffee did), and Parseability by up to 3 points where the only declared Organization is nested as publisher (one study row). Do not compare 2026.16 with earlier runs without saying so. The study was run and pre-registered on 2026.15; `ENGINE_VERSION_REQUIRED` in scripts/study/config.ts stays 2026.15, so the harness refuses 2026.16 rows. `scripts/study/regenerate-citability.mts` re-scores the content half on both engines from the same fresh pages.
**Revisit if:** a legitimate brand mention sits in an `aside` of the content region (an `aside` is excluded by this rule), or `PAGE_FURNITURE` needs more CMS hints than catlinks, tags and breadcrumbs.

---

## 42. Plans are metered on pages monitored, not articles written
**Date:** 2026-11-08
**Decision:**
- Free: 10 audits a month, crawler probe included, no monitoring, 10 draft scores. Solo $49: 1 domain, 15 pages, 100 audits, 90 days of history, 8 articles. Pro $129: 5 domains, 100 pages, 500 audits, 12 months, MCP and API keys, 30 articles. Agency $599: 20 domains, 500 pages, 2,000 audits, unlimited history, MCP and API keys, unbranded share links, 100 articles. Daily crawler access checks with change alerts on every paid tier.
- The numbers live in `src/lib/plans.ts` (app limits) and `PLAN_MODEL` in `src/lib/mcp/entitlements.ts` (MCP, Pro and Agency only; decision 22's free crawler test is superseded). The pricing page reads `plans.ts`, so a card cannot drift from what is enforced.
- Plan keys stay `starter`, `pro`, `agency` because `subscriptions.plan` identifies existing accounts, comped ones included. Only display names changed (Solo, Pro, Agency).
- Never sell daily re-scoring: `tracked_pages.interval_days` allows 7 to 90 days. What is daily is the crawler access check (`access_alerts`, confirmed by a second check).
- Enforced where tracked pages are created (POST `/api/tracked-pages`: pages, domains) and where audits run (`/api/free-tools/analyze`: monthly count from `audit_snapshots`). Refusals state the limit and never name a tier.
- Not enforced as cutoffs: history windows (kept at least that long, nothing is deleted) and the 10 free draft scores in the web editor (only MCP `score_draft` is metered). MCP access and unbranded share links are tagged "Coming soon" on the pricing page until they ship.
- Founder pricing is removed entirely: no founder tier, no discounted duplicate prices, no lock-in promise, no spot counter. Three plans, one price each (plus the annual price), priced plainly. The `founder-spots` route, the `*_founder` checkout and webhook branches and the founder price env vars are deleted. `subscriptions.is_founder` stays as history; nothing reads or writes it.
**Drivers:** the audit was identical on every tier, so the differentiated thing was free and the commodity was charged for. Monitoring is the only inherently recurring part of the product and was invisible on the pricing page.
**Revisit if:** Solo's 15 pages proves too tight or too loose, or $599 is wrong for agencies watching twenty client domains.

---

## 41. Engine 2026.15: the brand is the organisation; markup, content and dates read the way a person would
**Date:** 2026-11-03 (found by hand on blog.hubspot.com before a teardown; teardown dropped)
**Decision:**
- **Organizations are found wherever the markup declares them.** Top-level, nested as the publisher or author of a WebSite or Article, or referenced by @id. References sharing an @id are merged. An Organization declared only by reference, with no name on the page, reads as Weak, with that said plainly. It is never "none declared".
- **The brand is the publishing organisation's own name.** This is the general rule, replacing three instance patches (the legal name, capitalisation, the site name):
  - Read it from the Organization, then the WebSite name, then the title suffix.
  - Strip legal suffixes, business descriptors and publication descriptors (Blog, News, Insights, Magazine, Resources).
  - Prefer the form that matches the domain, ignoring case and punctuation. If none does, use the page's own spelling of the domain name, never a tagline.
  - A mention counts in any capitalisation except all lowercase.
  - When the brand appears on the page but in no section, the finding says that rather than "present only in the page chrome".
- **Paragraphs come from the content region,** like mainText and blocks. Header mega-menus can no longer supply the "opening paragraph".
- **Contact emails:** a mailto link, or an address in the copy on the site's own domain. Placeholder addresses never count.
- **Dates:** an impossible date (month 29, 30 February) is rejected rather than rolled forward into the future.
**Why (evidence, blog.hubspot.com, 3 Nov 2026, three articles):**
- "No Organization declared" on all three, while each declares one as publisher by @id reference.
- Brand proximity "absent" because the check searched for "HubSpot Blog", while the copy says "According to HubSpot data, 74%...".
- Direct answers scored on a 93-character header menu blurb, identical on every article.
- "email@address.com" in a LinkedIn summary template counted as HubSpot's contact details.
- `<time datetime="2026-29-10">` read as 2028-05-10 and reported as "a date set after today".
- The same brand error produced false outreach findings for Cedarwood, Beam and Aimclear (2 Nov).
- Tests: src/lib/geo-audit/hubspot-markup.test.ts, using the real pages as fixtures.
**PRIOR SCORES ARE AFFECTED.** Citable signals (entity resolution, brand proximity, authorship credentials) and Direct answers can move. Do not compare 2026.15 with earlier runs without saying so; score-over-time re-scores both runs.
**Revisit if:** a site's brand is genuinely written in lowercase in its copy as a style, which this rule does not count.

## 40. Facebook posts carry no links in the post body
**Date:** 2026-11-02
**Decision:**
- No Byline Facebook post puts a link in the post body. This covers the brand Facebook page and any future Facebook posting.
- Where a link is wanted, it goes in the first comment. The post must still read complete on its own and must give a reason to go looking for the link.
- Preferred alternative: write the post so it needs no link at all. A Facebook post that teaches something complete does not need a destination.
- "Link in comments" is never the whole payoff. A post whose only value is the pointer is not worth running.
- Recorded in the saved skill byline-outreach-and-social under Platform constraints, and in the byline-social-posts scheduled task prompt, so neither a future session nor a scheduled run reintroduces it.
**Why:**
- Links in the body suppress reach on Facebook. The platform keeps traffic on-platform, so a post with an outbound link is shown to fewer people than the same post without one. Paying that cost for a destination almost nobody will click is a bad trade for a page this small.
- The first-comment workaround is standard practice and keeps the link available without the body carrying it.
- The stronger version of the fix is editorial, not mechanical. Facebook is Byline's least technical audience, so a post that delivers the whole finding in plain language is a better fit than a teaser pointing elsewhere.
**Revisit if:** Facebook's ranking treatment of outbound links changes, or page reach data shows link posts performing at parity with link-free posts.

## 39. Score over time stores what was fetched, and compares by re-scoring both runs on today's engine
**Date:** 2026-10-29 (approved: score-over-time before the MCP server)
**Decision:**
- Every tracked run records the responses it read (page, robots.txt, llms.txt, crawler probe, linked pages) as a snapshot: `src/lib/geo-audit/snapshot.ts`, Brotli-compressed, stored in `audit_snapshots.snapshot`.
- A comparison never diffs two stored scores. It replays both snapshots through the current engine and diffs those (`compareOverTime`). A change then means the page changed, never the rubric. A fingerprint of the readable text says whether the words changed at all.
- Tracked pages re-run on an interval (default 30 days) from a daily cron (`/api/cron/rerun-tracked`), one page at a time inside the function's time limit; a failed run retries the next day. Scheduled runs use deterministic wording (no model call).
- Stopping tracking keeps the history.
- Proposed limits, for Michael to confirm: free account 1 tracked page, starter 3, pro 10, agency 25.
**Why:**
- compare.ts refuses a number across engine versions, correctly, and the engine moved four times in three weeks (2026.11 to 2026.14). Stored scores alone would make "proves it changed" read "not comparable" most months.
- History needs calendar time; it cannot be backfilled. Recording starts the asset.
- Raw fetches only: rendered fetches go through a third-party service outside the recorded transport.
**Evidence:** live runs of app.bylineseo.com (30 KB snapshot) and clickslice.co.uk (19 requests, 214 KB) replayed to exactly their live scores, check by check. Tests: `history.test.ts`, `tracking.test.ts`.
**Revisit if:** snapshot storage grows past what the database plan allows (move bodies to object storage), or a site changes faster than monthly re-runs can show.

## 38. Retrievable keeps counting unsourced figures; only Citable asks for a source
**Date:** 2026-10-27 (closes the option left open in DECISIONS 36)
**Decision:** the "Lists, tables and data" check in Retrievable keeps crediting figures whether or not they are sourced. No engine change.
**Why:**
- Retrievable asks whether an engine can lift a clean passage. A sentence with a number in it is liftable whether or not the number is sourced. Requiring a source there would make Retrievable measure attribution, which is Citable's job, and the two scores are never blended.
- The false finding was in Citable (Original evidence credited unchecked numbers as evidence). DECISIONS 36 fixed that where it belonged.
- The point at stake is 1 of 100. Changing it would move every prior score for no gain in accuracy.
**Revisit if:** a report reads as if Retrievable vouches for a figure ("12 specific figures" quoted back as praise for the figures themselves).

## 37. Engine 2026.14: a definition opens with its subject; no em dashes in report text
**Date:** 2026-10-27 (backlog item 4; Michael's no-em-dash rule for user-facing copy)
**Decision:**
- "A definition-style sentence states plainly what the subject is" (5 points in Direct answers, and in the AO scorer) now needs a sentence that opens with its subject (one to six words) and goes straight to "is/are a/an/the". Sentences opening with a pronoun, a demonstrative or a gerund do not count. One shared function, `findDefinition()` in extract.ts.
- Every user-facing engine string that carried an em dash now uses a colon, comma, semicolon or full stop instead: crawler evidence lines, the Gap text, truncation notices, authorship and testimonial evidence, the draft-report next step. Comments, test names and the narration prompt are unchanged.
- ENGINE_VERSION goes from 2026.13 to 2026.14.
**PRIOR SCORES ARE AFFECTED.** Pages whose only "definition" was an incidental "is a/an/the" lose up to 5 Retrievable points (typeamedia.net). Do not compare across 2026.13/2026.14 without saying so.
**Drivers:**
- typeamedia.net (2026-10-14 and 2026-10-26): "That is exactly why becoming an agentic business is an evolution for us" was credited as a definition. Since 2026.13 labelled the quote, the false credit was visible to any reader checking the report.
- Test: `direct-answers.test.ts`, from typeamedia.net's homepage (fetched 2026-10-26) and our own (which keeps "Byline is an AI search readiness tool for SEOs.").
**Revisit if:** a real definition with an inverted opener ("At its core, X is a ...") turns up in a report as a missed definition.

## 36. Engine 2026.13: only sourced figures are evidence; crawler rows must survive two request shapes
**Date:** 2026-10-26 (approved by Michael, backlog items 1, 2, 2a and 4)
**Decision:**
- Original evidence counts a figure only when the same section of the page links out to a source (another site, not a social profile). A "Sources:" line under the figures counts. Unsourced figures are neither credited nor penalised; the finding states how many there were.
- Outbound links no longer earn Original evidence on their own. They count through the figure they source. Their provenance value stays under Freshness and provenance.
- Crawler check: a 200 whose body is a script-submitted form with almost no readable text is a JavaScript challenge, not "served". A 429 with `x-ratelimit-used: 0` and nothing remaining is a refusal, not rate limiting. Every crawler is asked twice, with and without browser-style Accept headers; if the answers disagree the row is unconfirmed and is reported neither as served nor as blocked, never scored.
- Freshness evidence carries the URL of the page the date came from.
- Direct answers evidence is labelled ("Opening paragraph", "Definition-style sentence") and quotes the paragraph or sentence its finding describes.
- ENGINE_VERSION goes from 2026.12 to 2026.13.
**PRIOR SCORES ARE AFFECTED.** Citable bands can drop where Original evidence rested on unsourced figures or bare outbound links (clickslice.co.uk: adequate to absent). Crawler rows that were "served" behind a JavaScript challenge, or "rate limited" on a zero allowance, now read as refused or unknown. Do not compare across 2026.12/2026.13 without saying so.
**Drivers:**
- These produced false findings in reports Michael sends to agencies who check them.
- clickslice.co.uk: "12 specific figures" credited, none sourced ("AI search projected to hit 1 billion monthly visitors"); review-site badges credited as "outbound links to third-party sources".
- reddit.com: JavaScript challenge reported as "8,397 bytes served"; zero-allowance 429 labelled "rate limited, not a policy block".
- aira.net and zelst.co.uk (2026-10-07): the same crawler user agent served with Accept headers and refused without.
- app.bylineseo.com: the blog's date labelled with the home URL.
- typeamedia.net: "The opening paragraph is 355 characters" printed over a quote of a different paragraph.
- Tests built from each site's real markup or headers: `crawler-access.test.ts`, `original-evidence.test.ts`, `freshness-source.test.ts`, `direct-answers.test.ts`.
**Revisit if:** sites routinely cite figures with footnote links in a separate references section (a section-level match would then miss them), or a real crawler is shown to send a request shape we do not test.

## 35. RETRACTED CLAIMS: "ten free tools, none query an engine" and "Semrush measured unchanged pages"
**Date:** 2026-10-15
**Retracted claim 1, ten free tools.**
- What we believed and repeated for about two weeks: "Of ten free tools marketed as reporting what AI engines say about your brand, none query an AI engine, and five say so in their own documentation." It came from a survey of Michael's for which no record survives.
- What the evidence shows: `docs/audits/free-ai-visibility-tools-2026-10.md`, from vendor pages read on 2026-10-11 with quotes checked against the downloaded HTML.
  - Of ten free tools, five say in their own documentation that they send prompts to named engines: Ahrefs, HubSpot, Mangools, RightBlogger, Backlinko.
  - Two report from stored real engine answers: Semrush, ContextBolt.
  - One is a model estimate: SEOcrawl.
  - Two are page-only: Pixelmojo, LightSite.
  - Only two say they do not query engines.
  - Both halves of the claim are false.
- Where it was used or queued:
  - byline-social/01-FOUNDER-POSTS.md, posts F-L8 and F-X10, scheduled for Thu 15 in 00-SEQUENCING.md. MUST NOT RUN.
  - byline-outbound/byline-geo-services-wedge-strategy.md lines ~289, ~910 and ~957 ("zero of ten free tools query an engine", used as the basis of the "moat" argument).
  - Nearly the homepage. It was kept off because no evidence file existed.
  - Not used in any live page, report, email or committed blog draft (checked 2026-10-15).
- What the evidence does support is in the evidence file, under "What the evidence does support". It is a smaller, different point and must be worded exactly as there.
**Retracted claim 2, Semrush.**
- "Semrush's test showed citations of unchanged pages peaking and falling." The source (Semrush, Tushar Pol, 10 December 2025) tested 81 newly published pages and does not say whether they were edited during the 30 days.
- The figures stand: Google AI Mode cited 29 pages on day 1, 48 on day 6, 39 on day 14 and 21 on day 30. "Unchanged" and "nobody edited them" are our inference, not the finding.
- Removed from the live homepage and from the one-ai-visibility-score blog draft on 2026-10-15. Already listed as limited in the byline-outreach-and-social skill.
**Scope note, added 2026-11-23: there are two Otterly claims, one retracted and one good. Do not confuse them.**
- RETRACTED, never reuse: Otterly's "AI Overviews up 16%, AI Mode up 24%, Claude and Copilot at 0.000%". Not corroborated, and a 0.000% in a monitoring tool usually means below the reporting floor, not zero.
- VERIFIED, usable with attribution: Otterly.AI, July to September 2026, Reddit's share of ChatGPT citations fell 94% while its share of Perplexity citations rose 86% (byline-outreach-and-social evidence library, source https://otterly.ai/blog/chatgpt-reddit-citations/). This is on the live homepage and stays. The 94/86 pair is NOT on the retracted list. An earlier status note wrongly called it retracted.
- A retraction that is ambiguous about its own scope eventually takes a good claim down with it. Any new retraction names the exact figures it covers.
**Rule:** neither claim is restated in any form. Any count of free tools needs the evidence file open beside it, and the file says to re-read the vendor pages before reuse.

## 34. Engine 2026.12: block boundaries, "N of M" figures, defined terms
**Date:** 2026-10-11 (found on our own rewritten homepage; approved)
**Decision:**
- The extractor puts a space at every block-element boundary before reading text. Minified HTML (ours, and any Next.js or similar site) used to read as "publish them.Retrievable vs citableThe two halves". Words merged across every heading, paragraph and list item, word counts were understated, and phrase matching failed.
- A count against a base ("48 of 81", "seven of the eight") counts as a figure. Before, only percentages, comma-separated thousands, multipliers and "million/k" did.
- A term the page defines as its own measure ("Retrievable is a score...", "Citable is a band...") and then uses again counts as a coined term. Two such terms set against each other ("Retrievable vs citable") count as a named framework (strong). Title Case runs still need 3 uses. Products described as platforms do not count, because the defining noun must be a measure (score, band, rating, metric, index, framework, method, signal...).
- ENGINE_VERSION goes from 2026.11 to 2026.12.
**PRIOR SCORES ARE AFFECTED.** Word counts on sites served as minified HTML go up, so "Server-rendered content" can rise. Figures and coined terms can move Citable signals. Do not compare across 2026.11/2026.12 without saying so.
**Drivers:**
- Our homepage showed one figure where it had several.
- It showed no coined term with "Retrievable vs citable" in a heading.
- Debugging that exposed the block-boundary bug.
- Tests: `extract-accuracy.test.ts`, using the page's own sentences.
- Checked on the eight agency homepages: no new false coined terms.

## 33. Engine 2026.11: heading hierarchy can reach full marks; SoftwareApplication and WebApplication are content-level types
**Date:** 2026-10-11 (found by auditing our own homepage; approved)
**Decision:**
- Heading hierarchy is out of 12 but its awards summed to 11 (H1 3, H2 4, H3 2, no skipped levels 2). "No skipped levels" is now worth 3, so the parts sum to 12.
- The Parseability "content-level type" check now counts SoftwareApplication and WebApplication alongside Article, Product, Service and the rest.
- ENGINE_VERSION goes from 2026.10 to 2026.11.
**PRIOR SCORES ARE AFFECTED. Do not compare across this change without saying so.**
- Every Retrievable score produced before 2026.11 was capped at 99, and every page with a clean heading outline lost 1 point it had earned. On 2026.11 the same page scores up to 1 point higher with nothing changed on the site.
- Product and tool pages that declare SoftwareApplication or WebApplication (and no other content-level type) score 2 points higher on 2026.11. Our own homepage is one.
- compareAudits already flags runs from different engine versions; any copy, report or outreach that quotes a before/after across this boundary must state the version change.
**Drivers:** our homepage scored 11/12 on heading hierarchy with no stated reason, and was told to "add a SoftwareApplication schema" that was already present. Tests: `score-rubric.test.ts`, using our own homepage markup as served on 2026-10-11.
**Revisit if:** the planned Original evidence change (Group 1 item 6) ships; it bumps the version again.

## 32. Citability reads names the way a person would, and claims nothing it cannot attribute
**Date:** 2026-10-07 (outreach audits of eight SEO agencies)
**Decision:**
- The brand is the trading name, not only the declared legal name. "Candour Agency Ltd" is checked as "Candour"; a derived short form must match with its capital, so the noun "candour" is not the brand.
- Named authorship reads people from structured data, dated bylines ("19 May, 2026 by Dan Sharp"), quotes attributed to someone at the brand ("Tom Vaughton CEO at Varn"), and "Name Role" copy where the role is not at a different organisation. A name that appears only as a client's attribution is never the site's person.
- "Strong" authorship needs a credential that belongs to the person: in their own Person markup (not a job title alone), or in the same sentence as their full name. An agency award elsewhere on the page does not count.
- Client feedback needs a named client organisation other than the brand. A staff quote is not client evidence. A name and role with no company ("Vicky Walker Comms Director") is reported as neither staff nor client, because the text cannot tell which.
- Coined terms exclude UI labels ("Continue Reading"), multi-word place names ("San Diego") and people's names. A heading-case framework ("The Complete Organic Revenue Engine (CORE) Framework") counts, but needs an acronym or three-plus words so "The Content Process" does not.
- No engine version bump: the rubric is unchanged; these fix how accurately pages are read (the same treatment as the crawler-probe CAPTCHA fix, 027fd88).
**Drivers (each a false finding on a real site, now a test in `attribution-names.test.ts`):** varn.co.uk authorship "absent" with the CEO named on /about-us, and the CEO's own quote counted as client feedback; withcandour.co.uk and zelst.co.uk brand proximity "absent" (legal name searched); screamingfrog.co.uk authorship "absent" with bylines on the homepage, and "Continue Reading" and "San Diego" credited as coined terms; zelst.co.uk "Seen Everywhere Optimisation" missed and its founder read as "Peter Van"; salt.agency a nav menu credited as client feedback; yesoptimist.com its CORE Framework missed.
**Revisit if:** a site's staff and clients are routinely indistinguishable in this way and the "neither" rule hides real client evidence; then read the attribution's surrounding widget (team versus testimonial section) rather than the text.

## 31. A refused page request is our limitation, not a finding; the engine fetches over node:https with an honest user agent
**Date:** 2026-10-06 (aira.net run that blocked Michael's outbound)
**Decision:**
- The engine's requests (page, robots.txt, llms.txt, crawler probe) go over `node:https` (`src/lib/geo-audit/http.ts`), not Node's built-in fetch.
- The content fetch keeps the honest `BylineAuditBot` user agent. The crawler probe keeps presenting each crawler's own user agent.
- A refused page request (401, 403, 429, 5xx) no longer ends the audit. robots.txt and the probe are still reported. Everything that needs the page is "unable to assess", including Citable, and the score is withheld.
- All copy describes what happened to our request ("Our request for this page was refused"), never the site's policy ("blocking automated requests").
**Drivers (tested 2026-10-06 against aira.net, one machine, one IP):**
- Node fetch got 403 with every header and user-agent combination, including a full Chrome set.
- curl and `node:https` with the same BylineAuditBot user agent got 200. So the refusal was of Node's fetch client signature, not of our IP or user agent.
- Over `node:https`, a Chrome user agent got 403. Cloudflare bot management treats a browser user agent without a browser TLS fingerprint as impersonation. Presenting as an "ordinary browser" from a server is therefore worse than identifying honestly, and was rejected for that reason.
- A GPTBot user agent from our IP also got 403: unverified-bot handling. That is why the probe's baseline and "unknown" handling matter on Cloudflare sites.
- With these changes the local run produced a full report (Retrievable 62, Citable Adequate) where it had returned nothing.
**Revisit if:** production (Vercel egress) still gets refused where a local run is served. That would be IP reputation and needs a different answer, such as the render/fetch service path.

## 30. Blog tables are a custom block rendered as semantic table markup, not a plugin
**Date:** 2026-10-05 (approved by Michael)
**Decision:** The Sanity post body has a custom `table` object (caption, header row, rows of plain-text cells). The blog renders it as real HTML: `<table>`, `<caption>`, `<thead>` with `<th scope="col">`, `<tbody>`. The drafting pipeline (`npm run draft`) converts markdown tables into this block instead of flattening them.
**Drivers:**
- Both finished blog drafts needed a comparison table, and one had to be degraded into a list because the body accepted only block, image and faq.
- Our engine credits tables under extractability ("Lists, tables and data") and reads `<th>` cells as its evidence. Table plugins commonly render a grid of divs that looks like a table but is not one, so neither AI systems nor our engine can extract it.
- We tell practitioners to use tables for extractability, so ours have to be the real thing.
- Verified by test: the rendered block is detected by `extractPage` and credited by `scoreRetrievability`.
**Do not:** swap in a table plugin or a div-based renderer without re-running that test. Cells are plain text by design; links inside cells are dropped with a warning.
**Revisit if:** writers need links or formatting inside cells. Extend the cell type then, keeping the semantic markup.

## 28. The SEO and Readability panels keep only checks with a real basis
**Date:** 2026-10-04 (Michael, from signed-in pass findings 5 and 10)
**Decision:** Audit every check in the editor's SEO and Readability panels and sort them into two piles:
- Keep genuine, verifiable constraints with a technical basis: title presence and length, meta description presence and length, canonical, indexability, internal linking, image alt text, and similar.
- Remove invented thresholds whose target cannot be justified with a source: heading-count targets, word-count targets, keyword-density-style checks and the like.
Retuning a conflicting target is not acceptable. The two piles are reported, with reasons for borderline checks, before anything is removed. The goal is a smaller panel that is right rather than a fuller one that contradicts the engine.
**Drivers:** The old panel wanted 2–4 H2s while Retrievable wants 6+, so following the product's own advice lowered the new score (finding 5). "2–4 H2 headings" is folklore with no evidence; picking a different number would only move the conflict. Readability showed 100/100 while its own metrics missed target (finding 10), the same problem.
**Revisit if:** a removed check can be shown, with a citable source, to affect indexing, retrieval or citation.

## 29. No ranking prediction; a projected score on our own rubric instead
**Date:** 2026-10-04 (Michael, from signed-in pass finding 11)
**Decision:** Ranking Prediction ("4–6 months to top 10, High confidence") and the traffic-per-position estimates are removed outright, not softened. They are replaced by a projected score: "fix these specific findings and Retrievable goes from X to Y". The projection is computed by the deterministic scorer on our own rubric, and lists each contributing finding with the points it would add. It is never expressed as time, traffic, position, or likelihood of being cited.
**Longer term:** the real replacement is score over time. Retrievable and Citable get plotted across months once monthly re-runs exist, annotated with what changed and when. That is the honest answer to "is this working" and the argument for a monthly subscription. Design for it now rather than retrofitting it: every stored score must carry engine version, date and the content state it scored, so the series can be drawn and annotated later.
**Drivers:** A months-to-top-ten forecast with a confidence level is a guarantee and contradicts the core invariant (nothing claims results we cannot measure). Arithmetic on our own rubric is fully defensible, specific, and entirely in the user's control.
**Revisit if:** never for ranking or traffic forecasts. The projection itself is revisited if the rubric changes in a way that makes a projected score misleading.

## 21–26. MCP server decisions (docs/mcp-server-spec.md §7), answered 2026-10-04

### 21. OAuth 2.1 is the target auth; API keys only as a cheap side effect
**Decision:** Build the MCP server on OAuth 2.1 (the MCP authorization spec), so it works as a claude.ai custom connector. A personal-API-key path may exist for developers and Claude Code, but only where it falls out of the same principal/entitlement layer at little cost. OAuth is what must work.
**Drivers:** The target user works in claude.ai Projects (decision 4's driver), where only OAuth connectors work. Shipping keys first and redoing it later is rework. This is the 31–48h path rather than 21–32h, accepted.
**Revisit if:** claude.ai starts accepting header-based credentials for custom connectors.

### 22. Crawler access test is free; audit, stored audits and comparison are paid
**Decision:** `check_crawler_access` is free. `run_audit`, `get_audit`/`list_audits` (stored history) and `compare_audits` are paid. Comparison is never free.
**Drivers:** The crawler test is cheap and is the clearest first value moment (the same reasoning as onboarding). Longitudinal comparison is the thing no competitor can do (decision 8), so it is the paid core.
**Revisit if:** free-to-paid conversion from MCP users is negligible.

### 23. Quotas: a happy medium, metered from day one
**Decision:** Generous enough to feel useful, not so generous that volume or abuse becomes the cost. Every call is metered regardless of plan. The exact numbers are proposed in the spec (§4) and await Michael's confirmation.
**Drivers:** About $0.001 per audit, so the real risk is volume and abuse, not per-call cost.

### 24. Include score_draft
**Decision:** `score_draft` ships: deterministic draft scoring for content written in Claude.
**Drivers:** It is the bridge between a practitioner's own Claude workflow and Byline's framework, at zero model cost.

### 25. Endpoint on a subdomain: mcp.bylineseo.com
**Decision:** The MCP server is served at `mcp.bylineseo.com`.
**Drivers:** A stable, product-named address independent of the app's host split.
**Needs:** a DNS record and a Vercel domain on the project (Michael).

### 26. MCP usage is recorded, never emailed
**Decision:** MCP calls and audits are recorded against the account and visible to Michael (admin), but never enter a GHL email, tag or nurture flow.
**Drivers:** Someone wiring up a developer tool is not a lead and must not be emailed as one.

### 27. MCP is a feature of existing plans for now, built to become its own product
**Date:** 2026-10-04
**Decision:** The MCP server is a feature of existing paid plans, not a separate product, for now. It is built with the explicit intention that it may become its own product later. Requirements:
- Every entitlement check routes through one place (`src/lib/mcp/entitlements.ts`), so moving MCP onto its own plan is a configuration change, not a rewrite.
- Usage is metered per account AND per key/client from the start, per tool, with enough detail (tool, target domain, outcome, duration, model cost) to price MCP separately later. Plan-level totals alone would make that impossible.
- The MCP surface depends only on the geo-audit library and the data layer, never on dashboard-specific code, so it can be split out without untangling.
- No plan names or tier assumptions in tool responses or error messages. Wording comes from the same entitlement module.
**Drivers:** Agencies can keep their own systems and workflows while Byline supplies the data and tracking underneath, which is the positioning the research pointed at (decisions 3–4).
**Revisit if:** meaningful MCP usage comes from accounts that do not use the dashboard, or agencies ask to buy the data layer without the rest of the product. Those signals mean it has become its own thing.

## 20. Manual SQL is always sent as plain text in the message
**Date:** 2026-10-01
**Decision:** Any SQL Michael must run by hand in the Supabase SQL editor is pasted in full, as plain text, in the reply at the moment the migration is created. A file path or a "see the repo" pointer is never enough on its own. Long SQL is split across messages rather than summarised. The status file notes each migration as pending until he confirms it is applied.
**Drivers:** Michael applies migrations from the Supabase SQL editor, often away from the repo, and could not find the migration files last time. The direct database host is IPv6-only, so these migrations cannot be applied from the dev machine.
**Revisit if:** migrations become automatically applied (for example by a CI step with database access).

## 13–19. Paid engine product decisions (docs/paid-engine-spec.md §7), answered 2026-10-01

### 13. Two scores in the editor, matching the free tool
**Decision:** The paid editor shows two scores, Retrievable (a number) and Citable (a band), as the free tool does. They are never blended into one number.
**Drivers:** The publish loop only pays off if the draft-time and published measurements are visibly the same kind of thing. A customer who runs a published article through the free tool must see the same framework the editor showed. Citability is heuristic, so a single blended number would be false precision.
**Revisit if:** customers consistently fail to understand two scores in usability testing.

### 14. GEO and AEO name the tools; Retrievable and Citable name the scores
**Decision:** The tools and pages stay titled GEO and AEO. The scores inside the product are Retrievable and Citable. Category terms live on the outside; the framework is the vocabulary inside. Apply this consistently in UI copy (`src/lib/score-labels.ts` holds the score names).
**Drivers:** People search for GEO and AEO and expect those words on the tool. Inside, two vocabularies for one concept is a support cost, so the scores use the framework's names everywhere.
**Revisit if:** search demand shifts to different category terms.

### 15. Drafts get their own breakdown; unpublishable checks are "not yet assessable", never missing marks
**Decision:** The draft breakdown reads as "what can be judged now" and "what is judged at publication". Anything that belongs to the domain or the published page (crawler access, server rendering, structured data, entity markup, publication dates) is reported as not yet assessable, with the reason. It is never a zero, a failure or a deduction. The 45-of-100 scope is stated inline, not in a tooltip.
**Drivers:** Michael: do not make it seem a draft will fail or succeed on things that are not there yet. Stating what cannot be known before publication is the differentiator, and hiding it would contradict the rest of the product.
**Revisit if:** usability testing shows the inline scope text is unread. Then shorten it; do not hide it.

### 16. No migration notice and no side-by-side period
**Decision:** Skip the score-change announcement and any old/new side-by-side display. Supersedes the earlier same-day answer to announce it, which was given before it was clear there are no active users.
**Drivers:** There are no active users whose numbers would move, so a notice would be addressed to nobody. The draft notice in `docs/notices/score-change-notice.md` is kept only as reference.
**Revisit if:** paying users exist before the new scores ship. Then announce rather than migrate quietly, because silently lowering numbers contradicts a product that sells honest measurement.

### 17. The byline is part of the draft, but a profile claim is an intention, not evidence
**Decision:**
- At draft time, named authorship is scored from the brand profile's author (`author_name`, `author_credentials`, `author_url`, migration `20261001_brand_author.sql`).
- The live audit must verify that the byline actually renders on the published page.
- A profile that claims an author while the published pages show none is itself a finding, and is reported as one.
**Drivers:** It is actionable at draft time, and entity consistency is a live concern for this product (see 10). Michael: it is not enough that a byline exists in the brand profile; it has to appear on the live articles. Evidence is what is on the page.
**Revisit if:** never, for "evidence is what is on the page". How the check detects a byline can change.

### 18–19. Rendering entitlement and live re-audit limits: post-MVP
**Decision:** Decision 6 (is JavaScript rendering a paid entitlement, and on which plan) and decision 7 (live re-audits per plan per month) are deferred until after MVP. Until then, paid runs stay raw-HTML only (see 6) and there is no publish-loop re-audit.
**Revisit if:** the publish loop (spec phase 4) is scheduled.

## 12. Draft-time score uses its own denominator; MIN_ASSESSED_SHARE stays 0.6
**Date:** late Sept 2026 (recorded 2026-09-30)
**Decision:** The paid engine scores drafts over a separate 45-point denominator (Chunkability 25 + Extractability 20), normalised to 0–100 and labelled structure-only. `MIN_ASSESSED_SHARE` is not lowered.
**Drivers:** Only 45 of the live engine's 100 Retrievability points are assessable before publication (Access and Parseability belong to the domain and the CMS template). Fed through the live totals, every draft would be withheld forever. Lowering the threshold would weaken the guarantee on the free tool, which is what prospects see.
**Revisit if:** the draft number and the post-publication number diverge enough that customers read them as contradicting each other.

## 11. Rate-limit bypass for the signed-in owner only
**Date:** 2026-09-30
**Decision:** The free tool's 3 runs/day limit is lifted only for the owner account, verified via `supabase.auth.getUser()` with a confirmed email. Everyone else keeps 3/day. Never an IP allowlist or a header anyone could send.
**Drivers:** Michael demos to prospects from one connection and hit the wall after three runs. An unauthenticated bypass on a public endpoint is how people end up with a bill.
**Revisit if:** other staff need to demo, or signed-in customers need a higher cap (then key it on user id, still authenticated).

## 10. Author identity consolidates on Michael Jacobs
**Date:** late Sept 2026
**Decision:** The canonical author name everywhere is "Michael Jacobs". LinkedIn deliberately stays "Michael Osborne", bridged by an explicit schema.org `sameAs` declaration rather than name matching.
**Drivers:** The Amazon author history cannot move without losing reviews and ranking, so everything else conforms to it.
**Revisit if:** the Amazon catalogue stops mattering commercially.

## 9. Scoring stays deterministic in code
**Date:** Sept 2026
**Decision:** The model writes prose only and can never set a score, status or grade. Scoring is additive internally and presented as deductions.
**Drivers:** The original engine let the model invent scores. It produced an 11-out-of-10 freshness score labelled "needs work", and recommended publishing fabricated traffic statistics.
**Revisit if:** never, for scores. Model-written prose can expand.

## 8. The gate
**Date:** Sept 2026
**Decision:** The free tool shows the score plus a few recommendations. Email unlocks the rest, plus a free monthly re-run.
**Drivers:** The re-run is the retention hook. Run at volume, it becomes a longitudinal dataset no competitor has, because everyone else sells one-shot audits or expensive monitoring. Cost is about $0.0011 per run.
**Revisit if:** email capture rate or re-run engagement is poor, or per-run cost rises materially.

## 7. GEO and AEO get separate pages, one engine
**Date:** Sept 2026
**Decision:** GEO and AEO get separate pages with two report presenters over one scoring core. Do not fork the scoring logic.
**Drivers:** People search the two terms separately.
**Revisit if:** search demand converges on one term.

## 6. Free tool is raw HTML only; rendering is paid
**Date:** Sept 2026
**Decision:** Free runs fetch raw HTML. JavaScript rendering is a paid entitlement. Content that only appears after rendering is reported as a finding, not offered as a setting.
**Drivers:** GPTBot and PerplexityBot do not execute JavaScript, so raw HTML is what those crawlers actually see, which makes raw the honest default. Rendering on every free run creates a per-run cost floor that scales with traffic. The rendered-only finding is the natural upsell.
**Revisit if:** the major AI crawlers start executing JavaScript.

## 5. Services as a capped wedge
**Date:** late Sept 2026
**Decision:** Done-for-you GEO work, for cash flow and as a live controlled environment for testing the repositioned product on real sites.
- Fixed scope, hard cap. Every engagement feeds the product and produces a case study.
- Offer: Citability Baseline, $2,500, ten business days, a day-45 re-test. No implementation, no retainer, no outcome guarantee.
- Sold to agencies that lack GEO capability.
- Capped at three engagements a month; evaluate after five.
**Drivers:** Cash flow, plus real-site testing the product cannot get otherwise.
**Risk recorded:** services revenue is valued at far lower multiples than SaaS ARR, against a roughly two-year exit horizon.
**Revisit if:** services crowd out product work, or after the fifth engagement.

## 4. Build an MCP server
**Date:** late Sept 2026
**Decision:** Expose Byline's data layer through an MCP server, so practitioners can use it from inside their own Claude workflow.
**Drivers:** Sophisticated practitioners keep their own Claude workflow and will pay for the data layer underneath it. The "overly hand-holding" beta feedback points the same way. Research shows a good skill chain beats a generation-first SaaS at producing content. It cannot do repeated sampling, twelve months of comparable history, or auditable client artefacts. This turns the sharpest criticism received into a product decision rather than a design problem.
**Revisit if:** practitioners won't pay for data access without the UI, or MCP adoption among the target market stalls.

## 3. Target market is freelance and in-house SEOs, not agencies
**Date:** late Sept 2026
**Decision:** The product's buyer is the freelance or in-house SEO. Agencies are the route to first services clients, which is a different thing from being the product's buyer.
**Drivers:** Agencies typically have their own SOPs, which is what the beta feedback demonstrated.
**Revisit if:** agencies show product (not services) buying intent at meaningful volume.

## 2. Positioning wording
**Date:** late Sept 2026
**Decision:** "Byline tells you, with evidence, whether AI systems can retrieve and cite your pages, and proves it changed." Explicitly NOT "an AI visibility platform", which is the crowded and discredited version.
**Drivers:** Semrush's own experiment found AI Mode citations of unchanged pages peaking at 59% and falling to 26% in three weeks. Forrester found 57% of buyer objections are disbelief rather than price. The objection to beat is disbelief.
**Revisit if:** buyer interviews show disbelief is no longer the main objection.

## 1. Reposition to GEO/AEO first, with measurement as the spine
**Date:** late Sept 2026
**Decision:** Byline is a GEO and AEO product that also handles traditional SEO, not an SEO content tool with GEO bolted on. Generation is demoted to a supporting feature.
**Drivers:**
- An agency head who beta tested it said a well-structured Claude project already did what his team needed, and that Byline felt overly hand-holding.
- Five beta testers all described Byline as an SEO article generator. Not one mentioned visibility or measurement.
- Every "this is useful" moment in the survey was the generated article, which is the commoditised half.
**Revisit if:** measurement proves to have materially lower willingness to pay than production tooling.
