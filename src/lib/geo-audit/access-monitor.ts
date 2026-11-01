/**
 * Access alerts: what changed in crawler access between two checks of the same
 * page, and which of those changes are worth telling someone about the same day.
 *
 * Pure. The daily job builds an AccessState from a crawler probe (and, on a full
 * audit run, from the report), compares it with the last confirmed state, and
 * only alerts on a change a second check agrees with (`confirmChanges`).
 *
 * What is never an alert, by construction:
 *   - training crawlers (an editorial choice, not a defect)
 *   - rows the probe could not attribute to the user-agent, or got different
 *     answers for depending on request shape (the baseline failed, or unconfirmed)
 *   - rate limiting, network errors, timeouts and server errors on one crawler
 *   - an outage for everyone (the baseline fails): that is uptime, not access
 *   - scores, bands and page text: those are the monthly report, not an alarm
 *
 * Wording is about what the origin served to a request presenting that
 * user-agent, from our network. We probe with each vendor's published
 * user-agent, not from the vendor's addresses, so an alert never claims that an
 * AI system can or cannot read the page.
 */
import type { BlockKind, CrawlerAccessReport } from './crawler-access'
import type { AccessReport } from './access'

/** Refusals that are a policy on their side, so a change in them is news. */
const REFUSALS: ReadonlySet<BlockKind> = new Set(['edge-block', 'origin-block', 'bot-management'])

export interface CrawlerObservation {
  token: string
  label: string
  /** The exact user-agent sent, for the reproduce line. */
  userAgent: string
  served: boolean
  blockKind: BlockKind
  status: number | null
  robots: 'allowed' | 'disallowed' | 'unknown'
  evidence: string
  edgeVendor: string | null
}

export interface AccessState {
  checkedAt: string
  url: string
  baseline: { status: number | null; served: boolean }
  robots: { state: 'present' | 'missing' | 'unknown'; status: number | null }
  /** AI search crawlers only, and only rows attributable to the user-agent. */
  crawlers: CrawlerObservation[]
  /** Only known on a full audit run, which reads the page itself. */
  noindex?: boolean
}

export type AccessChangeKind =
  | 'crawler-refused'
  | 'crawler-restored'
  | 'robots-disallowed'
  | 'robots-allowed'
  | 'robots-unreadable'
  | 'page-gone'
  | 'noindex-added'
  | 'noindex-removed'

export interface AccessChange {
  /** Stable across checks, so a second check can confirm the first. */
  key: string
  kind: AccessChangeKind
  /** True for a fix or a recovery, so the email can lead with good news. */
  good: boolean
  token?: string
  headline: string
  detail: string
  /** A command the owner can run to see it for themselves, when there is one. */
  reproduce?: string
}

export function accessState(
  probe: CrawlerAccessReport,
  robots: { state: 'present' | 'missing' | 'unknown'; status: number | null },
  extra: { noindex?: boolean } = {},
): AccessState {
  return {
    checkedAt: probe.checkedAt,
    url: probe.url,
    baseline: { status: probe.baseline.status, served: !probe.baselineFailed && probe.baseline.contentServed },
    robots,
    crawlers: probe.probes
      .filter((p) => p.class === 'ai-search' && p.attributable && p.confirmed !== false)
      .map((p) => ({
        token: p.token,
        label: p.label,
        userAgent: p.userAgent,
        served: p.contentServed,
        blockKind: p.blockKind,
        status: p.status,
        robots: p.robotsVerdict,
        evidence: p.evidence,
        edgeVendor: p.edgeVendor,
      })),
    ...(extra.noindex === undefined ? {} : { noindex: extra.noindex }),
  }
}

/** The same state from a full audit report, when it carried the probe. */
export function accessStateFromReport(report: { crawlerProbe?: CrawlerAccessReport; access: AccessReport }): AccessState | null {
  if (!report.crawlerProbe) return null
  return accessState(
    report.crawlerProbe,
    { state: report.access.robots.state, status: report.access.robots.status },
    { noindex: report.access.directives.noindex },
  )
}

const curl = (ua: string, url: string) => `curl -s -o /dev/null -w "%{http_code}\\n" -A "${ua}" "${url}"`

