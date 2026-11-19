// Analysis pack for a study run directory. Read-only on the ledger outputs.
//   node scripts/study/analyse.mjs <run dir> <out dir>
// Reads sites.jsonl (regenerate with report.ts first). Writes byline-study-analysis.md and -data.json. Tables and counts only.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
const [dir, out] = process.argv.slice(2)
const S = readFileSync(join(dir, 'sites.jsonl'), 'utf8').trim().split('\n').map(JSON.parse)
const POPS = ['A', 'B']
const PILLARS = [['access', 30], ['parseability', 25], ['chunkability', 25], ['extractability', 20]]
const SIGNALS = ['named-authorship', 'entity-resolution', 'brand-proximity', 'original-evidence', 'proprietary-terms', 'freshness-provenance']
const BANDS = ['strong', 'adequate', 'weak', 'absent', 'unverified']
const q = (a, p) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return +(s[lo] + (s[hi] - s[lo]) * (i - lo)).toFixed(1) }
const mean = (a) => (a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : null)
const dist = (a) => ({ n: a.length, min: q(a, 0), q1: q(a, 0.25), median: q(a, 0.5), q3: q(a, 0.75), max: q(a, 1), mean: mean(a) })
const pct = (n, d) => (d ? `${((100 * n) / d).toFixed(1)}%` : 'n/a')
const count = (arr, f) => arr.reduce((m, s) => { const k = f(s); m[k] = (m[k] ?? 0) + 1; return m }, {})
// Fisher exact, two-sided, 2x2 [[a,b],[c,d]]
const lf = [0]
for (let i = 1; i < 400; i++) lf[i] = lf[i - 1] + Math.log(i)
const lp = (a, b, c, d) => lf[a + b] + lf[c + d] + lf[a + c] + lf[b + d] - lf[a + b + c + d] - lf[a] - lf[b] - lf[c] - lf[d]
function fisher(a, b, c, d) {
  const p0 = Math.exp(lp(a, b, c, d))
  let p = 0
  const r1 = a + b, c1 = a + c, n = a + b + c + d
  for (let x = Math.max(0, c1 - (n - r1)); x <= Math.min(r1, c1); x++) {
    const pp = Math.exp(lp(x, r1 - x, c1 - x, n - r1 - c1 + x))
    if (pp <= p0 * (1 + 1e-9)) p += pp
  }
  return +p.toFixed(4)
}

const audited = S.filter((s) => s.status === 'audited' && s.row)
const byPop = (p) => audited.filter((s) => s.population === p)
const grp = (g) => (g === 'all' ? audited : byPop(g))
const acc = (s) => s.row.access
const h = (s) => acc(s).headline
const probeRan = (s) => acc(s).probeRan
const isLoc = (s) => {
  const l = (s.row.htmlLang ?? '').toLowerCase()
  return (l && !l.startsWith('en')) || s.row.redirectedToLocalePath || s.row.redirectedToOtherHost
}
const R = { generatedFrom: dir, generatedAt: new Date().toISOString(), engineVersions: [...new Set(audited.map((s) => s.engineVersion))], engineRows: count(audited, (s) => s.engineVersion), countries: [...new Set(audited.map((s) => s.vantage.egressCountry))] }

// 0. coverage
R.status = {}
for (const p of POPS) {
  const all = S.filter((s) => s.population === p)
  R.status[p] = { inFile: all.length, audited: byPop(p).length, other: count(all.filter((s) => s.status !== 'audited'), (s) => s.status + (s.reason ? ':' + s.reason : '')) }
}
R.outstanding = S.filter((s) => s.status !== 'audited').map((s) => ({ key: s.key, status: s.status, reason: s.reason, nextEligibleAt: s.nextEligibleAt, attempts: s.attempts.map((a) => ({ n: a.n, at: a.at, kind: a.failureKind, http: a.httpStatus, message: a.message })) }))

