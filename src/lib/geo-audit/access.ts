/**
 * Access: can an AI crawler reach and index this page at all?
 *
 * This is the most deterministic part of the audit — every check has a right
 * answer that the user can verify against their own files in under a minute.
 *
 * Scoring rule that matters: only `ai-search` crawlers contribute points.
 * Training crawlers and user-triggered fetchers are reported with their status
 * and never scored, because blocking a training crawler is a publisher's
 * editorial choice and not a defect. `unknown` (timeout, 5xx, network error) is
 * excluded from scoring entirely rather than being treated as a block.
 */

import {
  CRAWLERS,
  LLMS_TXT_COPY,
  isAllowed,
  type AccessVerdict,
  type CrawlerClass,
  type CrawlerSpec,
  type LlmsTxtResult,
  type RobotsFetchResult,
  type RobotsRule,
} from './robots'

export interface CrawlerStatus {
  token: string
  label: string
  vendor: string
  class: CrawlerClass
  scored: boolean
  docs: string
  note: string
  verdict: AccessVerdict
  /** The robots.txt rule that decided it, so the finding can quote the file. */
  matchedRule: RobotsRule | null
  reason: string
}

export interface MetaDirectives {
  /** Content of `<meta name="robots">`, if present. */
  metaRobots: string | null
  /** Value of the `X-Robots-Tag` response header, if present. */
  xRobotsTag: string | null
  noindex: boolean
  nofollow: boolean
  /** Where the noindex came from, for the finding. */
  noindexSource: 'meta' | 'header' | null
}

export interface AccessReport {
  /** Per-crawler verdicts, all three classes. */
  crawlers: CrawlerStatus[]
  robots: {
    url: string
    state: RobotsFetchResult['state']
    status: number | null
    /** Verbatim file text for the evidence pane. */
    text: string
    sitemaps: string[]
    note?: string
  }
  llmsTxt: LlmsTxtResult & { copy: string }
  directives: MetaDirectives
  httpStatus: number | null
  finalUrl: string
  /** True when the page redirected somewhere else. */
  redirected: boolean
  canonical: string | null
  /** Canonical points at a different URL than the one analysed. */
  canonicalMismatch: boolean
  /**
   * Content appears only after JavaScript runs. Reported as a finding — AI
   * crawlers generally do not execute JS, so this content is invisible to them.
   */
  jsOnlyContent: boolean
}

export interface AccessInput {
  robots: RobotsFetchResult
  llmsTxt: LlmsTxtResult
  requestedUrl: string
  finalUrl: string
  httpStatus: number | null
  headers: Record<string, string>
  metaRobots: string | null
  canonical: string | null
  jsOnlySuspected: boolean
}

export function assessAccess(input: AccessInput): AccessReport {
  const path = pathOf(input.finalUrl)

  const crawlers: CrawlerStatus[] = CRAWLERS.map((spec) => buildStatus(spec, input.robots, path))

  const directives = readDirectives(input.headers, input.metaRobots)

  return {
    crawlers,
    robots: {
      url: input.robots.url,
      state: input.robots.state,
      status: input.robots.status,
      text: input.robots.text,
      sitemaps: input.robots.parsed?.sitemaps ?? [],
      note: input.robots.note,
    },
    llmsTxt: { ...input.llmsTxt, copy: LLMS_TXT_COPY },
    directives,
    httpStatus: input.httpStatus,
    finalUrl: input.finalUrl,
    redirected: stripTrailing(input.requestedUrl) !== stripTrailing(input.finalUrl),
    canonical: input.canonical,
    canonicalMismatch: Boolean(
      input.canonical && stripTrailing(input.canonical) !== stripTrailing(input.finalUrl),
    ),
    jsOnlyContent: input.jsOnlySuspected,
  }
}

function buildStatus(spec: CrawlerSpec, robots: RobotsFetchResult, path: string): CrawlerStatus {
  const base = {
    token: spec.token,
    label: spec.label,
    vendor: spec.vendor,
    class: spec.class,
    scored: spec.scored,
    docs: spec.docs,
    note: spec.note,
    matchedRule: null as RobotsRule | null,
  }

  if (robots.state === 'unknown' || !robots.parsed) {
    return {
      ...base,
      verdict: 'unknown',
      reason: robots.note ?? 'robots.txt could not be read, so this crawler’s access is unknown.',
    }
  }

  if (robots.state === 'missing') {
    return {
      ...base,
      verdict: 'allowed',
      reason: 'No robots.txt is published, so this crawler is permitted by default.',
    }
  }

  const decision = isAllowed(robots.parsed, spec.token, path)
  return { ...base, verdict: decision.verdict, matchedRule: decision.matchedRule, reason: decision.reason }
}

function readDirectives(headers: Record<string, string>, metaRobots: string | null): MetaDirectives {
  const xRobotsTag = headers['x-robots-tag'] ?? null
  const combined = `${metaRobots ?? ''} ${xRobotsTag ?? ''}`.toLowerCase()

  const noindex = /\bnoindex\b/.test(combined)
  const nofollow = /\bnofollow\b/.test(combined)

  let noindexSource: MetaDirectives['noindexSource'] = null
  if (noindex) {
    noindexSource = /\bnoindex\b/.test((metaRobots ?? '').toLowerCase()) ? 'meta' : 'header'
  }

  return { metaRobots, xRobotsTag, noindex, nofollow, noindexSource }
}

function pathOf(url: string): string {
  try {
    const u = new URL(url)
    return `${u.pathname}${u.search}`
  } catch {
    return '/'
  }
}

function stripTrailing(url: string): string {
  return (url ?? '').trim().replace(/\/+$/, '').toLowerCase()
}

// ── Summary helpers used by the scorer and the report ─────────────────────────

export interface AccessSummary {
  /** AI search crawlers only — the scored population. */
  searchAllowed: CrawlerStatus[]
  searchBlocked: CrawlerStatus[]
  searchUnknown: CrawlerStatus[]
  /** Reported but never scored. */
  training: CrawlerStatus[]
  userTriggered: CrawlerStatus[]
}

export function summariseAccess(report: AccessReport): AccessSummary {
  const search = report.crawlers.filter((c) => c.class === 'ai-search')
  return {
    searchAllowed: search.filter((c) => c.verdict === 'allowed'),
    searchBlocked: search.filter((c) => c.verdict === 'disallowed'),
    searchUnknown: search.filter((c) => c.verdict === 'unknown'),
    training: report.crawlers.filter((c) => c.class === 'training'),
    userTriggered: report.crawlers.filter((c) => c.class === 'user-triggered'),
  }
}
