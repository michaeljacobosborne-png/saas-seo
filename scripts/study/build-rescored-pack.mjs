// Build the 2026.16 study dataset from the 2026.15 ledger and a regenerate-citability.mts output, then analyse it.
//   node scripts/study/build-rescored-pack.mjs <regen.json>... <out dir>
// Rows the re-score covered carry engineVersion 2026.16 and originalEngineVersion 2026.15 with a rescore record.
// Rows it could not cover keep 2026.15 and say why. Later regen files override earlier ones, per site.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
const args = process.argv.slice(2)
const out = args.pop()
const regenFiles = args
const DIR = 'C:/Users/ozzy5/Documents/byline-study-runs/study-engine-2026.15'
const S = readFileSync(`${DIR}/sites.jsonl`, 'utf8').trim().split('\n').map(JSON.parse)
const byKey = new Map(); let code = null
for (const f of regenFiles) { const d = JSON.parse(readFileSync(f, 'utf8')); code = d.code ?? code; for (const r of d.rows) if (!byKey.has(r.key) || r.fetch === 'ok') byKey.set(r.key, r) }
const SIG = ['named-authorship', 'entity-resolution', 'brand-proximity', 'original-evidence', 'proprietary-terms', 'freshness-provenance']
const summary = { rescored: 0, notRescored: [], bandMoves: [], signalMoves: [], retrievableMoves: [], pageDrift: 0 }
for (const s of S) {
  if (!s.row) continue
  const r = byKey.get(s.key)
  const ok = r && r.fetch === 'ok' && r.old && r.new && r.old.meaningful && r.new.meaningful && r.old.engineVersion === '2026.15' && r.new.engineVersion === '2026.16'
  if (!ok) { s.rescore = { status: 'not re-scored', reason: !r ? 'no record' : r.fetch !== 'ok' ? r.fetch : 'no readable content on re-fetch' }; summary.notRescored.push(s.key); continue }
  const changed = []
  const c = s.row.citable
  for (const g of SIG) { const a = r.old.citable.signals[g].band, b = r.new.citable.signals[g].band; if (a !== b) { c.counts[a] -= 1; c.counts[b] = (c.counts[b] ?? 0) + 1; c.signals[g] = b; if (g === 'named-authorship') c.namedAuthorship = b; if (g === 'original-evidence') c.originalEvidence = b; changed.push(`${g} ${a}->${b}`); summary.signalMoves.push([s.key, g, a, b]) } }
  if (r.old.citable.band !== r.new.citable.band) { c.band = r.new.citable.band; changed.push(`band ${r.old.citable.band}->${r.new.citable.band}`); summary.bandMoves.push([s.key, r.old.citable.band, r.new.citable.band]) }
  const ro = r.old.retrievable, rn = r.new.retrievable
  if (ro.score !== rn.score) { s.row.retrievable += rn.score - ro.score; s.row.grade = rn.grade; s.row.pillars.parseability.score += rn.parseability - ro.parseability; changed.push(`retrievable ${ro.score}->${rn.score}`); summary.retrievableMoves.push([s.key, ro.score, rn.score]) }
  const sameAsStudy = s.row.citable && r.storedCitable.band === r.old.citable.band && SIG.every((g) => r.storedCitable.signals[g] === r.old.citable.signals[g].band) && r.storedRetrievable.score === ro.score
  if (!sameAsStudy) summary.pageDrift++
  s.originalEngineVersion = s.engineVersion
  s.engineVersion = '2026.16'
  s.row.engineVersion = '2026.16'
  s.rescore = { status: 're-scored', engineVersion: '2026.16', comparedAgainst: '2026.15', basis: 'Study row from the 12 Nov 2026 US-vantage run (engine 2026.15). The engine-only difference between 2026.15 and 2026.16 was measured on identical pages fetched 17 to 19 Nov 2026 and applied. Where the two dates\' pages differed (pageDrift), the difference is inferred, not measured on the study page.', pageDrift: !sameAsStudy, changed }
  summary.rescored++
}
mkdirSync(out, { recursive: true })
writeFileSync(join(out, 'sites.jsonl'), S.map((x) => JSON.stringify(x)).join('\n') + '\n')
writeFileSync(join(out, 'rescore-manifest.json'), JSON.stringify({ builtAt: new Date().toISOString(), regenFiles, code, ...summary }, null, 2))
console.log(JSON.stringify({ code, rescored: summary.rescored, notRescored: summary.notRescored.length, bandMoves: summary.bandMoves, signalMoves: summary.signalMoves, retrievableMoves: summary.retrievableMoves, pageDriftRows: summary.pageDrift }))
execFileSync('node', ['scripts/study/analyse.mjs', out, out], { stdio: 'inherit' })
