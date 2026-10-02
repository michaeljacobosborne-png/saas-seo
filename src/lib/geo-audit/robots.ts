/**
 * robots.txt parsing and the AI crawler taxonomy.
 *
 * Two things this module exists to get right, both of which most tools get wrong:
 *
 * 1. **Matching semantics.** Rules are grouped by user-agent, the most specific
 *    matching group wins, and within a group the longest matching path pattern
 *    wins with Allow breaking ties. Implemented to RFC 9309 / Google's published
 *    spec, because a wrong verdict here is a false accusation about someone's site.
 *
 * 2. **The three-class taxonomy.** AI *search* crawlers, *training* crawlers and
 *    *user-triggered* fetchers are different things. Blocking a training crawler
 *    is a legitimate editorial choice that does not remove a site from ChatGPT
 *    search. Tools that conflate them produce false failures and push publishers
 *    into decisions against their own interest, so training crawlers and
 *    user-triggered fetchers are REPORTED here and never scored.
 *
 * Unknown (timeout, 401, 429, network error) is its own state. It is never
 * silently treated as "allowed" or as "blocked".
 */

import { MAX_ROBOTS_BYTES } from './limits'

// ── Taxonomy ──────────────────────────────────────────────────────────────────

export type CrawlerClass = 'ai-search' | 'training' | 'user-triggered'

export interface CrawlerSpec {
  /** The exact product token as published by the provider. */
  token: string
  label: string
  vendor: string
  class: CrawlerClass
  /** First-party provider documentation for this token. */
  docs: string
  /** Only `ai-search` crawlers contribute to a score. */
  scored: boolean
  /** Shown next to the row so the user understands what blocking it means. */
  note: string
}

export const CRAWLERS: readonly CrawlerSpec[] = [
  // AI search / retrieval crawlers — these are the ones that affect whether a
  // page can be surfaced in an AI answer, so these are the only scored rows.
  {
    token: 'OAI-SearchBot',
    label: 'OAI-SearchBot',
    vendor: 'OpenAI',
    class: 'ai-search',
    docs: 'https://platform.openai.com/docs/bots',
    scored: true,
    note: 'Retrieval crawler for ChatGPT search. Blocking it can remove the page from ChatGPT search results.',
  },
  {
    token: 'Claude-SearchBot',
    label: 'Claude-SearchBot',
    vendor: 'Anthropic',
    class: 'ai-search',
    docs: 'https://support.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler',
    scored: true,
    note: 'Retrieval crawler for Claude search results.',
  },
  {
    token: 'PerplexityBot',
    label: 'PerplexityBot',
    vendor: 'Perplexity',
    class: 'ai-search',
    docs: 'https://docs.perplexity.ai/guides/bots',
    scored: true,
    note: 'Indexing crawler for Perplexity search.',
  },
  {
    token: 'Google-Extended',
    label: 'Google-Extended',
    vendor: 'Google',
    class: 'ai-search',
    docs: 'https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers',
    scored: true,
    note: 'Controls use of already-crawled content in Gemini and AI surfaces. It is not a separate crawler and does not affect Google Search ranking.',
  },

  // Training crawlers — reported, never scored.
  {
    token: 'GPTBot',
    label: 'GPTBot',
    vendor: 'OpenAI',
    class: 'training',
    docs: 'https://platform.openai.com/docs/bots',
    scored: false,
    note: 'Training crawler. Blocking it does not remove the page from ChatGPT search — that is OAI-SearchBot.',
  },
  {
    token: 'ClaudeBot',
    label: 'ClaudeBot',
    vendor: 'Anthropic',
    class: 'training',
    docs: 'https://support.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler',
    scored: false,
    note: 'Training crawler. Allowing or blocking training is a publisher choice, not a defect.',
  },
  {
    token: 'CCBot',
    label: 'CCBot',
    vendor: 'Common Crawl',
    class: 'training',
    docs: 'https://commoncrawl.org/ccbot',
    scored: false,
    note: 'Open crawl corpus used as training data by many parties.',
  },
  {
    token: 'Bytespider',
    label: 'Bytespider',
    vendor: 'ByteDance',
    class: 'training',
    docs: 'https://support.bytedance.com/en/docs/bytespider',
    scored: false,
    note: 'Training crawler for ByteDance models. Blocking it is a publisher choice and does not affect any AI search surface.',
  },
  {
    token: 'Applebot-Extended',
    label: 'Applebot-Extended',
    vendor: 'Apple',
    class: 'training',
    docs: 'https://support.apple.com/en-us/119829',
    scored: false,
    note: 'Controls use of crawled content for Apple generative models. Does not affect Siri or Spotlight search.',
  },

  // User-triggered fetchers — reported, never scored. These fetch a page because
  // a human asked for it in a chat, and providers differ on whether robots.txt
  // even applies to them.
  {
    token: 'ChatGPT-User',
    label: 'ChatGPT-User',
    vendor: 'OpenAI',
    class: 'user-triggered',
    docs: 'https://platform.openai.com/docs/bots',
    scored: false,
    note: 'Fetches a page when a user asks ChatGPT to visit it. OpenAI states this is not used for training.',
  },
  {
    token: 'Claude-User',
    label: 'Claude-User',
    vendor: 'Anthropic',
    class: 'user-triggered',
    docs: 'https://support.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler',
    scored: false,
    note: 'Fetches a page on behalf of a user request in Claude.',
  },
  {
    token: 'Perplexity-User',
    label: 'Perplexity-User',
    vendor: 'Perplexity',
    class: 'user-triggered',
    docs: 'https://docs.perplexity.ai/guides/bots',
    scored: false,
    note: 'Fetches a page on behalf of a user request. Perplexity states user-triggered fetches may not follow robots.txt.',
  },
] as const

