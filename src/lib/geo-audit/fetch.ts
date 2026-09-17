/**
 * Page fetching.
 *
 * The free tool fetches **raw HTML only** and never spends a render call. That
 * is not a cost compromise, it is the more honest default: GPTBot, PerplexityBot
 * and the other AI crawlers do not execute JavaScript, so raw HTML is what they
 * actually see.
 *
 * Where a page's content only exists after JavaScript runs, that is reported as
 * a FINDING — "this content is invisible to crawlers that don't execute JS" —
 * not silently papered over by rendering it. Rendering is a separate, entitled
 * capability (see `RenderEntitlement`); an unentitled run never contacts a
 * provider, so a free run has a hard ceiling of zero paid fetches.
 */

import { MAX_FETCH_BYTES, formatBytes, truncationDisclosure, type Truncation } from './limits'

export type RenderMode = 'raw' | 'rendered'

export interface FetchedPage {
  url: string
  finalUrl: string
  status: number | null
  ok: boolean
  html: string
  /** Which mode actually produced this HTML. */
  renderMode: RenderMode
  /** The exact User-Agent string we sent, for the chain-of-custody header. */
  userAgent: string
  /** Response headers we reason about later (lower-cased keys). */
  headers: Record<string, string>
  /** Wall-clock milliseconds for the fetch. */
  elapsedMs: number
  /** Set when the HTML was truncated by the byte cap. Always disclosed. */
  truncation: Truncation | null
  /** Name of the render provider, when rendering was used. */
  renderedBy?: string
  /**
   * True when the raw HTML contains almost no readable text. On a raw-mode run
   * this becomes a finding, not a trigger to render.
   */
  jsOnlySuspected: boolean
  /** Human-readable reason the fetch failed or was degraded. */
  note?: string
  /** Resources we could not load, for the "what we could not fetch" section. */
  couldNotFetch: { url: string; reason: string }[]
}

export interface RenderFallback {
  name: string
  isConfigured(): boolean
  render(url: string, opts: { timeoutMs: number }): Promise<{ html: string; finalUrl: string } | null>
}

/**
 * Whether this run may spend a render call.
 *
 * Rendering is a paid surface. The check is an entitlement, not a user setting,
 * so a free run cannot opt itself into spending money.
 */
export interface RenderEntitlement {
  allowed: boolean
  /** Shown as upsell copy when a page needs rendering and the run cannot. */
  reason?: string
}

export const FREE_TIER_NO_RENDER: RenderEntitlement = {
  allowed: false,
  reason:
    'Rendering pages with JavaScript is a paid feature. This free run fetched raw HTML, which is what AI crawlers such as GPTBot and PerplexityBot actually see.',
}

/**
 * The user agent we send. Identifies Byline honestly and points at the policy
 * page, so a site owner who sees it in their logs can find out what it is.
 */
export const BYLINE_USER_AGENT =
  'Mozilla/5.0 (compatible; BylineAuditBot/1.0; +https://bylineseo.com/robot)'

const BASE_HEADERS: Record<string, string> = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  'Upgrade-Insecure-Requests': '1',
}

/** Response headers worth retaining for the evidence pane. */
const KEEP_HEADERS = [
  'content-type',
  'x-robots-tag',
  'cache-control',
  'server',
  'content-encoding',
  'last-modified',
  'x-powered-by',
]

export interface FetchOptions {
  timeoutMs?: number
  fetchImpl?: typeof fetch
  renderFallback?: RenderFallback | null
  /** Defaults to raw. `rendered` requires an entitlement that allows it. */
  renderMode?: RenderMode
  /** Defaults to the free-tier entitlement, which never renders. */
  entitlement?: RenderEntitlement
  /** Override the user agent (the robots check reuses this). */
  userAgent?: string
}

