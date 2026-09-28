#!/usr/bin/env tsx
/**
 * CLI for the AI crawler access probe.
 *
 *   npx tsx scripts/crawler-access.ts https://example.com
 *   npx tsx scripts/crawler-access.ts https://example.com --json
 *
 * Fetches robots.txt first so each row can show what the site declares next to
 * what the origin actually did.
 */

import { probeCrawlerAccess, summarise, isPolicyBlock } from '../src/lib/geo-audit/crawler-access'
import { fetchRobotsTxt } from '../src/lib/geo-audit/robots'

const KIND_LABEL: Record<string, string> = {
  none: 'served',
  'robots-disallow': 'robots.txt disallow',
  'edge-block': 'blocked at edge',
  'bot-management': 'bot challenge',
  'rate-limited': 'rate limited',
  'origin-block': 'blocked at origin',
  'not-found': 'not found',
  'server-error': 'server error',
  'network-error': 'no response',
}

async function main() {
  const args = process.argv.slice(2)
  const asJson = args.includes('--json')
  const url = args.find((a) => !a.startsWith('--'))
  if (!url) {
    console.error('Usage: npx tsx scripts/crawler-access.ts <url> [--json]')
    process.exit(1)
  }

  let robots = null
  try {
    const r = await fetchRobotsTxt(new URL(url).origin)
    robots = r.parsed ?? null
  } catch {
    robots = null
  }

  const report = await probeCrawlerAccess(url, { robots })
  const s = summarise(report)

  if (asJson) {
    console.log(JSON.stringify({ report, summary: s }, null, 2))
    return
  }

  console.log('')
  console.log(`  ${report.url}`)
  console.log(`  checked ${report.checkedAt}`)
  console.log('')
  console.log(
    `  baseline (browser)   HTTP ${report.baseline.status ?? '—'}  ` +
      `${report.baseline.contentServed ? 'content served' : 'NO CONTENT'}  ` +
      `${report.baseline.bytes.toLocaleString()} bytes  ${report.baseline.ms}ms`,
  )
  console.log('')

  const pad = (s: string, n: number) => (s.length >= n ? s : s + ' '.repeat(n - s.length))

  for (const cls of ['ai-search', 'training'] as const) {
    const rows = report.probes.filter((p) => p.class === cls)
    if (!rows.length) continue
    console.log(`  ${cls === 'ai-search' ? 'RETRIEVAL (affects AI answers)' : 'TRAINING (reported, never scored)'}`)
    for (const p of rows) {
      const mark = !p.attributable ? '?   ' : p.contentServed ? 'ok  ' : isPolicyBlock(p.blockKind) ? 'BLOCK' : '?   '
      console.log(
        `   ${mark} ${pad(p.token, 16)} HTTP ${pad(String(p.status ?? '—'), 4)} ` +
          `${pad(KIND_LABEL[p.blockKind] ?? p.blockKind, 20)} ` +
          `robots: ${pad(p.robotsVerdict, 11)}${p.edgeVendor ? ` via ${p.edgeVendor}` : ''}`,
      )
      console.log(`         ${p.evidence}`)
      if (p.divergence) console.log(`         ⚠ ${p.divergence}`)
    }
    console.log('')
  }

  if (s.asymmetry) console.log(`  ASYMMETRY: ${s.asymmetry}`)
  for (const c of report.caveats) console.log(`  · ${c}`)
  console.log('')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
