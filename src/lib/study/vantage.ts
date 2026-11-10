/**
 * Where a request came from, established by looking rather than assuming.
 *
 * The study is pinned to a United States vantage point. A region name in a
 * config file is not evidence of that: a function can be deployed somewhere
 * else, and a laptop can sit behind a VPN. So the harness asks an IP lookup
 * service what address and country the outbound traffic actually has, and
 * records the answer on every row. In study mode a row whose egress country is
 * not US is refused, not recorded as data.
 *
 * The lookup sends our own egress address to ipinfo.io, once per process.
 */

export interface Vantage {
  /** 'local': the machine running the script. 'remote': a deployed function. */
  mode: 'local' | 'remote'
  /** The platform region the function reports (VERCEL_REGION), when there is one. */
  platformRegion: string | null
  /** x-vercel-id style request id, so a row can be traced to one invocation. */
  requestId: string | null
  egressIp: string | null
  egressCountry: string | null
  egressRegion: string | null
  /** Network owner as the lookup reports it, e.g. "AS16509 Amazon.com, Inc.". */
  egressOrg: string | null
  lookedUpAt: string
  /** Why the lookup failed, if it did. A vantage with no country can never pass study mode. */
  lookupError: string | null
}

let cached: { at: number; value: Omit<Vantage, 'mode' | 'platformRegion' | 'requestId'> } | null = null
const CACHE_MS = 10 * 60_000

export async function lookupEgress(
  base: { mode: Vantage['mode']; platformRegion?: string | null; requestId?: string | null },
  fetchImpl: typeof fetch = fetch,
): Promise<Vantage> {
  const common = { mode: base.mode, platformRegion: base.platformRegion ?? process.env.VERCEL_REGION ?? null, requestId: base.requestId ?? null }
  if (cached && Date.now() - cached.at < CACHE_MS) return { ...common, ...cached.value }
  const lookedUpAt = new Date().toISOString()
  try {
    const res = await fetchImpl('https://ipinfo.io/json', { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000) })
    if (!res.ok) throw new Error(`ipinfo.io returned HTTP ${res.status}`)
    const j = (await res.json()) as { ip?: string; country?: string; region?: string; org?: string }
    const value = {
      egressIp: j.ip ?? null,
      egressCountry: j.country ?? null,
      egressRegion: j.region ?? null,
      egressOrg: j.org ?? null,
      lookedUpAt,
      lookupError: j.country ? null : 'The lookup returned no country.',
    }
    cached = { at: Date.now(), value }
    return { ...common, ...value }
  } catch (err) {
    return {
      ...common,
      egressIp: null,
      egressCountry: null,
      egressRegion: null,
      egressOrg: null,
      lookedUpAt,
      lookupError: err instanceof Error ? err.message : String(err),
    }
  }
}