export function accessChanges(prev: AccessState, curr: AccessState): AccessChange[] {
  const out: AccessChange[] = []

  // The page itself went away for everyone: worth saying, and it explains every
  // crawler row, so nothing else is reported on this check.
  const ok = (s: number | null) => s !== null && s >= 200 && s < 300
  if (ok(prev.baseline.status) && (curr.baseline.status === 404 || curr.baseline.status === 410)) {
    return [{
      key: `page-gone:${curr.baseline.status}`,
      kind: 'page-gone',
      good: false,
      headline: `The page now returns HTTP ${curr.baseline.status} to an ordinary browser request.`,
      detail: `It returned HTTP ${prev.baseline.status} on the previous check. Every crawler gets the same, so no crawler-specific finding applies until it is back.`,
      reproduce: `curl -s -o /dev/null -w "%{http_code}\\n" "${curr.url}"`,
    }]
  }
  // Down for everyone, or our own request refused: nothing here is about crawlers.
  if (!prev.baseline.served || !curr.baseline.served) return out

  const before = new Map(prev.crawlers.map((c) => [c.token, c]))
  for (const c of curr.crawlers) {
    const p = before.get(c.token)
    if (!p) continue
    if (p.served && !c.served && REFUSALS.has(c.blockKind)) {
      out.push({
        key: `crawler-refused:${c.token}:${c.blockKind}`,
        kind: 'crawler-refused',
        good: false,
        token: c.token,
        headline: `Your server now refuses requests that identify as ${c.label} (${c.token}).`,
        detail: `On the previous check it served the page to the same request. Now: HTTP ${c.status ?? 'no response'}, ${describeKind(c.blockKind)}${c.edgeVendor ? ` (${c.edgeVendor})` : ''}. An ordinary browser request was still served, so the difference is the user-agent. ${c.robots === 'allowed' ? 'robots.txt still allows this crawler, so the refusal is happening at the server, not in robots.txt. ' : ''}Evidence: ${plain(c.evidence)}`,
        reproduce: curl(c.userAgent, curr.url),
      })
    } else if (!p.served && REFUSALS.has(p.blockKind) && c.served) {
      out.push({
        key: `crawler-restored:${c.token}`,
        kind: 'crawler-restored',
        good: true,
        token: c.token,
        headline: `Your server now serves the page to requests that identify as ${c.label} (${c.token}).`,
        detail: `On the previous check it refused them (HTTP ${p.status ?? 'no response'}, ${describeKind(p.blockKind)}). Now it returns HTTP ${c.status}.`,
        reproduce: curl(c.userAgent, curr.url),
      })
    }

    // robots.txt only compares when it was readable both times.
    if (prev.robots.state !== 'unknown' && curr.robots.state !== 'unknown') {
      if (p.robots === 'allowed' && c.robots === 'disallowed') {
        out.push({
          key: `robots-disallowed:${c.token}`,
          kind: 'robots-disallowed',
          good: false,
          token: c.token,
          headline: `robots.txt now disallows ${c.label} (${c.token}) for this page.`,
          detail: 'It allowed it on the previous check. A compliant crawler will stop fetching the page. If that was not a deliberate choice, check recent edits to robots.txt or a CMS or CDN setting that writes it.',
          reproduce: `curl -s "${new URL('/robots.txt', curr.url).toString()}"`,
        })
      } else if (p.robots === 'disallowed' && c.robots === 'allowed') {
        out.push({
          key: `robots-allowed:${c.token}`,
          kind: 'robots-allowed',
          good: true,
          token: c.token,
          headline: `robots.txt now allows ${c.label} (${c.token}) for this page.`,
          detail: 'It disallowed it on the previous check.',
          reproduce: `curl -s "${new URL('/robots.txt', curr.url).toString()}"`,
        })
      }
    }
  }

  // robots.txt that starts failing with a server error reads, to a compliant
  // crawler, as "do not crawl anything" (RFC 9309). A timeout does not count.
  if (prev.robots.state !== 'unknown' && curr.robots.state === 'unknown' && (curr.robots.status ?? 0) >= 500) {
    out.push({
      key: 'robots-unreadable',
      kind: 'robots-unreadable',
      good: false,
      headline: `robots.txt now returns HTTP ${curr.robots.status}.`,
      detail: 'Under the robots.txt standard, a crawler that gets a server error for robots.txt treats the whole site as disallowed until it can read the file again.',
      reproduce: `curl -s -o /dev/null -w "%{http_code}\\n" "${new URL('/robots.txt', curr.url).toString()}"`,
    })
  }

  if (prev.noindex === false && curr.noindex === true) {
    out.push({ key: 'noindex-added', kind: 'noindex-added', good: false, headline: 'The page now carries a noindex directive.', detail: 'It did not on the previous check. noindex asks every engine to leave the page out of its results. Check the robots meta tag and the X-Robots-Tag header.' })
  } else if (prev.noindex === true && curr.noindex === false) {
    out.push({ key: 'noindex-removed', kind: 'noindex-removed', good: true, headline: 'The page no longer carries a noindex directive.', detail: 'It did on the previous check.' })
  }
  return out
}

/**
 * Only changes the second check agrees with. One odd response is noise; the
 * same change seen twice, hours apart, is a change on their side.
 */
export function confirmChanges(first: AccessChange[], second: AccessChange[]): AccessChange[] {
  const seen = new Set(first.map((c) => c.key))
  return second.filter((c) => seen.has(c.key))
}

/** Engine evidence strings can carry dashes; alert copy does not. */
function plain(s: string): string {
  return s.replace(/\s*[—–]\s*/g, ', ')
}

function describeKind(k: BlockKind): string {
  switch (k) {
    case 'edge-block': return 'refused at the edge, before the site'
    case 'origin-block': return 'refused by the site itself'
    case 'bot-management': return 'shown a challenge page instead of the content'
    default: return k
  }
}
