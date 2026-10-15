/**
 * Run a live audit and archive the full output, for outreach, the blog and
 * worked examples. Every real audit run during testing goes through this.
 *
 *   npx tsx scripts/save-audit.ts <url> [geo|ao]
 *
 * Writes, under BYLINE_AUDIT_DIR (default C:\Users\ozzy5\Documents\byline-audits):
 *   <domain>/<YYYY-MM-DD>_<HHMMSS>Z_<path>_<tool>.json   full AuditReport plus the raw crawler probe
 *   <domain>/<YYYY-MM-DD>_<HHMMSS>Z_<path>_<tool>.md     human-readable summary with evidence
 * (<path> is the page path as a slug, or "home"; files before 2026-10-02 lack it)
 * and appends one line to INDEX.md at the root.
 *
 *   npx tsx scripts/save-audit.ts <url> [geo|ao] --share
 *
 * --share also saves the report to the database and prints a link a prospect
 * can open (/report/<token>), for outreach. It never goes through the public
 * unlock flow and never calls the lead route, so no email is sent to anyone.
 * Rows are written with source "outreach", a fixed internal address that
 * nothing sends to, no user, and no promoted score columns, so they never
 * appear in a dashboard and never enter a benchmark.
 */
import { config } from 'dotenv'
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

config({ path: '.env.local', quiet: true })
config({ path: 'C:/dev/Byline/.env.local', quiet: true })

const ROOT = process.env.BYLINE_AUDIT_DIR || 'C:\\Users\\ozzy5\\Documents\\byline-audits'

async function shareReport(report: { url: string; finalUrl?: string }, tool: 'geo' | 'ao'): Promise<{ reportUrl: string; resultsUrl: string }> {
  const { createServiceClient } = await import('../src/lib/supabase/service')
  const { outreachRow, reportLinks } = await import('../src/lib/outreach-report')
  // Straight to the table: never the lead route, so nothing is emailed.
  const { data, error } = await createServiceClient()
    .from('audit_results')
    .insert(outreachRow(report, tool))
    .select('id, share_token')
    .single()
  if (error || !data) throw new Error(`Could not save the shareable report: ${error?.message ?? 'no row returned'}`)
  return reportLinks(data as { id: string; share_token: string })
}

