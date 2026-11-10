#!/usr/bin/env tsx
/**
 * The study run harness. Resumable, paced, and honest about failure.
 *
 *   npx tsx --env-file=.env.local scripts/study/run.ts --mode smoke --vantage local
 *   npx tsx --env-file=.env.local scripts/study/run.ts --mode smoke --vantage http://localhost:3108
 *   npx tsx --env-file=.env.local scripts/study/run.ts --mode study --vantage https://app.bylineseo.com
 *
 * --mode study  The real run. Refuses to start unless the vantage point is
 *               observed to be in the United States and the engine is the one
 *               pre-registered, and refuses every row that is not. Writes to a
 *               fixed directory, so a re-run resumes where the last one stopped.
 * --mode smoke  A small sample plus two deliberate failures, written to its own
 *               dated directory. Smoke rows are never study data.
 * --vantage     `local` audits from this machine. A URL audits through a
 *               deployed US function (POST /api/study/audit, needs STUDY_RUN_TOKEN).
 * --populations A,B   Which populations. Defaults to those marked `include` in config.ts.
 * --per-pop N         Spread N sites evenly through each population (smoke default 5).
 * --dir <path>        Override the output directory.
 *
 * Ctrl-C stops after the site in progress. A hard kill loses at most the
 * attempt in flight, which is simply done again: nothing is counted twice.
 * Then: npx tsx scripts/study/report.ts --dir <the run directory>
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { auditSite, type Failure, type SiteAudit } from '../../src/lib/study/audit-site'
import { Ledger, domainBudgetOk, resolveSite, type AttemptEvent, type Pacing } from '../../src/lib/study/ledger'
import { evenSample, loadPopulation, splitDuplicates, type Site } from '../../src/lib/study/populations'
import { lookupEgress, type Vantage } from '../../src/lib/study/vantage'
import { ENGINE_VERSION } from '../../src/lib/geo-audit/types'
import { ENGINE_VERSION_REQUIRED, OUT_DIR, PACING, POPULATIONS, REQUIRED_COUNTRY } from './config'
import { runReport } from './report'

const args = process.argv.slice(2)
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? (args[i + 1] ?? '') : null
}

const modeArg = flag('mode')
if (modeArg !== 'smoke' && modeArg !== 'study') {
  console.error('Usage: run.ts --mode smoke|study --vantage local|<url> [--populations A,B] [--per-pop N] [--dir path]')
  process.exit(1)
}
const mode: 'smoke' | 'study' = modeArg
const vantageArg = flag('vantage') ?? 'local'
const remoteBase = vantageArg === 'local' ? null : vantageArg.replace(/\/+$/, '')

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
let stopping = false
process.on('SIGINT', () => {
  if (stopping) process.exit(130)
  stopping = true
  console.log('\n  Stopping after the site in progress. Ctrl-C again to quit now.')
})

let activeLedger: Ledger | null = null
function die(msg: string): never {
  console.error(`\n  ✗ ${msg}\n`)
  activeLedger?.unlock()
  process.exit(1)
}

// ── pacing: study mode takes the config as written; smoke may shorten the gap ──
const pacing: Pacing = { ...PACING }
if (mode === 'smoke') pacing.siteGapSeconds = Number(flag('gap-seconds') ?? 10)
else if (flag('gap-seconds') || flag('retry-gap-hours') || flag('min-span-hours') || flag('max-attempts')) die('Pacing is fixed in config.ts for a study run; it cannot be overridden on the command line.')
if (mode === 'smoke' && flag('retry-gap-hours')) pacing.retryMinGapHours = Number(flag('retry-gap-hours'))
if (mode === 'smoke' && flag('min-span-hours')) pacing.minSpanHours = Number(flag('min-span-hours'))
if (mode === 'smoke' && flag('max-attempts')) pacing.maxAttempts = Number(flag('max-attempts'))

// ── remote call ──────────────────────────────────────────────────────────────
async function remote(path: string, body: unknown): Promise<Response> {
  const token = process.env.STUDY_RUN_TOKEN ?? ''
  if (token.length < 16) die('STUDY_RUN_TOKEN is not set (16+ characters). It must match the value on the deployed function.')
  return fetch(`${remoteBase}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(pacing.siteTimeoutMs + 15_000),
  })
}

async function observeVantage(): Promise<{ vantage: Vantage; engineVersion: string }> {
  if (!remoteBase) return { vantage: await lookupEgress({ mode: 'local' }), engineVersion: ENGINE_VERSION }
  const res = await remote('/api/study/audit', { probe: true })
  if (!res.ok) die(`The vantage function answered HTTP ${res.status} to the probe. Is STUDY_RUN_TOKEN set on it and does it match?`)
  return (await res.json()) as { vantage: Vantage; engineVersion: string }
}

async function runOne(site: Site, vantage: Vantage): Promise<SiteAudit> {
  const timeout = (): SiteAudit => ({
    ok: false,
    engineVersion: ENGINE_VERSION,
    vantage,
    failure: { kind: 'harness-timeout', httpStatus: null, message: `No result within ${pacing.siteTimeoutMs / 1000}s.` } satisfies Failure,
  })
  const work = async (): Promise<SiteAudit> => {
    if (!remoteBase) return auditSite(site.url, { vantage })
    const res = await remote('/api/study/audit', { url: site.url })
    if (res.status === 504 || res.status === 408) return timeout()
    if (!res.ok) {
      return { ok: false, engineVersion: 'unknown', vantage, failure: { kind: 'harness-error', httpStatus: res.status, message: `The vantage function answered HTTP ${res.status}.` } }
    }
    return (await res.json()) as SiteAudit
  }
  try {
    return await Promise.race([work(), sleep(pacing.siteTimeoutMs).then(timeout)])
  } catch (err) {
    return { ok: false, engineVersion: ENGINE_VERSION, vantage, failure: { kind: 'harness-error', httpStatus: null, message: err instanceof Error ? err.message : String(err) } }
  }
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  const wanted = flag('populations')?.split(',').map((s) => s.trim().toUpperCase())
  const chosen = POPULATIONS.filter((p) => (wanted ? wanted.includes(p.id) : p.include))
  if (chosen.length === 0) die('No populations selected.')
  const loaded = chosen.map(loadPopulation)

  const { unique, duplicates } = splitDuplicates(loaded)
  let sites = unique
  const perPop = flag('per-pop') ?? (mode === 'smoke' ? '5' : null)
  if (perPop) {
    sites = loaded.flatMap((p) => (Number(perPop) === 0 ? [] : evenSample(unique.filter((s) => s.population === p.config.id), Number(perPop))))
  }
  if (mode === 'smoke' && !args.includes('--no-fixtures')) {
    // Two deliberate failures, so the failure path is seen working before it matters.
    sites.push(
      { key: 'X:study-smoke-nonexistent.invalid', population: 'X', rank: 1, name: 'fixture: domain that does not resolve', url: 'https://study-smoke-nonexistent.invalid/', domain: 'study-smoke-nonexistent.invalid' },
      { key: 'X:bylineseo.com', population: 'X', rank: 2, name: 'fixture: a page that returns 404', url: 'https://bylineseo.com/study-smoke-404', domain: 'bylineseo.com' },
    )
  }

  const runDir = flag('dir') ?? (mode === 'study' ? join(OUT_DIR, `study-engine-${ENGINE_VERSION_REQUIRED}`) : join(OUT_DIR, `smoke-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')}`))
  mkdirSync(runDir, { recursive: true })
  const ledger = new Ledger(runDir)
  ledger.lock()
  activeLedger = ledger
  const finish = (code: number) => {
    ledger.unlock()
    process.exit(code)
  }

  try {
    // Guards before anything is touched.
    if (ENGINE_VERSION !== ENGINE_VERSION_REQUIRED && mode === 'study') die(`This checkout is engine ${ENGINE_VERSION}; the study is pre-registered on ${ENGINE_VERSION_REQUIRED}.`)
    const seen = await observeVantage()
    const guard = (v: Vantage, engine: string): string | null => {
      if (engine !== ENGINE_VERSION_REQUIRED) return `engine ${engine}, not ${ENGINE_VERSION_REQUIRED}`
      if (v.egressCountry !== REQUIRED_COUNTRY) return `egress country ${v.egressCountry ?? 'unknown'} (${v.lookupError ?? 'looked up'}), not ${REQUIRED_COUNTRY}`
      return null
    }
    console.log(`\n  Mode       ${mode}${mode === 'smoke' ? '  (smoke rows are never study data)' : ''}`)
    console.log(`  Vantage    ${seen.vantage.mode}  egress ${seen.vantage.egressIp ?? '?'}  ${seen.vantage.egressCountry ?? '?'}/${seen.vantage.egressRegion ?? '?'}  ${seen.vantage.egressOrg ?? ''}  platform region ${seen.vantage.platformRegion ?? '-'}`)
    console.log(`  Engine     ${seen.engineVersion}   (required ${ENGINE_VERSION_REQUIRED})`)
    console.log(`  Directory  ${runDir}`)
    const problem = guard(seen.vantage, seen.engineVersion)
    if (problem && mode === 'study') {
      ledger.append({ type: 'halt', at: new Date().toISOString(), reason: `Refused to start: ${problem}.` })
      die(`Refusing to run the study: ${problem}.\n    Deploy the vantage function in a US region and point --vantage at it. Nothing was audited.`)
    }
    if (problem) console.log(`  ! Vantage check would FAIL a study run: ${problem}. Fine for a smoke test of the row format; not study data.`)

    const now0 = new Date()
    ledger.append({
      type: 'run-start',
      at: now0.toISOString(),
      mode,
      runId: now0.toISOString(),
      vantage: seen.vantage,
      config: {
        engineRequired: ENGINE_VERSION_REQUIRED,
        requiredCountry: REQUIRED_COUNTRY,
        pacing,
        populations: loaded.map((p) => ({ id: p.config.id, label: p.config.label, file: p.config.file, rows: p.rows, sha256: p.fileSha256 })),
        sites,
      },
    })
    // Duplicates are counted every time a run starts, written once.
    const already = new Set(ledger.duplicates().map((d) => d.key))
    for (const d of duplicates) {
      if (already.has(d.site.key)) continue
      ledger.append({ type: 'duplicate', key: d.site.key, population: d.site.population, rank: d.site.rank, name: d.site.name, domain: d.site.domain, url: d.site.url, duplicateOf: d.duplicateOf.key, at: new Date().toISOString() })
    }

    // Passes: do everything eligible now. In a study run, sites that failed wait
    // for their retry window; re-run the same command later to continue.
    let done = 0
    let touched = 0
    for (const site of sites) {
      if (stopping) break
      const events = ledger.read()
      const attempts = ledger.attempts(events).filter((a) => a.key === site.key)
      const state = resolveSite(attempts, pacing, new Date())
      if (state.status === 'audited' || state.status === 'dropped' || state.status === 'unresolved') {
        done++
        continue
      }
      if (state.status === 'retry-wait') {
        console.log(`  wait   ${site.key}  failed ${state.failures.length}x, next attempt after ${state.nextEligibleAt}`)
        continue
      }
      if (!domainBudgetOk(ledger.attempts(events), site.domain, pacing, new Date())) {
        console.log(`  wait   ${site.key}  per-domain cap (${pacing.perDomainMax} per ${pacing.perDomainWindowMs / 60_000} min) reached`)
        continue
      }

      const attemptNo = attempts.length + 1
      const t0 = Date.now()
      const result = await runOne(site, seen.vantage)

      // Honesty guards on every row. A row from the wrong engine or the wrong
      // country is not recorded as data; the run halts instead of mixing.
      const bad = guard(result.vantage, result.engineVersion)
      if (bad && mode === 'study' && result.engineVersion !== 'unknown') {
        ledger.append({ type: 'halt', at: new Date().toISOString(), reason: `Halted at ${site.key}: ${bad}. That attempt was discarded.` })
        die(`Halted: the result for ${site.key} came back with ${bad}.\n    The attempt was discarded, nothing was mixed. Fix the vantage or engine, then re-run to resume.`)
      }

      let reportFile: string | undefined
      if (result.ok || result.report) reportFile = ledger.writeReport(site.key, attemptNo, { report: result.report, row: result.ok ? result.row : null, vantage: result.vantage })
      const ev: AttemptEvent = {
        type: 'attempt',
        key: site.key,
        population: site.population,
        rank: site.rank,
        name: site.name,
        domain: site.domain,
        url: site.url,
        attempt: attemptNo,
        at: new Date(t0).toISOString(),
        durationMs: Date.now() - t0,
        engineVersion: result.engineVersion,
        vantage: result.vantage,
        outcome: result.ok ? 'audited' : 'failed',
        ...(result.ok ? { row: result.row } : { failure: result.failure }),
        ...(reportFile ? { reportFile } : {}),
      }
      ledger.append(ev)
      touched++
      const r = result.ok ? result.row : null
      const fail = result.ok ? null : result.failure
      console.log(
        `  ${result.ok ? 'ok    ' : 'FAILED'} ${site.key.padEnd(34)} ` +
          (r
            ? `score ${r.scoreWithheld ? 'withheld' : r.retrievable}  citable ${r.citable.band}  baseline ${r.access.baseline?.status}${r.access.baselineRefused ? ' REFUSED' : ''}  challenge200 ${r.access.headline.challenge200Count}  ${((Date.now() - t0) / 1000).toFixed(0)}s`
            : `${fail!.kind}${fail!.httpStatus ? ` (HTTP ${fail!.httpStatus})` : ''}: ${fail!.message}`),
      )
      const last = site === sites[sites.length - 1]
      if (!last && !stopping) {
        const gap = pacing.siteGapSeconds * 1000 * (1 + (Math.random() * 2 - 1) * pacing.jitter)
        await sleep(gap)
      }
    }

    console.log(`\n  Touched ${touched} site(s) this pass; ${done} were already finished and skipped.`)
    const out = runReport(runDir, pacing)
    console.log(`  Wrote ${out.csv} and ${out.summaryFile}`)
    finish(0)
  } catch (err) {
    ledger.unlock()
    throw err
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