export const SCORED_CRAWLERS = CRAWLERS.filter((c) => c.scored)

// ── Parsing ───────────────────────────────────────────────────────────────────

export interface RobotsRule {
  type: 'allow' | 'disallow'
  /** The path pattern exactly as written in the file. */
  pattern: string
  /** 1-based line number, so a finding can point at the file. */
  line: number
}

export interface RobotsGroup {
  /** Lower-cased user-agent tokens this group applies to. */
  agents: string[]
  rules: RobotsRule[]
  /** 1-based line of the first User-agent line in the group. */
  line: number
}

export interface ParsedRobots {
  groups: RobotsGroup[]
  sitemaps: string[]
  /** Lines we could not interpret, kept so the evidence pane can show them. */
  unparsed: { line: number; text: string }[]
}

export function parseRobotsTxt(text: string): ParsedRobots {
  const groups: RobotsGroup[] = []
  const sitemaps: string[] = []
  const unparsed: { line: number; text: string }[] = []

  let current: RobotsGroup | null = null
  // Consecutive User-agent lines share one rule set; a rule line closes the run.
  let acceptingAgents = false

  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1
    const withoutComment = lines[i].replace(/#.*$/, '')
    const raw = withoutComment.trim()
    if (!raw) continue

    const sep = raw.indexOf(':')
    if (sep === -1) {
      unparsed.push({ line: lineNo, text: lines[i].trim() })
      continue
    }

    const field = raw.slice(0, sep).trim().toLowerCase()
    const value = raw.slice(sep + 1).trim()

    if (field === 'user-agent') {
      if (!acceptingAgents || !current) {
        current = { agents: [], rules: [], line: lineNo }
        groups.push(current)
        acceptingAgents = true
      }
      if (value) current.agents.push(value.toLowerCase())
      continue
    }

    if (field === 'sitemap') {
      if (value) sitemaps.push(value)
      continue
    }

    if (field === 'allow' || field === 'disallow') {
      acceptingAgents = false
      if (!current) {
        // Rules before any User-agent line are not addressed to anyone.
        unparsed.push({ line: lineNo, text: lines[i].trim() })
        continue
      }
      current.rules.push({ type: field, pattern: value, line: lineNo })
      continue
    }

    // crawl-delay, host, and anything else: valid but not used here.
    if (field !== 'crawl-delay' && field !== 'host') {
      unparsed.push({ line: lineNo, text: lines[i].trim() })
    }
  }

  return { groups, sitemaps, unparsed }
}

