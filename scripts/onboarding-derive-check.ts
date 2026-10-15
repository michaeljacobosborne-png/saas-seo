/**
 * Run the onboarding derivation (what /api/brand/derive does) against real
 * sites, without a login. For QA of hostile cases: sites that refuse us,
 * JS-only shells, timeouts, non-HTML URLs, typo domains.
 *
 *   npx tsx scripts/onboarding-derive-check.ts <url> [<url> ...]
 *
 * Model suggestions are skipped (no API cost); this checks what the user sees
 * first: the access card, the read fields, or the error message.
 */
import { fetchPage, normaliseUrl } from '../src/lib/geo-audit/fetch'
import { extractPage } from '../src/lib/geo-audit/extract'
import { fetchRobotsTxt } from '../src/lib/geo-audit/robots'
import { crossReferenceRobots, probeCrawlerAccess } from '../src/lib/geo-audit/crawler-access'
import { onboardingAccess, readIdentity } from '../src/lib/brand-derive'

async function check(raw: string) {
  const url = normaliseUrl(raw)
  const t0 = Date.now()
  const [robots, probe, fetched] = await Promise.all([
    fetchRobotsTxt(url).catch(() => null),
    probeCrawlerAccess(url, { robots: null }).catch(() => null),
    fetchPage(url).catch((e: unknown) => ({ ok: false as const, note: e instanceof Error ? e.message : String(e) })),
  ])
  const ms = Date.now() - t0
  console.log(`\n== ${raw}  (${ms}ms)`)
  if (probe) {
    const a = onboardingAccess(crossReferenceRobots(probe, robots?.parsed ?? null))
    console.log(`  access: ${a.headline}`)
    for (const r of a.rows) console.log(`    ${r.token}: ${r.state} — ${r.evidence.slice(0, 90)}`)
  } else {
    console.log('  access: probe did not complete (card says "did not complete")')
  }
  if (!fetched.ok) {
    console.log(`  profile: ERROR shown to user → "${fetched.note ?? 'We could not load that site.'}" (form stays usable)`)
    return
  }
  const page = extractPage(fetched.html, fetched.finalUrl)
  const id = readIdentity(page, fetched.html, fetched.finalUrl)
  console.log(`  profile: name=${id.brand_name?.value ?? '—'} (${id.brand_name?.source ?? 'none'}), author=${id.author_name?.value ?? '—'}, meaningful=${page.hasMeaningfulContent}, words=${page.wordCount}`)
  if (!page.hasMeaningfulContent) console.log('  note: too little readable text → no model suggestions; user fills fields')
}

;(async () => {
  for (const u of process.argv.slice(2)) await check(u)
})()
