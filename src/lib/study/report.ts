/**
 * Turn a run ledger into one result per site and the counts the study publishes.
 *
 * Every site in the run ends in exactly one of: audited, dropped (with the
 * rule's reason), unresolved (failed for a reason the rule does not name, so it
 * needs a ruling), duplicate, or still in progress. Nothing falls out of the
 * count. The denominators are stated next to every figure.
 */
import { resolveSite, type AttemptEvent, type Pacing, type RunEvent, type SiteStatus } from './ledger'
import type { Site } from './populations'
import type { StudyRow } from './derive'
import type { Vantage } from './vantage'

/** The pre-registered vantage point. Mirrored in scripts/study/config.ts, which is what the harness enforces. */
const REQUIRED_COUNTRY = 'US'

export interface SiteResult {
  key: string
  population: string
  rank: number
  name: string
  domain: string
  url: string
  status: 'audited' | 'dropped' | 'unresolved' | 'duplicate' | 'in-progress' | 'pending'
  reason: string | null
  duplicateOf: string | null
  attempts: { n: number; at: string; outcome: string; failureKind: string | null; httpStatus: number | null; message: string | null }[]
  nextEligibleAt: string | null
  engineVersion: string | null
  vantage: Vantage | null
  row: StudyRow | null
}

export interface Tally {
  /** Audited sites in this group whose crawler probe ran: the denominator for every access finding. */
  audited: number
  /** At least one crawler got a 2xx that was a challenge with no content. */
  challenge200: number
  /** ...and the browser baseline was served the real page, so the difference is the user-agent. */
  challenge200WithBrowserServed: number
  /** ...of which the body was a JavaScript form challenge specifically. */
  challenge200JsForm: number
  robotsPermitsOriginRefuses: number
  vendorAsymmetry: number
  /** The plain browser request was refused too: every crawler row is unknown. */
  baselineRefused: number
  baseline200NoContent: number
  scoreWithheld: number
  /** Served page declares a language other than English, or redirected to a locale path or another host. */
  possiblyLocalised: number
}

export interface Summary {
  generatedAt: string
  engineVersions: string[]
  egressCountries: string[]
  platformRegions: string[]
  /** True only when the run used one engine and one US vantage throughout. Anything else is a problem to resolve before publishing. */
  consistent: boolean
  populations: Record<string, { sites: number; duplicates: number; audited: number; dropped: Record<string, number>; unresolved: Record<string, number>; outstanding: number }>
  tally: Record<string, Tally>
}

const emptyTally = (): Tally => ({
  audited: 0,
  challenge200: 0,
  challenge200WithBrowserServed: 0,
  challenge200JsForm: 0,
  robotsPermitsOriginRefuses: 0,
  vendorAsymmetry: 0,
  baselineRefused: 0,
  baseline200NoContent: 0,
  scoreWithheld: 0,
  possiblyLocalised: 0,
})

function addToTally(t: Tally, row: StudyRow): void {
  const a = row.access
  if (a.probeRan) {
    t.audited++
    if (a.headline.challenge200Count > 0) {
      t.challenge200++
      if (!a.baselineRefused) t.challenge200WithBrowserServed++
      if (a.probes.some((p) => p.challengeKind === 'js-form')) t.challenge200JsForm++
    }
    if (a.headline.robotsPermitsOriginRefusesCount > 0) t.robotsPermitsOriginRefuses++
    if (a.headline.vendorAsymmetry) t.vendorAsymmetry++
    if (a.baselineRefused) t.baselineRefused++
    if (a.baseline200NoContent) t.baseline200NoContent++
  }
  if (row.scoreWithheld) t.scoreWithheld++
  const lang = (row.htmlLang ?? '').toLowerCase()
  if ((lang && !lang.startsWith('en')) || row.redirectedToLocalePath || row.redirectedToOtherHost) t.possiblyLocalised++
}

export function buildResults(events: RunEvent[], pacing: Pacing, now: Date): SiteResult[] {
  const sites = new Map<string, Site>()
  for (const e of events) {
    if (e.type === 'run-start') for (const s of (e.config as { sites?: Site[] }).sites ?? []) sites.set(s.key, s)
  }
  const byKey = new Map<string, AttemptEvent[]>()
  for (const e of events) if (e.type === 'attempt') byKey.set(e.key, [...(byKey.get(e.key) ?? []), e])
  // An attempt for a site the run-start list does not name (a fixture) still counts.
  for (const [key, list] of byKey) if (!sites.has(key)) sites.set(key, { key, population: list[0].population, rank: list[0].rank, name: list[0].name, url: list[0].url, domain: list[0].domain })

  const dupKeys = new Map<string, { of: string }>()
  for (const e of events) if (e.type === 'duplicate' && !dupKeys.has(e.key)) dupKeys.set(e.key, { of: e.duplicateOf })

  const out: SiteResult[] = []
  for (const site of sites.values()) {
    const base = { key: site.key, population: site.population, rank: site.rank, name: site.name, domain: site.domain, url: site.url }
    const attempts = byKey.get(site.key) ?? []
    const history = [...attempts]
      .sort((a, b) => a.at.localeCompare(b.at))
      .map((a) => ({ n: a.attempt, at: a.at, outcome: a.outcome, failureKind: a.failure?.kind ?? null, httpStatus: a.failure?.httpStatus ?? null, message: a.failure?.message ?? null }))
    const dup = dupKeys.get(site.key)
    if (dup && attempts.length === 0) {
      out.push({ ...base, status: 'duplicate', reason: 'duplicate', duplicateOf: dup.of, attempts: [], nextEligibleAt: null, engineVersion: null, vantage: null, row: null })
      continue
    }
    const s: SiteStatus = resolveSite(attempts, pacing, now)
    const common = { ...base, duplicateOf: null as string | null, attempts: history, nextEligibleAt: null as string | null }
    if (s.status === 'audited') {
      out.push({ ...common, status: 'audited', reason: null, engineVersion: s.attempt.engineVersion, vantage: s.attempt.vantage, row: s.attempt.row ?? null })
    } else if (s.status === 'dropped' || s.status === 'unresolved') {
      const last = s.failures[s.failures.length - 1]
      out.push({ ...common, status: s.status, reason: s.reason, engineVersion: last.engineVersion, vantage: last.vantage, row: null })
    } else if (s.status === 'pending') {
      out.push({ ...common, status: 'pending', reason: null, engineVersion: null, vantage: null, row: null })
    } else {
      const last = s.failures[s.failures.length - 1]
      out.push({ ...common, status: 'in-progress', reason: s.failures.map((f) => f.failure!.kind).join('+'), nextEligibleAt: s.status === 'retry-wait' ? s.nextEligibleAt : null, engineVersion: last.engineVersion, vantage: last.vantage, row: null })
    }
  }
  return out.sort((a, b) => a.population.localeCompare(b.population) || a.rank - b.rank)
}

