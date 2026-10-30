# Blog drafting — markdown to Sanity draft

Push a markdown file into Sanity as a **draft** `post`. Nothing goes live until
you press Publish in Studio.

```bash
npm run draft -- content/blog/my-post.md            # create/update the draft
npm run draft -- content/blog/my-post.md --dry-run  # validate, write nothing
npm run draft -- content/blog/my-post.md --json     # print the document, write nothing
```

## One-time setup

The script needs three values in `.env.local` (gitignored — never commit it):

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | Public project id. Set in `C:\dev\Byline\.env.local`. |
| `NEXT_PUBLIC_SANITY_DATASET` | `production`. |
| `SANITY_API_WRITE_TOKEN` | Editor-scoped token from sanity.io/manage → API → Tokens. Set in `C:\dev\Byline\.env.local`. |

The script reads `.env.local` from the directory you run it in, so run it from
the repo root (or copy `.env.local` into a worktree first).

Verified end to end on 2026-09-30: a throwaway draft was created, read back as
`drafts.post-<slug>` with the token, returned nothing to unauthenticated API and
CDN reads, 404'd on `/blog/<slug>`, was absent from `/blog` and the sitemap, and
was then deleted.

`--dry-run` and `--json` need the project id but **not** the write token, so you
can validate markdown before the token is in place.

A token with **Editor** permission is enough. It only ever writes `drafts.*`
documents; it never publishes.

## Frontmatter

```yaml
---
title: "How to Check Whether AI Search Engines Can Read Your Site"
slug: "check-ai-search-can-read-your-site"
excerpt: "One or two sentences for the blog card and meta description."
seoTitle: "Optional override for the <title> tag"
seoDescription: "Optional override for the meta description"
publishedAt: "2026-09-24T09:00:00.000Z"
author: michael-osborne
categories: []
---
```

| Field | Required | Rule |
|---|---|---|
| `title` | **yes** | Schema requires it. Rendered as the page `<h1>`. |
| `slug` | **yes** | Lowercase, hyphenated, max 96 chars. Also the idempotency key. |
| `excerpt` | no | **Max 300 characters** — over is a hard failure. Used for the card and meta description. |
| `seoTitle` | no | Overrides the `<title>` tag. |
| `seoDescription` | no | Overrides the meta description. |
| `publishedAt` | no | ISO 8601. Defaults to now. The blog orders by this descending. |
| `author` | no | An author document **slug**. Optional while only one author exists; required once there are more. |
| `categories` | no | Array of category document slugs. **No category documents exist yet**, so leave it empty or create them in Studio first. |

A missing author or category is a hard failure listing what does exist — it
never silently drops the reference.

## Markdown

Supported and rendered correctly:

| Markdown | Becomes | Renders as |
|---|---|---|
| `##`, `###` | `h2`, `h3` | styled headings |
| `####` | `h4` | styled heading |
| paragraphs | `normal` | body text |
| `**bold**`, `*italic*` | `strong`, `em` | bold / italic |
| `[text](url)` | `link` annotation | copper link, external gets `target="_blank"` |
| `-` / `1.` lists | `bullet` / `number` | `<ul>` / `<ol>` |
| `> quote` | `blockquote` | left-ruled quote |

### Headings start at `##`

The post page already renders `title` as the page `<h1>`. A `#` heading in the
body is therefore dropped if it repeats the title, and demoted to `##`
otherwise — with a warning either way. Start at `##`.

### FAQ blocks

Wrap FAQ sections in a `:::faq` fence. Each `###` inside it is a question and
the prose beneath is its answer:

```markdown
:::faq
### Does AI search use the same signals as Google?
Partly. Crawling and indexing overlap, but retrieval for a generated answer
favours passages that are self-contained and quotable.

### How often should I re-check my site?
Monthly is enough for most sites.
:::
```

These become real `faq` objects, which render as an accordion **and** are
emitted as `FAQPage` JSON-LD structured data — the reason to use the fence
rather than plain headings.

The schema requires both `question` and `answer`, so an empty one fails the run.
Answers render as plain text, so markdown inside an answer shows as literal
characters; the script warns if it spots any.

Put fences at the top level, not nested inside a list or quote.

### Tables

Write a normal GFM markdown table. It becomes a real `table` object (header row
plus data rows) and renders as semantic `<table>`/`<thead>`/`<th>` markup, which
is what AI systems and our own engine can extract (DECISIONS 30).

```markdown
| Criterion | Why it matters |
|---|---|
| Direct answer | Engines lift the opening |
```

- The first row is the header. Rows with fewer cells are padded, and extra cells
  are dropped to the header's width.
- Cells are plain text: links, bold and code inside cells are kept as text, with
  a warning.
- Put tables at the top level, not inside a list or quote; the run fails if a
  table cannot be placed.

### Known gaps

- **Fenced code blocks** — the `post` schema's body accepts `block`, `image`,
  `faq` and `table` only; there is no `code` type, and the renderer has no code component.
  A fenced block is converted to a plain paragraph with a loud warning rather
  than being dropped or written in a form Studio would reject. Proper support
  needs a `code` type added to `src/sanity/schemas/post.ts` *and* a matching
  component in `src/app/blog/_components/PortableTextBody.tsx`.
- **Inline `` `code` `` and `~~strike~~`** — valid in the schema and stored
  faithfully, but `PortableTextBody` has no component for either, so they render
  as plain text. Warned once per run.
- **Images** — the schema supports body images, but uploading assets is not
  wired into this script. Add images in Studio after drafting.
- **`h5`/`h6`** — flattened to `h4`, which is the deepest heading the renderer
  styles.

## Idempotency

Re-running with the same slug **updates the same draft** — it never stacks
duplicates.

- No post with that slug yet → draft id is `drafts.post-<slug>`.
- A **published** post already uses that slug → the draft attaches to it
  (`drafts.<publishedId>`), so Studio shows it as unpublished changes to that
  post and publishing updates it rather than creating a second page on the same
  URL.

The run prints which of the two it did before writing.

## Reviewing and publishing

The draft appears in Studio at `/studio`. It is **not** on the live site.

The reason is the token, not the queries: a `drafts.*` document still has
`_type == "post"` and a slug, so the blog's GROQ filters would match it. What
keeps it hidden is that `src/sanity/lib/client.ts` reads with `useCdn: true` and
**no token**, and unauthenticated reads only ever return published documents.
Verified directly — `count(*[_id in path("drafts.**")])` returns `0` against
both the CDN and the live API without a token.

The corollary is worth knowing: if anyone ever adds a token to that client to
support preview, drafts become publicly visible unless the queries are also
changed to exclude `drafts.**`.

Check it renders, then press **Publish** in Studio. That is the only step that
makes it live, and it is always a human one.
