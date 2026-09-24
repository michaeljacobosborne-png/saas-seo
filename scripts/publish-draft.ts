#!/usr/bin/env tsx
/**
 * Create (or update) a Sanity DRAFT `post` from a markdown file.
 *
 *   npm run draft -- content/blog/my-post.md
 *   npm run draft -- content/blog/my-post.md --dry-run
 *
 * Never publishes. The document is written with a `drafts.` id, so it is only
 * visible in Studio (and to token-authenticated reads) until Michael hits
 * Publish. See docs/blog-drafting.md for the markdown contract.
 *
 * Idempotent on slug: re-running with the same slug replaces the same draft
 * rather than creating a second one. If a PUBLISHED post already uses that
 * slug, the draft is attached to it (`drafts.<publishedId>`) so publishing
 * updates that post instead of creating a duplicate slug.
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve, basename } from 'node:path'
import { createClient } from '@sanity/client'
import { htmlToBlocks, randomKey } from '@portabletext/block-tools'
import { Schema } from '@sanity/schema'
import { JSDOM } from 'jsdom'
import matter from 'gray-matter'
import { marked } from 'marked'
import { config as loadEnv } from 'dotenv'

loadEnv({ path: '.env.local', quiet: true })
loadEnv({ path: '.env', quiet: true })

const EXCERPT_MAX = 300 // schema: rule.max(300)
const SLUG_MAX = 96 // schema: options.maxLength

// ── failure ──────────────────────────────────────────────────────────────────

class DraftError extends Error {}

/** Every validation failure routes through here so the CLI output is uniform. */
function fail(message: string, hint?: string): never {
  throw new DraftError(hint ? `${message}\n   → ${hint}` : message)
}

const warnings: string[] = []
const warn = (m: string) => warnings.push(m)

// ── frontmatter ──────────────────────────────────────────────────────────────

interface Frontmatter {
  title?: string
  slug?: string
  excerpt?: string
  seoTitle?: string
  seoDescription?: string
  publishedAt?: string | Date
  author?: string // author document slug; omit to use the only author
  categories?: string[] // category document slugs
}

// ── FAQ extraction ───────────────────────────────────────────────────────────

interface FaqBlock {
  _type: 'faq'
  _key: string
  question: string
  answer: string
}

/**
 * FAQ sections are marked with a `:::faq` fence. Inside it, every `### heading`
 * is a question and the prose beneath it is the answer:
 *
 *   :::faq
 *   ### What is GEO?
 *   Generative Engine Optimization is …
 *
 *   ### How is it different from SEO?
 *   SEO optimises for ranking …
 *   :::
 *
 * An explicit fence rather than "any section titled FAQ", so a post that merely
 * discusses FAQs doesn't get silently restructured.
 *
 * Both `question` and `answer` are required by the schema, so an empty one is a
 * hard failure rather than a dropped block.
 *
 * Returns the markdown with each fence replaced by a placeholder, plus the
 * parsed blocks — the placeholders are swapped back in after conversion so the
 * FAQ keeps its position in the body.
 */
// A bare alphanumeric token, not an HTML comment: comments are not elements, so
// the DOM parser behind the deserializer discards them and the FAQ's position
// in the body is lost. This survives as an ordinary paragraph we can swap out.
const FAQ_PLACEHOLDER = (i: number) => `BYLINEFAQPLACEHOLDER${i}`

function extractFaqs(md: string): { markdown: string; faqs: FaqBlock[] } {
  const faqs: FaqBlock[] = []
  const fence = /^:::faq[ \t]*\r?\n([\s\S]*?)^:::[ \t]*$/gm

  const markdown = md.replace(fence, (_match, inner: string) => {
    const questions = String(inner).split(/^###[ \t]+/m).slice(1)

    if (questions.length === 0) {
      fail(
        'A :::faq block contains no questions.',
        'Each question inside the fence must be a "### " heading.',
      )
    }

    const start = faqs.length
    for (const chunk of questions) {
      const [head, ...rest] = chunk.split(/\r?\n/)
      const question = (head ?? '').trim()
      const answer = rest.join('\n').trim()

      if (!question) fail('An FAQ entry has an empty question.')
      if (!answer) {
        fail(
          `FAQ "${question}" has no answer.`,
          'The schema requires both question and answer; add prose beneath the heading.',
        )
      }
      // The renderer prints the answer as plain text with whitespace-pre-line,
      // so inline markdown would show as literal characters. Flag rather than
      // silently shipping "**bold**" to the page.
      if (/\[[^\]]+\]\([^)]+\)|\*\*|__/.test(answer)) {
        warn(`FAQ "${question}" contains markdown syntax; it renders as plain text.`)
      }

      faqs.push({ _type: 'faq', _key: randomKey(12), question, answer })
    }

    return `\n\n${faqs
      .slice(start)
      .map((_, i) => FAQ_PLACEHOLDER(start + i))
      .join('\n\n')}\n\n`
  })

  return { markdown, faqs }
}