/**
 * Pick the group that applies to a user-agent: the longest matching token wins,
 * falling back to the `*` group. Matching is case-insensitive substring matching
 * on the product token, per the spec.
 */
export function groupForAgent(parsed: ParsedRobots, userAgent: string): RobotsGroup | null {
  const ua = userAgent.toLowerCase()
  let best: RobotsGroup | null = null
  let bestLength = -1

  for (const group of parsed.groups) {
    for (const agent of group.agents) {
      if (agent === '*') continue
      if (ua.includes(agent) && agent.length > bestLength) {
        best = group
        bestLength = agent.length
      }
    }
  }
  if (best) return best

  return parsed.groups.find((g) => g.agents.includes('*')) ?? null
}

/** Convert a robots path pattern (`*` wildcard, `$` end-anchor) to a regex. */
function patternToRegex(pattern: string): RegExp {
  let source = ''
  let anchored = false
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i]
    if (ch === '*') {
      source += '.*'
    } else if (ch === '$' && i === pattern.length - 1) {
      anchored = true
    } else {
      source += ch.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    }
  }
  return new RegExp(`^${source}${anchored ? '$' : ''}`)
}

export type AccessVerdict = 'allowed' | 'disallowed' | 'unknown'

export interface RobotsDecision {
  verdict: AccessVerdict
  /** The rule that decided it, so the report can quote the file. */
  matchedRule: RobotsRule | null
  /** Which user-agent group applied, for the evidence pane. */
  matchedGroup: string[] | null
  /** Human explanation, always populated. */
  reason: string
}

/**
 * Decide whether a path is crawlable for a given user-agent.
 *
 * Longest matching pattern wins; Allow beats Disallow on equal length. An empty
 * Disallow value means "allow everything" and is treated as no rule.
 */
export function isAllowed(parsed: ParsedRobots, userAgent: string, path: string): RobotsDecision {
  const group = groupForAgent(parsed, userAgent)
  if (!group) {
    return {
      verdict: 'allowed',
      matchedRule: null,
      matchedGroup: null,
      reason: 'No robots.txt group applies to this crawler, so everything is permitted by default.',
    }
  }

  let best: RobotsRule | null = null
  let bestLength = -1

  for (const rule of group.rules) {
    // "Disallow:" with an empty value explicitly allows everything.
    if (rule.pattern === '') continue
    if (!patternToRegex(rule.pattern).test(path)) continue

    const len = rule.pattern.length
    if (len > bestLength || (len === bestLength && rule.type === 'allow')) {
      best = rule
      bestLength = len
    }
  }

  if (!best) {
    return {
      verdict: 'allowed',
      matchedRule: null,
      matchedGroup: group.agents,
      reason: `No rule in the "${group.agents.join(', ')}" group matches ${path}.`,
    }
  }

  return {
    verdict: best.type === 'allow' ? 'allowed' : 'disallowed',
    matchedRule: best,
    matchedGroup: group.agents,
    reason:
      best.type === 'allow'
        ? `Line ${best.line} allows ${path} for the "${group.agents.join(', ')}" group.`
        : `Line ${best.line} disallows ${path} for the "${group.agents.join(', ')}" group.`,
  }
}

// ── Fetching ──────────────────────────────────────────────────────────────────

export interface RobotsFetchResult {
  url: string
  status: number | null
  /** Raw file text, retained verbatim for the evidence pane. */
  text: string
  parsed: ParsedRobots | null
  /**
   * `missing` (404 — everything permitted), `present`, or `unknown` when we
   * could not determine it. `unknown` is never scored as either outcome.
   */
  state: 'present' | 'missing' | 'unknown'
  note?: string
}

