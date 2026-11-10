/**
 * Record one live audit with everything it fetched, then replay it offline and
 * check the replay scores identically.
 *
 *   npx tsx --env-file=.env.local scripts/record-snapshot.ts <url> [geo|ao] [--out <file>]
 *
 * Prints the snapshot size and any difference between the live and replayed
 * scores. With --out, writes the encoded snapshot (gzip, base64) to that file.
 */
import { writeFileSync } from 'node:fs'
import { recordAudit, rescoreSnapshot } from '../src/lib/geo-audit/history'
import { encodeSnapshot } from '../src/lib/geo-audit/snapshot'

async function main() {
  const args = process.argv.slice(2)
  const outIdx = args.indexOf('--out')
  const out = outIdx >= 0 ? args[outIdx + 1] : null
  const [url, tool = 'geo'] = args.filter((a, i) => !a.startsWith('--') && (outIdx < 0 || i !== outIdx + 1))
  if (!url || (tool !== 'geo' && tool !== 'ao')) throw new Error('Usage: record-snapshot.ts <url> [geo|ao] [--out <file>]')

  const rec = await recordAudit(url, tool, { useModel: false })
  const encoded = encodeSnapshot(rec.snapshot)
  console.log(`recorded ${rec.snapshot.exchanges.length} requests, ${Object.keys(rec.snapshot.bodies).length} distinct bodies, ${Math.round(encoded.length / 1024)} KB encoded`)
  console.log(`live: Retrievable ${rec.report.scoreWithheld ? 'withheld' : rec.report.retrievability?.score}, Citable ${rec.report.citability?.band}, content ${rec.contentHash}`)

  const replay = await rescoreSnapshot(rec.snapshot)
  const checks = (r: typeof replay) => r.retrievability?.groups.flatMap((g) => g.checks.map((c) => `${c.id}=${c.score}`)) ?? []
  const signals = (r: typeof replay) => r.citability?.signals.map((s) => `${s.id}=${s.band}`) ?? []
  const probe = (r: typeof replay) => JSON.stringify(r.retrievability?.groups.find((g) => g.id === 'access')?.checks.find((c) => c.id === 'access-crawlers')?.evidence ?? [])
  const diffs = [
    ...checks(rec.report).filter((c, i) => c !== checks(replay)[i]).map((c) => `check ${c} vs ${checks(replay).find((x) => x.startsWith(c.split('=')[0]))}`),
    ...signals(rec.report).filter((s, i) => s !== signals(replay)[i]).map((s) => `signal ${s}`),
    ...(probe(rec.report) === probe(replay) ? [] : ['crawler evidence differs']),
  ]
  console.log(`replay: Retrievable ${replay.scoreWithheld ? 'withheld' : replay.retrievability?.score}, Citable ${replay.citability?.band}`)
  console.log(diffs.length ? `DIFFERENCES:\n${diffs.join('\n')}` : 'replay identical to the live run')
  if (out) writeFileSync(out, encoded)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
