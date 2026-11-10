/**
 * Internal links in a blog draft must resolve before the draft reaches Sanity.
 *
 * A post that links to a page that does not exist is a defect a reader finds
 * and a crawler records. It happened once (a draft linked to a parked post), in
 * a piece whose whole argument is that the evidence under a claim should hold
 * up when checked. So the drafting script refuses, rather than warns.
 *
 * Rules:
 *  - /blog/<slug> must be a PUBLISHED post in the dataset. A draft does not
 *    count: the draft is invisible on the live site, so the link would 404.
 *  - any other internal path must answer on the live site (HTTP below 400,
 *    redirects followed).
 *  - site links are written as /path or on our own hosts; a relative path with
 *    no leading slash is refused as ambiguous.
 * External links are out of scope here. Pure: the lookups are injected.
 */

const OWN_HOSTS = new Set(['bylineseo.com', 'www.bylineseo.com', 'app.bylineseo.com'])
export const LIVE_ORIGIN = 'https://app.bylineseo.com'

export interface InternalLink {
  raw: string
  /** Path with no query, hash or trailing slash; '/' for the root. */
  path: string
}

export interface LinkProblem {
  raw: string
  reason: string
}

/** Every markdown link target and bare URL in the text, as written. */
export function extractLinkTargets(markdown: string): string[] {
  const targets = new Set<string>()
  for (const m of markdown.matchAll(/\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) targets.add(m[1])
  for (const m of markdown.matchAll(/(?<![\](<"'])\bhttps?:\/\/[^\s)<>"']+/g)) targets.add(m[0].replace(/[.,;:!?]+$/, ''))
  return [...targets]
}

/** Split targets into our own pages, and the problems that can be seen without a lookup. */
export function internalLinks(markdown: string): { links: InternalLink[]; problems: LinkProblem[] } {
  const links: InternalLink[] = []
  const problems: LinkProblem[] = []
  for (const raw of extractLinkTargets(markdown)) {
    if (/^(mailto:|tel:|#)/i.test(raw)) continue
    let path: string | null = null
    if (/^https?:\/\//i.test(raw)) {
      let u: URL
      try {
        u = new URL(raw)
      } catch {
        problems.push({ raw, reason: 'Not a valid URL.' })
        continue
      }
      if (!OWN_HOSTS.has(u.hostname.toLowerCase())) continue // external
      path = u.pathname
    } else if (raw.startsWith('/')) {
      path = raw.split(/[?#]/)[0]
    } else {
      problems.push({ raw, reason: 'A relative link with no leading slash. Write site links as /path.' })
      continue
    }
    links.push({ raw, path: path.replace(/\/+$/, '') || '/' })
  }
  return { links, problems }
}

export interface LinkLookups {
  /** Slugs (from the given list) that exist as published posts. */
  publishedSlugs: (slugs: string[]) => Promise<Set<string>>
  /** HTTP status of a live site path, or null if it could not be reached. */
  liveStatus: (path: string) => Promise<number | null>
}

export async function checkInternalLinks(markdown: string, lookups: LinkLookups): Promise<{ checked: number; problems: LinkProblem[] }> {
  const { links, problems } = internalLinks(markdown)

  const blogSlugs = new Map<string, string>()
  const otherPaths: InternalLink[] = []
  for (const l of links) {
    const m = /^\/blog\/([^/]+)$/.exec(l.path)
    if (m) blogSlugs.set(l.raw, m[1])
    else if (l.path === '/blog' || l.path.startsWith('/blog/')) problems.push({ raw: l.raw, reason: 'Not a post URL. Blog posts live at /blog/<slug>.' })
    else otherPaths.push(l)
  }

  if (blogSlugs.size) {
    const published = await lookups.publishedSlugs([...new Set(blogSlugs.values())])
    for (const [raw, slug] of blogSlugs) {
      if (!published.has(slug)) problems.push({ raw, reason: `No published post has the slug "${slug}". A draft, a parked post or a typo all 404 on the live site.` })
    }
  }

  const seen = new Map<string, number | null>()
  for (const l of otherPaths) {
    if (!seen.has(l.path)) seen.set(l.path, await lookups.liveStatus(l.path))
    const status = seen.get(l.path)
    if (status === null || status === undefined) problems.push({ raw: l.raw, reason: `Could not reach ${LIVE_ORIGIN}${l.path} to check it. Fix the connection and re-run.` })
    else if (status >= 400) problems.push({ raw: l.raw, reason: `${LIVE_ORIGIN}${l.path} answers HTTP ${status}.` })
  }

  return { checked: links.length, problems }
}