export async function fetchRobotsTxt(
  pageUrl: string,
  opts: { fetchImpl?: typeof fetch; timeoutMs?: number; userAgent?: string } = {},
): Promise<RobotsFetchResult> {
  const { fetchImpl = fetch, timeoutMs = 8_000, userAgent } = opts

  let robotsUrl: string
  try {
    robotsUrl = new URL('/robots.txt', pageUrl).toString()
  } catch {
    return { url: '', status: null, text: '', parsed: null, state: 'unknown', note: 'Could not derive a robots.txt URL.' }
  }

  try {
    const res = await fetchImpl(robotsUrl, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: userAgent ? { 'User-Agent': userAgent } : undefined,
      redirect: 'follow',
    })

    if (res.status === 404 || res.status === 410) {
      return {
        url: robotsUrl,
        status: res.status,
        text: '',
        parsed: { groups: [], sitemaps: [], unparsed: [] },
        state: 'missing',
        note: 'No robots.txt is published, so all crawlers are permitted by default.',
      }
    }

    if (!res.ok) {
      return {
        url: robotsUrl,
        status: res.status,
        text: '',
        parsed: null,
        state: 'unknown',
        // A 5xx on robots.txt means crawlers may treat the whole site as
        // disallowed, so this is worth surfacing rather than shrugging off.
        note:
          res.status >= 500
            ? `robots.txt returned HTTP ${res.status}. Major crawlers treat a persistent 5xx on robots.txt as "disallow everything", so this is worth fixing.`
            : `robots.txt returned HTTP ${res.status}, so crawler rules could not be read.`,
      }
    }

    const full = await res.text()
    const text = full.length > MAX_ROBOTS_BYTES ? full.slice(0, MAX_ROBOTS_BYTES) : full

    return {
      url: robotsUrl,
      status: res.status,
      text,
      parsed: parseRobotsTxt(text),
      state: 'present',
      note:
        full.length > MAX_ROBOTS_BYTES
          ? `robots.txt is ${full.length} bytes; only the first ${MAX_ROBOTS_BYTES} were parsed.`
          : undefined,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      url: robotsUrl,
      status: null,
      text: '',
      parsed: null,
      state: 'unknown',
      note: /timeout|abort/i.test(message)
        ? 'robots.txt did not respond in time, so crawler rules are unknown.'
        : `robots.txt could not be fetched (${message}), so crawler rules are unknown.`,
    }
  }
}

// ── llms.txt ──────────────────────────────────────────────────────────────────

export interface LlmsTxtResult {
  url: string
  present: boolean
  status: number | null
  bytes: number
}

/**
 * Reported, never scored.
 *
 * No major AI provider has committed to consuming llms.txt. Google Search
 * Central states publishers do not need to create AI text files, and scoring its
 * absence manufactures a deficiency. We report presence as a neutral fact.
 */
export const LLMS_TXT_COPY =
  'Present or absent. No major AI provider has committed to consuming llms.txt, so this does not affect your score.'

export async function fetchLlmsTxt(
  pageUrl: string,
  opts: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<LlmsTxtResult> {
  const { fetchImpl = fetch, timeoutMs = 6_000 } = opts

  let url: string
  try {
    url = new URL('/llms.txt', pageUrl).toString()
  } catch {
    return { url: '', present: false, status: null, bytes: 0 }
  }

  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), redirect: 'follow' })
    if (!res.ok) return { url, present: false, status: res.status, bytes: 0 }
    const text = await res.text()
    // Some hosts serve an HTML 404 page with a 200 status.
    const looksLikeHtml = /^\s*<(!doctype|html)/i.test(text)
    return { url, present: !looksLikeHtml && text.trim().length > 0, status: res.status, bytes: text.length }
  } catch {
    return { url, present: false, status: null, bytes: 0 }
  }
}
