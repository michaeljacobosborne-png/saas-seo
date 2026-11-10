/**
 * Record what an audit fetched, so the run can be re-scored later on any engine.
 *
 * Score-over-time has to say whether a PAGE changed. Comparing two stored scores
 * cannot: the engine moved four times in three weeks (2026.11 to 2026.14), and
 * compare.ts rightly refuses a number across engine versions. So a run keeps the
 * responses it read, and any two runs can be replayed through the current
 * engine side by side. A difference then means the page changed, never the
 * rubric.
 *
 * Every request an audit makes (the page, robots.txt, llms.txt, the crawler
 * probe, linked pages) goes through one injectable fetchImpl, so recording wraps
 * that and nothing in the engine changes. Replay serves the recorded responses
 * by URL, User-Agent and request shape, in the order they were made.
 *
 * Size: the crawler probe fetches the same page up to 13 times, and the copies
 * differ only in nonces. Every body is kept whole (the probe looks for challenge
 * markers anywhere in it, so a prefix would not replay exactly), and the
 * snapshot is compressed with Brotli over a 16 MB window, which stores the
 * near-identical copies almost for free.
 */
import { brotliCompressSync, brotliDecompressSync, constants as z } from 'node:zlib'
import { createHash } from 'node:crypto'

export const SNAPSHOT_VERSION = 1

export interface RecordedExchange {
  url: string
  /** The URL the response came from after redirects. */
  finalUrl: string
  userAgent: string
  /** Whether the request sent an Accept header (the probe asks both ways). */
  accept: boolean
  status: number | null
  headers: [string, string][]
  /** Key into `bodies`; null for a bodiless response or a failed request. */
  body: string | null
  /** Bytes in the original body. */
  length: number
  /** Set when the request failed; replay throws the same message. */
  error?: string
}

export interface AuditSnapshot {
  version: typeof SNAPSHOT_VERSION
  recordedAt: string
  engineVersion: string
  url: string
  tool: 'geo' | 'ao'
  exchanges: RecordedExchange[]
  /**
   * Body hash to content: "t:" + the text when the bytes are valid UTF-8 (so
   * gzip compresses it well), otherwise "b:" + base64. Gzipped as a whole by
   * encodeSnapshot.
   */
  bodies: Record<string, string>
}

function packBody(bytes: Uint8Array): string {
  const text = Buffer.from(bytes).toString('utf8')
  return Buffer.from(text, 'utf8').equals(Buffer.from(bytes)) ? `t:${text}` : `b:${Buffer.from(bytes).toString('base64')}`
}

/** The stored bytes of one body. */
export function snapshotBody(snapshot: AuditSnapshot, key: string): Buffer {
  return unpackBody(snapshot.bodies[key])
}

function unpackBody(packed: string | undefined): Buffer {
  if (!packed) return Buffer.alloc(0)
  return packed.startsWith('t:') ? Buffer.from(packed.slice(2), 'utf8') : Buffer.from(packed.slice(2), 'base64')
}

function headerPairs(init?: RequestInit): Record<string, string> {
  const out: Record<string, string> = {}
  new Headers(init?.headers).forEach((v, k) => (out[k.toLowerCase()] = v))
  return out
}

function requestUrl(input: string | URL | Request): string {
  return typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
}

const keyOf = (url: string, ua: string, accept: boolean) => `${url}\u0000${ua}\u0000${accept ? 'a' : '-'}`

/** Wraps a fetch so every response is recorded as it is returned. */
export function recordingFetch(inner: typeof fetch): { fetchImpl: typeof fetch; exchanges: RecordedExchange[]; bodies: Record<string, string> } {
  const exchanges: RecordedExchange[] = []
  const bodies: Record<string, string> = {}

  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = requestUrl(input)
    const h = headerPairs(init)
    const base = { url, userAgent: h['user-agent'] ?? '', accept: 'accept' in h }
    let res: Response
    try {
      res = await inner(input as string, init)
    } catch (err) {
      exchanges.push({ ...base, finalUrl: url, status: null, headers: [], body: null, length: 0, error: err instanceof Error ? err.message : String(err) })
      throw err
    }
    const bytes = new Uint8Array(await res.clone().arrayBuffer())
    let key: string | null = null
    if (bytes.length) {
      key = createHash('sha256').update(bytes).digest('hex').slice(0, 32)
      if (!bodies[key]) bodies[key] = packBody(bytes)
    }
    const headers: [string, string][] = []
    res.headers.forEach((v, k) => headers.push([k, v]))
    exchanges.push({ ...base, finalUrl: res.url || url, status: res.status, headers, body: key, length: bytes.length })
    return res
  }) as typeof fetch

  return { fetchImpl, exchanges, bodies }
}

/** Serves a snapshot's responses back, in recorded order per request. */
export function replayFetch(snapshot: AuditSnapshot): typeof fetch {
  const queues = new Map<string, RecordedExchange[]>()
  for (const ex of snapshot.exchanges) {
    const k = keyOf(ex.url, ex.userAgent, ex.accept)
    queues.set(k, [...(queues.get(k) ?? []), ex])
  }
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = requestUrl(input)
    const h = headerPairs(init)
    const queue = queues.get(keyOf(url, h['user-agent'] ?? '', 'accept' in h))
    const ex = queue?.shift()
    if (!ex) throw new Error(`Not in the snapshot: ${url}`)
    if (ex.error) throw new Error(ex.error)
    const body: Uint8Array<ArrayBuffer> | null = ex.body ? new Uint8Array(unpackBody(snapshot.bodies[ex.body])) : null
    const status = ex.status ?? 0
    const res = new Response(status === 204 || status === 304 || !body ? null : body, { status, headers: new Headers(ex.headers) })
    Object.defineProperty(res, 'url', { value: ex.finalUrl })
    return res
  }) as typeof fetch
}

export function encodeSnapshot(s: AuditSnapshot): string {
  const json = Buffer.from(JSON.stringify(s))
  return brotliCompressSync(json, {
    params: {
      [z.BROTLI_PARAM_QUALITY]: 9,
      // 16 MB window: the probe's near-identical copies of a page compress against each other.
      [z.BROTLI_PARAM_LGWIN]: 24,
      [z.BROTLI_PARAM_SIZE_HINT]: json.length,
    },
  }).toString('base64')
}

export function decodeSnapshot(encoded: string): AuditSnapshot {
  const s = JSON.parse(brotliDecompressSync(Buffer.from(encoded, 'base64')).toString('utf8')) as AuditSnapshot
  if (s.version !== SNAPSHOT_VERSION) throw new Error(`Unknown snapshot version ${s.version}`)
  return s
}