export function normaliseUrl(input: string): string {
  const trimmed = (input ?? '').trim()
  if (!trimmed) return ''
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

/**
 * Cheap check for "this HTML contains almost no readable text". Used to raise
 * the JS-only finding, not to trigger a render.
 */
export function looksLikeEmptyShell(html: string): boolean {
  if (!html || html.length < 200) return true
  const withoutHead = html.replace(/<head[\s\S]*?<\/head>/i, '')
  const stripped = withoutHead
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return stripped.length < 200
}

export async function fetchPage(rawUrl: string, opts: FetchOptions = {}): Promise<FetchedPage> {
  const {
    timeoutMs = 12_000,
    fetchImpl = fetch,
    renderFallback = getRenderFallback(),
    renderMode = 'raw',
    entitlement = FREE_TIER_NO_RENDER,
    userAgent = BYLINE_USER_AGENT,
  } = opts

  const url = normaliseUrl(rawUrl)
  if (!url) {
    return emptyResult(rawUrl, userAgent, 'No URL supplied.')
  }

  let result = await tryFetch(url, timeoutMs, fetchImpl, userAgent)

  // Some hosts only answer on the www. host; retry once before giving up.
  if (!result.ok && !/:\/\/www\./i.test(url)) {
    const second = await tryFetch(url.replace('://', '://www.'), timeoutMs, fetchImpl, userAgent)
    if (second.ok) result = second
  }

  if (!result.ok) return result

  // Rendering only happens when explicitly requested AND entitled AND available.
  // A free run short-circuits here without touching a provider.
  const wantsRender = renderMode === 'rendered'
  if (wantsRender && entitlement.allowed && renderFallback?.isConfigured()) {
    try {
      const rendered = await renderFallback.render(result.finalUrl, { timeoutMs })
      if (rendered && rendered.html) {
        const capped = capHtml(rendered.html)
        return {
          ...result,
          html: capped.html,
          truncation: capped.truncation,
          finalUrl: rendered.finalUrl || result.finalUrl,
          renderMode: 'rendered',
          renderedBy: renderFallback.name,
          jsOnlySuspected: false,
        }
      }
      result.couldNotFetch.push({ url: result.finalUrl, reason: 'The render service returned no HTML.' })
    } catch (err) {
      result.couldNotFetch.push({
        url: result.finalUrl,
        reason: `Render service failed (${err instanceof Error ? err.message : String(err)}).`,
      })
    }
  } else if (wantsRender && !entitlement.allowed) {
    result.note = entitlement.reason
  }

  return result
}

function capHtml(text: string): { html: string; truncation: Truncation | null } {
  if (text.length <= MAX_FETCH_BYTES) return { html: text, truncation: null }
  return {
    html: text.slice(0, MAX_FETCH_BYTES),
    truncation: truncationDisclosure('page HTML', text.length, MAX_FETCH_BYTES),
  }
}

/**
 * Connection-level failures that are worth one retry.
 *
 * These are not "the site is down" — they are a socket dying between us and a
 * healthy server. `UND_ERR_SOCKET` in particular is Node's connection pool
 * handing back a keep-alive socket the server had already closed, which shows up
 * as an instant failure (single-digit milliseconds) under concurrent requests to
 * the same host. The engine fetches the page, robots.txt, llms.txt and up to
 * three linked pages, so it hits that pattern on every run.
 *
 * Reproduced against a live site: 12 sequential requests all succeeded, but the
 * concurrent pattern failed 2 of 24. A single retry clears it.
 */
const TRANSIENT_NETWORK_ERROR =
  /ECONNRESET|UND_ERR_SOCKET|socket hang up|ECONNABORTED|EPIPE|other side closed|terminated/i

function isTransient(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const cause = (err as { cause?: { code?: string; message?: string } }).cause
  const text = `${err.message} ${cause?.code ?? ''} ${cause?.message ?? ''}`
  return TRANSIENT_NETWORK_ERROR.test(text)
}

async function tryFetch(
  url: string,
  timeoutMs: number,
  fetchImpl: typeof fetch,
  userAgent: string,
  attempt = 0,
): Promise<FetchedPage> {
  const started = Date.now()
  try {
    const res = await fetchImpl(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { ...BASE_HEADERS, 'User-Agent': userAgent },
      redirect: 'follow',
    })

    const headers: Record<string, string> = {}
    for (const name of KEEP_HEADERS) {
      const v = res.headers.get(name)
      if (v) headers[name] = v
    }

    const base = {
      url,
      finalUrl: res.url || url,
      status: res.status,
      renderMode: 'raw' as const,
      userAgent,
      headers,
      elapsedMs: Date.now() - started,
      truncation: null,
      jsOnlySuspected: false,
      couldNotFetch: [] as { url: string; reason: string }[],
    }

    if (!res.ok) {
      return {
        ...base,
        ok: false,
        html: '',
        note: describeStatus(res.status),
        couldNotFetch: [{ url, reason: `HTTP ${res.status}` }],
      }
    }

    const contentType = headers['content-type'] ?? ''
    if (contentType && !/html|xml|text\/plain/i.test(contentType)) {
      return {
        ...base,
        ok: false,
        html: '',
        note: `That URL returned ${contentType.split(';')[0]}, not a web page.`,
        couldNotFetch: [{ url, reason: `Unsupported content type: ${contentType}` }],
      }
    }

    const full = await res.text()
    const capped = capHtml(full)

    return {
      ...base,
      ok: true,
      html: capped.html,
      truncation: capped.truncation,
      jsOnlySuspected: looksLikeEmptyShell(capped.html),
      note: capped.truncation
        ? `Page is ${formatBytes(full.length)}; analysed the first ${formatBytes(MAX_FETCH_BYTES)}.`
        : undefined,
    }
  } catch (err) {
    // One retry on a dropped socket, with a short backoff so a fresh connection
    // is opened rather than another dead pooled one.
    if (attempt === 0 && isTransient(err)) {
      await new Promise((r) => setTimeout(r, 250))
      return tryFetch(url, timeoutMs, fetchImpl, userAgent, 1)
    }

    const message = err instanceof Error ? err.message : String(err)
    return {
      ...emptyResult(url, userAgent, describeNetworkError(message)),
      elapsedMs: Date.now() - started,
      couldNotFetch: [{ url, reason: message }],
    }
  }
}

