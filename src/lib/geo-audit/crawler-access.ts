/**
 * Live AI crawler access probe.
 *
 * robots.txt tells you what a site *says*. This tells you what the origin
 * *does*. The gap between the two is the finding: since Cloudflare changed its
 * default in July 2025 to block AI crawlers, a site can publish a permissive
 * robots.txt and still have every retrieval crawler turned away at the edge,
 * and the site owner has no way to know. The controls offered by bot-management
 * products do not reliably separate retrieval crawlers from training crawlers,
 * so "block AI bots" frequently removes a site from AI search as a side effect
 * nobody chose.
 *
 * Method: request the URL once per crawler, sending that crawler's published
 * User-Agent, plus one baseline request with an ordinary browser UA. The
 * baseline is what makes the result interpretable — without it, a 403 for
 * GPTBot is indistinguishable from a site that is simply down.
 *
 * What this measures, precisely: whether an origin serves this page to a
 * request presenting that user-agent, from our network, right now. That is
 * evidence a crawler cannot fetch the page. It is **not** evidence about
 * whether any model has indexed, retrieved, cited or will cite the page, and
 * nothing in this module's output may be phrased that way. Crawlers also fetch
 * from their own IP ranges, so a site doing IP-based verification may treat the
 * real crawler differently from us — reported as a caveat, never hidden.
 *
 * Three-class taxonomy is respected throughout (see robots.ts): blocking a
 * *training* crawler is a legitimate editorial choice and is reported, never
 * scored. Only retrieval (`ai-search`) crawlers bear on whether a page can
 * surface in an AI answer.
 */

import { CRAWLERS, type CrawlerClass, type CrawlerSpec, type ParsedRobots, isAllowed } from './robots'
import { httpFetch } from './http'

// ── Types ─────────────────────────────────────────────────────────────────────

/** Why a crawler did not get the page, as far as the response lets us tell. */
export type BlockKind =
  | 'none'
  /** robots.txt disallows this path for this token. A declaration, not enforcement. */
  | 'robots-disallow'
  /** 401/403 carrying a CDN fingerprint — refused at the edge, before the origin. */
  | 'edge-block'
  /** An interactive challenge (Turnstile, hCaptcha, "Just a moment..."). */
  | 'bot-management'
  /** 429, or 503 with Retry-After. Transient, not a policy. */
  | 'rate-limited'
  /** 401/403 with no CDN fingerprint — refused by the application itself. */
  | 'origin-block'
  | 'not-found'
  | 'server-error'
  /** Timeout, DNS failure, TLS failure. Never conflated with "blocked". */
  | 'network-error'

export interface CrawlerProbe {
  token: string
  label: string
  vendor: string
  class: CrawlerClass
  docs: string
  /** The exact User-Agent header sent, so the finding is reproducible by hand. */
  userAgent: string
  /** null when the request never completed. */
  status: number | null
  /** True only when the origin returned a 2xx carrying a non-trivial body. */
  contentServed: boolean
  /**
   * Content-Length when the origin declared one; otherwise the number of bytes
   * we actually read. We stop reading early (see MAX_SNIFF_BYTES), so check
   * `bytesTruncated` before presenting this as the page size.
   */
  bytes: number
  /** True when we stopped reading before the body ended. */
  bytesTruncated: boolean
  blockKind: BlockKind
  /** The header or body fragment the classification rests on. */
  evidence: string
  /** Infrastructure in front of the origin, when it identifies itself. */
  edgeVendor: string | null
  /** What robots.txt declares for this token, independent of what happened. */
  robotsVerdict: 'allowed' | 'disallowed' | 'unknown'
  /** robots.txt and the origin disagree. The practitioner-relevant case. */
  divergence: 'robots-allows-origin-blocks' | 'robots-blocks-origin-serves' | null
  /**
   * False when the baseline browser request also failed. The refusal is then
   * real but not attributable to the user-agent — it is more likely our IP, or
   * the site being down for everyone. A non-attributable result must be
   * presented as unknown, never as "this crawler is blocked".
   */
  attributable: boolean
  ms: number
}

