# Create a clean, easy-to-follow GHL manual setup guide as a markdown fi

- Cowork session `s26`
- 2026-06-30 03:42 to 2026-06-30 03:45
- 2 prompts, 9 tool calls, 125 Byline mentions

**Files touched (1):** `GHL-Workflows-Manual-Setup.md`

---

## Michael

Create a clean, easy-to-follow GHL manual setup guide as a markdown file saved to /sessions/dazzling-eloquent-euler/mnt/seo-saas/GHL-Workflows-Manual-Setup.md

Include BOTH workflows in full, formatted for easy copy-paste into GHL. Here are the exact details:

---

# WORKFLOW 1: Byline — Post-Audit Nurture

**Trigger:** Tag Added = `audit_lead`
**Goal/Exit:** Contact gets tag `byline_user` → exit workflow
**From name:** The Byline team
**Folder:** Byline Email Sequences

Schedule:
- Day 0 (5 min delay): Email 1 — "Your content gaps, mapped"
- Day +2: Email 2 — "The article you didn't write"
- Day +5: Email 3 — "From keyword to ranking — the full picture"
- Day +8: Email 4 — "The one setup step that changes everything"
- Day +12: Email 5 — "Still thinking about it?"

EMAIL 1 SUBJECT: Your content gaps, mapped
EMAIL 1 BODY:
Hi {{contact.first_name}},

You ran the audit. Here's what it means.

Content gaps aren't created equal. Some are low-competition opportunities you could fill this week. Others are strategic bets — high-value topics that take time to build but compound over months.

Your results flagged both.

The **quick wins** are topics with real search demand and manageable competition. Articles your audience is already searching for that you haven't written yet. Fill three of them in the next 30 days and you'll likely see measurable organic movement by Q4.

The **strategic gaps** are bigger — topic clusters where your competitors have built authority and you're starting from zero. Worth understanding, even if you don't tackle them first.

Here's the honest part: most content teams look at a list like this and don't know where to start, so they don't start at all. The gaps stay gaps.

If you want to do something with this data, the next step is simple: pick one topic and write the article. Byline generates that article for you in about 60 seconds — research-backed, 2,000+ words, written to rank.