async function main() {
  const args = process.argv.slice(2)
  const share = args.includes('--share')
  const [rawUrl, rawTool = 'geo'] = args.filter((a) => !a.startsWith('--'))
  if (!rawUrl || (rawTool !== 'geo' && rawTool !== 'ao')) {
    console.error('Usage: npx tsx scripts/save-audit.ts <url> [geo|ao] [--share]')
    process.exit(1)
  }
  // Imported after dotenv so the engine sees the keys.
  const { runAudit } = await import('../src/lib/geo-audit')
  const { normaliseUrl, BYLINE_USER_AGENT } = await import('../src/lib/geo-audit/fetch')
  const { probeCrawlerAccess } = await import('../src/lib/geo-audit/crawler-access')
  const { fetchRobotsTxt } = await import('../src/lib/geo-audit/robots')

  const url = normaliseUrl(rawUrl)
  const now = new Date()
  // robots.txt first, so each probe row can show what the site declares beside
  // what the origin did (the divergence is the practitioner-relevant finding).
  const robots = await fetchRobotsTxt(url, { userAgent: BYLINE_USER_AGENT }).then((r) => r.parsed ?? null, () => null)
  const [outcome, probe] = await Promise.all([
    runAudit(url, rawTool, { now, onProgress: (m) => console.error(`  ${m}`) }).then(
      (report) => ({ report, error: null as string | null }),
      (err: unknown) => ({ report: null, error: err instanceof Error ? err.message : String(err) }),
    ),
    probeCrawlerAccess(url, { now, robots }).catch(() => null),
  ])

  // Date, time to the second, and the page path, so two runs on one domain in
  // the same minute, or on different pages, never overwrite each other.
  const time = now.toISOString().replace(/\.\d{3}Z$/, 'Z').replace('T', '_').replace(/:/g, '')
  const pathSlug = (() => {
    try {
      const p = new URL(url).pathname.replace(/^\/+|\/+$/g, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
      return p ? `_${p.slice(0, 60)}` : '_home'
    } catch {
      return ''
    }
  })()
  const stamp = `${time}${pathSlug}`
  const domainOf = (u: string) => new URL(u).hostname.replace(/^www\./, '')
  const index = join(ROOT, 'INDEX.md')
  const ensureIndex = () => {
    if (!existsSync(index)) writeFileSync(index, '# Byline audit archive\n\ndate | domain | tool | retrievability | citability | file | finding types | engine\n---|---|---|---|---|---|---|---\n')
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
          ...probe.probes.map((p) => `- ${p.token} (${p.class}): HTTP ${p.status ?? '—'}, ${p.blockKind}, robots ${p.robotsVerdict}${p.attributable ? '' : ', NOT attributable'}${p.divergence ? `, DIVERGENCE ${p.divergence}` : ''}. ${p.evidence}`),
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
    `${now.toISOString().slice(0, 10)} | ${domain} | ${rawTool} | ${r.scoreWithheld ? 'withheld' : r.score} | ${report.citability.label} | ${domain}/${stamp}_${rawTool}.md | ${findingTags(report, probe).join(', ')} | ${report.engineVersion}\n`,
  )
  console.log(`${base}.json`)
  console.log(`${base}.md`)

  if (share) {
    const links = await shareReport(report, rawTool)
    // Kept beside the archived report so the link can be found again later.
    appendFileSync(`${base}.md`, `\n\n## Shared\n- Report link (for the prospect): ${links.reportUrl}\n- Results page: ${links.resultsUrl}\n`)
    console.log(`SHARE LINK: ${links.reportUrl}`)
  }
}

/**
 * Searchable finding types for INDEX.md, so "every site with a broken JSON-LD
 * block" can be found without opening every report. Derived only from what the
 * report states; a crawler row is never tagged blocked when the baseline failed.
 */
type Check = { id: string; score: number; maxScore: number; scored: boolean; detail: string }
type ProbeRow = { class: string; attributable: boolean; contentServed: boolean; blockKind: string; divergence: string | null }
function findingTags(
  report: { retrievability: { scoreWithheld: boolean; groups: { checks: Check[] }[] }; citability: { signals: { id: string; band: string; detail: string }[] } },
  probe: { baselineFailed: boolean; probes: ProbeRow[] } | null,
): string[] {
  const tags: string[] = []
  const checks = Object.fromEntries(report.retrievability.groups.flatMap((g) => g.checks).map((c) => [c.id, c]))
  const signal = Object.fromEntries(report.citability.signals.map((s) => [s.id, s]))
  const POLICY = new Set(['edge-block', 'bot-management', 'origin-block'])

  if (report.retrievability.scoreWithheld) tags.push('score-withheld')
  if (probe) {
    const search = probe.probes.filter((p) => p.class === 'ai-search')
    if (probe.baselineFailed) tags.push('crawler-unknown')
    else if (search.some((p) => p.attributable && !p.contentServed && POLICY.has(p.blockKind))) tags.push('crawler-blocked')
    if (probe.probes.some((p) => p.divergence)) tags.push('robots-origin-divergence')
  }
  if (/syntax error/.test(checks['parse-structured-data']?.detail ?? '')) tags.push('jsonld-parse-error')
  if (checks['access-indexing']?.scored && checks['access-indexing'].score === 0) tags.push('noindex')
  if (checks['extract-answers']?.scored && checks['extract-answers'].score === 0) tags.push('no-direct-answer')
  if (checks['extract-questions']?.scored && checks['extract-questions'].score === 0) tags.push('no-question-headings')
  if (checks['chunk-sections']?.scored && checks['chunk-sections'].score <= 2) tags.push('thin-sections')
  if (signal['named-authorship']?.band === 'absent') tags.push('no-named-author')
  if (['weak', 'absent'].includes(signal['entity-resolution']?.band ?? '')) tags.push('entity-weak')
  if (/year\(s\) ago/.test(signal['freshness-provenance']?.detail ?? '')) tags.push('stale-date')
  if (signal['original-evidence']?.band === 'absent') tags.push('no-original-evidence')
  return tags.length ? tags : ['clean']
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