export interface BaselineProbe {
  status: number | null
  contentServed: boolean
  bytes: number
  ms: number
}

export interface CrawlerAccessReport {
  url: string
  checkedAt: string
  /** An ordinary browser request, for comparison. */
  baseline: BaselineProbe
  probes: CrawlerProbe[]
  /**
   * True when the baseline itself failed. Every crawler result is then
   * uninterpretable and must be reported as unknown, not as blocked.
   */
  baselineFailed: boolean
  caveats: string[]
}

// ── Published user-agent strings ──────────────────────────────────────────────

/**
 * Verbatim from each vendor's own documentation (the `docs` URL on each spec).
 * We send the real string because edge rules match on the full UA, not the bare
 * product token — a probe sending only "GPTBot" would miss most real rules.
 */
const USER_AGENTS: Record<string, string> = {
  'OAI-SearchBot':
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot',
  GPTBot:
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.1; +https://openai.com/gptbot',
  'ChatGPT-User':
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot',
  PerplexityBot:
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot',
  'Perplexity-User':
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user',
  ClaudeBot: 'Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
  'Claude-SearchBot': 'Mozilla/5.0 (compatible; Claude-SearchBot/1.0; +claudebot@anthropic.com)',
  'Claude-User': 'Mozilla/5.0 (compatible; Claude-User/1.0; +claudebot@anthropic.com)',
  CCBot: 'CCBot/2.0 (https://commoncrawl.org/faq/)',
  'Google-Extended':
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  Bytespider:
    'Mozilla/5.0 (compatible; Bytespider; spider-feedback@bytedance.com)',
  'Applebot-Extended':
    'Mozilla/5.0 (compatible; Applebot/0.1; +http://www.apple.com/go/applebot)',
}

/** A current, ordinary desktop browser. The control in the experiment. */
const BASELINE_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

/**
 * What we probe by default: every AI crawler that is an actual fetcher, plus the
 * three training crawlers worth reporting on.
 *
 * Deliberately excluded: `Google-Extended` and `Applebot-Extended`. Those are
 * robots.txt *control tokens*, not user-agents — no process identifies itself
 * that way, and the fetching is done by Googlebot and Applebot. Probing them
 * would mean sending a UA nothing uses and reporting the answer as if it were
 * about Gemini or Apple Intelligence, which would be fabricated evidence. They
 * stay robots.txt-only, and `PROBEABLE` is what tells the scorer so.
 */
export const DEFAULT_PROBE_TOKENS = [
  'OAI-SearchBot',
  'Claude-SearchBot',
  'PerplexityBot',
  'ClaudeBot',
  'GPTBot',
  'CCBot',
] as const

/**
 * Tokens that correspond to a real fetching user-agent. Anything outside this
 * set can only ever be assessed from robots.txt, and the scorer must fall back
 * to the declaration for it rather than dropping it from the assessment.
 */
export const PROBEABLE: ReadonlySet<string> = new Set([
  'OAI-SearchBot',
  'Claude-SearchBot',
  'PerplexityBot',
  'ChatGPT-User',
  'Claude-User',
  'Perplexity-User',
  'GPTBot',
  'ClaudeBot',
  'CCBot',
  'Bytespider',
])

// ── Edge / bot-management fingerprints ────────────────────────────────────────

/**
 * Response headers that identify infrastructure in front of the origin. Used
 * only to say *where* a refusal came from — never to accuse a vendor of
 * anything. A site may have configured this deliberately.
 */