// ── markdown → HTML ──────────────────────────────────────────────────────────

/**
 * The post page already renders `post.title` as the page <h1> (blog/[slug]),
 * so an <h1> in the body would be a second one. A leading h1 matching the
 * title is dropped; any other h1 is demoted to h2.
 *
 * The renderer styles h2/h3/h4 only, so h5/h6 are flattened to h4.
 */
function normaliseHeadings(html: string, title: string): string {
  let out = html.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (m, inner: string) => {
    const text = String(inner).replace(/<[^>]+>/g, '').trim()
    if (text.toLowerCase() === title.trim().toLowerCase()) return ''
    warn(`Body <h1> "${text}" demoted to <h2> (the page title is the only h1).`)
    return `<h2>${inner}</h2>`
  })

  out = out.replace(/<(h[56])[^>]*>([\s\S]*?)<\/\1>/gi, (_m, tag: string, inner: string) => {
    warn(`<${tag}> flattened to <h4> — the blog renderer styles h2–h4 only.`)
    return `<h4>${inner}</h4>`
  })

  return out
}

/**
 * The post schema's body array accepts `block`, `image` and `faq` only — there
 * is no `code` type, and PortableTextBody has no `code` renderer. A fenced code
 * block is therefore kept as readable text rather than dropped, and flagged
 * loudly, because the alternative is a block Studio rejects and the page can't
 * draw.
 */
