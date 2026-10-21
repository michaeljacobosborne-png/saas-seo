/**
 * Does the byline the brand profile claims actually render on the live page?
 *
 * Decision 17 (docs/DECISIONS.md): a profile claim is an intention, not
 * evidence. Evidence is what is on the page. At draft time named authorship is
 * scored from the brand profile; on a live page it must be verified, and a
 * profile that names an author while the page shows none is itself a finding.
 *
 * "Renders" means the name is in the page's text, or in a Person node in its
 * structured data. A name only in a meta tag or a script the crawler cannot see
 * does not count, because that is not what a reader or a quoting engine gets.
 */

import { truncate, type ExtractedPage } from './extract'
import type { BylineCheck, Evidence } from './types'

export type { BylineCheck }

function norm(s: string): string {
  return s.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()
}

export function verifyByline(page: ExtractedPage, expectedAuthor: string | null | undefined): BylineCheck | null {
  const expected = expectedAuthor?.trim()
  if (!expected) return null
  const needle = norm(expected)

  const person = page.structuredData.find(
    (n) => n.types.some((t) => /^Person$/i.test(t)) && typeof n.raw.name === 'string' && norm(n.raw.name as string) === needle,
  )

  const text = page.bodyText || page.mainText
  const at = norm(text).indexOf(needle)
  const evidence: Evidence[] = []
  if (person) evidence.push({ url: page.url, kind: 'jsonld', snippet: `Person: ${person.raw.name}` })
  if (at >= 0) {
    // Snippet around the match, from the normalised text so offsets line up.
    const flat = text.replace(/\s+/g, ' ')
    const i = norm(flat).indexOf(needle)
    evidence.push({ url: page.url, kind: 'text', snippet: truncate(flat.slice(Math.max(0, i - 60), i + needle.length + 60).trim(), 200) })
  }

  if (evidence.length) {
    return {
      expected,
      found: true,
      detail: `The byline the brand profile names (${expected}) appears on the published page${person ? ', including in its structured data' : ''}.`,
      evidence,
    }
  }
  return {
    expected,
    found: false,
    detail:
      `The brand profile names ${expected} as the author, but no byline for ${expected} appears on this page, in its text or its structured data. ` +
      'The profile states an intention; only what renders on the page is evidence, and here it does not.',
    evidence: [],
  }
}
