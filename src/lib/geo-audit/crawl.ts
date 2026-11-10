/**
 * Follows the handful of internal links that sitewide claims depend on.
 *
 * The rule this exists to enforce: we never say a site "has no About page" or
 * "has no blog" because the homepage did not contain one inline. If the homepage
 * links to it, we follow the link and look. If we cannot follow it, the relevant
 * factor is reported unverified rather than absent.
 */

import { fetchPage, type FetchOptions } from './fetch'
import { extractPage, type ExtractedPage, type PageLink } from './extract'

export type KeyPageRole = 'about' | 'blog' | 'contact' | 'services' | 'caseStudies'

export interface KeyPageCandidate {
  role: KeyPageRole
  url: string
  /** The link text that identified it — used as evidence. */
  linkText: string
}

export interface KeyPageResult extends KeyPageCandidate {
  /** Populated when the page was fetched and parsed successfully. */
  page: ExtractedPage | null
  ok: boolean
  status: number | null
  note?: string
}

interface RolePattern {
  role: KeyPageRole
  path: RegExp
  text: RegExp
}

const ROLE_PATTERNS: RolePattern[] = [
  { role: 'about', path: /\/(about|about-us|who-we-are|our-story|team|meet-the-team)\/?$/i, text: /^(about|about us|our story|who we are|meet the team|team)$/i },
  { role: 'blog', path: /\/(blog|blogs|articles|insights|news|resources|journal)\/?$/i, text: /^(blog|blogs|articles|insights|news|resources)$/i },
  { role: 'contact', path: /\/(contact|contact-us|get-in-touch)\/?$/i, text: /^(contact|contact us|get in touch)$/i },
  { role: 'caseStudies', path: /\/(case-stud(y|ies)|work|portfolio|clients|results|success-stories)\/?$/i, text: /^(case stud(y|ies)|our work|portfolio|clients|results)$/i },
  { role: 'services', path: /\/(services|what-we-do|what-we-offer|solutions)\/?$/i, text: /^(services|what we do|what we offer|solutions)$/i },
]

/** Roles worth spending a request on — these carry real scoring signal. */
export const DEFAULT_ROLES: KeyPageRole[] = ['about', 'blog', 'caseStudies']

/**
 * Identify candidate pages from the homepage's own links. Returns at most one
 * candidate per role, preferring a path match over a link-text match.
 */
export function findKeyPages(links: PageLink[], roles: KeyPageRole[] = DEFAULT_ROLES): KeyPageCandidate[] {
  const found = new Map<KeyPageRole, KeyPageCandidate>()

  for (const pattern of ROLE_PATTERNS) {
    if (!roles.includes(pattern.role)) continue

    const byPath = links.find((l) => l.internal && l.absolute && pattern.path.test(pathOf(l.absolute)))
    const byText = links.find((l) => l.internal && l.absolute && pattern.text.test(l.text))
    const match = byPath ?? byText
    if (match) {
      found.set(pattern.role, {
        role: pattern.role,
        url: stripHash(match.absolute),
        linkText: match.text || pattern.role,
      })
    }
  }

  return [...found.values()]
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname
  } catch {
    return ''
  }
}

function stripHash(url: string): string {
  try {
    const u = new URL(url)
    u.hash = ''
    return u.toString()
  } catch {
    return url
  }
}

export interface CrawlOptions extends FetchOptions {
  /** Hard cap on extra requests, to stay inside the route's time budget. */
  maxPages?: number
}

/** Fetch and parse the candidate pages in parallel. Never throws. */
export async function crawlKeyPages(
  candidates: KeyPageCandidate[],
  opts: CrawlOptions = {},
): Promise<KeyPageResult[]> {
  const { maxPages = 3, timeoutMs = 8_000, ...rest } = opts
  const selected = candidates.slice(0, maxPages)

  return Promise.all(
    selected.map(async (candidate): Promise<KeyPageResult> => {
      try {
        const fetched = await fetchPage(candidate.url, { ...rest, timeoutMs })
        if (!fetched.ok) {
          return { ...candidate, page: null, ok: false, status: fetched.status, note: fetched.note }
        }
        const page = extractPage(fetched.html, fetched.finalUrl)
        return { ...candidate, page, ok: true, status: fetched.status }
      } catch (err) {
        return {
          ...candidate,
          page: null,
          ok: false,
          status: null,
          note: err instanceof Error ? err.message : String(err),
        }
      }
    }),
  )
}

/** Convenience accessor used by the scorers. */
export function pageForRole(results: KeyPageResult[], role: KeyPageRole): KeyPageResult | undefined {
  return results.find((r) => r.role === role)
}
