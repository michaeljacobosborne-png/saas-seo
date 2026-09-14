/**
 * Page fetching with a pluggable render fallback.
 *
 * The default path is a plain HTTP fetch, which is what the overwhelming
 * majority of marketing sites need — their content is in the static HTML. When
 * static HTML comes back genuinely empty (a JS-only shell), we hand off to a
 * render provider if one is configured. No provider is configured today; the
 * interface exists so Firecrawl/ScrapingBee can be switched on by setting an
 * env var, without touching the engine.
 */

export interface FetchedPage {
  url: string
  finalUrl: string
  status: number | null
  ok: boolean
  html: string
  /** Name of the render provider, when the HTML did not come from a plain fetch. */
  renderedBy?: string
  /** Human-readable reason the fetch failed or was degraded. */
  note?: string
}

export interface RenderFallback {
  name: string
  /** True when the provider has the credentials it needs. */
  isConfigured(): boolean
  render(url: string, opts: { timeoutMs: number }): Promise<{ html: string; finalUrl: string } | null>
}

const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
}

/** Cap on bytes we keep. Generous — the old 15k cut every site off mid-<head>. */
export const MAX_HTML_BYTES = 3_000_000

export interface FetchOptions {
  timeoutMs?: number
  /** Injected for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch
  /** Injected for tests. Defaults to the env-configured provider, if any. */
  renderFallback?: RenderFallback | null
  /** When true, try the render fallback if the static HTML looks empty. */
  allowRender?: boolean
}

export function normaliseUrl(input: string): string {
  const trimmed = (input ?? '').trim()
  if (!trimmed) return ''
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

/**
 * A rough "does this HTML contain a page" check, used to decide whether to
 * reach for a render fallback. Deliberately cheap — real assessment happens in
 * the extractor.
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
    allowRender = true,
  } = opts

  const url = normaliseUrl(rawUrl)
  if (!url) {
    return { url: rawUrl, finalUrl: rawUrl, status: null, ok: false, html: '', note: 'No URL supplied.' }
  }

  const attempt = await tryFetch(url, timeoutMs, fetchImpl)

  // Some hosts only answer on the www. host; retry once before giving up.
  let result = attempt
  if (!result.ok && !/:\/\/www\./i.test(url)) {
    const withWww = url.replace('://', '://www.')
    const second = await tryFetch(withWww, timeoutMs, fetchImpl)
    if (second.ok) result = second
  }

  if (!result.ok) return result

  if (allowRender && looksLikeEmptyShell(result.html) && renderFallback?.isConfigured()) {
    try {
      const rendered = await renderFallback.render(result.finalUrl, { timeoutMs })
      if (rendered && !looksLikeEmptyShell(rendered.html)) {
        return {
          ...result,
          html: rendered.html,
          finalUrl: rendered.finalUrl || result.finalUrl,
          renderedBy: renderFallback.name,
        }
      }
    } catch {
      // Fall through with the static HTML and let the extractor report it thin.
    }
  }

  if (looksLikeEmptyShell(result.html)) {
    return {
      ...result,
      note: renderFallback?.isConfigured()
        ? 'The page returned almost no readable HTML, and rendering it did not help.'
        : 'The page returned almost no readable HTML — its content is likely rendered by JavaScript, which this audit does not execute.',
    }
  }

  return result
}

async function tryFetch(url: string, timeoutMs: number, fetchImpl: typeof fetch): Promise<FetchedPage> {
  try {
    const res = await fetchImpl(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: BROWSER_HEADERS,
      redirect: 'follow',
    })

    if (!res.ok) {
      return {
        url,
        finalUrl: res.url || url,
        status: res.status,
        ok: false,
        html: '',
        note:
          res.status === 403
            ? 'That site is blocking automated requests (HTTP 403).'
            : res.status === 404
              ? 'That page was not found (HTTP 404).'
              : `The server returned HTTP ${res.status}.`,
      }
    }

    const contentType = res.headers.get('content-type') ?? ''
    if (contentType && !/html|xml|text\/plain/i.test(contentType)) {
      return {
        url,
        finalUrl: res.url || url,
        status: res.status,
        ok: false,
        html: '',
        note: `That URL returned ${contentType.split(';')[0]}, not a web page.`,
      }
    }

    const text = await res.text()
    return {
      url,
      finalUrl: res.url || url,
      status: res.status,
      ok: true,
      html: text.length > MAX_HTML_BYTES ? text.slice(0, MAX_HTML_BYTES) : text,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      url,
      finalUrl: url,
      status: null,
      ok: false,
      html: '',
      note: /timeout|abort/i.test(message)
        ? 'The site did not respond in time.'
        : `Could not reach that URL (${message}).`,
    }
  }
}

// ── Render providers ───────────────────────────────────────────────────────────
// Both are inert until their API key is set. Adding a key is the only step
// needed to switch rendering on.

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

/** The first configured provider, or null when rendering is unavailable. */
export function getRenderFallback(): RenderFallback | null {
  for (const provider of [firecrawlFallback, scrapingBeeFallback]) {
    if (provider.isConfigured()) return provider
  }
  return null
}
