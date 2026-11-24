# Email and environment variables: how mail is sent and what to know before touching it

Written 2026-11-24 after the password-reset work, which found that the app's own
mail had never worked. Read this before changing a sender, a key or an env var.

## Two mail paths, two Resend accounts

1. **Supabase Auth mail** (signup confirmation and anything Supabase itself sends).
   Goes out through Supabase's custom SMTP, which points at Resend. Sender:
   `Byline SEO <welcome@send.bylineseo.com>`.
2. **The app's own mail** (`src/lib/email.ts`, function `sendEmail`): password
   reset, password and email change notices, cancellation confirmations, access
   alerts, tracked-page change emails. Sender:
   `Byline SEO <support@send.bylineseo.com>`, reply-to `hi@bylineseo.com`.

There were **two Resend accounts**. The personal one held the root domain
(`bylineseo.com`) and Supabase's SMTP. The branded account now holds the verified
sending subdomain **`send.bylineseo.com`** (region ap-northeast-1, sending enabled,
receiving disabled). Everything the app sends must come from that subdomain. A From
on the root domain is refused.

**Use a separate API key per system, named for where it lives** (for example one for
Supabase SMTP, one for the Vercel app). Then rotating or revoking one cannot silently
break the other, and a key in the wrong place is visible by name.

Verified on 2026-11-24: a reset sent by the app's own code reached a Gmail inbox
(not spam) in about one second, `SPF: PASS`, `DKIM: PASS` with domain
`send.bylineseo.com`, `DMARC: PASS`. The root domain's DMARC policy is `p=none`.

## `vercel env pull` does not return sensitive variables

For any variable marked **Sensitive** in Vercel, `vercel env pull` writes the
literal placeholder **`[SENSITIVE]`** (11 characters), not the value. It looks like a
key that is set. It is not. This hid a broken mail setup for most of a day: the local
`RESEND_API_KEY` was "set", Resend answered "API key is invalid", and the cause
looked like the key itself.

- A pulled `.env.local` holds `[SENSITIVE]` for every sensitive variable (at the time
  of writing that included the Resend key, Telegram token and chat ids, the GHL
  keys, Google client secrets, `CRON_SECRET`, `ENCRYPTION_KEY`, `PERPLEXITY_API_KEY`).
- **Sensitive values can never be pulled.** To test something locally that needs one,
  paste the real value into `.env.local` by hand, and keep it out of chat and logs.
- `sendEmail` now treats any key that does not start with `re_` as "not a Resend
  key", reports it (see below) and does not attempt the send.

## Failed sends are not silent any more

`sendEmail` reports every failure (key unset or placeholder, provider refusal, network
error) as a greppable log line `[EMAIL-SEND-FAILED]` (recipient domain only) and a
Telegram message to Michael, at most two a day (`src/lib/email-alert.ts`). Telegram
because the failing channel is email. Several flows show the customer a neutral
message whatever happens to the mail, so without this a dead key looks like a working
one. The Telegram token and chat id are sensitive Vercel variables: if they are
missing, the alert itself cannot send, so check they are set in Production.

## The old sender setting is dead

`SUPPORT_EMAIL_FROM` (was `support@bylineseo.com`, the unverified root domain) is no
longer read by anything. **Delete it from Vercel.** The sender is the constant
`EMAIL_FROM` in `src/lib/email.ts`. A test fails if a From on the root domain returns.

## The access-alert marking bug, and what it would have hidden

`emailAccessChange` (`src/lib/access-tracking.ts`) set `access_alerts.emailed_at`
after calling `sendEmail` **whatever the result**. While the key was broken, every
alert would have been recorded as emailed and never delivered, and nothing would have
shown it. It now sets `emailed_at` only when the send succeeded, so an alert that was
never sent stays visibly un-emailed. Checked at the time of the fix: `access_alerts`
had zero rows and there were no billing tickets, so nothing was lost and nothing is
queued to fire in a burst. The tracked-page change emails (`emailChange` in
`src/lib/tracking.ts`) have no record of sends at all; they were sent per rerun and
dropped on failure. They resume now, to the owners of tracked pages.

## Checklist for changing any of this

1. Never trust a local env value that came from `vercel env pull`. Check the prefix.
2. After any change to a sender or key, send one real email through the app's own
   code (not a direct API call) to an inbox you can read, and read the headers.
3. Look at the Resend dashboard's Emails list. It shows from, to, subject and the last
   event (`delivered`, `bounced`), which is the quickest check that the app's path works.