export function summarise(results: SiteResult[], now: Date): Summary {
  const audited = results.filter((r) => r.status === 'audited')
  const engines = new Set(audited.map((r) => r.engineVersion ?? 'unknown'))
  const countries = new Set(audited.map((r) => r.vantage?.egressCountry ?? 'unknown'))
  const regions = new Set(audited.map((r) => r.vantage?.platformRegion ?? 'none'))

  const populations: Summary['populations'] = {}
  const tally: Record<string, Tally> = { all: emptyTally() }
  for (const r of results) {
    const p = (populations[r.population] ??= { sites: 0, duplicates: 0, audited: 0, dropped: {}, unresolved: {}, outstanding: 0 })
    p.sites++
    if (r.status === 'duplicate') p.duplicates++
    else if (r.status === 'audited') {
      p.audited++
      if (r.row) {
        addToTally((tally[r.population] ??= emptyTally()), r.row)
        addToTally(tally.all, r.row)
      }
    } else if (r.status === 'dropped') p.dropped[r.reason ?? 'unknown'] = (p.dropped[r.reason ?? 'unknown'] ?? 0) + 1
    else if (r.status === 'unresolved') p.unresolved[r.reason ?? 'unknown'] = (p.unresolved[r.reason ?? 'unknown'] ?? 0) + 1
    else p.outstanding++
  }
  return {
    generatedAt: now.toISOString(),
    engineVersions: [...engines].sort(),
    egressCountries: [...countries].sort(),
    platformRegions: [...regions].sort(),
    consistent: engines.size <= 1 && countries.size === 1 && countries.has(REQUIRED_COUNTRY),
    populations,
    tally,
  }
}

/** One flat line per site, for the published CSV. */
export function flatten(r: SiteResult): Record<string, string | number | boolean | null> {
  const row = r.row
  const a = row?.access
  const f: Record<string, string | number | boolean | null> = {
    population: r.population,
    rank: r.rank,
    name: r.name,
    domain: r.domain,
    status: r.status,
    reason: r.reason,
    attempts: r.attempts.length,
    engine_version: r.engineVersion,
    vantage_mode: r.vantage?.mode ?? null,
    egress_country: r.vantage?.egressCountry ?? null,
    egress_ip: r.vantage?.egressIp ?? null,
    egress_org: r.vantage?.egressOrg ?? null,
    platform_region: r.vantage?.platformRegion ?? null,
    audited_at: r.attempts.find((x) => x.outcome === 'audited')?.at ?? null,
    requested_url: row?.requestedUrl ?? r.url,
    final_url: row?.finalUrl ?? null,
    http_status: row?.httpStatus ?? null,
    html_lang: row?.htmlLang ?? null,
    redirected_other_host: row?.redirectedToOtherHost ?? null,
    redirected_locale_path: row?.redirectedToLocalePath ?? null,
    score_withheld: row?.scoreWithheld ?? null,
    retrievable: row?.retrievable ?? null,
    grade: row?.grade ?? null,
    pillar_access: row?.pillars.access ? row.pillars.access.score : null,
    pillar_parseability: row?.pillars.parseability ? row.pillars.parseability.score : null,
    pillar_chunkability: row?.pillars.chunkability ? row.pillars.chunkability.score : null,
    pillar_extractability: row?.pillars.extractability ? row.pillars.extractability.score : null,
    citable_band: row?.citable.band ?? null,
    named_authorship: row?.citable.namedAuthorship ?? null,
    original_evidence: row?.citable.originalEvidence ?? null,
    baseline_status: a?.baseline?.status ?? null,
    baseline_refused: a?.baselineRefused ?? null,
    baseline_200_no_content: a?.baseline200NoContent ?? null,
    nothing_attributable: a?.headline.nothingAttributable ?? null,
    challenge200_count: a?.headline.challenge200Count ?? null,
    challenge200_tokens: a?.headline.challenge200Tokens.join(' ') ?? null,
    robots_permits_origin_refuses: a?.headline.robotsPermitsOriginRefusesCount ?? null,
    vendors_served: a?.headline.vendorsServed.join(' ') ?? null,
    vendors_refused: a?.headline.vendorsRefused.join(' ') ?? null,
    vendor_asymmetry: a?.headline.vendorAsymmetry ?? null,
  }
  for (const p of a?.probes ?? []) {
    f[`${p.token}_status`] = p.status
    f[`${p.token}_served`] = p.contentServed
    f[`${p.token}_block`] = p.blockKind
    f[`${p.token}_attributable`] = p.attributable
  }
  return f
}
