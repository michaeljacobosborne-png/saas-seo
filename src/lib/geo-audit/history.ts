/**
 * Score over time: record a run with everything it fetched, and re-score any
 * recorded run on the engine that is running now.
 *
 * The promise is "proves it changed". A comparison is only honest when both
 * sides were scored by the same rules, so `compareOverTime` replays both
 * snapshots through the current engine before diffing them. Engine changes
 * then cancel out, and what is left is a change in the page. A content
 * fingerprint on each side says whether the page text changed at all.
 *
 * Raw fetches only. A rendered fetch goes to a third-party render service
 * outside the recorded transport, so it is never recorded and never replayed.
 */
import { createHash } from 'node:crypto'
import { runAudit, type RunAuditOptions } from './index'
import { httpFetch } from './http'
import { compareAudits, type AuditComparison } from './compare'
import { extractPage } from './extract'
import { recordingFetch, replayFetch, snapshotBody, SNAPSHOT_VERSION, type AuditSnapshot } from './snapshot'
import { ENGINE_VERSION, type AuditReport } from './types'

/** Options both the recording and every replay must share, so they score the same inputs. */
const RUN_OPTIONS = { crawl: true, maxCrawlPages: 3, renderMode: 'raw' as const }

export interface RecordedAudit {
  report: AuditReport
  snapshot: AuditSnapshot
  /** Hash of the page's readable main text: equal hashes mean the words did not change. */
  contentHash: string
}

/** sha256 of the normalised main text, short form. Markup changes that move no words do not change it. */
export function contentFingerprint(html: string, url: string): string {
  const text = extractPage(html, url).mainText.replace(/\s+/g, ' ').trim().toLowerCase()
  return createHash('sha256').update(text).digest('hex').slice(0, 16)
}

function homeHtml(snapshot: AuditSnapshot, finalUrl: string): string {
  const ex = snapshot.exchanges.find((e) => e.finalUrl === finalUrl && e.body && e.status && e.status < 400)
  return ex?.body ? snapshotBody(snapshot, ex.body).toString('utf8') : ''
}

export async function recordAudit(
  url: string,
  tool: 'geo' | 'ao',
  opts: Pick<RunAuditOptions, 'now' | 'useModel' | 'onProgress' | 'expectedAuthor' | 'fetchImpl'> = {},
): Promise<RecordedAudit> {
  const now = opts.now ?? new Date()
  const rec = recordingFetch(opts.fetchImpl ?? httpFetch)
  const report = await runAudit(url, tool, { ...opts, ...RUN_OPTIONS, now, fetchImpl: rec.fetchImpl })
  const snapshot: AuditSnapshot = {
    version: SNAPSHOT_VERSION,
    recordedAt: now.toISOString(),
    engineVersion: ENGINE_VERSION,
    url: report.url,
    tool,
    exchanges: rec.exchanges,
    bodies: rec.bodies,
  }
  return { report, snapshot, contentHash: contentFingerprint(homeHtml(snapshot, report.finalUrl), report.finalUrl) }
}

/** The recorded run, scored by today's engine. No network, no model. */
export async function rescoreSnapshot(snapshot: AuditSnapshot): Promise<AuditReport> {
  return runAudit(snapshot.url, snapshot.tool, {
    ...RUN_OPTIONS,
    now: new Date(snapshot.recordedAt),
    useModel: false,
    fetchImpl: replayFetch(snapshot),
  })
}

export interface OverTime {
  comparison: AuditComparison
  /** Engine version both sides were re-scored on. */
  engineVersion: string
  /** Whether the readable text of the page changed between the two runs. */
  contentChanged: boolean
  /** The versions each run was originally scored on, for the record. */
  recordedOn: { from: string; to: string }
}

/** Re-scores both runs on the current engine, then diffs them. */
export async function compareOverTime(earlier: AuditSnapshot, later: AuditSnapshot): Promise<OverTime> {
  const [a, b] = earlier.recordedAt <= later.recordedAt ? [earlier, later] : [later, earlier]
  const [ra, rb] = await Promise.all([rescoreSnapshot(a), rescoreSnapshot(b)])
  const ha = contentFingerprint(homeHtml(a, ra.finalUrl), ra.finalUrl)
  const hb = contentFingerprint(homeHtml(b, rb.finalUrl), rb.finalUrl)
  return {
    comparison: compareAudits(ra, rb),
    engineVersion: ENGINE_VERSION,
    contentChanged: ha !== hb,
    recordedOn: { from: a.engineVersion, to: b.engineVersion },
  }
}