const EDGE_SIGNATURES: { vendor: string; header: string; match?: RegExp }[] = [
  { vendor: 'Cloudflare', header: 'cf-ray' },
  { vendor: 'Cloudflare', header: 'cf-mitigated' },
  { vendor: 'Cloudflare', header: 'server', match: /cloudflare/i },
  { vendor: 'Akamai', header: 'server', match: /akamai|ghost/i },
  { vendor: 'Akamai', header: 'x-akamai-request-id' },
  { vendor: 'Fastly', header: 'x-served-by', match: /cache-/i },
  { vendor: 'Fastly', header: 'server', match: /fastly/i },
  { vendor: 'AWS CloudFront', header: 'x-amz-cf-id' },
  { vendor: 'Sucuri', header: 'x-sucuri-id' },
  { vendor: 'Imperva', header: 'x-iinfo' },
  { vendor: 'Vercel', header: 'server', match: /vercel/i },
  { vendor: 'Vercel', header: 'x-vercel-id' },
]

/** Body markers for an interactive challenge rather than a flat refusal. */
const CHALLENGE_MARKERS = [
  /just a moment/i,
  /checking your browser/i,
  /cf-challenge|cf_chl_opt/i,
  /enable javascript and cookies to continue/i,
  /attention required/i,
  /access denied.*(?:ray id|reference)/i,
]

/**
 * Widget names that also appear on ordinary pages (a contact form protected by
 * reCAPTCHA or Turnstile). They indicate a challenge only on a small response
 * that is plausibly nothing but the challenge; on a full page they were
 * labelling real content as "a bot challenge, not the page".
 */
const WEAK_CHALLENGE_MARKERS = [/hcaptcha|recaptcha|turnstile/i]
const CHALLENGE_PAGE_MAX_BYTES = 30_000

function detectEdge(headers: Headers): string | null {
  for (const sig of EDGE_SIGNATURES) {
    const v = headers.get(sig.header)
    if (!v) continue
    if (sig.match && !sig.match.test(v)) continue
    return sig.vendor
  }
  return null
}

// ── Classification ────────────────────────────────────────────────────────────

const MAX_SNIFF_BYTES = 8_000

interface RawResult {
  status: number | null
  headers: Headers | null
  body: string
  /** Declared Content-Length if present, else bytes actually read. */
  bytes: number
  /** We stopped reading before the body ended, so `bytes` is a floor. */
  truncated: boolean
  ms: number
  networkError: string | null
}

/**
 * Turn one response into a verdict. Deliberately conservative: anything that
 * does not clearly indicate a policy decision is reported as what it is
 * (server error, rate limit, network failure) rather than as a block.
 */
