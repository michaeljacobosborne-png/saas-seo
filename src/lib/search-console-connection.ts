// Server-side helper: load a brand's GSC connection and hand back a *valid*
// access token, transparently refreshing + persisting when the stored one has
// expired. Used by the properties/performance routes so each doesn't re-implement
// the refresh dance. Reads/writes go through the caller's auth-aware Supabase
// client, so RLS keeps everything scoped to the logged-in user.

import { refreshAccessToken } from '@/lib/google-search-console'

export interface GscConnection {
  id: string
  brand_profile_id: string
  access_token: string
  refresh_token: string | null
  token_expiry: string | null
  property_url: string | null
}

// 60s safety margin so we refresh slightly before actual expiry.
const EXPIRY_SKEW_MS = 60_000

/**
 * Fetch the connection for a user's brand profile. Returns null if none exists.
 */
export async function getConnection(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  brandProfileId: string
): Promise<GscConnection | null> {
  const { data } = await supabase
    .from('search_console_connections')
    .select('id, brand_profile_id, access_token, refresh_token, token_expiry, property_url')
    .eq('user_id', userId)
    .eq('brand_profile_id', brandProfileId)
    .maybeSingle()
  return (data as GscConnection | null) ?? null
}

/**
 * Return a non-expired access token for the connection, refreshing + saving the
 * new token if the stored one is past (or near) its expiry. Throws if a refresh
 * is needed but no refresh token is available.
 */
export async function getValidAccessToken(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  connection: GscConnection
): Promise<string> {
  const expiry = connection.token_expiry ? new Date(connection.token_expiry).getTime() : 0
  const isExpired = !expiry || expiry - EXPIRY_SKEW_MS < Date.now()

  if (!isExpired) return connection.access_token

  if (!connection.refresh_token) {
    throw new Error('Search Console token expired and no refresh token is available. Please reconnect.')
  }

  const refreshed = await refreshAccessToken(connection.refresh_token)

  await supabase
    .from('search_console_connections')
    .update({
      access_token: refreshed.access_token,
      token_expiry: new Date(refreshed.expiry_date).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', connection.id)

  return refreshed.access_token
}
