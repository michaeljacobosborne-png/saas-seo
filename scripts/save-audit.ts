/**
 * Run a live audit and archive the full output, for outreach, the blog and
 * worked examples. Every real audit run during testing goes through this.
 *
 *   npx tsx scripts/save-audit.ts <url> [geo|ao]
 *
 * Writes, under BYLINE_AUDIT_DIR (default C:\Users\ozzy5\Documents\byline-audits):
 *   <domain>/<YYYY-MM-DD>_<HHMM>Z_<tool>.json   full AuditReport plus the raw crawler probe
 *   <domain>/<YYYY-MM-DD>_<HHMM>Z_<tool>.md     human-readable summary with evidence
 * and appends one line to INDEX.md at the root.
 */
import { config } from 'dotenv'
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

config({ path: '.env.local', quiet: true })
config({ path: 'C:/dev/Byline/.env.local', quiet: true })

const ROOT = process.env.BYLINE_AUDIT_DIR || 'C:\\Users\\ozzy5\\Documents\\byline-audits'

async function main() {
  const [rawUrl, rawTool = 'geo'] = process.argv.slice(2)
  if (!rawUrl || (rawTool !== 'geo' && rawTool !== 'ao')) {
    console.error('Usage: npx tsx scripts/save-audit.ts <url> [geo|ao]')
    process.exit(1)
  }
  // Imported after dotenv so the engine sees the keys.
  const { runAudit } = await import('../src/lib/geo-audit')
  const { normaliseUrl } = await import('../src/lib/geo-audit/fetch')
  const { probeCrawlerAccess } = await import('../src/lib/geo-audit/crawler-access')

  const url = normaliseUrl(rawUrl)
  const now = new Date()
  const [outcome, probe] = await Promise.all([
    runAudit(url, rawTool, { now, onProgress: (m) => console.error(`  ${m}`) }).then(
      (report) => ({ report, error: null as string | null }),
      (err: unknown) => ({ report: null, error: err instanceof Error ? err.message : String(err) }),
    ),
    probeCrawlerAccess(url, { now }).catch(() => null),
  ])

  const stamp = now.toISOString().replace(/:\d{2}\.\d{3}Z$/, 'Z').replace('T', '_').replace(':', '')
  const domainOf = (u: string) => new URL(u).hostname.replace(/^www\./, '')
  const index = join(ROOT, 'INDEX.md')
  const ensureIndex = () => {
    if (!existsSync(index)) writeFileSync(index, '# Byline audit archive\n\ndate | domain | tool | retrievability | citability | file\n---|---|---|---|---|---\n')
  }

  // A refused or failed audit is still a finding (e.g. an origin that 403s
  // every non-browser request), so it is archived rather than discarded.
  if (!outcome.report) {
    const domain = domainOf(url)
    const dir = join(ROOT, domain)
    mkdirSync(dir, { recursive: true })
    const base = join(dir, `${stamp}_${rawTool}_failed`)
    writeFileSync(`${base}.json`, JSON.stringify({ url, error: outcome.error, crawlerProbe: probe }, null, 2))
    writeFileSync(
      `${base}.md`,
      [
        `# ${domain} — ${rawTool.toUpperCase()} audit could not run, ${now.toISOString()}`,
        '',
        `Error: ${outcome.error}`,
        '',
        '## Crawler probe',
        ...(probe
          ? [
              `Baseline browser request: HTTP ${probe.baseline.status ?? 'no response'}${probe.baselineFailed ? ' (FAILED, so every row is unknown, not blocked)' : ''}`,
              ...probe.probes.map((p) => `- ${p.token} (${p.class}): HTTP ${p.status ?? '—'}, ${p.blockKind}. ${p.evidence}`),
              ...probe.caveats.map((c) => `> ${c}`),
            ]
          : ['Probe did not complete.']),
      ].join('\n'),
    )
    ensureIndex()
    appendFileSync(index, `${now.toISOString().slice(0, 10)} | ${domain} | ${rawTool} | not run: ${outcome.error} | — | ${domain}/${stamp}_${rawTool}_failed.md\n`)
    console.log(`${base}.md`)
    return
  }

  const report = outcome.report
  const domain = domainOf(report.finalUrl || url)
  const dir = join(ROOT, domain)
  mkdirSync(dir, { recursive: true })
  const base = join(dir, `${stamp}_${rawTool}`)

  writeFileSync(`${base}.json`, JSON.stringify({ report, crawlerProbe: probe }, null, 2))

  const r = report.retrievability
  const lines = [
    `# ${domain} — ${rawTool.toUpperCase()} audit, ${now.toISOString()}`,
    '',
    `URL: ${url} → ${report.finalUrl}`,
    `Retrievability: ${r.scoreWithheld ? `withheld (${r.withheldReason})` : `${r.score}/100 (${r.grade}), confidence ${r.confidence}`}`,
    `Citability: ${report.citability.label}`,
    `Gap: ${report.gap.headline}. ${report.gap.diagnosis}`,
    '',
    'This is an assessment of content readiness, not a measurement of AI visibility.',
    '',
    '## Retrievability',
    ...r.groups.flatMap((g) => [
      `### ${g.name}: ${g.scored ? `${g.score}/${g.maxScore}` : '—'} (${g.label})`,
      ...g.checks.flatMap((c) => [
        `- **${c.name}** ${c.scored ? `${c.score}/${c.maxScore}` : '—'}: ${c.detail}`,
        ...c.evidence.slice(0, 3).map((e) => `  - evidence (${e.kind}, ${e.url}): ${e.snippet}`),
      ]),
    ]),
    '',
    '## Citability',
    ...report.citability.signals.flatMap((s) => [
      `- **${s.name}**: ${s.band}. ${s.detail}`,
      ...s.evidence.slice(0, 2).map((e) => `  - evidence (${e.kind}): ${e.snippet}`),
    ]),
    '',
    '## Crawler probe',
    ...(probe
      ? [
          `Baseline browser request: HTTP ${probe.baseline.status ?? 'no response'}${probe.baselineFailed ? ' (FAILED, so every row is unknown)' : ''}`,
          ...probe.probes.map((p) => `- ${p.token} (${p.class}): HTTP ${p.status ?? '—'}, ${p.blockKind}, robots ${p.robotsVerdict}. ${p.evidence}`),
          ...probe.caveats.map((c) => `> ${c}`),
        ]
      : ['Probe did not complete.']),
    '',
    '## Recommendations',
    ...report.recommendations.map((x) => `- [${x.priority}] ${x.title}: ${x.description}`),
  ]
  writeFileSync(`${base}.md`, lines.join('\n'))

  ensureIndex()
  appendFileSync(
    index,
    `${now.toISOString().slice(0, 10)} | ${domain} | ${rawTool} | ${r.scoreWithheld ? 'withheld' : r.score} | ${report.citability.label} | ${domain}/${stamp}_${rawTool}.md\n`,
  )
  console.log(`${base}.json`)
  console.log(`${base}.md`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
