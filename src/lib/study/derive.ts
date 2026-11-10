/**
 * The study row: what one homepage audit is reduced to for publication.
 *
 * Pure functions over an AuditReport. Nothing here fetches, scores or decides
 * anything the engine has not already decided; it only reads the report and
 * lays out the fields the pre-registered selection rule lists, plus enough
 * crawler detail to support the access findings.
 *
 * The access findings, as the selection rule words them:
 *   - robots.txt permits a crawler that the origin then refuses
 *   - a 200 that is really a JavaScript challenge with no content (which a tool
 *     with no browser baseline would count as success)
 *   - one vendor served while another is refused
 *   - a plain browser request is refused too, so nothing is attributable and
 *     every crawler row is "unknown", never "blocked"
 */
import type { AuditReport } from '@/lib/geo-audit/types'
import { isPolicyBlock, type CrawlerProbe } from '@/lib/geo-audit/crawler-access'

export const ROW_SCHEMA = 1

export interface StudyProbe {
  token: string
  vendor: string
  class: string
  status: number | null
  contentServed: boolean
  bytes: number
  blockKind: string
  edgeVendor: string | null
  robotsVerdict: string
  divergence: string | null
  attributable: boolean
  confirmed: boolean
  /** A 2xx response whose body is a challenge, not the page. */
  challenge200: boolean
  /** 'js-form' when the body is a script that fills in and submits a form; 'interstitial' otherwise. */
  challengeKind: 'js-form' | 'interstitial' | null
  /** The engine's own words for what it saw, for the reproduce-by-hand record. */
  evidence: string
}

export interface StudyAccess {
  probeRan: boolean
  baseline: { status: number | null; contentServed: boolean; bytes: number; ms: number } | null
  /** The plain browser request did not get the page. Nothing about this site is then attributable. */
  baselineRefused: boolean
  /** Baseline got a 2xx and no content: a challenge or an empty shell. The engine does not say which. */
  baseline200NoContent: boolean
  robotsState: string | null
  robotsStatus: number | null
  probes: StudyProbe[]
  headline: {
    challenge200Count: number
    challenge200Tokens: string[]
    robotsPermitsOriginRefusesCount: number
    robotsPermitsOriginRefusesTokens: string[]
    robotsDisallowsOriginServesCount: number
    vendorsServed: string[]
    vendorsRefused: string[]
    /** At least one vendor is served and at least one refused, on rows that are attributable. */
    vendorAsymmetry: boolean
    /** Every crawler row is unknown: the baseline was refused, or every row was unconfirmed. */
    nothingAttributable: boolean
  }
}

export interface StudyRow {
  schema: typeof ROW_SCHEMA
  engineVersion: string | null
  requestedUrl: string
  finalUrl: string
  httpStatus: number | null
  elapsedMs: number
  /** Localisation evidence: the language the page declares and any language-looking path prefix. */
  htmlLang: string | null
  contentLanguage: string | null
  redirectedToOtherHost: boolean
  redirectedToLocalePath: boolean
  scoreWithheld: boolean
  withheldReason: string | null
  retrievable: number | null
  grade: string | null
  confidence: string | null
  incomplete: boolean
  pillars: Record<string, { score: number; max: number } | null>
  citable: {
    band: string
    counts: Record<string, number>
    signals: Record<string, string>
    namedAuthorship: string | null
    originalEvidence: string | null
  }
  pagesInspected: number
  access: StudyAccess
}

const PILLARS = ['access', 'parseability', 'chunkability', 'extractability'] as const

/** www and a trailing dot are not a different host. */
function bareHost(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '')
  } catch {
    return null
  }
}

const LOCALE_PATH = /^\/(?:[a-z]{2}(?:[-_][a-z]{2})?)(?:\/|$)/i

export function toStudyProbe(p: CrawlerProbe): StudyProbe {
  const is2xx = p.status !== null && p.status >= 200 && p.status < 300
  const challenge200 = is2xx && !p.contentServed && p.blockKind === 'bot-management'
  return {
    token: p.token,
    vendor: p.vendor,
    class: p.class,
    status: p.status,
    contentServed: p.contentServed,
    bytes: p.bytes,
    blockKind: p.blockKind,
    edgeVendor: p.edgeVendor,
    robotsVerdict: p.robotsVerdict,
    divergence: p.divergence,
    attributable: p.attributable,
    confirmed: p.confirmed !== false,
    challenge200,
    challengeKind: challenge200 ? (/JavaScript challenge/i.test(p.evidence) ? 'js-form' : 'interstitial') : null,
    evidence: p.evidence,
  }
}

