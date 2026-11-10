/**
 * Run the study's audit of one homepage and classify what happened.
 *
 * Used by both vantage modes: directly by the local harness, and by the
 * authenticated route a deployed US function serves. One code path, so a row
 * means the same thing wherever it was produced.
 *
 * A failure is data. Every outcome that is not an audited page comes back as a
 * `failure` with a kind and the reason in the engine's own words, never as a
 * thrown error and never as a gap.
 *
 * What counts as a failed attempt for the pre-registered disqualifications:
 *   dns        the domain does not resolve              (disqualification 1)
 *   http-404   the homepage returns 404                 (disqualification 2)
 *   http-5xx   the homepage returns a server error      (disqualification 2)
 * A 401, 403 or 429 on the page is NOT a failure: the engine still reads
 * robots.txt and runs the crawler probe, and a refusal is a finding. Timeouts,
 * TLS faults and refused connections are recorded as failures that are not
 * disqualifying: the rule does not list them, so they are surfaced for a ruling
 * rather than dropped or counted silently.
 */
import { promises as dnsPromises } from 'node:dns'
import { AuditError } from '@/lib/geo-audit'
import { recordAudit } from '@/lib/geo-audit/history'
import { snapshotBody } from '@/lib/geo-audit/snapshot'
import { ENGINE_VERSION, type AuditReport } from '@/lib/geo-audit/types'
import { deriveRow, htmlLangOf, type StudyRow } from './derive'
import { lookupEgress, type Vantage } from './vantage'

export type FailureKind =
  | 'dns'
  /** The engine could not resolve the name, but an independent lookup then could (or failed in a way that is not "no such domain"). A hiccup, not a disqualification. */
  | 'dns-transient'
  | 'http-404'
  | 'http-5xx'
  | 'timeout'
  | 'tls'
  | 'connection-refused'
  | 'not-html'
  | 'http-other'
  | 'unreachable-other'
  | 'harness-timeout'
  | 'harness-error'

/** The kinds the selection rule lists as grounds for dropping a site. */
export const DISQUALIFYING: ReadonlySet<FailureKind> = new Set(['dns', 'http-404', 'http-5xx'])

export interface Failure {
  kind: FailureKind
  httpStatus: number | null
  /** The engine's own sentence, or the harness's. */
  message: string
}

export type SiteAudit =
  | { ok: true; engineVersion: string; vantage: Vantage; report: AuditReport; row: StudyRow }
  | { ok: false; engineVersion: string; vantage: Vantage; failure: Failure; report?: AuditReport }

export function classifyFailure(status: number | null, message: string): Failure {
  const m = message || ''
  let kind: FailureKind = 'unreachable-other'
  if (/could not be resolved|ENOTFOUND|getaddrinfo/i.test(m)) kind = 'dns'
  else if (status === 404) kind = 'http-404'
  else if (status !== null && status >= 500) kind = 'http-5xx'
  else if (/did not respond in time|timeout|abort/i.test(m)) kind = 'timeout'
  else if (/certificate|SSL|TLS/i.test(m)) kind = 'tls'
  else if (/refused the connection|ECONNREFUSED/i.test(m)) kind = 'connection-refused'
  else if (/not a web page/i.test(m)) kind = 'not-html'
  else if (status !== null) kind = 'http-other'
  return { kind, httpStatus: status, message: m }
}

/**
 * The engine words every resolver failure as "could not be resolved", including
 * a resolver that timed out (EAI_AGAIN). "The domain does not resolve" is a
 * disqualification, so it is only claimed after an independent lookup, from the
 * same machine, agrees: no such domain (ENOTFOUND) or no address records
 * (ENODATA). If the name resolves now, or the lookup itself failed, the attempt
 * is a transient failure and cannot count towards dropping the site.
 */
export async function refineDnsFailure(
  failure: Failure,
  url: string,
  lookup: (host: string) => Promise<unknown> = (h) => dnsPromises.lookup(h, { all: true }),
): Promise<Failure> {
  if (failure.kind !== 'dns') return failure
  let host = ''
  try {
    host = new URL(url).hostname
  } catch {
    return failure
  }
  try {
    await lookup(host)
    return { ...failure, kind: 'dns-transient', message: `${failure.message} [independent lookup of ${host} succeeded, so this was a resolver hiccup]` }
  } catch (err) {
    const code = (err as { code?: string }).code ?? 'unknown'
    if (code === 'ENOTFOUND' || code === 'ENODATA') return { ...failure, message: `${failure.message} [independent lookup of ${host}: ${code}]` }
    return { ...failure, kind: 'dns-transient', message: `${failure.message} [independent lookup of ${host} failed with ${code}, which is not "no such domain"]` }
  }
}

export async function auditSite(
  url: string,
  opts: { now?: Date; vantage?: Vantage; fetchImpl?: typeof fetch } = {},
): Promise<SiteAudit> {
  const now = opts.now ?? new Date()
  const vantage = opts.vantage ?? (await lookupEgress({ mode: 'local' }))
  try {
    // useModel false: the numbers come from code either way, and a study row
    // must not depend on a language model's wording.
    const run = await recordAudit(url, 'geo', { now, useModel: false, fetchImpl: opts.fetchImpl })
    const report = run.report

    // A homepage that answers with a server error is a failed attempt under the
    // selection rule, even though the engine still reports on robots.txt and the probe.
    const status = report.chainOfCustody?.httpStatus ?? null
    if (status !== null && status >= 500) {
      return {
        ok: false,
        engineVersion: report.engineVersion ?? ENGINE_VERSION,
        vantage,
        report,
        failure: classifyFailure(status, `The site returned a server error to our request (HTTP ${status}).`),
      }
    }

    const home = run.snapshot.exchanges.find((e) => e.finalUrl === report.finalUrl && e.body && e.status && e.status < 400)
    const html = home?.body ? snapshotBody(run.snapshot, home.body).toString('utf8') : ''
    const contentLanguage = home?.headers.find(([k]) => k.toLowerCase() === 'content-language')?.[1] ?? null
    const row = deriveRow(report, { htmlLang: html ? htmlLangOf(html) : null, contentLanguage })
    return { ok: true, engineVersion: report.engineVersion ?? ENGINE_VERSION, vantage, report, row }
  } catch (err) {
    if (err instanceof AuditError) {
      const failure = await refineDnsFailure(classifyFailure(err.status, err.message), url)
      return { ok: false, engineVersion: ENGINE_VERSION, vantage, failure }
    }
    return {
      ok: false,
      engineVersion: ENGINE_VERSION,
      vantage,
      failure: { kind: 'harness-error', httpStatus: null, message: err instanceof Error ? err.message : String(err) },
    }
  }
}