function degradeCodeBlocks(html: string): string {
  return html.replace(
    /<pre[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi,
    (_m, code: string) => {
      warn(
        'Code block converted to a plain paragraph — the post schema has no `code` type. ' +
          'Formatting and syntax highlighting are lost.',
      )
      return `<p>${code}</p>`
    },
  )
}

// ── HTML → Portable Text ─────────────────────────────────────────────────────

/**
 * A minimal block content type for the deserializer. Deliberately declared here
 * rather than importing the Studio schema: sanity.config.ts is a 'use client'
 * module that pulls in the whole Studio, which does not belong in a CLI.
 *
 * This mirrors the `body` field in src/sanity/schemas/post.ts. If that field
 * gains a style, mark or annotation, mirror it here.
 */
const compiled = Schema.compile({
  name: 'blog',
  types: [
    {
      name: 'blockContent',
      type: 'array',
      of: [
        {
          type: 'block',
          styles: [
            { title: 'Normal', value: 'normal' },
            { title: 'H2', value: 'h2' },
            { title: 'H3', value: 'h3' },
            { title: 'H4', value: 'h4' },
            { title: 'Quote', value: 'blockquote' },
          ],
          lists: [
            { title: 'Bullet', value: 'bullet' },
            { title: 'Numbered', value: 'number' },
          ],
          marks: {
            // post.ts uses a bare `type: 'block'`, so it inherits Sanity's
            // default decorators — which include code and strike-through.
            // They are listed here so inline `code` and ~~strike~~ survive the
            // conversion instead of being flattened to plain text. Note that
            // PortableTextBody styles strong/em/link only, so these two are
            // stored faithfully but render unstyled (see the warning below).
            decorators: [
              { title: 'Strong', value: 'strong' },
              { title: 'Emphasis', value: 'em' },
              { title: 'Code', value: 'code' },
              { title: 'Strike', value: 'strike-through' },
            ],
            annotations: [
              {
                name: 'link',
                type: 'object',
                title: 'Link',
                fields: [{ name: 'href', type: 'url', title: 'URL' }],
              },
            ],
          },
        },
      ],
    },
  ],
})

const blockContentType = compiled.get('blockContent')

/** 12-char hex, matching the _key format already in the dataset. */
const keyGenerator = () => randomKey(12)

function markdownToBlocks(md: string, title: string): unknown[] {
  let html = marked.parse(md, { async: false, gfm: true }) as string
  html = normaliseHeadings(html, title)
  html = degradeCodeBlocks(html)

  const blocks = htmlToBlocks(html, blockContentType, {
    keyGenerator,
    parseHtml: (h) => new JSDOM(h).window.document,
  }) as unknown[]

  // Stored faithfully, but PortableTextBody has no component for these, so they
  // render as unstyled text. Warn once rather than per occurrence.
  const unstyled = new Set<string>()
  for (const b of blocks) {
    const children = (b as { children?: { marks?: string[] }[] }).children ?? []
    for (const c of children) {
      for (const m of c.marks ?? []) {
        if (m === 'code' || m === 'strike-through') unstyled.add(m)
      }
    }
  }
  if (unstyled.size) {
    warn(
      `Uses ${[...unstyled].join(' and ')} — valid in the schema, but the blog ` +
        'renderer has no component for it, so it displays as plain text.',
    )
  }

  return blocks
}

/** Swap the placeholder paragraphs back out for the real faq objects. */
function reinsertFaqs(blocks: unknown[], faqs: FaqBlock[]): unknown[] {
  const placed = new Set<number>()

  const out = blocks.map((block) => {
    const b = block as { _type?: string; children?: { text?: string }[] }
    if (b._type !== 'block' || !Array.isArray(b.children)) return block

    const text = b.children.map((c) => c.text ?? '').join('').trim()
    const hit = /^BYLINEFAQPLACEHOLDER(\d+)$/.exec(text)
    if (!hit) return block

    const idx = Number(hit[1])
    const faq = faqs[idx]
    if (!faq) return block
    placed.add(idx)
    return faq
  })

  // A placeholder that survived conversion but never matched means the fence
  // landed somewhere the deserializer restructured (inside a list, say).
  const lost = faqs.filter((_, i) => !placed.has(i))
  if (lost.length) {
    fail(
      `${lost.length} FAQ block(s) could not be placed in the body.`,
      'Put :::faq fences at the top level, not nested inside a list or quote.',
    )
  }

  return out
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  // --json prints the document that would be written, for inspecting the
  // conversion before it reaches Sanity. It implies --dry-run.
  const showJson = args.includes('--json')
  const dryRun = args.includes('--dry-run') || showJson
  const file = args.find((a) => !a.startsWith('--'))

  if (!file) {
    fail(
      'No markdown file given.',
      'Usage: npm run draft -- content/blog/my-post.md [--dry-run] [--json]',
    )
  }

  const path = resolve(file)
  if (!existsSync(path)) fail(`File not found: ${path}`)

  // ── env ──
  const projectId = (process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || '').trim()
  const dataset = (process.env.NEXT_PUBLIC_SANITY_DATASET || 'production').trim()
  const apiVersion = (process.env.NEXT_PUBLIC_SANITY_API_VERSION || '2024-01-01').trim()
  const token = (process.env.SANITY_API_WRITE_TOKEN || '').trim()

  if (!projectId) {
    fail(
      'NEXT_PUBLIC_SANITY_PROJECT_ID is empty.',
      'Set it in .env.local — it exists as a key but has no value. See docs/blog-drafting.md.',
    )
  }
  if (!token && !dryRun) {
    fail(
      'SANITY_API_WRITE_TOKEN is not set locally.',
      'It is deployed to Vercel but not present in .env.local. Add it there (never commit it), ' +
        'or re-run with --dry-run to validate the markdown without writing.',
    )
  }

  // ── frontmatter ──
  const raw = readFileSync(path, 'utf8')
  const { data, content } = matter(raw)
  const fm = data as Frontmatter

  const title = (fm.title ?? '').trim()
  if (!title) fail('Frontmatter is missing `title`.', 'The schema requires it.')

  const slug = (fm.slug ?? '').trim()
  if (!slug) {
    fail(
      'Frontmatter is missing `slug`.',
      `Add one, e.g. slug: ${basename(path).replace(/\.mdx?$/, '')}`,
    )
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    fail(`Slug "${slug}" is not URL-safe.`, 'Use lowercase letters, numbers and single hyphens.')
  }
  if (slug.length > SLUG_MAX) {
    fail(`Slug is ${slug.length} characters; the schema caps it at ${SLUG_MAX}.`)
  }

  const excerpt = (fm.excerpt ?? '').trim()
  if (excerpt.length > EXCERPT_MAX) {
    fail(
      `Excerpt is ${excerpt.length} characters; the schema caps it at ${EXCERPT_MAX}.`,
      `Trim ${excerpt.length - EXCERPT_MAX} character(s).`,
    )
  }
  if (!excerpt) warn('No excerpt — the blog card preview and meta description will be empty.')

  let publishedAt = new Date().toISOString()
  if (fm.publishedAt) {
    const d = new Date(fm.publishedAt as string)
    if (Number.isNaN(d.getTime())) {
      fail(`publishedAt "${String(fm.publishedAt)}" is not a valid date.`, 'Use ISO 8601.')
    }
    publishedAt = d.toISOString()
  }

  // ── body ──
  const { markdown, faqs } = extractFaqs(content)
  const converted = markdownToBlocks(markdown, title)
  const body = reinsertFaqs(converted, faqs)

  if (body.length === 0) fail('The markdown produced no body content.')

  // ── client ──
  const client = createClient({
    projectId,
    dataset,
    apiVersion,
    token: token || undefined,
    useCdn: false, // must read live data to resolve refs and find existing drafts
  })

  // ── author reference ──
  const authors = (await client.fetch(
    '*[_type=="author"]{_id,name,"slug":slug.current}',
  )) as { _id: string; name: string; slug: string }[]

  if (authors.length === 0) {
    fail('No author documents exist in Sanity.', 'Create one in Studio before drafting posts.')
  }

  let author = authors[0]
  if (fm.author) {
    const found = authors.find((a) => a.slug === fm.author || a.name === fm.author)
    if (!found) {
      fail(
        `Author "${fm.author}" does not exist in Sanity.`,
        `Available: ${authors.map((a) => `${a.name} (${a.slug})`).join(', ')}`,
      )
    }
    author = found
  } else if (authors.length > 1) {
    fail(
      'Multiple authors exist and frontmatter does not say which to use.',
      `Add an "author:" line — one of: ${authors.map((a) => a.slug).join(', ')}`,
    )
  }

  // ── category references ──
  const wantedCats = fm.categories ?? []
  let categoryRefs: { _type: 'reference'; _ref: string; _key: string }[] = []

  if (wantedCats.length > 0) {
    const cats = (await client.fetch(
      '*[_type=="category"]{_id,title,"slug":slug.current}',
    )) as { _id: string; title: string; slug: string }[]

    if (cats.length === 0) {
      fail(
        'Frontmatter lists categories but no category documents exist in Sanity.',
        'Create them in Studio first, or remove `categories` from the frontmatter.',
      )
    }

    categoryRefs = wantedCats.map((want) => {
      const found = cats.find((c) => c.slug === want || c.title === want)
      if (!found) {
        fail(
          `Category "${want}" does not exist in Sanity.`,
          `Available: ${cats.map((c) => `${c.title} (${c.slug})`).join(', ')}`,
        )
      }
      return { _type: 'reference' as const, _ref: found._id, _key: randomKey(12) }
    })
  }

  // ── resolve the draft id (idempotency) ──
  // If a published post already owns this slug, attach the draft to it so
  // publishing updates that post. Otherwise use a deterministic slug-derived id
  // so re-running replaces our own draft instead of stacking duplicates.
  const publishedId = (await client.fetch(
    '*[_type=="post" && slug.current==$slug && !(_id in path("drafts.**"))][0]._id',
    { slug },
  )) as string | null

  const draftId = publishedId ? `drafts.${publishedId}` : `drafts.post-${slug}`
  const existingDraft = (await client.fetch('*[_id==$id][0]._id', { id: draftId })) as string | null

  const doc = {
    _id: draftId,
    _type: 'post',
    title,
    slug: { _type: 'slug', current: slug },
    author: { _type: 'reference', _ref: author._id },
    publishedAt,
    ...(excerpt ? { excerpt } : {}),
    ...(fm.seoTitle ? { seoTitle: String(fm.seoTitle).trim() } : {}),
    ...(fm.seoDescription ? { seoDescription: String(fm.seoDescription).trim() } : {}),
    ...(categoryRefs.length ? { categories: categoryRefs } : {}),
    body,
  }

  // ── report ──
  const blockCount = body.filter((b) => (b as { _type?: string })._type === 'block').length
  console.log('')
  console.log(`  Title      ${title}`)
  console.log(`  Slug       ${slug}`)
  console.log(`  Author     ${author.name} (${author._id})`)
  console.log(`  Published  ${publishedAt}`)
  console.log(`  Excerpt    ${excerpt ? `${excerpt.length}/${EXCERPT_MAX} chars` : '— none —'}`)
  console.log(`  Categories ${categoryRefs.length || '— none —'}`)
  console.log(`  Body       ${blockCount} blocks, ${faqs.length} FAQ`)
  console.log(`  Draft id   ${draftId}`)
  console.log(
    `  Mode       ${existingDraft ? 'UPDATE existing draft' : 'CREATE new draft'}` +
      (publishedId ? ' (attached to the published post)' : ''),
  )

  if (warnings.length) {
    console.log('')
    for (const w of warnings) console.log(`  ! ${w}`)
  }

  if (showJson) {
    console.log('')
    console.log(JSON.stringify(doc, null, 2))
  }

  if (dryRun) {
    console.log('')
    console.log('  Dry run — nothing written.')
    return
  }

  await client.createOrReplace(doc)

  console.log('')
  console.log(`  Draft saved. Review at /studio/structure/post;${draftId}`)
  console.log('  It stays invisible on the live site until you press Publish in Studio.')
  console.log('')
}

main().catch((err: unknown) => {
  if (err instanceof DraftError) {
    console.error(`\n  ✗ ${err.message}\n`)
  } else {
    console.error(`\n  ✗ Unexpected failure: ${err instanceof Error ? err.message : String(err)}\n`)
  }
  process.exit(1)
})