export function deriveAccess(report: Pick<AuditReport, 'crawlerProbe' | 'access'>): StudyAccess {
  const probe = report.crawlerProbe
  const robots = report.access?.robots
  if (!probe) {
    return {
      probeRan: false,
      baseline: null,
      baselineRefused: false,
      baseline200NoContent: false,
      robotsState: robots?.state ?? null,
      robotsStatus: robots?.status ?? null,
      probes: [],
      headline: {
        challenge200Count: 0,
        challenge200Tokens: [],
        robotsPermitsOriginRefusesCount: 0,
        robotsPermitsOriginRefusesTokens: [],
        robotsDisallowsOriginServesCount: 0,
        vendorsServed: [],
        vendorsRefused: [],
        vendorAsymmetry: false,
        nothingAttributable: false,
      },
    }
  }

  const probes = probe.probes.map(toStudyProbe)
  const baselineRefused = probe.baselineFailed
  const attributable = probes.filter((p) => p.attributable)
  const served = new Set<string>()
  const refused = new Set<string>()
  for (const p of attributable) {
    if (p.contentServed) served.add(p.vendor)
    else if (isPolicyBlock(p.blockKind as CrawlerProbe['blockKind'])) refused.add(p.vendor)
  }
  const challenge = probes.filter((p) => p.challenge200)
  const permitsRefuses = probes.filter((p) => p.divergence === 'robots-allows-origin-blocks')

  return {
    probeRan: true,
    baseline: { status: probe.baseline.status, contentServed: probe.baseline.contentServed, bytes: probe.baseline.bytes, ms: probe.baseline.ms },
    baselineRefused,
    baseline200NoContent: probe.baseline.status !== null && probe.baseline.status >= 200 && probe.baseline.status < 300 && !probe.baseline.contentServed,
    robotsState: robots?.state ?? null,
    robotsStatus: robots?.status ?? null,
    probes,
    headline: {
      challenge200Count: challenge.length,
      challenge200Tokens: challenge.map((p) => p.token),
      robotsPermitsOriginRefusesCount: permitsRefuses.length,
      robotsPermitsOriginRefusesTokens: permitsRefuses.map((p) => p.token),
      robotsDisallowsOriginServesCount: probes.filter((p) => p.divergence === 'robots-blocks-origin-serves').length,
      vendorsServed: [...served].sort(),
      vendorsRefused: [...refused].sort(),
      vendorAsymmetry: served.size > 0 && refused.size > 0,
      nothingAttributable: probes.length > 0 && attributable.length === 0,
    },
  }
}

export function deriveRow(
  report: AuditReport,
  page: { htmlLang: string | null; contentLanguage: string | null },
): StudyRow {
  const ret = report.retrievability
  const groups = new Map(ret?.groups.map((g) => [g.id as string, g]) ?? [])
  const signals = report.citability?.signals ?? []
  const bandOf = (id: string) => signals.find((s) => s.id === id)?.band ?? null

  const reqHost = bareHost(report.url)
  const finHost = bareHost(report.finalUrl)
  let finalPath = '/'
  try {
    finalPath = new URL(report.finalUrl).pathname
  } catch {
    /* keep '/' */
  }
  let reqPath = '/'
  try {
    reqPath = new URL(report.url).pathname
  } catch {
    /* keep '/' */
  }

  return {
    schema: ROW_SCHEMA,
    engineVersion: report.engineVersion ?? null,
    requestedUrl: report.url,
    finalUrl: report.finalUrl,
    httpStatus: report.chainOfCustody?.httpStatus ?? null,
    elapsedMs: report.chainOfCustody?.elapsedMs ?? 0,
    htmlLang: page.htmlLang,
    contentLanguage: page.contentLanguage,
    redirectedToOtherHost: !!reqHost && !!finHost && reqHost !== finHost,
    redirectedToLocalePath: LOCALE_PATH.test(finalPath) && !LOCALE_PATH.test(reqPath),
    scoreWithheld: report.scoreWithheld,
    withheldReason: report.withheldReason ?? null,
    retrievable: report.scoreWithheld ? null : (ret?.score ?? report.score),
    grade: report.scoreWithheld ? null : (report.grade ?? null),
    confidence: report.confidence ?? null,
    incomplete: report.incomplete,
    pillars: Object.fromEntries(
      PILLARS.map((id) => {
        const g = groups.get(id)
        return [id, g ? { score: g.score, max: g.maxScore } : null]
      }),
    ),
    citable: {
      band: report.citability?.band ?? 'unverified',
      counts: (report.citability?.counts ?? {}) as Record<string, number>,
      signals: Object.fromEntries(signals.map((s) => [s.id, s.band])),
      namedAuthorship: bandOf('named-authorship'),
      originalEvidence: bandOf('original-evidence'),
    },
    pagesInspected: report.pagesInspected?.length ?? 0,
    access: deriveAccess(report),
  }
}

/** `<html lang="…">` from the served page, as the page itself declares it. */
export function htmlLangOf(html: string): string | null {
  const m = /<html\b[^>]*\blang\s*=\s*["']?([A-Za-z0-9_-]+)/i.exec(html.slice(0, 20_000))
  return m ? m[1] : null
}