function classify(r: RawResult): {
  blockKind: BlockKind
  contentServed: boolean
  evidence: string
  edgeVendor: string | null
} {
  if (r.networkError !== null || r.status === null) {
    return {
      blockKind: 'network-error',
      contentServed: false,
      evidence: r.networkError ?? 'The request did not complete.',
      edgeVendor: null,
    }
  }

  const edgeVendor = r.headers ? detectEdge(r.headers) : null
  const mitigated = r.headers?.get('cf-mitigated') ?? null
  const retryAfter = r.headers?.get('retry-after') ?? null
  const smallBody = !r.truncated && r.bytes < CHALLENGE_PAGE_MAX_BYTES
  const challenged =
    CHALLENGE_MARKERS.some((re) => re.test(r.body)) ||
    (smallBody && WEAK_CHALLENGE_MARKERS.some((re) => re.test(r.body)))

  // 2xx that is actually a challenge page. Cloudflare serves these with 200 or
  // 403 depending on configuration, so status alone is not enough.
  if (r.status >= 200 && r.status < 300) {
    if (challenged || mitigated === 'challenge') {
      return {
        blockKind: 'bot-management',
        contentServed: false,
        evidence: mitigated
          ? `HTTP ${r.status} with cf-mitigated: ${mitigated} — an interactive challenge, not the page.`
          : `HTTP ${r.status} but the body is a bot challenge, not the page.`,
        edgeVendor,
      }
    }
    // A 2xx with almost nothing in it is not content.
    if (r.bytes < 500) {
      return {
        blockKind: 'none',
        contentServed: false,
        evidence: `HTTP ${r.status} but only ${r.bytes} bytes returned — too little to be the page.`,
        edgeVendor,
      }
    }
    return {
      blockKind: 'none',
      contentServed: true,
      evidence: `HTTP ${r.status}, ${r.truncated ? "at least " : ""}${r.bytes.toLocaleString()} bytes served.`,
      edgeVendor,
    }
  }

  if (r.status === 429) {
    return {
      blockKind: 'rate-limited',
      contentServed: false,
      evidence: `HTTP 429${retryAfter ? `, Retry-After: ${retryAfter}` : ''} — rate limited, not a policy block.`,
      edgeVendor,
    }
  }

  if (r.status === 503 && retryAfter) {
    return {
      blockKind: 'rate-limited',
      contentServed: false,
      evidence: `HTTP 503 with Retry-After: ${retryAfter} — temporary, not a policy block.`,
      edgeVendor,
    }
  }

  if (r.status === 401 || r.status === 403) {
    if (challenged || mitigated) {
      return {
        blockKind: 'bot-management',
        contentServed: false,
        evidence: mitigated
          ? `HTTP ${r.status} with cf-mitigated: ${mitigated} — refused by bot management.`
          : `HTTP ${r.status} returning a challenge page — refused by bot management.`,
        edgeVendor,
      }
    }
    if (edgeVendor) {
      return {
        blockKind: 'edge-block',
        contentServed: false,
        evidence: `HTTP ${r.status} from ${edgeVendor} — refused at the edge before reaching the origin.`,
        edgeVendor,
      }
    }
    return {
      blockKind: 'origin-block',
      contentServed: false,
      evidence: `HTTP ${r.status} with no CDN fingerprint — refused by the application itself.`,
      edgeVendor,
    }
  }

  if (r.status === 404 || r.status === 410) {
    return {
      blockKind: 'not-found',
      contentServed: false,
      evidence: `HTTP ${r.status} — the URL does not exist for this request.`,
      edgeVendor,
    }
  }

  if (r.status >= 500) {
    return {
      blockKind: 'server-error',
      contentServed: false,
      evidence: `HTTP ${r.status} — server error, not a crawler policy.`,
      edgeVendor,
    }
  }

  return {
    blockKind: 'none',
    contentServed: false,
    evidence: `HTTP ${r.status}.`,
    edgeVendor,
  }
}

// ── Fetching ──────────────────────────────────────────────────────────────────

export interface ProbeOptions {
  timeoutMs?: number
  fetchImpl?: typeof fetch
  /** Which crawler tokens to probe. Defaults to DEFAULT_PROBE_TOKENS. */
  tokens?: readonly string[]
  /** robots.txt for the host, when already fetched, to cross-reference. */
  robots?: ParsedRobots | null
  /** Injected for deterministic tests. */
  now?: Date
}

