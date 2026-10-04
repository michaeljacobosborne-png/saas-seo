/**
 * MCP authentication: resolve a request to a principal (docs/mcp-server-spec.md §3).
 *
 * One interface, two future implementations: personal API keys (first) and
 * OAuth 2.1 bearer tokens for claude.ai connectors (later, decision M1). Tools
 * only ever see an `McpPrincipal`, so adding OAuth changes nothing downstream.
 *
 * Storage is injected (`lookupKey`, `planFor`), so this file has no database
 * code and is fully testable before the `api_keys` table exists.
 *
 * Never: keys in URLs, IP allowlists, or a principal derived from anything a
 * caller can type other than a verified credential.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export type PlanTier = 'free' | 'starter' | 'growth' | 'multi_brand'

export interface McpPrincipal {
  userId: string
  /** The API key used, when authenticated by key. */
  keyId: string | null
  plan: PlanTier
  /** The owner account (decision 11). Exempt from quotas, never from validation. */
  isOwner: boolean
  via: 'api_key' | 'oauth'
}

export interface AuthResolver {
  /** A principal, or null when the request carries no valid credential. */
  resolve(request: Request): Promise<McpPrincipal | null>
}

export const API_KEY_PREFIX = 'byl_live_'
const KEY_BODY = /^[A-Za-z0-9]{32}$/

/** A new key. Show `key` to the user once; store only `hash` and `prefix`. */
export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = randomBytes(32)
  let body = ''
  for (const b of bytes) body += alphabet[b % alphabet.length]
  const key = `${API_KEY_PREFIX}${body}`
  return { key, prefix: key.slice(0, API_KEY_PREFIX.length + 6), hash: hashApiKey(key) }
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex')
}

export function isWellFormedApiKey(key: string): boolean {
  return key.startsWith(API_KEY_PREFIX) && KEY_BODY.test(key.slice(API_KEY_PREFIX.length))
}

/** The token from `Authorization: Bearer <token>`, or null. */
export function bearerToken(request: Request): string | null {
  const h = request.headers.get('authorization')
  if (!h) return null
  const m = h.match(/^Bearer\s+(\S+)$/i)
  return m ? m[1] : null
}

/** Constant-time hash comparison, for when a lookup returns a stored hash to confirm. */
export function hashesMatch(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'hex')
  const bb = Buffer.from(b, 'hex')
  return ab.length === bb.length && ab.length > 0 && timingSafeEqual(ab, bb)
}

/**
 * Map the `subscriptions.plan` value (and account type) to a tier. Mirrors the
 * dashboard: 'pro' is Growth; 'agency' and 'team' are both Multi-Brand
 * (ARCHITECTURE.md gotcha 5). No active subscription → free.
 */
export function planTier(subscriptionPlan: string | null | undefined): PlanTier {
  switch ((subscriptionPlan ?? '').toLowerCase()) {
    case 'starter':
      return 'starter'
    case 'pro':
    case 'growth':
      return 'growth'
    case 'agency':
    case 'team':
    case 'multi_brand':
      return 'multi_brand'
    default:
      return 'free'
  }
}

/**
 * OAuth 2.1 bearer tokens (decision 21). Supabase Auth is the authorization
 * server (its OAuth 2.1 server issues user access tokens to registered or
 * dynamically registered clients such as claude.ai); this server is only a
 * resource server. A token is accepted when Supabase verifies it, and the
 * calling client is recorded from its `client_id` claim for metering.
 */
export function oauthResolver(deps: {
  /** Verify an access token with Supabase (auth.getUser(token) or JWKS); null when invalid or expired. */
  verifyToken: (token: string) => Promise<{ userId: string; clientId: string | null } | null>
  planFor: (userId: string) => Promise<PlanTier>
  isOwner: (userId: string) => Promise<boolean>
}): AuthResolver {
  return {
    async resolve(request) {
      const token = bearerToken(request)
      if (!token || token.startsWith(API_KEY_PREFIX)) return null
      const v = await deps.verifyToken(token)
      if (!v) return null
      const [plan, owner] = await Promise.all([deps.planFor(v.userId), deps.isOwner(v.userId)])
      return { userId: v.userId, keyId: v.clientId, plan, isOwner: owner, via: 'oauth' }
    },
  }
}

/** Try resolvers in order (OAuth first, then API keys as a developer side path). */
export function chainResolvers(...resolvers: AuthResolver[]): AuthResolver {
  return {
    async resolve(request) {
      for (const r of resolvers) {
        const p = await r.resolve(request)
        if (p) return p
      }
      return null
    },
  }
}

export interface StoredKey {
  keyId: string
  userId: string
  keyHash: string
  revoked: boolean
}

export function apiKeyResolver(deps: {
  /** Find a key row by its hash. */
  lookupKey: (hash: string) => Promise<StoredKey | null>
  /** The user's current plan tier (from active/trialing subscriptions). */
  planFor: (userId: string) => Promise<PlanTier>
  /** Whether this user is the owner account (decision 11). */
  isOwner: (userId: string) => Promise<boolean>
  /** Record use; must never throw into the request. */
  touch?: (keyId: string) => Promise<void>
}): AuthResolver {
  return {
    async resolve(request) {
      const token = bearerToken(request)
      if (!token || !isWellFormedApiKey(token)) return null
      const hash = hashApiKey(token)
      const row = await deps.lookupKey(hash)
      if (!row || row.revoked || !hashesMatch(row.keyHash, hash)) return null
      const [plan, owner] = await Promise.all([deps.planFor(row.userId), deps.isOwner(row.userId)])
      if (deps.touch) deps.touch(row.keyId).catch(() => {})
      return { userId: row.userId, keyId: row.keyId, plan, isOwner: owner, via: 'api_key' }
    },
  }
}
