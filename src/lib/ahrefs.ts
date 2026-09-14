// Domain Rank integration via DataForSEO backlinks/summary.
//
// Uses the same DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD credentials already
// configured for keyword research — no additional API key needed.
//
// DataForSEO's `rank` field in the backlinks summary is a 0–100 domain
// authority score (higher = stronger backlink profile), surfaced in the UI
// as "DR" for familiarity. Cost: ~$0.01–0.02 per domain per call; results are
// cached in-memory for 24h so cold instances re-fetch at most once per domain
// per day.
//
// Env vars (same as keyword research):
//   DATAFORSEO_LOGIN
//   DATAFORSEO_PASSWORD

const BASE = 'https://api.dataforseo.com/v3'

export interface DomainRating {
  dr: number       // DataForSEO domain rank (0–100)
  ahrefsRank: number // kept for interface compatibility; always 0
}

// In-memory cache so repeated page renders don't hammer the API. Process-local
// (per server instance) — fine for a soft 24h cache; cold instances just
// re-fetch. We cache nulls too (negative caching) to avoid retrying a domain
// that errored on every render.
const TTL_MS = 24 * 60 * 60 * 1000
const cache = new Map<string, { value: DomainRating | null; fetchedAt: number }>()

function getCached(domain: string): { value: DomainRating | null } | undefined {
  const hit = cache.get(domain)
  if (!hit) return undefined
  if (Date.now() - hit.fetchedAt > TTL_MS) {
    cache.delete(domain)
    return undefined
  }
  return { value: hit.value }
}

// Fetch domain rank for a single domain via DataForSEO backlinks/summary/live.
// Resolves to null on any error so one bad domain never breaks the batch.
async function fetchOne(
  domain: string,
  login: string,
  password: string
): Promise<DomainRating | null> {
  const credentials = Buffer.from(`${login}:${password}`).toString('base64')
  try {
    const res = await fetch(`${BASE}/backlinks/summary/live`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{ target: domain, include_subdomains: true }]),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (data.tasks?.[0]?.status_code !== 20000) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = data.tasks?.[0]?.result?.[0] as any
    const dr = Number(result?.rank)
    if (!Number.isFinite(dr)) return null
    return { dr, ahrefsRank: 0 }
  } catch {
    return null
  }
}

/**
 * Fetch Domain Rank for one or more domains via DataForSEO. Returns a map of
 * domain → { dr, ahrefsRank } | null. Requests run in parallel (capped at 10
 * domains). Missing credentials → all nulls (UI shows "—"). Per-domain
 * failures → null for that domain only. Results cached in-memory for 24h.
 */
export async function fetchDomainRatings(
  domains: string[]
): Promise<Record<string, DomainRating | null>> {
  const targets = domains.slice(0, 10)
  const out: Record<string, DomainRating | null> = {}

  const login = process.env.DATAFORSEO_LOGIN
  const password = process.env.DATAFORSEO_PASSWORD
  if (!login || !password) {
    // Graceful no-op: surface nulls everywhere so the UI shows "—".
    for (const d of targets) out[d] = null
    return out
  }

  const toFetch: string[] = []
  for (const d of targets) {
    const cached = getCached(d)
    if (cached) out[d] = cached.value
    else toFetch.push(d)
  }

  const results = await Promise.all(toFetch.map((d) => fetchOne(d, login, password)))
  toFetch.forEach((d, i) => {
    const value = results[i]
    cache.set(d, { value, fetchedAt: Date.now() })
    out[d] = value
  })

  return out
}
