// Ahrefs Domain Rating (DR) integration.
//
// Ahrefs recently opened their Domain Rating endpoint for free use. DR is a
// 0–100 score representing how strong a domain's backlink profile is — useful
// context for SEO strategy. We surface it on the dashboard, content audit, and
// keyword research.
//
// Env var:
//   AHREFS_API_KEY — from ahrefs.com/api (Domain Rating endpoint is free tier).
//     When missing, every lookup returns null so the UI degrades gracefully.
//
// No SDK — native fetch against the v3 REST endpoint.

const BASE = 'https://api.ahrefs.com/v3'

export interface DomainRating {
  dr: number
  ahrefsRank: number
}

// In-memory cache so repeated page renders don't hammer the API. Process-local
// (per server instance) — that's fine for a soft 24h cache; a cold instance just
// re-fetches. We cache nulls too (negative caching) to avoid retrying a domain
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

// Fetch DR for a single domain. Resolves to null on any error (missing key,
// non-200, malformed payload) so one bad domain never breaks the batch.
async function fetchOne(domain: string, apiKey: string): Promise<DomainRating | null> {
  const url = `${BASE}/site-explorer/domain-rating?target=${encodeURIComponent(
    domain
  )}&date=latest&output=json`
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!res.ok) return null
    const data = await res.json()
    // Ahrefs nests the metrics under `domain_rating`; tolerate a flat shape too.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node = (data?.domain_rating ?? data) as any
    const dr = Number(node?.domain_rating ?? node?.dr)
    const ahrefsRank = Number(node?.ahrefs_rank ?? node?.ahrefsRank)
    if (!Number.isFinite(dr)) return null
    return { dr, ahrefsRank: Number.isFinite(ahrefsRank) ? ahrefsRank : 0 }
  } catch {
    return null
  }
}

/**
 * Fetch Domain Rating for one or more domains. Returns a map of
 * domain → { dr, ahrefsRank } | null. Requests run in parallel (capped at 10
 * domains). Missing API key → all nulls. Per-domain failures → null for that
 * domain only. Results are cached in-memory for 24h.
 */
export async function fetchDomainRatings(
  domains: string[]
): Promise<Record<string, DomainRating | null>> {
  const targets = domains.slice(0, 10)
  const out: Record<string, DomainRating | null> = {}

  const apiKey = process.env.AHREFS_API_KEY
  if (!apiKey) {
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

  const results = await Promise.all(toFetch.map((d) => fetchOne(d, apiKey)))
  toFetch.forEach((d, i) => {
    const value = results[i]
    cache.set(d, { value, fetchedAt: Date.now() })
    out[d] = value
  })

  return out
}