function describeStatus(status: number): string {
  if (status === 403) return 'That site is blocking automated requests (HTTP 403).'
  if (status === 404) return 'That page was not found (HTTP 404).'
  if (status === 401) return 'That page requires authentication (HTTP 401), so a crawler cannot read it either.'
  if (status === 429) return 'That site is rate-limiting requests (HTTP 429). Try again in a few minutes.'
  if (status >= 500) return `That site returned a server error (HTTP ${status}).`
  return `The server returned HTTP ${status}.`
}

function describeNetworkError(message: string): string {
  if (/timeout|abort/i.test(message)) return 'The site did not respond in time.'
  if (/ENOTFOUND|getaddrinfo|dns/i.test(message)) return 'That domain could not be resolved. Check the spelling.'
  if (/certificate|SSL|TLS/i.test(message)) return 'That site has an SSL certificate problem, which also blocks crawlers.'
  if (/ECONNREFUSED/i.test(message)) return 'The server refused the connection.'
  return `Could not reach that URL (${message}).`
}

function emptyResult(url: string, userAgent: string, note: string): FetchedPage {
  return {
    url,
    finalUrl: url,
    status: null,
    ok: false,
    html: '',
    renderMode: 'raw',
    userAgent,
    headers: {},
    elapsedMs: 0,
    truncation: null,
    jsOnlySuspected: false,
    note,
    couldNotFetch: [],
  }
}

// ── Render providers ───────────────────────────────────────────────────────────
// Inert until a key is set AND the run is entitled. Both gates must open.

export const firecrawlFallback: RenderFallback = {
  name: 'firecrawl',
  isConfigured: () => Boolean(process.env.FIRECRAWL_API_KEY),
  async render(url, { timeoutMs }) {
    const key = process.env.FIRECRAWL_API_KEY
    if (!key) return null
    const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ url, formats: ['rawHtml'], onlyMainContent: false }),
    })
    if (!res.ok) return null
    const json = (await res.json()) as { data?: { rawHtml?: string; metadata?: { sourceURL?: string } } }
    const html = json.data?.rawHtml
    if (!html) return null
    return { html, finalUrl: json.data?.metadata?.sourceURL ?? url }
  },
}

export const scrapingBeeFallback: RenderFallback = {
  name: 'scrapingbee',
  isConfigured: () => Boolean(process.env.SCRAPINGBEE_API_KEY),
  async render(url, { timeoutMs }) {
    const key = process.env.SCRAPINGBEE_API_KEY
    if (!key) return null
    const endpoint = new URL('https://app.scrapingbee.com/api/v1/')
    endpoint.searchParams.set('api_key', key)
    endpoint.searchParams.set('url', url)
    endpoint.searchParams.set('render_js', 'true')
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(timeoutMs) })
    if (!res.ok) return null
    return { html: await res.text(), finalUrl: url }
  },
}

export function getRenderFallback(): RenderFallback | null {
  for (const provider of [firecrawlFallback, scrapingBeeFallback]) {
    if (provider.isConfigured()) return provider
  }
  return null
}
