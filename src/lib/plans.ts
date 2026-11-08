/**
 * What each plan includes, as numbers the app enforces (the repricing of
 * 2026-11-08: plans are metered on pages monitored, not articles written).
 *
 * Keys are the values stored in `subscriptions.plan` ('starter', 'pro',
 * 'agency'; 'team' is an old spelling of agency). They are NOT renamed when the
 * customer-facing names change: existing accounts, comped ones included, are
 * identified by those values. Display names live in PLAN_DISPLAY_NAMES.
 *
 * MCP entitlements are a separate table on purpose (src/lib/mcp/entitlements.ts,
 * DECISIONS 27). The pricing page copy is checked against this file by
 * plans.test.ts, so a number cannot drift between the two.
 */

export type PaidPlan = 'starter' | 'pro' | 'agency'

export interface PlanLimits {
  /** Articles generated a month. A bundled feature, not the unit of value. */
  articles: number
  keywordSessions: number
  brandProfiles: number
  /** Pages kept under monitoring (daily crawler access checks, change alerts). */
  trackedPages: number
  /** Distinct domains those pages may sit on. */
  domains: number
  /** One-off audits of any URL a month. */
  auditsPerMonth: number
  /** Days of history kept at least. null = unlimited. */
  historyDays: number | null
  /** How often tracked pages are re-scored. Weekly is the fastest the column allows. */
  rescoreIntervalDays: number
}

export const PLAN_LIMITS: Record<PaidPlan, PlanLimits> = {
  starter: { articles: 8, keywordSessions: 10, brandProfiles: 1, trackedPages: 15, domains: 1, auditsPerMonth: 100, historyDays: 90, rescoreIntervalDays: 30 },
  pro: { articles: 30, keywordSessions: 60, brandProfiles: 1, trackedPages: 100, domains: 5, auditsPerMonth: 500, historyDays: 365, rescoreIntervalDays: 7 },
  agency: { articles: 100, keywordSessions: 200, brandProfiles: 3, trackedPages: 500, domains: 20, auditsPerMonth: 2000, historyDays: null, rescoreIntervalDays: 7 },
}

/** Free accounts: generous one-off checks, no monitoring at all. */
export const FREE_LIMITS = { auditsPerMonth: 10, trackedPages: 0, domains: 0, draftScoresPerMonth: 10 } as const

export const PLAN_DISPLAY_NAMES: Record<PaidPlan, string> = { starter: 'Solo', pro: 'Pro', agency: 'Agency' }

/** Map a stored `subscriptions.plan` value onto a plan key. Unknown values are not guessed at. */
export const PLAN_ALIASES: Record<string, PaidPlan> = { starter: 'starter', pro: 'pro', agency: 'agency', team: 'agency' }

export const UPGRADE_URL = 'https://app.bylineseo.com/pricing'

// ── domains ──────────────────────────────────────────────────────────────────

/** Second-level suffixes where the registrable domain has three labels (example.co.uk). */
const TWO_PART_SUFFIXES = new Set(['co.uk', 'org.uk', 'ac.uk', 'com.au', 'net.au', 'org.au', 'co.nz', 'co.za', 'co.jp', 'com.br', 'com.mx', 'co.in'])

/**
 * The domain a page counts against: lower-case, no www, subdomains folded into
 * the registrable domain so blog.example.com and example.com are one site.
 * A heuristic, not the public suffix list; it errs towards counting a few
 * exotic hosts as one site rather than many.
 */
export function domainOf(url: string): string | null {
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase().replace(/\.$/, '')
  } catch {
    return null
  }
  if (!host || /^[\d.]+$/.test(host) || host.includes(':')) return host || null
  const labels = host.split('.')
  if (labels.length <= 2) return host
  const tail2 = labels.slice(-2).join('.')
  return TWO_PART_SUFFIXES.has(tail2) ? labels.slice(-3).join('.') : tail2
}

// ── tracked-page allowance (pure; the route supplies the data) ───────────────

export type TrackedPageCheck =
  | { ok: true }
  | { ok: false; code: 'NOT_INCLUDED' | 'PAGE_LIMIT' | 'DOMAIN_LIMIT'; message: string }

/**
 * May this account start monitoring `newUrl`? Re-adding a page that is already
 * monitored always passes. Messages state the limit and link to the plans page;
 * they never name a tier (DECISIONS 27).
 */
export function checkTrackedPageAllowance(args: {
  limits: { trackedPages: number; domains: number }
  /** URLs of the account's active tracked pages. */
  activeUrls: string[]
  newUrl: string
}): TrackedPageCheck {
  const { limits, activeUrls, newUrl } = args
  if (limits.trackedPages <= 0) {
    return { ok: false, code: 'NOT_INCLUDED', message: `Page monitoring is not included in your current Byline subscription. See ${UPGRADE_URL}.` }
  }
  if (activeUrls.includes(newUrl)) return { ok: true }

  const distinctUrls = new Set(activeUrls)
  if (distinctUrls.size >= limits.trackedPages) {
    return {
      ok: false,
      code: 'PAGE_LIMIT',
      message: `Your subscription monitors up to ${limits.trackedPages} page${limits.trackedPages === 1 ? '' : 's'}, and you are monitoring ${distinctUrls.size}. Stop monitoring one to add another, or see ${UPGRADE_URL}.`,
    }
  }

  const domain = domainOf(newUrl)
  const domains = new Set(activeUrls.map(domainOf).filter((d): d is string => !!d))
  if (domain && !domains.has(domain) && domains.size >= limits.domains) {
    return {
      ok: false,
      code: 'DOMAIN_LIMIT',
      message: `Your subscription monitors pages on up to ${limits.domains} domain${limits.domains === 1 ? '' : 's'}, and you are monitoring ${domains.size}. Stop monitoring every page on one to add another, or see ${UPGRADE_URL}.`,
    }
  }
  return { ok: true }
}

/** Start of the current calendar month, UTC, and the start of the next. */
export function monthWindowUtc(now: Date): { start: Date; next: Date } {
  return {
    start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    next: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
  }
}
