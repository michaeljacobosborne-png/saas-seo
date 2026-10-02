// Helpers for the external publishing integration (WordPress first).
// Credentials are stored AES-256-CBC encrypted (see lib/encrypt.ts) as a JSON
// string of WpCredentials inside publishing_connections.credentials.

export interface WpCredentials {
  username: string
  appPassword: string
}

// WordPress Application Passwords are issued with spaces (e.g. "abcd efgh ijkl").
// Basic Auth tolerates them, but trimming the outer whitespace avoids surprises.
export function wpAuthHeader(username: string, appPassword: string): string {
  return 'Basic ' + Buffer.from(`${username}:${appPassword}`).toString('base64')
}

// Normalise a site URL: trim, drop any trailing slashes so we can append
// `/wp-json/...` cleanly. Returns '' for blank input.
export function normalizeSiteUrl(url: string): string {
  return (url ?? '').trim().replace(/\/+$/, '')
}

export interface WpTestResult {
  ok: boolean
  displayName?: string
  error?: string
}

// Verify a WordPress connection by hitting the authenticated users/me endpoint.
// Returns the WP display name on success, a human-readable error otherwise.
export async function testWordPress(
  siteUrl: string,
  username: string,
  appPassword: string,
): Promise<WpTestResult> {
  const base = normalizeSiteUrl(siteUrl)
  if (!base || !/^https?:\/\//i.test(base)) {
    return { ok: false, error: 'Enter a valid site URL starting with http:// or https://' }
  }

  let res: Response
  try {
    res = await fetch(`${base}/wp-json/wp/v2/users/me?context=edit`, {
      headers: {
        Authorization: wpAuthHeader(username, appPassword),
        Accept: 'application/json',
      },
      // Defensive timeout — a misconfigured site shouldn't hang the request.
      signal: AbortSignal.timeout(12_000),
      cache: 'no-store',
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      return { ok: false, error: 'The site took too long to respond. Check the URL and try again.' }
    }
    return { ok: false, error: 'Could not reach the site. Check the URL is correct and publicly accessible.' }
  }

  if (res.status === 401 || res.status === 403) {
    return { ok: false, error: 'Authentication failed. Check the username and application password.' }
  }
  if (res.status === 404) {
    return { ok: false, error: 'WordPress REST API not found at that URL. Is this a WordPress site?' }
  }
  if (!res.ok) {
    return { ok: false, error: `WordPress returned an error (${res.status}). Please try again.` }
  }

  let me: { name?: string; slug?: string } = {}
  try {
    me = await res.json()
  } catch {
    return { ok: false, error: 'Unexpected response from the site — it may not be a WordPress REST API.' }
  }

  return { ok: true, displayName: me.name || me.slug || username }
}
