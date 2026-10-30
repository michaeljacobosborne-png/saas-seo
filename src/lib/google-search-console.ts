// Google Search Console (Webmasters API v3) integration helpers.
//
// OAuth: we request the read-only webmasters scope with offline access so Google
// hands back a refresh token, letting us query Search Console data long after the
// initial consent without re-prompting the user.
//
// Env vars:
//   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET — the same OAuth client used for
//     Supabase Google login (add the search-console callback as an authorized
//     redirect URI in the Google Cloud console).
//   NEXT_PUBLIC_APP_URL — base URL used to build the redirect URI.
//
// No SDK — everything is native fetch against Google's REST endpoints.

const OAUTH_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const OAUTH_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const SITES_ENDPOINT = 'https://www.googleapis.com/webmasters/v3/sites'
const SEARCH_ANALYTICS_BASE = 'https://www.googleapis.com/webmasters/v3/sites'

export const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'

export function getRedirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? ''
  return `${base}/api/search-console/callback`
}

export interface GscTokens {
  access_token: string
  refresh_token?: string | null
  // Absolute epoch-ms expiry computed from Google's `expires_in` (seconds).
  expiry_date: number
}

export interface GscProperty {
  siteUrl: string
  permissionLevel: string
}

export interface PerformanceRow {
  keys: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
}

/**
 * Build the Google OAuth consent URL. State is `${userId}:${brandProfileId}` so
 * the callback can tie the returned tokens back to the right brand connection.
 */
export function buildAuthUrl(brandProfileId: string, userId: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? '',
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: GSC_SCOPE,
    access_type: 'offline',
    // `consent` forces Google to re-issue a refresh token even on re-auth, so a
    // reconnect never lands us with an access token but no refresh token.
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: `${userId}:${brandProfileId}`,
  })
  return `${OAUTH_AUTH_ENDPOINT}?${params.toString()}`
}

/** Exchange an authorization code for access + refresh tokens. */
export async function exchangeCode(code: string): Promise<GscTokens> {
  const res = await fetch(OAUTH_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      redirect_uri: getRedirectUri(),
      grant_type: 'authorization_code',
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Google token exchange failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? null,
    expiry_date: Date.now() + (data.expires_in ?? 3600) * 1000,
  }
}

/** Refresh an expired access token using a stored refresh token. */
export async function refreshAccessToken(refreshToken: string): Promise<GscTokens> {
  const res = await fetch(OAUTH_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Google token refresh failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  return {
    access_token: data.access_token,
    // A refresh response usually omits refresh_token — keep the existing one.
    refresh_token: data.refresh_token ?? null,
    expiry_date: Date.now() + (data.expires_in ?? 3600) * 1000,
  }
}

/** List the GSC properties (sites) the authorized account can access. */
export async function fetchProperties(accessToken: string): Promise<GscProperty[]> {
  const res = await fetch(SITES_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Search Console sites fetch failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entries: any[] = data.siteEntry ?? []
  return entries.map((e) => ({
    siteUrl: e.siteUrl,
    permissionLevel: e.permissionLevel,
  }))
}

/**
 * Query the searchAnalytics endpoint for a property over a date range.
 * Dates are ISO `YYYY-MM-DD`. `dimensions` defaults to ['query'].
 */
export async function fetchPerformance(
  accessToken: string,
  propertyUrl: string,
  startDate: string,
  endDate: string,
  dimensions: string[] = ['query'],
  rowLimit = 25
): Promise<PerformanceRow[]> {
  const res = await fetch(
    `${SEARCH_ANALYTICS_BASE}/${encodeURIComponent(propertyUrl)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate,
        endDate,
        dimensions,
        rowLimit,
      }),
    }
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Search Console performance query failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = data.rows ?? []
  return rows.map((r) => ({
    keys: r.keys ?? [],
    clicks: r.clicks ?? 0,
    impressions: r.impressions ?? 0,
    ctr: r.ctr ?? 0,
    position: r.position ?? 0,
  }))
}

/** ISO `YYYY-MM-DD` for `daysAgo` days before now (UTC). */
export function isoDaysAgo(daysAgo: number): string {
  const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}
