/**
 * A fetch-compatible GET built on node:http/https, used by the engine instead
 * of the global fetch.
 *
 * Why: some Cloudflare-protected sites refuse Node's built-in fetch (undici)
 * outright. Tested 2026-10-06 against aira.net, from one machine and IP, same
 * User-Agent:
 * - fetch: 403 with any headers, including a full Chrome user-agent and a full
 *   browser header set
 * - curl: 200
 * - node:https: 200
 * The refusal is about the client signature, not the site's policy toward
 * automation and not our IP. Reporting it as "the site is blocking automated
 * requests" was a false finding about the site. Everything the audit sends still
 * carries the user-agent the caller chose: the crawler probe still identifies as
 * GPTBot and the rest; only the transport changes.
 *
 * Supports what the engine uses: GET, headers, redirect following, timeout or
 * abort signal, gzip/deflate/br decoding, and a body cap. Returns a standard
 * Response with `url` set to the final URL.
 */
import http from 'node:http'
import https from 'node:https'
import zlib from 'node:zlib'

const MAX_REDIRECTS = 5
/** Hard cap on bytes read from one response; the engine caps HTML lower than this itself. */
const MAX_BODY_BYTES = 5 * 1024 * 1024

export async function httpFetch(input: string | URL | Request, init: RequestInit = {}): Promise<Response> {
  let url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
  const headers: Record<string, string> = {}
  new Headers(init.headers).forEach((v, k) => (headers[k] = v))
  if (!headers['accept-encoding']) headers['accept-encoding'] = 'gzip, deflate, br'
  const signal = init.signal ?? undefined
  const follow = init.redirect !== 'manual' && init.redirect !== 'error'

  for (let hop = 0; ; hop++) {
    const res = await once(url, headers, signal)
    const location = res.headers.get('location')
    if (follow && location && res.status >= 300 && res.status < 400 && hop < MAX_REDIRECTS) {
      url = new URL(location, url)
      continue
    }
    if (init.redirect === 'error' && res.status >= 300 && res.status < 400) throw new TypeError('Redirect not allowed')
    Object.defineProperty(res, 'url', { value: url.href })
    Object.defineProperty(res, 'redirected', { value: hop > 0 })
    return res
  }
}

function once(url: URL, headers: Record<string, string>, signal?: AbortSignal): Promise<Response> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
    const lib = url.protocol === 'http:' ? http : https
    const req = lib.request(url, { method: 'GET', headers, signal }, (res) => {
      const status = res.statusCode ?? 0
      const outHeaders = new Headers()
      for (const [k, v] of Object.entries(res.headers)) {
        if (v === undefined) continue
        for (const one of Array.isArray(v) ? v : [v]) outHeaders.append(k, one)
      }
      // Redirects and bodiless statuses: no need to read the payload.
      if ((status >= 300 && status < 400 && res.headers.location) || status === 204 || status === 304) {
        res.resume()
        return resolve(new Response(null, { status, headers: outHeaders }))
      }
      const encoding = String(res.headers['content-encoding'] ?? '').toLowerCase()
      const stream =
        encoding === 'gzip' || encoding === 'x-gzip' ? res.pipe(zlib.createGunzip())
        : encoding === 'deflate' ? res.pipe(zlib.createInflate())
        : encoding === 'br' ? res.pipe(zlib.createBrotliDecompress())
        : res
      const chunks: Buffer[] = []
      let size = 0
      stream.on('data', (c: Buffer) => {
        if (size >= MAX_BODY_BYTES) return
        chunks.push(c)
        size += c.length
        if (size >= MAX_BODY_BYTES) res.destroy()
      })
      let settled = false
      const done = () => {
        if (settled) return
        settled = true
        // The body is decoded here, so the header no longer describes it.
        outHeaders.delete('content-encoding')
        outHeaders.delete('content-length')
        resolve(new Response(status === 204 ? null : new Uint8Array(Buffer.concat(chunks)), { status, headers: outHeaders }))
      }
      stream.on('end', done)
      stream.on('close', () => (size >= MAX_BODY_BYTES ? done() : undefined))
      stream.on('error', (e) => {
        if (size > 0) return done()
        settled = true
        reject(e)
      })
    })
    req.on('error', reject)
    req.end()
  })
}