// 1. score distribution
const wclass = (s) => {
  const r = s.row.withheldReason ?? ''
  if (/refused \(HTTP/.test(r)) return 'our page request refused (HTTP ' + (r.match(/HTTP (\d+)/)?.[1] ?? '?') + ')'
  if (/readable text|JavaScript/i.test(r)) return 'content only after JavaScript'
  return 'other: ' + r.slice(0, 70)
}
R.score = {}
for (const g of [...POPS, 'all']) {
  const rows = grp(g)
  const scored = rows.filter((s) => !s.row.scoreWithheld)
  R.score[g] = { audited: rows.length, scored: scored.length, withheld: rows.length - scored.length, ...dist(scored.map((s) => s.row.retrievable)), grades: count(scored, (s) => s.row.grade) }
}
R.withheld = {}
for (const p of POPS) R.withheld[p] = count(byPop(p).filter((s) => s.row.scoreWithheld), wclass)

// 2. pillars: scored rows only (a withheld row's zeros mean "unable to assess")
R.pillars = {}
for (const g of [...POPS, 'all']) {
  const scored = grp(g).filter((s) => !s.row.scoreWithheld)
  R.pillars[g] = { n: scored.length }
  for (const [k, max] of PILLARS) {
    const v = scored.map((s) => s.row.pillars[k].score)
    R.pillars[g][k] = { pillarMax: max, ...dist(v), meanPctOfMax: +((100 * mean(v)) / max).toFixed(1), medianPctOfMax: +((100 * q(v, 0.5)) / max).toFixed(1), meanPointsLost: +(max - mean(v)).toFixed(1), atFullMarks: v.filter((x) => x === max).length, below50pct: v.filter((x) => x < max / 2).length }
  }
  const lost = PILLARS.map(([k]) => R.pillars[g][k].meanPointsLost)
  const tot = lost.reduce((a, b) => a + b, 0)
  R.pillars[g].shareOfLostPoints = Object.fromEntries(PILLARS.map(([k], i) => [k, +((100 * lost[i]) / tot).toFixed(1)]))
  R.pillars[g].lowestPillarCount = scored.reduce((m, s) => {
    const arr = PILLARS.map(([k, max]) => [k, s.row.pillars[k].score / max])
    const mn = Math.min(...arr.map((a) => a[1]))
    for (const [k, v] of arr) if (v === mn) m[k] = (m[k] ?? 0) + 1
    return m
  }, {})
}

// 3. citable
R.citable = {}
for (const g of [...POPS, 'all']) {
  const rows = grp(g)
  const ver = rows.filter((s) => s.row.citable.band !== 'unverified')
  R.citable[g] = { n: rows.length, verifiedN: ver.length, bands: Object.fromEntries(BANDS.map((b) => [b, rows.filter((s) => s.row.citable.band === b).length])), signals: {}, signalsAmongVerified: {} }
  for (const sg of SIGNALS) {
    R.citable[g].signals[sg] = Object.fromEntries(BANDS.map((b) => [b, rows.filter((s) => s.row.citable.signals[sg] === b).length]))
    R.citable[g].signalsAmongVerified[sg] = Object.fromEntries(BANDS.map((b) => [b, ver.filter((s) => s.row.citable.signals[sg] === b).length]))
  }
}

// 4. access
R.access = {}
for (const g of [...POPS, 'all']) {
  const rows = grp(g).filter(probeRan)
  R.access[g] = { probeRan: rows.length, challenge200: rows.filter((s) => h(s).challenge200Count > 0).length, robotsPermitsOriginRefuses: rows.filter((s) => h(s).robotsPermitsOriginRefusesCount > 0).length, vendorAsymmetry: rows.filter((s) => h(s).vendorAsymmetry).length, baselineRefused: rows.filter((s) => acc(s).baselineRefused).length, nothingAttributable: rows.filter((s) => h(s).nothingAttributable).length, scoreWithheld: rows.filter((s) => s.row.scoreWithheld).length, robotsState: count(rows, (s) => acc(s).robotsState), possiblyLocalised: rows.filter(isLoc).length }
}
const TOK = ['OAI-SearchBot', 'Claude-SearchBot', 'PerplexityBot', 'ClaudeBot', 'GPTBot', 'CCBot']
R.tokens = {}
for (const p of POPS) {
  R.tokens[p] = {}
  for (const t of TOK) {
    const ps = byPop(p).filter(probeRan).map((s) => acc(s).probes.find((x) => x.token === t)).filter(Boolean)
    R.tokens[p][t] = { n: ps.length, served: ps.filter((x) => x.contentServed).length, rateLimited: ps.filter((x) => x.blockKind === 'rate-limited').length, notAttributable: ps.filter((x) => !x.attributable).length, blockKinds: count(ps, (x) => x.blockKind) }
  }
}

// 5. cross-cut
const flags = (s) => ({ baselineRefused: !!acc(s).baselineRefused, robotsPermitsOriginRefuses: h(s).robotsPermitsOriginRefusesCount > 0, vendorAsymmetry: !!h(s).vendorAsymmetry })
R.crosscut = { rates: {}, fisher: {}, overlap: {}, baselineRefused: {} }
for (const p of POPS) {
  const rows = byPop(p).filter(probeRan)
  const c = rows.map(flags)
  R.crosscut.rates[p] = { n: rows.length, baselineRefused: c.filter((x) => x.baselineRefused).length, robotsPermitsOriginRefuses: c.filter((x) => x.robotsPermitsOriginRefuses).length, vendorAsymmetry: c.filter((x) => x.vendorAsymmetry).length }
  R.crosscut.overlap[p] = {
    baselineRefusedAndRobotsPermitsOriginRefuses: c.filter((x) => x.baselineRefused && x.robotsPermitsOriginRefuses).length,
    baselineRefusedAndVendorAsymmetry: c.filter((x) => x.baselineRefused && x.vendorAsymmetry).length,
    robotsPermitsOriginRefusesAndVendorAsymmetry: c.filter((x) => x.robotsPermitsOriginRefuses && x.vendorAsymmetry).length,
    anyOfThree: c.filter((x) => x.baselineRefused || x.robotsPermitsOriginRefuses || x.vendorAsymmetry).length,
    noneOfThree: c.filter((x) => !(x.baselineRefused || x.robotsPermitsOriginRefuses || x.vendorAsymmetry)).length,
  }
}
for (const k of ['baselineRefused', 'robotsPermitsOriginRefuses', 'vendorAsymmetry']) {
  const a = R.crosscut.rates.A, b = R.crosscut.rates.B
  R.crosscut.fisher[k] = { A: `${a[k]}/${a.n}`, B: `${b[k]}/${b.n}`, pTwoSided: fisher(a[k], a.n - a[k], b[k], b.n - b[k]) }
}
for (const g of [...POPS, 'all']) {
  const rows = grp(g).filter(probeRan)
  const br = rows.filter((s) => acc(s).baselineRefused)
  const nb = rows.filter((s) => !acc(s).baselineRefused)
  const wh = (x) => x.filter((s) => s.row.scoreWithheld).length
  R.crosscut.baselineRefused[g] = {
    n: br.length,
    status: count(br, (s) => acc(s).baseline?.status),
    scoreWithheld: wh(br),
    scored: br.length - wh(br),
    twoByTwo: { refused_withheld: wh(br), refused_scored: br.length - wh(br), notRefused_withheld: wh(nb), notRefused_scored: nb.length - wh(nb) },
    fisherP: fisher(wh(br), br.length - wh(br), wh(nb), nb.length - wh(nb)),
    withheldWhileBaselineNotRefused: nb.filter((s) => s.row.scoreWithheld).map((s) => ({ key: s.key, reason: wclass(s) })),
    scoredWhileBaselineRefused: br.filter((s) => !s.row.scoreWithheld).map((s) => ({ key: s.key, baseline: acc(s).baseline?.status, retrievable: s.row.retrievable })),
    robotsState: count(br, (s) => acc(s).robotsState),
    crawlerRowsAttributable: { allSix: br.filter((s) => acc(s).probes.length && acc(s).probes.every((x) => x.attributable)).length, none: br.filter((s) => h(s).nothingAttributable).length, some: br.filter((s) => !h(s).nothingAttributable && !acc(s).probes.every((x) => x.attributable)).length },
    citableBand: count(br, (s) => s.row.citable.band),
    pillarsAllZero: br.filter((s) => PILLARS.every(([k]) => s.row.pillars[k].score === 0)).length,
    pagesInspected: count(br, (s) => s.row.pagesInspected),
  }
}
R.crosscut.baselineRefusedSites = audited.filter((s) => acc(s).baselineRefused).map((s) => ({ key: s.key, baseline: acc(s).baseline?.status, robotsState: acc(s).robotsState, robotsStatus: acc(s).robotsStatus, withheld: s.row.scoreWithheld, retrievable: s.row.retrievable, citable: s.row.citable.band, attributableRows: acc(s).probes.filter((x) => x.attributable).length, servedRows: acc(s).probes.filter((x) => x.contentServed).length }))

const bclass = (s) => { const st = acc(s).baseline?.status; return st == null ? 'no response' : String(st) }
R.crosscut.byBaselineStatus = {}
for (const g of [...POPS, 'all']) {
  const rows = grp(g).filter(probeRan).filter((s) => acc(s).baselineRefused)
  R.crosscut.byBaselineStatus[g] = Object.fromEntries(Object.entries(count(rows, bclass)).map(([k]) => { const r = rows.filter((s) => bclass(s) === k); return [k, { n: r.length, withheld: r.filter((s) => s.row.scoreWithheld).length, scored: r.filter((s) => !s.row.scoreWithheld).length, withheldReasons: count(r.filter((s) => s.row.scoreWithheld), wclass) }] }))
}
R.crosscut.attributable = {}
for (const p of POPS) {
  const rows = byPop(p).filter(probeRan).filter((s) => !h(s).nothingAttributable)
  R.crosscut.attributable[p] = { n: rows.length, robotsPermitsOriginRefuses: rows.filter((s) => h(s).robotsPermitsOriginRefusesCount > 0).length, vendorAsymmetry: rows.filter((s) => h(s).vendorAsymmetry).length }
}
{ const a = R.crosscut.attributable.A, b = R.crosscut.attributable.B; for (const k of ['robotsPermitsOriginRefuses', 'vendorAsymmetry']) R.crosscut.attributable[k + 'Fisher'] = fisher(a[k], a.n - a[k], b[k], b.n - b[k]) }

// 6. localisation
const loc = audited.filter(isLoc)
R.localised = {
  flagged: loc.map((s) => ({ key: s.key, htmlLang: s.row.htmlLang, contentLanguage: s.row.contentLanguage, redirectedToLocalePath: s.row.redirectedToLocalePath, redirectedToOtherHost: s.row.redirectedToOtherHost, requested: s.row.requestedUrl, final: s.row.finalUrl, withheld: s.row.scoreWithheld, retrievable: s.row.retrievable, citable: s.row.citable.band, nonEnglishHtmlLang: !!(s.row.htmlLang && !s.row.htmlLang.toLowerCase().startsWith('en')) })),
  noLangDeclared: audited.filter((s) => !s.row.htmlLang).length,
}
R.scoreExcludingLocalised = {}
for (const g of [...POPS, 'all']) {
  const sc = grp(g).filter((s) => !s.row.scoreWithheld && !isLoc(s))
  R.scoreExcludingLocalised[g] = { ...dist(sc.map((s) => s.row.retrievable)), pillarMeanPctOfMax: Object.fromEntries(PILLARS.map(([k, max]) => [k, +((100 * mean(sc.map((s) => s.row.pillars[k].score))) / max).toFixed(1)])) }
}
R.confidence = {}
R.pagesInspected = {}
for (const p of POPS) {
  R.confidence[p] = count(byPop(p), (s) => `${s.row.confidence}${s.row.incomplete ? '/incomplete' : ''}`)
  R.pagesInspected[p] = count(byPop(p), (s) => s.row.pagesInspected)
}
R.finalHostChanged = audited.filter((s) => { try { return new URL(s.row.requestedUrl).host.replace(/^www\./, '') !== new URL(s.row.finalUrl).host.replace(/^www\./, '') } catch { return false } }).map((s) => ({ key: s.key, requested: s.row.requestedUrl, final: s.row.finalUrl }))

writeFileSync(join(out, 'byline-study-analysis-data.json'), JSON.stringify(R, null, 2))

// ---- markdown ----
const L = []
const T = (hd, rows) => {
  L.push('| ' + hd.join(' | ') + ' |', '|' + hd.map(() => '---').join('|') + '|')
  for (const r of rows) L.push('| ' + r.join(' | ') + ' |')
  L.push('')
}
const J = (o) => JSON.stringify(o)
L.push('# Byline study: analysis pack', '', `Source: \`${dir}\`. Generated ${R.generatedAt}. Rows by engine version: ${Object.entries(R.engineRows).map(([v, n]) => v + ' (' + n + ')').join(', ')}${R.engineVersions.length > 1 ? ' (MIXED: see the rescore field on each row)' : ''}; egress ${R.countries.join(', ')}. Counts and tables only. Machine-readable: \`byline-study-analysis-data.json\`.`, '')
L.push('## 0. Coverage', '')
T(['pop', 'in file', 'audited', 'not audited'], POPS.map((p) => [p, R.status[p].inFile, R.status[p].audited, J(R.status[p].other)]))
if (R.outstanding.length) {
  L.push('Not audited:', '')
  T(['site', 'status', 'reason', 'next eligible', 'attempts'], R.outstanding.map((o) => [o.key, o.status, o.reason ?? '', o.nextEligibleAt ?? '', o.attempts.map((a) => `#${a.n} ${a.at?.slice(11, 16)}Z ${a.kind}${a.http ? ' ' + a.http : ''}`).join('; ')]))
}
L.push('## 1. Retrievable score (scored sites only; withheld counted separately)', '')
T(['group', 'audited', 'scored', 'withheld', 'min', 'Q1', 'median', 'Q3', 'max', 'mean (reference only)'], [...POPS, 'all'].map((g) => { const x = R.score[g]; return [g, x.audited, x.scored, x.withheld, x.min, x.q1, x.median, x.q3, x.max, x.mean] }))
L.push('Grades (scored):', '')
T(['group', 'grade counts'], [...POPS, 'all'].map((g) => [g, J(R.score[g].grades)]))
L.push('Withheld, by reason (engine reason text, classified):', '')
T(['pop', 'reason counts'], POPS.map((p) => [p, J(R.withheld[p])]))
L.push('Confidence / incomplete flags (all audited):', '')
T(['pop', 'counts'], POPS.map((p) => [p, J(R.confidence[p])]))
L.push('## 2. Pillars (scored sites only; a withheld row\'s pillar zeros mean "unable to assess" and are excluded)', '')
for (const g of [...POPS, 'all']) {
  L.push(`**${g}** (n=${R.pillars[g].n})`, '')
  T(['pillar', 'pillar max', 'min', 'Q1', 'median', 'Q3', 'max seen', 'mean', 'mean % of max', 'median % of max', 'mean points lost', 'share of lost points', 'at full marks', 'below 50% of max'], PILLARS.map(([k]) => { const x = R.pillars[g][k]; return [k, x.pillarMax, x.min, x.q1, x.median, x.q3, x.max, x.mean, x.meanPctOfMax, x.medianPctOfMax, x.meanPointsLost, R.pillars[g].shareOfLostPoints[k] + '%', x.atFullMarks, x.below50pct] }))
  L.push(`Lowest pillar as % of its own max, per site (ties count for each): ${J(R.pillars[g].lowestPillarCount)}`, '')
}
L.push('## 3. Citable', '', 'Band counts (all audited; "unverified" = could not be assessed):', '')
T(['group', 'n', ...BANDS], [...POPS, 'all'].map((g) => [g, R.citable[g].n, ...BANDS.map((b) => R.citable[g].bands[b])]))
for (const g of POPS) {
  L.push(`Six signals, population ${g} (all audited, n=${R.citable[g].n}):`, '')
  T(['signal', ...BANDS], SIGNALS.map((sg) => [sg, ...BANDS.map((b) => R.citable[g].signals[sg][b])]))
}
L.push('Named authorship and original evidence, verified sites only (strong / adequate / weak / absent):', '')
T(['pop', 'verified n', 'named authorship', 'original evidence'], POPS.map((p) => { const c = R.citable[p]; const f = (sg) => ['strong', 'adequate', 'weak', 'absent'].map((b) => c.signalsAmongVerified[sg][b]).join(' / '); return [p, c.verifiedN, f('named-authorship'), f('original-evidence')] }))
L.push('## 4. Access findings (denominator = audited sites whose crawler probe ran)', '')
T(['group', 'probe ran', '200 that is a challenge', 'robots permits, origin refuses', 'vendor asymmetry', 'baseline refused', 'nothing attributable', 'score withheld', 'possibly localised'], [...POPS, 'all'].map((g) => { const x = R.access[g]; return [g, x.probeRan, x.challenge200, x.robotsPermitsOriginRefuses, x.vendorAsymmetry, x.baselineRefused, x.nothingAttributable, x.scoreWithheld, x.possiblyLocalised] }))
L.push('robots.txt state:', '')
T(['group', 'counts'], [...POPS, 'all'].map((g) => [g, J(R.access[g].robotsState)]))
L.push('Per crawler token:', '')
for (const p of POPS) {
  L.push(`**${p}**`, '')
  T(['token', 'n', 'content served', 'rate-limited (429)', 'not attributable', 'block kinds'], TOK.map((t) => { const x = R.tokens[p][t]; return [t, x.n, x.served, x.rateLimited, x.notAttributable, J(x.blockKinds)] }))
}
L.push('## 5. Failure-mode cross-cut', '', 'Rates (of probe-ran sites), Fisher exact two-sided p, A vs B:', '')
T(['measure', 'A', 'B', 'p'], Object.entries(R.crosscut.fisher).map(([k, x]) => [k, `${x.A} (${pct(...x.A.split('/').map(Number))})`, `${x.B} (${pct(...x.B.split('/').map(Number))})`, x.pTwoSided]))
L.push('Overlap of the three flags within each population:', '')
T(['pop', 'baseline refused AND robots-permits-origin-refuses', 'baseline refused AND vendor asymmetry', 'robots-permits-refuses AND vendor asymmetry', 'any of the three', 'none of the three'], POPS.map((p) => { const o = R.crosscut.overlap[p]; return [p, o.baselineRefusedAndRobotsPermitsOriginRefuses, o.baselineRefusedAndVendorAsymmetry, o.robotsPermitsOriginRefusesAndVendorAsymmetry, o.anyOfThree, o.noneOfThree] }))
L.push('Baseline refused: what could and could not be assessed', '')
T(['group', 'baseline refused', 'baseline status', 'score withheld', 'scored anyway', 'robots.txt state', 'crawler rows attributable: all six / some / none', 'citable band', 'all four pillars 0', 'pages inspected'], [...POPS, 'all'].map((g) => { const x = R.crosscut.baselineRefused[g]; return [g, x.n, J(x.status), x.scoreWithheld, x.scored, J(x.robotsState), `${x.crawlerRowsAttributable.allSix} / ${x.crawlerRowsAttributable.some} / ${x.crawlerRowsAttributable.none}`, J(x.citableBand), x.pillarsAllZero, J(x.pagesInspected)] }))
L.push('Baseline-refused sites by what the baseline request returned, and whether the score was withheld:', '')
{ const rows = []; for (const g of [...POPS, 'all']) for (const [k, x] of Object.entries(R.crosscut.byBaselineStatus[g])) rows.push([g, k, x.n, x.withheld, x.scored, J(x.withheldReasons)]); T(['group', 'baseline returned', 'sites', 'score withheld', 'scored', 'withheld reasons'], rows) }
L.push('Crawler-rule findings re-based on sites where the crawler rows ARE attributable (baseline served), vs the all-probe-ran base above:', '')
T(['pop', 'attributable sites', 'robots permits, origin refuses', 'vendor asymmetry'], POPS.map((p) => { const x = R.crosscut.attributable[p]; return [p, x.n, `${x.robotsPermitsOriginRefuses} (${pct(x.robotsPermitsOriginRefuses, x.n)})`, `${x.vendorAsymmetry} (${pct(x.vendorAsymmetry, x.n)})`] }))
L.push(`Fisher p, A vs B, attributable base: robots permits/origin refuses ${R.crosscut.attributable.robotsPermitsOriginRefusesFisher}; vendor asymmetry ${R.crosscut.attributable.vendorAsymmetryFisher}`, '')
L.push('Baseline refused vs score withheld (2x2, probe-ran sites):', '')
T(['group', 'refused & withheld', 'refused & scored', 'not refused & withheld', 'not refused & scored', 'Fisher p'], [...POPS, 'all'].map((g) => { const x = R.crosscut.baselineRefused[g]; return [g, x.twoByTwo.refused_withheld, x.twoByTwo.refused_scored, x.twoByTwo.notRefused_withheld, x.twoByTwo.notRefused_scored, x.fisherP] }))
L.push('Withheld although the baseline was NOT refused:', '')
T(['group', 'sites'], [...POPS, 'all'].map((g) => [g, R.crosscut.baselineRefused[g].withheldWhileBaselineNotRefused.map((x) => `${x.key} (${x.reason})`).join('; ') || 'none']))
L.push('Scored although the baseline WAS refused:', '')
T(['group', 'sites'], [...POPS, 'all'].map((g) => [g, R.crosscut.baselineRefused[g].scoredWhileBaselineRefused.map((x) => `${x.key} (baseline ${x.baseline}, score ${x.retrievable})`).join('; ') || 'none']))
L.push('Every baseline-refused site:', '')
T(['site', 'baseline', 'robots', 'robots HTTP', 'withheld', 'score', 'citable', 'attributable rows', 'served rows'], R.crosscut.baselineRefusedSites.map((x) => [x.key, x.baseline, x.robotsState, x.robotsStatus, x.withheld, x.retrievable ?? '', x.citable, x.attributableRows, x.servedRows]))
L.push('## 6. Localisation check', '', `Flagged by the harness rule (non-English html lang, locale-path redirect, or other-host redirect): ${loc.length}. Audited sites declaring no html lang at all: ${R.localised.noLangDeclared}.`, '')
T(['site', 'html lang', 'content-language', 'locale redirect', 'other-host redirect', 'requested', 'final', 'withheld', 'score', 'citable', 'non-English lang?'], R.localised.flagged.map((x) => [x.key, x.htmlLang ?? '', x.contentLanguage ?? '', x.redirectedToLocalePath, x.redirectedToOtherHost, x.requested, x.final, x.withheld, x.retrievable ?? '', x.citable, x.nonEnglishHtmlLang]))
L.push('Page-half numbers with the flagged sites excluded (compare with sections 1 and 2):', '')
T(['group', 'scored n', 'min', 'Q1', 'median', 'Q3', 'max', 'access % of max', 'parseability %', 'chunkability %', 'extractability %'], [...POPS, 'all'].map((g) => { const x = R.scoreExcludingLocalised[g], p = x.pillarMeanPctOfMax; return [g, x.n, x.min, x.q1, x.median, x.q3, x.max, p.access, p.parseability, p.chunkability, p.extractability] }))
L.push('Audited sites whose final host differs from the requested host (www ignored):', '')
T(['site', 'requested', 'final'], R.finalHostChanged.map((x) => [x.key, x.requested, x.final]))
L.push('Pages inspected per site (all audited):', '')
T(['pop', 'counts'], POPS.map((p) => [p, J(R.pagesInspected[p])]))
// 7. verifications and reconciliation
const sc = (g) => grp(g).filter((s) => !s.row.scoreWithheld)
const U = (a, b) => { // Mann-Whitney U, normal approximation with tie correction, two-sided
  const all = [...a.map((v) => [v, 0]), ...b.map((v) => [v, 1])].sort((x, y) => x[0] - y[0])
  const ranks = new Array(all.length); let tieTerm = 0
  for (let i = 0; i < all.length;) { let j = i; while (j + 1 < all.length && all[j + 1][0] === all[i][0]) j++; const r = (i + j) / 2 + 1; for (let k = i; k <= j; k++) ranks[k] = r; const t = j - i + 1; tieTerm += t ** 3 - t; i = j + 1 }
  const n1 = a.length, n2 = b.length, N = n1 + n2
  const r1 = all.reduce((s, x, i) => s + (x[1] === 0 ? ranks[i] : 0), 0)
  const u1 = r1 - (n1 * (n1 + 1)) / 2, mu = (n1 * n2) / 2
  const sd = Math.sqrt((n1 * n2 / 12) * (N + 1 - tieTerm / (N * (N - 1))))
  const z = (u1 - mu) / sd
  const erf = (x) => { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y }
  return { u1, z: +z.toFixed(3), pTwoSided: +(2 * (1 - 0.5 * (1 + erf(Math.abs(z) / Math.SQRT2)))).toFixed(5) }
}
R.verify = { chunkability: {}, access: {}, retrievable: {} }
for (const g of [...POPS, 'all']) {
  const rows = grp(g), scored = sc(g)
  const ch = (r) => r.map((s) => s.row.pillars.chunkability.score)
  R.verify.chunkability[g] = { auditedRows: rows.length, maxScoreAllAuditedRows: Math.max(...ch(rows)), rowsAtFullMarks25AllAudited: ch(rows).filter((x) => x === 25).length, scoredRows: scored.length, maxScoreScoredRows: Math.max(...ch(scored)), rowsAtFullMarks25Scored: ch(scored).filter((x) => x === 25).length, topFiveScoresScored: ch(scored).sort((x, y) => y - x).slice(0, 5), pillarMaxInRows: [...new Set(rows.map((s) => s.row.pillars.chunkability.max))] }
  const ac = (r) => r.map((s) => s.row.pillars.access.score)
  R.verify.access[g] = { scoredRows: scored.length, meanPctOfMaxScored: +((100 * mean(ac(scored))) / 30).toFixed(1), atFullMarksScored: ac(scored).filter((x) => x === 30).length, auditedRows: rows.length, meanPctOfMaxAllAudited_withheldAsZero: +((100 * mean(ac(rows))) / 30).toFixed(1), atFullMarksAllAudited: ac(rows).filter((x) => x === 30).length, accessScoreByWithheldRows: ac(rows.filter((s) => s.row.scoreWithheld)) }
}
{ const a = sc('A').map((s) => s.row.retrievable), b = sc('B').map((s) => s.row.retrievable)
  R.verify.retrievable = { A: dist(a), B: dist(b), medianDifferenceAminusB: q(a, 0.5) - q(b, 0.5), withheldA: grp('A').length - a.length, withheldB: grp('B').length - b.length, mannWhitney: U(a, b), allAuditedRowsIncludingWithheld: { note: 'withheld rows have no score; not imputed', nA: grp('A').length, nB: grp('B').length } } }
R.reconciliation = {}
for (const p of POPS) {
  const all = S.filter((s) => s.population === p)
  R.reconciliation[p] = { inFile: all.length, audited: byPop(p).length, dropped: all.filter((s) => s.status === 'dropped').length, unresolved: all.filter((s) => s.status === 'unresolved').map((s) => ({ key: s.key, reason: s.reason })), inProgress: all.filter((s) => s.status === 'in-progress' || s.status === 'retry-wait' || s.status === 'retry-due' || s.status === 'pending').length, duplicates: all.filter((s) => s.duplicateOf).length }
  R.reconciliation[p].sums = R.reconciliation[p].audited + R.reconciliation[p].dropped + R.reconciliation[p].unresolved.length + R.reconciliation[p].inProgress === R.reconciliation[p].inFile
}
R.investigations = [
  { key: 'A:seodiscovery.com', observed: '2026-11-15 from this machine (non-AWS), curl with browser UA. https://seodiscovery.com/ and https://www.seodiscovery.com/ both return HTTP 307, Server: Sucuri/Cloudproxy, NO Location header. The body is a JavaScript interstitial ("You are being redirected... Javascript is required") that computes a cookie and calls location.reload(). It is a bot challenge, not a redirect to another URL. /robots.txt returns 301 to the www host. Harness attempts: 3 of 3, all HTTP 307 (2026-11-12 10:56Z, 16:57Z; 2026-11-13 05:22Z). Not audited: content cannot be read without executing the challenge script, which was not attempted.', ruleStatus: 'http-other is not one of the four pre-registered drop reasons (dns, 404, 5xx, GEO-page rule), so the ledger holds it as unresolved, needs a ruling' },
  { key: 'A:mediaspearhead.com', observed: '2026-11-15 curl from this machine: HTTP 200, nginx, both apex and www; DNS resolves. Harness attempts: 3 of 3, all "socket hang up" from the US function (2026-11-12 11:37Z; 2026-11-13 05:22Z; 2026-11-15 09:4xZ). Reachable from a residential-range client, connection dropped from the AWS vantage.', ruleStatus: 'unreachable-other is not a pre-registered drop reason; ledger holds it as unresolved, needs a ruling' },
]
L.push('## 7. Verification of the three headline numbers', '')
L.push('Chunkability full marks (25), all audited rows vs scored rows only:', '')
T(['group', 'audited rows', 'max chunkability, all audited', 'rows at 25, all audited', 'scored rows', 'max, scored', 'rows at 25, scored', 'top five scored', 'pillar max in rows'], [...POPS, 'all'].map((g) => { const x = R.verify.chunkability[g]; return [g, x.auditedRows, x.maxScoreAllAuditedRows, x.rowsAtFullMarks25AllAudited, x.scoredRows, x.maxScoreScoredRows, x.rowsAtFullMarks25Scored, x.topFiveScoresScored.join(', '), x.pillarMaxInRows.join(',')] }))
L.push('Access pillar (30), scored rows and all audited rows (withheld rows carry 0 meaning unable to assess):', '')
T(['group', 'scored rows', 'mean % of max, scored', 'at 30, scored', 'audited rows', 'mean % of max, all audited (withheld as 0)', 'at 30, all audited', 'access score of withheld rows'], [...POPS, 'all'].map((g) => { const x = R.verify.access[g]; return [g, x.scoredRows, x.meanPctOfMaxScored, x.atFullMarksScored, x.auditedRows, x.meanPctOfMaxAllAudited_withheldAsZero, x.atFullMarksAllAudited, x.accessScoreByWithheldRows.join(',')] }))
L.push('Retrievable score, A vs B (scored rows; withheld not imputed):', '')
{ const v = R.verify.retrievable; T(['group', 'scored n', 'withheld', 'min', 'Q1', 'median', 'Q3', 'max'], [['A', v.A.n, v.withheldA, v.A.min, v.A.q1, v.A.median, v.A.q3, v.A.max], ['B', v.B.n, v.withheldB, v.B.min, v.B.q1, v.B.median, v.B.q3, v.B.max]]); L.push(`Median difference A minus B: ${v.medianDifferenceAminusB}. Mann-Whitney U two-sided: z=${v.mannWhitney.z}, p=${v.mannWhitney.pTwoSided}. Group sizes unequal (${v.A.n} vs ${v.B.n} scored).`, '') }
L.push('## 8. Reconciliation of counts', '')
T(['pop', 'in file', 'audited', 'dropped (named rule)', 'unresolved (needs ruling)', 'still in progress', 'duplicates', 'audited + dropped + unresolved + in progress = in file'], POPS.map((p) => { const x = R.reconciliation[p]; return [p, x.inFile, x.audited, x.dropped, x.unresolved.map((u) => `${u.key} (${u.reason})`).join('; ') || '0', x.inProgress, x.duplicates, x.sums] }))
L.push('Unaudited sites, evidence:', '')
T(['site', 'what was observed', 'status under the pre-registered rule'], R.investigations.map((i) => [i.key, i.observed, i.ruleStatus]))
L.push('## 9. Questions these rows cannot answer', '', 'Each line: the question, then the fact in the data or method that blocks it.', '')
const sA = R.score.A, sB = R.score.B
const lim = [
  ['Do agencies differ from SaaS companies in general?', `Population A is ${R.status.A.inFile} sites taken from search results on a stated date; B is G2 Best Global Software ranks 1 to 50 (${R.status.B.inFile} rows after drops). Neither is a random sample. The pre-registered target was 100 each. Group sizes ${sA.audited} vs ${sB.audited} audited, ${sA.scored} vs ${sB.scored} scored.`],
  ['Are agencies better or worse than their own clients?', 'B is not the set of companies A sells to. No row links an agency to a client.'],
  ['Do the refusals mean real AI crawlers are refused?', 'Probes send each vendor\'s user-agent string from AWS (AS14618, Virginia). A block of a claimed bot from a non-vendor IP can be bot verification working as intended. Real crawlers on their own IP ranges are untested, in either direction (stated in the selection rule).'],
  ['Why does a site refuse?', 'Rows record status, block kind and edge vendor where detected. Intent (default WAF setting, deliberate policy, bot-management product) is not observable. "Robots permits, origin refuses" is a divergence, not proof of an error.'],
  ['Does a high Retrievable or Citable score mean the site is cited?', 'No citation or visibility data was collected. Readiness is not visibility (selection rule).'],
  ['What do the baseline-refused sites do for crawlers?', `${R.access.all.baselineRefused} of ${R.access.all.probeRan} probed sites had the plain baseline request refused or unanswered; ${R.access.all.nothingAttributable} had no attributable crawler rows. Crawler-rule findings are measurable only on the rest.`],
  ['Are the page-half numbers a comparison of the same thing across populations?', `Rows inspected 1 to 4 pages, not one homepage as the selection rule describes. Pages inspected A ${J(R.pagesInspected.A)}; B ${J(R.pagesInspected.B)}. The mix differs by population.`],
  ['Are scored sites representative of all audited sites?', `Withheld rows (A ${sA.withheld}, B ${sB.withheld}) have no score and are excluded from distributions. Withheld share differs by population. Withheld reasons differ (JavaScript-only content vs request refused). 11 baseline-refused sites were scored anyway; the content they were scored on came from a different request than the baseline that was refused.`],
  ['Is a single run stable?', 'One pass, 2026-11-12, about two hours, engine 2026.15. No repeat measurements. Rate-limit rows (429) are partly our own request rate: about ten sites also received repeated smoke-test requests the same day from the same vantage, outside the study ledger\'s per-domain cap.'],
  ['What do EU, UK or other regional visitors and crawlers see?', `One US vantage. Seven sites flagged possibly localised (section 6); ${R.localised.noLangDeclared} audited sites declare no html lang; English-language regional variants cannot be detected from the row.`],
  ['Is the engine\'s rubric neutral between pillars?', 'Pillar maxima differ (30, 25, 25, 20) and are our own rubric. Points lost per pillar depend on the weighting. No external validation of the rubric. Engine findings have been wrong on hand checks before (send log 2026-11-02, brand-in-body finding, two sites); these rows were not hand-verified.'],
  ['Are "absent" named authorship and original evidence absent from the site?', 'They are absent from the 1 to 4 pages inspected, by the engine\'s heuristic.'],
  ['Does the engine score non-English sites comparably?', 'Five population A sites declare de, pl or es. The rubric\'s text checks are written for English; effect unmeasured.'],
  ['Does the rule cover every unaudited site?', 'The pre-registered drop reasons are DNS failure, 404 or 5xx on every attempt, duplicate, and (A only) no GEO page. Two A sites ended on reasons the rule does not name (section 8). Dropping them would be a rule amendment.'],
  ['Are user-triggered agents (ChatGPT-User, Claude-User, Perplexity-User) treated differently?', 'Not probed. Six tokens only: three AI search, three training. Training crawlers are reported, not scored.'],
  ['Are the A vs B differences significant after many comparisons?', 'Fisher and Mann-Whitney p values in this pack are unadjusted and unplanned beyond the pre-registered measures.'],
]
T(['question', 'blocking fact'], lim)
writeFileSync(join(out, 'byline-study-analysis-data.json'), JSON.stringify(R, null, 2))
writeFileSync(join(out, 'byline-study-analysis.md'), L.join('\n'))
console.log('written', J(R.status))
