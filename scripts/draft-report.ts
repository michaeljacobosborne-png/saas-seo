/**
 * Print the draft-time report for a markdown file, for reviewing the paid
 * engine against a real article before it is wired into the editor.
 *
 *   npx tsx scripts/draft-report.ts <file.md> [--brand "Acme"] [--title "..."] [--json]
 */
import { readFileSync } from 'node:fs'
import { buildDraftReport } from '../src/lib/geo-audit/draft-report'

const args = process.argv.slice(2)
const file = args.find((a) => !a.startsWith('--') && !['--brand', '--title'].includes(args[args.indexOf(a) - 1]))
const opt = (name: string) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
if (!file) {
  console.error('Usage: npx tsx scripts/draft-report.ts <file.md> [--brand "Acme"] [--title "..."] [--json]')
  process.exit(1)
}

let markdown = readFileSync(file, 'utf8')
let title = opt('--title')
// Strip YAML frontmatter, taking its title if none was given.
const fm = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)
if (fm) {
  title ??= fm[1].match(/^title:\s*"?(.+?)"?\s*$/m)?.[1]
  markdown = markdown.slice(fm[0].length)
}

const r = buildDraftReport({ markdown, articleId: file, title, brandName: opt('--brand') ?? null, now: new Date() })

if (args.includes('--json')) {
  console.log(JSON.stringify(r, null, 2))
  process.exit(0)
}

const rr = r.retrievability
console.log(`\n${r.scope}\n`)
console.log(
  rr.scoreWithheld
    ? `Structure: withheld — ${rr.withheldReason}`
    : `Structure: ${rr.score}/100 (${rr.grade}) — ${rr.rawScore} of ${rr.assessedMaxScore} assessed points (draft denominator ${rr.draftMaxScore})`,
)
console.log(`Citable:   ${r.citability.label}`)
console.log(`Gap:       ${r.gap.headline} — ${r.gap.nextStep}\n`)
for (const g of rr.groups) {
  console.log(`${g.name}: ${g.scored ? `${g.score}/${g.maxScore}` : '—'} ${g.label}`)
  for (const c of g.checks) {
    console.log(`  ${c.scored ? `${c.score}/${c.maxScore}` : '—'.padEnd(4)} ${c.name}: ${c.detail}`)
    for (const e of c.evidence.slice(0, 2)) console.log(`         ↳ ${e.snippet}`)
  }
}
console.log('\nCitability signals:')
for (const s of r.citability.signals) console.log(`  ${s.band.padEnd(10)} ${s.name}: ${s.detail}`)
if (r.notes.length) console.log(`\nNotes:\n  - ${r.notes.join('\n  - ')}`)
