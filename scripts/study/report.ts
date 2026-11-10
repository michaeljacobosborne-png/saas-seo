#!/usr/bin/env tsx
/**
 * Build the publishable files from a run directory's ledger. Safe to run at any
 * point, including mid-run: it only reads the ledger.
 *
 *   npx tsx scripts/study/report.ts --dir <run directory>
 *
 * Writes, beside the ledger:
 *   sites.jsonl     one full result per site (the row, every attempt, the vantage)
 *   sites.csv       one flat line per site
 *   summary.json    counts per population: audited, dropped by reason, unresolved, headline tallies
 *   summary.md      the same, readable
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Ledger, type Pacing } from '../../src/lib/study/ledger'
import { buildResults, flatten, summarise } from '../../src/lib/study/report'
import { PACING } from './config'

const csvCell = (v: unknown) => {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function runReport(dir: string, pacing: Pacing = PACING): { csv: string; summaryFile: string } {
  const ledger = new Ledger(dir)
  const now = new Date()
  const results = buildResults(ledger.read(), pacing, now)
  const summary = summarise(results, now)

  writeFileSync(join(dir, 'sites.jsonl'), results.map((r) => JSON.stringify(r)).join('\n') + '\n')

  const flat = results.map(flatten)
  const cols: string[] = []
  for (const f of flat) for (const k of Object.keys(f)) if (!cols.includes(k)) cols.push(k)
  writeFileSync(join(dir, 'sites.csv'), [cols.join(','), ...flat.map((f) => cols.map((c) => csvCell(f[c])).join(','))].join('\n') + '\n')

  writeFileSync(join(dir, 'summary.json'), JSON.stringify(summary, null, 2))

  const lines: string[] = [`# Study run summary`, '', `Generated ${summary.generatedAt}`, '']
  lines.push(`Engine versions in audited rows: ${summary.engineVersions.join(', ') || 'none'}`)
  lines.push(`Egress countries in audited rows: ${summary.egressCountries.join(', ') || 'none'}   platform regions: ${summary.platformRegions.join(', ') || 'none'}`)
  lines.push(`Consistent (one engine, one US vantage): **${summary.consistent ? 'yes' : 'NO, resolve before publishing'}**`, '')
  for (const [id, p] of Object.entries(summary.populations)) {
    lines.push(`## Population ${id}`, '')
    lines.push(`- in the file: ${p.sites}, duplicates: ${p.duplicates}, audited: ${p.audited}, outstanding: ${p.outstanding}`)
    lines.push(`- dropped (rule reasons): ${Object.entries(p.dropped).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}`)
    lines.push(`- unresolved, need a ruling: ${Object.entries(p.unresolved).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}`, '')
  }
  lines.push('## Access findings (denominator = audited sites whose crawler probe ran)', '')
  lines.push('| group | audited | 200 that is a challenge | ...browser served | robots permits, origin refuses | vendor asymmetry | browser refused | score withheld | possibly localised |', '|---|---|---|---|---|---|---|---|---|')
  for (const [g, t] of Object.entries(summary.tally)) {
    lines.push(`| ${g} | ${t.audited} | ${t.challenge200} | ${t.challenge200WithBrowserServed} | ${t.robotsPermitsOriginRefuses} | ${t.vendorAsymmetry} | ${t.baselineRefused} | ${t.scoreWithheld} | ${t.possiblyLocalised} |`)
  }
  const summaryFile = join(dir, 'summary.md')
  writeFileSync(summaryFile, lines.join('\n') + '\n')
  return { csv: join(dir, 'sites.csv'), summaryFile }
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/study/report.ts')) {
  const i = process.argv.indexOf('--dir')
  const dir = i >= 0 ? process.argv[i + 1] : null
  if (!dir) {
    console.error('Usage: report.ts --dir <run directory>')
    process.exit(1)
  }
  const out = runReport(dir)
  console.log(`Wrote ${out.csv} and ${out.summaryFile}`)
}