async function request(
  url: string,
  userAgent: string,
  timeoutMs: number,
  fetchImpl: typeof fetch,
): Promise<RawResult> {
  const started = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': userAgent,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })

    // Read a bounded prefix: enough to recognise a challenge page, not enough
    // to matter for cost or memory across six concurrent requests.
    let body = ''
    let read = 0
    let truncated = false
    const reader = res.body?.getReader()
    if (reader) {
      const decoder = new TextDecoder()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        read += value.byteLength
        if (body.length < MAX_SNIFF_BYTES) body += decoder.decode(value, { stream: true })
        if (read > MAX_SNIFF_BYTES * 4) {
          truncated = true
          await reader.cancel()
          break
        }
      }
    }

    // Prefer the declared length: what we read is bounded by our own cap, so
    // reporting it as the page size would put a number in the evidence that is
    // an artefact of this probe rather than a fact about the site.
    const declared = Number(res.headers.get('content-length') ?? NaN)
    const bytes = Number.isFinite(declared) && declared >= 0 ? declared : read

    return {
      status: res.status,
      headers: res.headers,
      body,
      bytes,
      truncated: truncated && !Number.isFinite(declared),
      ms: Date.now() - started,
      networkError: null,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      status: null,
      headers: null,
      body: '',
      bytes: 0,
      truncated: false,
      ms: Date.now() - started,
      networkError: /abort/i.test(msg) ? `Timed out after ${timeoutMs}ms.` : msg,
    }
  } finally {
    clearTimeout(timer)
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

export async function probeCrawlerAccess(
  url: string,
  opts: ProbeOptions = {},
): Promise<CrawlerAccessReport> {
  const timeoutMs = opts.timeoutMs ?? 12_000
  const fetchImpl = opts.fetchImpl ?? httpFetch
  const tokens = opts.tokens ?? DEFAULT_PROBE_TOKENS
  const now = opts.now ?? new Date()

  const specs = tokens
    .map((t) => CRAWLERS.find((c) => c.token === t))
    .filter((c): c is CrawlerSpec => Boolean(c))

  const path = (() => {
    try {
      return new URL(url).pathname || '/'
    } catch {
      return '/'
    }
  })()

  // Baseline and all crawler probes together. Same moment, same network, so a
  // difference between them is attributable to the user-agent.
  const [baselineRaw, ...crawlerRaws] = await Promise.all([
    request(url, BASELINE_UA, timeoutMs, fetchImpl),
    ...specs.map((s) => request(url, USER_AGENTS[s.token] ?? s.token, timeoutMs, fetchImpl)),
  ])

  const baselineClass = classify(baselineRaw)
  const baseline: BaselineProbe = {
    status: baselineRaw.status,
    contentServed: baselineClass.contentServed,
    bytes: baselineRaw.bytes,
    ms: baselineRaw.ms,
  }
  const baselineFailed = !baselineClass.contentServed

  const probes: CrawlerProbe[] = specs.map((spec, i) => {
    const raw = crawlerRaws[i]
    const c = classify(raw)

    let robotsVerdict: CrawlerProbe['robotsVerdict'] = 'unknown'
    if (opts.robots) {
      robotsVerdict = isAllowed(opts.robots, spec.token, path).verdict === 'allowed'
        ? 'allowed'
        : 'disallowed'
    }

    // Divergence is only meaningful when we know both halves. A refusal the
    // baseline also got is not the origin treating this crawler differently.
    let divergence: CrawlerProbe['divergence'] = null
    if (robotsVerdict === 'allowed' && !c.contentServed && isPolicyBlock(c.blockKind) && !baselineFailed) {
      divergence = 'robots-allows-origin-blocks'
    } else if (robotsVerdict === 'disallowed' && c.contentServed) {
      divergence = 'robots-blocks-origin-serves'
    }

    return {
      token: spec.token,
      label: spec.label,
      vendor: spec.vendor,
      class: spec.class,
      docs: spec.docs,
      userAgent: USER_AGENTS[spec.token] ?? spec.token,
      status: raw.status,
      contentServed: c.contentServed,
      bytes: raw.bytes,
      bytesTruncated: raw.truncated,
      attributable: !baselineFailed,
      blockKind: c.blockKind,
      evidence: c.evidence,
      edgeVendor: c.edgeVendor,
      robotsVerdict,
      divergence,
      ms: raw.ms,
    }
  })

  return {
    url,
    checkedAt: now.toISOString(),
    baseline,
    probes,
    baselineFailed,
    caveats: buildCaveats(baselineFailed, probes),
  }
}

/**
 * Fill in `robotsVerdict` and `divergence` after the fact.
 *
 * The probe runs concurrently with the robots.txt fetch so neither waits on the
 * other, which means robots.txt is not parsed yet when the probe returns. This
 * applies it afterwards, so we get the divergence finding without paying for a
 * second round trip.
 */
export function crossReferenceRobots(
  report: CrawlerAccessReport,
  robots: ParsedRobots | null,
): CrawlerAccessReport {
  if (!robots) return report

  const path = (() => {
    try {
      return new URL(report.url).pathname || '/'
    } catch {
      return '/'
    }
  })()

  const probes = report.probes.map((p) => {
    const robotsVerdict: CrawlerProbe['robotsVerdict'] =
      isAllowed(robots, p.token, path).verdict === 'allowed' ? 'allowed' : 'disallowed'

    let divergence: CrawlerProbe['divergence'] = null
    if (p.attributable) {
      if (robotsVerdict === 'allowed' && !p.contentServed && isPolicyBlock(p.blockKind)) {
        divergence = 'robots-allows-origin-blocks'
      } else if (robotsVerdict === 'disallowed' && p.contentServed) {
        divergence = 'robots-blocks-origin-serves'
      }
    }

    return { ...p, robotsVerdict, divergence }
  })

  return { ...report, probes, caveats: buildCaveats(report.baselineFailed, probes) }
}

/** A refusal that reflects a decision, as opposed to an outage or a rate limit. */
export function isPolicyBlock(kind: BlockKind): boolean {
  return kind === 'edge-block' || kind === 'bot-management' || kind === 'origin-block'
}

function buildCaveats(baselineFailed: boolean, probes: CrawlerProbe[]): string[] {
  const out: string[] = []

  if (baselineFailed) {
    out.push(
      'An ordinary browser request also failed, so none of the crawler results below can be ' +
        'attributed to the user-agent. Treat every row as unknown rather than blocked.',
    )
    return out
  }

  out.push(
    'This records whether the origin served the page to a request presenting each user-agent, ' +
      'from our network, at the time shown. It is evidence about fetchability, not about ' +
      'whether any AI system has retrieved, indexed or cited the page.',
  )

  if (probes.some((p) => isPolicyBlock(p.blockKind))) {
    out.push(
      'Some crawlers verify themselves by IP range. A site checking those ranges may treat the ' +
        'real crawler differently from this probe, in either direction.',
    )
  }

  if (probes.some((p) => p.blockKind === 'rate-limited')) {
    out.push('At least one request was rate limited. Re-run before treating that row as settled.')
  }

  if (probes.some((p) => p.robotsVerdict === 'unknown')) {
    out.push('robots.txt could not be cross-referenced for every crawler, so some rows show origin behaviour only.')
  }

  return out
}

// ── Summary for presentation ──────────────────────────────────────────────────

export interface AccessSummary {
  retrievalBlocked: CrawlerProbe[]
  retrievalAllowed: CrawlerProbe[]
  trainingBlocked: CrawlerProbe[]
  trainingAllowed: CrawlerProbe[]
  /** The headline case: retrieval refused while training is let through. */
  asymmetry: 'retrieval-blocked-training-allowed' | 'training-blocked-retrieval-allowed' | null
  unknown: CrawlerProbe[]
}

/**
 * Split results by class so presentation can respect the taxonomy. Blocking a
 * training crawler is an editorial choice and must never be presented as a
 * failure; blocking a retrieval crawler is the thing worth surfacing.
 */
export function summarise(report: CrawlerAccessReport): AccessSummary {
  const decided = report.baselineFailed ? [] : report.probes
  const unknown = report.baselineFailed
    ? report.probes
    : report.probes.filter((p) => p.blockKind === 'network-error' || p.blockKind === 'rate-limited')

  const pick = (cls: CrawlerClass, blocked: boolean) =>
    decided.filter(
      (p) =>
        p.class === cls &&
        p.blockKind !== 'network-error' &&
        p.blockKind !== 'rate-limited' &&
        (blocked ? isPolicyBlock(p.blockKind) : p.contentServed),
    )

  const retrievalBlocked = pick('ai-search', true)
  const retrievalAllowed = pick('ai-search', false)
  const trainingBlocked = pick('training', true)
  const trainingAllowed = pick('training', false)

  let asymmetry: AccessSummary['asymmetry'] = null
  if (retrievalBlocked.length > 0 && trainingAllowed.length > 0 && trainingBlocked.length === 0) {
    asymmetry = 'retrieval-blocked-training-allowed'
  } else if (trainingBlocked.length > 0 && retrievalAllowed.length > 0 && retrievalBlocked.length === 0) {
    asymmetry = 'training-blocked-retrieval-allowed'
  }

  return {
    retrievalBlocked,
    retrievalAllowed,
    trainingBlocked,
    trainingAllowed,
    asymmetry,
    unknown,
  }
}
