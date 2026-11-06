# Queue handoff: getting drafted work onto Michael's action page

Michael works from his phone. He cannot copy text out of a chat. The only way a
drafted post, comment or message reaches him is as a row in the Supabase table
`outreach_queue`, which the action page (https://app.bylineseo.com/admin/today)
reads, with a copy button on every item.

## Why this is done by hand

Since about 4 November 2026 the scheduled tasks run on a cloud runner that
cannot reach supabase.co and cannot write to Michael's Documents folder. Their
drafts end up in files and never reach the queue. There is no setting to move
them back to his computer.

So: **drafting and inserting must happen in a session running on Michael's
computer (C:\dev\Byline), which has both the files and Supabase access.** A
scheduled task can still draft, but its output is not delivered until a host
session runs the scripts below. Never report work as "in the queue" until the
rows have been read back.

## Two rules learned the hard way

- **A draft that exists only in a chat reply is lost.** Write anything drafted
  to a file (the JSON the script takes) in the same turn it is drafted, before
  reporting it as done. On 5 Nov four comments survived because they were in
  `comments-2026-11-05.json`; a fifth was drafted only in chat and had to be
  rebuilt from the send log.
- **Before inserting a comment or reply, check the queue for the same person
  and post.** If one is already there, and especially if it is marked done, do
  not insert a second; Michael would be commenting twice on one post. On 6 Nov
  a rewritten comment for Eli Schwartz was held back because the first version
  (CM-08) had already been posted the day before.

## Capture the permalink

When a post is first read, capture its permalink (the post's own URL, from
"Copy link to post") and put it in `postUrl`. Today's comment rows name a
profile's recent-activity page and an opening line to scan for, which works
but is slow on a phone. Capturing it costs one extra page load per post.

## Daily routine

Run everything from `C:\dev\Byline`. Every script takes `--dry`. Run that first:
it checks the copy and prints character counts without writing anything.

| Work | Draft file | Script |
|---|---|---|
| Social posts | JSON array, see the header of the script | `npx tsx --env-file=.env.local scripts/add-social.ts <posts.json>` |
| Comments on other people's posts | `C:\Users\ozzy5\Documents\byline-outbound\engagement\comments-YYYY-MM-DD.json` | `npx tsx --env-file=.env.local scripts/add-comments.ts <comments.json>` |
| A reply to a comment or message | one JSON object | `npx tsx --env-file=.env.local scripts/add-reply.ts <reply.json>` |
| A connection request plus its follow-up message | one JSON object | `npx tsx --env-file=.env.local scripts/add-connection.ts <connection.json>` |

Then:
1. Read the rows back (id, type, account, platform, first words) and confirm they are there.
2. Log each item in `C:\Users\ozzy5\Documents\byline-outbound\byline-send-log.md` with its id and `Outcome: pending`.

## What the scripts refuse

They refuse rather than "fix" copy. The copy comes from the
byline-outreach-and-social skill, so a refusal goes back to whoever drafted it.

- Em or en dashes, and exclamation points, anywhere.
- X posts over 280 characters (a link counts as 23).
- LinkedIn connection follow-up messages over 200 characters.
- A link in the body of a Facebook post (DECISIONS 40). It goes in the first comment instead.
- Comments on posts more than 5 days old.

`add-social.ts` skips a post whose text is already queued. `add-comments.ts`
does not, so check for an existing row before running it twice.

## Id conventions

The prefix plus the next free number, with **no dash before the number**.

| Prefix | Meaning | Example |
|---|---|---|
| F-X, F-L | Founder post on X, on LinkedIn | F-X15, F-L14 |
| B-X, B-F | Brand post on X, on the Facebook page | B-X11, B-F8 |
| CM-nn | Comment on someone's post | CM-14 |
| RE-nn | Reply | RE-03 |
| RQ-nn | Plain connection request, no note | RQ-29 |
| OB-nn | The message sent after that request is accepted (same number as its RQ) | OB-29 |

Older one-off scripts (`add-social-2026-11-02.ts`, `add-social-2026-11-05.ts`)
once built "F-X-15" with an extra dash. Any id with two dashes is a bug.

## How items behave on the page

- **A post promoting a blog article** waits with `after_ids: ["blog:<slug>"]`. It appears when the article is published in Sanity.
- **An OB message** is held (status `blocked`) until Michael taps "They accepted" on its RQ request.
- **Replies** go to the top of the list. **Comments** sort by `closes_on`, which is three days after the post went up.
- **Daily limits:** 2 posts per account per day and 5 per week; 4 comments; 15 requests; 5 messages. Items over a limit are held, not lost.

## Supabase from a host session

The scripts read `.env.local`: NEXT_PUBLIC_SUPABASE_URL and the service role
key. Never print the values. Michael runs any SQL schema change himself.
Scripts only insert and update rows.