[Start with your first gap →](https://app.bylineseo.com/signup)

— The Byline team

---

EMAIL 2 SUBJECT: The article you didn't write
EMAIL 2 BODY:
Hi {{contact.first_name}},

Here's what happens when you identify a content gap and don't fill it:

Your competitors do.

It sounds obvious. But it's worth sitting with. Every topic in your audit results is a search query someone is typing right now. If your site doesn't answer it, they're landing on someone else's — building trust with that brand, not yours.

Content that ranks doesn't just drive traffic. It earns backlinks, signals relevance to the algorithms that power AI answer engines like ChatGPT and Gemini, and compounds in ways that paid ads simply don't.

The window on a content gap isn't infinite. The topics in your audit results are ranked by opportunity right now. That ranking changes as competitors build out their coverage.

You already did the research. You saw what's there. The only question is whether you're going to do something with it.

Byline turns a gap from your audit into a complete, publish-ready article in about 60 seconds. Not a rough draft you'll spend hours editing — a real 2,000-word piece that's structured, researched, and written to the intent of the keyword.

[Turn your first gap into an article →](https://app.bylineseo.com/signup)

The data won't get fresher.

— The Byline team

---

EMAIL 3 SUBJECT: From keyword to ranking — the full picture
EMAIL 3 BODY:
Hi {{contact.first_name}},

A lot of AI writing tools give you a draft. Byline builds something different.

Here's the actual workflow — from gap to published post:

**Step 1: The brief**
Before writing a word, Byline generates a content brief. It maps the search intent, outlines the article structure, identifies the semantic topics the piece needs to cover to compete with what's currently ranking, and sets a word count target based on the competitive landscape. The brief is what most writers skip — and why most AI content underperforms.

**Step 2: The draft**
The article is generated to the brief — not just to a keyword. That means it's structured to match real search intent, not just the phrase. 2,000–2,500 words, with a specific claim or verdict in every H2, and none of the vague filler that makes AI content recognizable at a glance.

**Step 3: The agent**
This is where Byline separates from every other tool. The article agent reviews your draft and works with you to improve it — in three modes: Review (conversational), Assist (targeted paragraph rewrites), and Auto (hands-off full editorial pass).

**Step 4: Publish**
Connect your WordPress account and publish directly from Byline. No copy-paste. No format loss.

The whole loop — brief → draft → polish → live — takes under 10 minutes for most articles.

[See it for yourself →](https://app.bylineseo.com/signup)

— The Byline team

---

EMAIL 4 SUBJECT: The one setup step that changes everything
EMAIL 4 BODY:
Hi {{contact.first_name}},

The most common complaint about AI-written content is that it sounds like AI.

You know the tone — technically competent, occasionally insightful, but somehow flat. Like someone translated your ideas through a filter that's never quite met them.

Byline has a specific answer to this, and it takes about 5 minutes to configure.

When you create a **Brand Profile**, you're giving Byline's generation engine a set of constraints that shape every article it writes for you: your voice and tone, topics you avoid, phrases you don't use, and competitor names to leave out.

Once this is set, every article Byline generates — for every keyword you run — is filtered through those parameters. The output stops sounding like "an AI article about your topic" and starts sounding like something you'd actually publish under your name.

Skip this step and you get competent generic content. Set it up and you get something you'd be proud of.

[Start free + set up your Brand Profile →](https://app.bylineseo.com/signup)

— The Byline team

---

EMAIL 5 SUBJECT: Still thinking about it?
EMAIL 5 BODY:
Hi {{contact.first_name}},

You ran the audit. You saw what's missing.

We've spent the past two weeks showing you what Byline does with a content gap — the workflow, the agent, the brand profile that keeps it sounding like you instead of like everyone else.

Here's the most honest thing we can say:

If you're not going to start filling those gaps, the audit was just an interesting exercise.

If you are — Byline is free to get started. No credit card. You get your first article generated at no cost. If you like it, you can decide whether $49/month is worth it. If you don't, you've lost nothing except the 10 minutes it took to find out.

[Start for free →](https://app.bylineseo.com/signup)

The gaps don't fill themselves.

— Michael + the Byline team

P.S. If you have questions about whether Byline is right for your situation, just reply. We read everything.

---

# WORKFLOW 2: Byline — Welcome Onboarding

**Trigger:** Tag Added = `byline_user`
**Goal/Exit:** Contact gets tag `byline_fully_activated` → exit workflow
**From name:** The Byline team
**Folder:** Byline Email Sequences

Schedule:
- Day 0 (5 min delay): E1 — "Welcome to Byline — start here" (all users)
- Day +1: E2 — "The 5-minute step..." (skip if custom field brand_profile_complete = true → jump to E3)
- Day +3: E3 — "Your first Byline article" (all users)
- Day +6: E4 — "The agent is where Byline gets interesting" (skip if agent_sessions > 0 → jump to E5)
- Day +10: E5 — "Ready to publish? Connect WordPress." (all users)
- Day +14: E6A — "You signed up 2 weeks ago..." (only if articles_generated = 0)
- Day +14: E6B — "You've got N articles..." (only if articles_generated > 0 AND agent_sessions = 0)

EMAIL E1 SUBJECT: Welcome to Byline — start here
EMAIL E1 BODY:
Hi {{contact.first_name}},

You're in.

Byline is built to do one thing well: take a keyword and turn it into the kind of article you'd actually be proud to publish. Not just fast — good.

Before you generate your first article, there's one thing that will make everything that follows better:

**Set up your Brand Profile.**

It takes 5 minutes. It affects every piece of content Byline creates for you — your voice, your tone, the topics you avoid, the phrases that don't fit your brand, the competitor names you don't give free press to.

Without it, the articles will be competent. With it, they'll sound like you.

[Complete your Brand Profile →](https://app.bylineseo.com/settings/brand)

Tomorrow: we'll show you how to generate your first article.

— The Byline team

---

EMAIL E2 SUBJECT: The 5-minute step that makes AI content sound like you
EMAIL E2 BODY:
Hi {{contact.first_name}},

A quick story.

A user generated their first Byline article — a competitive comparison piece for a B2B software company. Well-structured, accurate, ~2,200 words. But when they read it back, something felt off. The tone was a little generic. Like reading their own ideas through a filter that had never actually met them.

They hadn't set up their Brand Profile.

They set it up — described their voice (direct, no fluff, technical but human), added a handful of phrases they don't use, noted which competitors they don't mention by name. Then they regenerated.

Same keyword. Different result. That one they published.

Your **Brand Profile** is the layer that makes Byline's engine understand your brand, not just the topic. It's applied at the brief level — before a word is written — so the entire article is shaped by your constraints from the start.

Here's what it covers: voice and tone, topics to avoid, phrases you don't use, and competitor names to leave out.

[Set up your Brand Profile →](https://app.bylineseo.com/settings/brand)

Once that's done, your first article is ready to run.

— The Byline team

---

EMAIL E3 SUBJECT: Your first Byline article (takes about 60 seconds)
EMAIL E3 BODY:
Hi {{contact.first_name}},

Ready to generate your first article?

Here's how it works with **Quick Write**:

Go to Articles → New Article, enter a keyword or topic you want to rank for, and Byline generates a content brief. You can review it or let it run automatically. The full article comes back: 2,000+ words, structured to the intent, with a clear point of view in every section.

The whole thing usually takes under 2 minutes.

A few notes on what to expect: the article is a strong first draft from a well-informed writer — not a final publish. Treat it that way. The agent (more on that in a few days) is what takes it from draft to done.

If it doesn't quite sound like you yet, that's almost always a Brand Profile thing. A note or two added there will change the next one meaningfully.

The best first keyword is something your audience is already searching for — a topic you know has demand, not just one that feels right to write about.

[Generate your first article →](https://app.bylineseo.com/articles/new)

When you've run it, reply and tell us what you think. We read every response.

— The Byline team

---

EMAIL E4 SUBJECT: The agent is where Byline gets interesting
EMAIL E4 BODY:
Hi {{contact.first_name}},

You've got a draft. Here's what to do with it.

The Byline agent works in three modes. Each one is useful for a different scenario:

**Review mode** — Conversational editing. You talk to the agent like you'd talk to an editor: "the second section feels weak," "sharpen the intro," "make the tone a bit less formal." It responds with rewrites and reasons for the changes. This is the best mode when you have specific notes but want to stay in control of the direction.

**Assist mode** — Targeted rewrites. Highlight any paragraph in the editor and tell the agent what to do with it. The change applies to that section only — everything else stays untouched. Good for fixing one weak spot without disrupting a draft that's otherwise working.

**Auto mode** — Hands-off editorial pass. The agent reviews the full article and applies improvements on its own — strengthening arguments, cutting filler, tightening structure, improving clarity throughout. You review the changes and accept or reject before anything is saved.

If you've already generated your first article, open it now and try Review mode first. Ask the agent one thing. Get a feel for how it responds before you run Auto.

[Open your article + try the agent →](https://app.bylineseo.com/articles)

This is where most Byline users have their "oh, that's what this actually is" moment.

— The Byline team

---

EMAIL E5 SUBJECT: Ready to publish? Connect WordPress.
EMAIL E5 BODY:
Hi {{contact.first_name}},

If you're on WordPress (or planning to be), there's one more step worth taking.

Connect your WordPress account in Settings, and every article you generate in Byline can be published directly — with formatting intact, headings preserved, and metadata set.

No copy-paste. No fighting with the block editor to keep your H2 structure. No watching your formatting fall apart in the transfer.

Once connected, there's a **Publish to WordPress** button on every article. You click it. It's live.

For teams publishing at volume, this alone saves hours per week. For solo operators, it removes the friction that turns finished drafts into files that sit in a folder instead of getting published.

[Connect WordPress in Settings →](https://app.bylineseo.com/settings/connections)

Not on WordPress? The editor gives you clean HTML and plain text export — both format cleanly wherever you paste them.

At this point you have everything in place: a Brand Profile that makes Byline sound like you, a workflow for turning any keyword into a 2,000-word draft, an agent that sharpens the draft, and a direct publish path to your site.

The only thing left is to use it consistently.

— The Byline team

---

EMAIL E6A SUBJECT: You signed up 2 weeks ago — did something get in the way?
EMAIL E6A BODY: (send only if articles_generated = 0)
Hi {{contact.first_name}},

You signed up two weeks ago and haven't generated anything yet.

That's completely fine — we know how it goes. You sign up with good intentions, life moves, and by the time you circle back it feels like the moment has passed.

It hasn't.

If you ran a content audit before signing up, those gap topics are still there — unwritten, still searched for, still claimed by your competitors. The opportunity is the same. The window is just slightly shorter.

Fastest path back: go to Articles → New Article, pick one keyword — from your audit or anything you know your audience searches for — let Byline generate the brief and draft, then give it one pass with the agent.

If the article is good, you have something worth publishing. If it's not quite right, reply here and tell us what felt off. We'll help.

[Generate your first article →](https://app.bylineseo.com/articles/new)

— The Byline team

P.S. If something about the setup or signup experience didn't work the way you expected, reply here. We'd genuinely like to know.

---

EMAIL E6B SUBJECT: You've got {{custom_field.articles_generated}} article(s) — here's what most people miss next
EMAIL E6B BODY: (send only if articles_generated > 0 AND agent_sessions = 0)
Hi {{contact.first_name}},

You've generated {{custom_field.articles_generated}} article(s) in Byline. That's a real start.

There's a second step most people miss: the **agent**.

The article you get back from generation is a strong first draft. The agent is what takes it from draft to something you'd actually want to publish under your name.

You haven't used it yet. Here's the quickest way to see what it does:

Open your most recent article, click the agent panel on the right, start in Review mode, and ask it to improve one specific section. Watch how it responds.

That's it. One session will show you more than anything we could explain in an email.

[Open your article + try the agent →](https://app.bylineseo.com/articles)

It's where the tool goes from "useful" to "this is the thing I was actually looking for."

— The Byline team

---

Format all of this cleanly as a markdown document. Include a quick-reference section at the top showing workflow names, triggers, and send schedules in a table. Make it easy to scan and use as a reference while building in GHL.

Save to /sessions/dazzling-eloquent-euler/mnt/seo-saas/GHL-Workflows-Manual-Setup.md and present the file when done. Also send a brief SendUserMessage telling the user the file is ready with both workflows and all email copy.

## Michael

Create a clean, easy-to-follow GHL manual setup guide as a markdown file saved to /sessions/dazzling-eloquent-euler/mnt/seo-saas/GHL-Workflows-Manual-Setup.md

Include BOTH workflows in full, formatted for easy copy-paste into GHL. Here are the exact details:

---

# WORKFLOW 1: Byline — Post-Audit Nurture

**Trigger:** Tag Added = `audit_lead`
**Goal/Exit:** Contact gets tag `byline_user` → exit workflow
**From name:** The Byline team
**Folder:** Byline Email Sequences

Schedule:
- Day 0 (5 min delay): Email 1 — "Your content gaps, mapped"
- Day +2: Email 2 — "The article you didn't write"
- Day +5: Email 3 — "From keyword to ranking — the full picture"
- Day +8: Email 4 — "The one setup step that changes everything"
- Day +12: Email 5 — "Still thinking about it?"

EMAIL 1 SUBJECT: Your content gaps, mapped
EMAIL 1 BODY:
Hi {{contact.first_name}},

You ran the audit. Here's what it means.

Content gaps aren't created equal. Some are low-competition opportunities you could fill this week. Others are strategic bets — high-value topics that take time to build but compound over months.

Your results flagged both.

The **quick wins** are topics with real search demand and manageable competition. Articles your audience is already searching for that you haven't written yet. Fill three of them in the next 30 days and you'll likely see measurable organic movement by Q4.

The **strategic gaps** are bigger — topic clusters where your competitors have built authority and you're starting from zero. Worth understanding, even if you don't tackle them first.

Here's the honest part: most content teams look at a list like this and don't know where to start, so they don't start at all. The gaps stay gaps.

If you want to do something with this data, the next step is simple: pick one topic and write the article. Byline generates that article for you in about 60 seconds — research-backed, 2,000+ words, written to rank.

[Start with your first gap →](https://app.bylineseo.com/signup)

— The Byline team

---

EMAIL 2 SUBJECT: The article you didn't write
EMAIL 2 BODY:
Hi {{contact.first_name}},

Here's what happens when you identify a content gap and don't fill it:

Your competitors do.

It sounds obvious. But it's worth sitting with. Every topic in your audit results is a search query someone is typing right now. If your site doesn't answer it, they're landing on someone else's — building trust with that brand, not yours.

Content that ranks doesn't just drive traffic. It earns backlinks, signals relevance to the algorithms that power AI answer engines like ChatGPT and Gemini, and compounds in ways that paid ads simply don't.

The window on a content gap isn't infinite. The topics in your audit results are ranked by opportunity right now. That ranking changes as competitors build out their coverage.

You already did the research. You saw what's there. The only question is whether you're going to do something with it.

Byline turns a gap from your audit into a complete, publish-ready article in about 60 seconds. Not a rough draft you'll spend hours editing — a real 2,000-word piece that's structured, researched, and written to the intent of the keyword.

[Turn your first gap into an article →](https://app.bylineseo.com/signup)

The data won't get fresher.

— The Byline team

---

EMAIL 3 SUBJECT: From keyword to ranking — the full picture
EMAIL 3 BODY:
Hi {{contact.first_name}},

A lot of AI writing tools give you a draft. Byline builds something different.

Here's the actual workflow — from gap to published post:

**Step 1: The brief**
Before writing a word, Byline generates a content brief. It maps the search intent, outlines the article structure, identifies the semantic topics the piece needs to cover to compete with what's currently ranking, and sets a word count target based on the competitive landscape. The brief is what most writers skip — and why most AI content underperforms.

**Step 2: The draft**
The article is generated to the brief — not just to a keyword. That means it's structured to match real search intent, not just the phrase. 2,000–2,500 words, with a specific claim or verdict in every H2, and none of the vague filler that makes AI content recognizable at a glance.

**Step 3: The agent**
This is where Byline separates from every other tool. The article agent reviews your draft and works with you to improve it — in three modes: Review (conversational), Assist (targeted paragraph rewrites), and Auto (hands-off full editorial pass).

**Step 4: Publish**
Connect your WordPress account and publish directly from Byline. No copy-paste. No format loss.

The whole loop — brief → draft → polish → live — takes under 10 minutes for most articles.

[See it for yourself →](https://app.bylineseo.com/signup)

— The Byline team

---

EMAIL 4 SUBJECT: The one setup step that changes everything
EMAIL 4 BODY:
Hi {{contact.first_name}},

The most common complaint about AI-written content is that it sounds like AI.

You know the tone — technically competent, occasionally insightful, but somehow flat. Like someone translated your ideas through a filter that's never quite met them.

Byline has a specific answer to this, and it takes about 5 minutes to configure.

When you create a **Brand Profile**, you're giving Byline's generation engine a set of constraints that shape every article it writes for you: your voice and tone, topics you avoid, phrases you don't use, and competitor names to leave out.

Once this is set, every article Byline generates — for every keyword you run — is filtered through those parameters. The output stops sounding like "an AI article about your topic" and starts sounding like something you'd actually publish under your name.

Skip this step and you get competent generic content. Set it up and you get something you'd be proud of.

[Start free + set up your Brand Profile →](https://app.bylineseo.com/signup)

— The Byline team

---

EMAIL 5 SUBJECT: Still thinking about it?
EMAIL 5 BODY:
Hi {{contact.first_name}},

You ran the audit. You saw what's missing.

We've spent the past two weeks showing you what Byline does with a content gap — the workflow, the agent, the brand profile that keeps it sounding like you instead of like everyone else.

Here's the most honest thing we can say:

If you're not going to start filling those gaps, the audit was just an interesting exercise.

If you are — Byline is free to get started. No credit card. You get your first article generated at no cost. If you like it, you can decide whether $49/month is worth it. If you don't, you've lost nothing except the 10 minutes it took to find out.

[Start for free →](https://app.bylineseo.com/signup)

The gaps don't fill themselves.

— Michael + the Byline team

P.S. If you have questions about whether Byline is right for your situation, just reply. We read everything.

---

# WORKFLOW 2: Byline — Welcome Onboarding

**Trigger:** Tag Added = `byline_user`
**Goal/Exit:** Contact gets tag `byline_fully_activated` → exit workflow
**From name:** The Byline team
**Folder:** Byline Email Sequences

Schedule:
- Day 0 (5 min delay): E1 — "Welcome to Byline — start here" (all users)
- Day +1: E2 — "The 5-minute step..." (skip if custom field brand_profile_complete = true → jump to E3)
- Day +3: E3 — "Your first Byline article" (all users)
- Day +6: E4 — "The agent is where Byline gets interesting" (skip if agent_sessions > 0 → jump to E5)
- Day +10: E5 — "Ready to publish? Connect WordPress." (all users)
- Day +14: E6A — "You signed up 2 weeks ago..." (only if articles_generated = 0)
- Day +14: E6B — "You've got N articles..." (only if articles_generated > 0 AND agent_sessions = 0)

EMAIL E1 SUBJECT: Welcome to Byline — start here
EMAIL E1 BODY:
Hi {{contact.first_name}},

You're in.

Byline is built to do one thing well: take a keyword and turn it into the kind of article you'd actually be proud to publish. Not just fast — good.

Before you generate your first article, there's one thing that will make everything that follows better:

**Set up your Brand Profile.**

It takes 5 minutes. It affects every piece of content Byline creates for you — your voice, your tone, the topics you avoid, the phrases that don't fit your brand, the competitor names you don't give free press to.

Without it, the articles will be competent. With it, they'll sound like you.

[Complete your Brand Profile →](https://app.bylineseo.com/settings/brand)

Tomorrow: we'll show you how to generate your first article.

— The Byline team

---

EMAIL E2 SUBJECT: The 5-minute step that makes AI content sound like you
EMAIL E2 BODY:
Hi {{contact.first_name}},

A quick story.

A user generated their first Byline article — a competitive comparison piece for a B2B software company. Well-structured, accurate, ~2,200 words. But when they read it back, something felt off. The tone was a little generic. Like reading their own ideas through a filter that had never actually met them.

They hadn't set up their Brand Profile.

They set it up — described their voice (direct, no fluff, technical but human), added a handful of phrases they don't use, noted which competitors they don't mention by name. Then they regenerated.

Same keyword. Different result. That one they published.

Your **Brand Profile** is the layer that makes Byline's engine understand your brand, not just the topic. It's applied at the brief level — before a word is written — so the entire article is shaped by your constraints from the start.

Here's what it covers: voice and tone, topics to avoid, phrases you don't use, and competitor names to leave out.

[Set up your Brand Profile →](https://app.bylineseo.com/settings/brand)

Once that's done, your first article is ready to run.

— The Byline team

---

EMAIL E3 SUBJECT: Your first Byline article (takes about 60 seconds)
EMAIL E3 BODY:
Hi {{contact.first_name}},

Ready to generate your first article?

Here's how it works with **Quick Write**:

Go to Articles → New Article, enter a keyword or topic you want to rank for, and Byline generates a content brief. You can review it or let it run automatically. The full article comes back: 2,000+ words, structured to the intent, with a clear point of view in every section.

The whole thing usually takes under 2 minutes.

A few notes on what to expect: the article is a strong first draft from a well-informed writer — not a final publish. Treat it that way. The agent (more on that in a few days) is what takes it from draft to done.

If it doesn't quite sound like you yet, that's almost always a Brand Profile thing. A note or two added there will change the next one meaningfully.

The best first keyword is something your audience is already searching for — a topic you know has demand, not just one that feels right to write about.

[Generate your first article →](https://app.bylineseo.com/articles/new)

When you've run it, reply and tell us what you think. We read every response.

— The Byline team

---

EMAIL E4 SUBJECT: The agent is where Byline gets interesting
EMAIL E4 BODY:
Hi {{contact.first_name}},

You've got a draft. Here's what to do with it.

The Byline agent works in three modes. Each one is useful for a different scenario:

**Review mode** — Conversational editing. You talk to the agent like you'd talk to an editor: "the second section feels weak," "sharpen the intro," "make the tone a bit less formal." It responds with rewrites and reasons for the changes. This is the best mode when you have specific notes but want to stay in control of the direction.

**Assist mode** — Targeted rewrites. Highlight any paragraph in the editor and tell the agent what to do with it. The change applies to that section only — everything else stays untouched. Good for fixing one weak spot without disrupting a draft that's otherwise working.

**Auto mode** — Hands-off editorial pass. The agent reviews the full article and applies improvements on its own — strengthening arguments, cutting filler, tightening structure, improving clarity throughout. You review the changes and accept or reject before anything is saved.

If you've already generated your first article, open it now and try Review mode first. Ask the agent one thing. Get a feel for how it responds before you run Auto.

[Open your article + try the agent →](https://app.bylineseo.com/articles)

This is where most Byline users have their "oh, that's what this actually is" moment.

— The Byline team

---

EMAIL E5 SUBJECT: Ready to publish? Connect WordPress.
EMAIL E5 BODY:
Hi {{contact.first_name}},

If you're on WordPress (or planning to be), there's one more step worth taking.

Connect your WordPress account in Settings, and every article you generate in Byline can be published directly — with formatting intact, headings preserved, and metadata set.

No copy-paste. No fighting with the block editor to keep your H2 structure. No watching your formatting fall apart in the transfer.

Once connected, there's a **Publish to WordPress** button on every article. You click it. It's live.

For teams publishing at volume, this alone saves hours per week. For solo operators, it removes the friction that turns finished drafts into files that sit in a folder instead of getting published.

[Connect WordPress in Settings →](https://app.bylineseo.com/settings/connections)

Not on WordPress? The editor gives you clean HTML and plain text export — both format cleanly wherever you paste them.

At this point you have everything in place: a Brand Profile that makes Byline sound like you, a workflow for turning any keyword into a 2,000-word draft, an agent that sharpens the draft, and a direct publish path to your site.

The only thing left is to use it consistently.

— The Byline team

---

EMAIL E6A SUBJECT: You signed up 2 weeks ago — did something get in the way?
EMAIL E6A BODY: (send only if articles_generated = 0)
Hi {{contact.first_name}},

You signed up two weeks ago and haven't generated anything yet.

That's completely fine — we know how it goes. You sign up with good intentions, life moves, and by the time you circle back it feels like the moment has passed.

It hasn't.

If you ran a content audit before signing up, those gap topics are still there — unwritten, still searched for, still claimed by your competitors. The opportunity is the same. The window is just slightly shorter.

Fastest path back: go to Articles → New Article, pick one keyword — from your audit or anything you know your audience searches for — let Byline generate the brief and draft, then give it one pass with the agent.

If the article is good, you have something worth publishing. If it's not quite right, reply here and tell us what felt off. We'll help.

[Generate your first article →](https://app.bylineseo.com/articles/new)

— The Byline team

P.S. If something about the setup or signup experience didn't work the way you expected, reply here. We'd genuinely like to know.

---

EMAIL E6B SUBJECT: You've got {{custom_field.articles_generated}} article(s) — here's what most people miss next
EMAIL E6B BODY: (send only if articles_generated > 0 AND agent_sessions = 0)
Hi {{contact.first_name}},

You've generated {{custom_field.articles_generated}} article(s) in Byline. That's a real start.

There's a second step most people miss: the **agent**.

The article you get back from generation is a strong first draft. The agent is what takes it from draft to something you'd actually want to publish under your name.

You haven't used it yet. Here's the quickest way to see what it does:

Open your most recent article, click the agent panel on the right, start in Review mode, and ask it to improve one specific section. Watch how it responds.

That's it. One session will show you more than anything we could explain in an email.

[Open your article + try the agent →](https://app.bylineseo.com/articles)

It's where the tool goes from "useful" to "this is the thing I was actually looking for."

— The Byline team

---

Format all of this cleanly as a markdown document. Include a quick-reference section at the top showing workflow names, triggers, and send schedules in a table. Make it easy to scan and use as a reference while building in GHL.

Save to /sessions/dazzling-eloquent-euler/mnt/seo-saas/GHL-Workflows-Manual-Setup.md and present the file when done. Also send a brief SendUserMessage telling the user the file is ready with both workflows and all email copy.

> `mcp__workspace__bash`

> `mcp__workspace__bash`

> `mcp__workspace__bash`

> `mcp__workspace__bash`

> `mcp__workspace__bash`

> `mcp__workspace__bash`

> `mcp__workspace__bash`

**Claude:** The target path isn't writable from this session, so I'll save it to my outputs folder where you can access it directly.

> `Write: GHL-Workflows-Manual-Setup.md`

> `mcp__cowork__present_files`

**Claude:** Your GHL manual setup guide is ready. Note: the path `/sessions/dazzling-eloquent-euler/mnt/seo-saas/` wasn't writable from this session, so the file was saved to your outputs folder instead:

[View GHL-Workflows-Manual-Setup.md](computer://C%3A%5CUsers%5Cozzy5%5CAppData%5CRoaming%5CClaude%5Clocal-agent-mode-sessions%5C4fa41303-fad2-4f13-83d3-42867bfb9491%5C9ac27fbc-a982-4441-a41a-2f4e4b966141%5Clocal_3827bf16-4e88-4372-b41d-398424ff0aff%5Coutputs%5CGHL-Workflows-Manual-Setup.md)

The file includes both workflows in full with all email copy in code blocks ready to paste directly into GHL. At the top there's a quick-reference section with two tables — one showing the overall workflow settings side by side, and individual schedule tables for each workflow. The onboarding workflow's branching logic (E2 skip, E4 skip, E6A/E6B conditions) is spelled out in the build order steps, and there's a custom fields reference table at the bottom noting the three fields you'll need to create in GHL and how they should be populated via Byline webhooks.
