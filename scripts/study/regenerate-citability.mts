#!/usr/bin/env tsx
/**
 * Re-score the study's content half on a new engine version, from fresh pages,
 * beside the previous engine run on the SAME pages, so what moved because of
 * the engine is separable from what moved because the page or the vantage did.
 *
 *   npx tsx --env-file=.env.local scripts/study/regenerate-citability.mts <old-engine-checkout> <out.json> [--limit N]
 *
 * <old-engine-checkout> is a git worktree of the commit before the engine
 * change (with node_modules linked in). Each site is fetched once (its homepage
 * and the key pages the audit would follow), 3 seconds apart, from this machine.
 * No crawler probe is sent and nothing is written to the ledger: the crawler
 * rows, the baseline and every Access finding stay as the study recorded them.
 * Retrievable is re-scored on each engine using the study's own stored access
 * report, so a changed Retrievable can only be the engine.
 *
 * This is not a study run. The study is pre-registered on engine 2026.15 and its
 * harness refuses other engines; this only re-reads pages and re-scores them.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const [oldRoot, outFile] = process.argv.slice(2)
const limit = Number(process.argv[process.argv.indexOf('--limit') + 1]) || Infinity
const onlyIdx = process.argv.indexOf('--keys')
const only = onlyIdx > 0 ? new Set(process.argv[onlyIdx + 1].split(',')) : null
if (!oldRoot || !outFile) throw new Error('Usage: regenerate-citability.mts <old-engine-checkout> <out.json> [--limit N]')
const DIR = 'C:/Users/ozzy5/Documents/byline-study-runs/study-engine-2026.15'
const REPORTS = `${DIR}/reports`

const load = async (root: string) => {
  const g = (f: string) => import(pathToFileURL(join(root, 'src/lib/geo-audit', f)).href)
  const [extract, citability, retr, crawl, types] = await Promise.all([g('extract.ts'), g('assess-citability.ts'), g('score-retrievability.ts'), g('crawl.ts'), g('types.ts')])
  return { extractPage: extract.extractPage, assessCitability: citability.assessCitability, scoreRetrievability: retr.scoreRetrievability, findKeyPages: crawl.findKeyPages, version: types.ENGINE_VERSION as string }
}
const OLD = await load(oldRoot)
const NEW = await load('C:/dev/Byline')
const { fetchPage } = await import('../../src/lib/geo-audit/fetch')
const { execSync } = await import('node:child_process')
const gitHead = (root: string) => { try { return execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim() + (execSync('git status --porcelain --untracked-files=no', { cwd: root }).toString().trim() ? '+uncommitted' : '') } catch { return 'unknown' } }
const CODE = { old: { engineVersion: OLD.version, commit: gitHead(oldRoot) }, new: { engineVersion: NEW.version, commit: gitHead('C:/dev/Byline') } }
console.log(`old engine ${OLD.version} (${CODE.old.commit}), new engine ${NEW.version} (${CODE.new.commit})`)
if (OLD.version === NEW.version) throw new Error('Both trees report the same engine version; refusing to compare.')

const sites = readFileSync(`${DIR}/sites.jsonl`, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).filter((s: { status: string }) => s.status === 'audited')
const reportFile = (key: string) => {
  const stem = key.replace(':', '_')
  const files = readdirSync(REPORTS).filter((f) => f.startsWith(stem + '.attempt')).sort()
  return JSON.parse(readFileSync(join(REPORTS, files[files.length - 1]), 'utf8')).report
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const now = new Date()

const score = (E: typeof OLD, f: { html: string; finalUrl: string }, keyHtml: { url: string; role: string; html: string | null; finalUrl: string | null; status: number | null }[], stored: { access: unknown; crawlerProbe: unknown }) => {
  const home = E.extractPage(f.html, f.finalUrl)
  const keyPages = keyHtml.map((k) => ({ url: k.url, role: k.role, linkText: '', page: k.html ? E.extractPage(k.html, k.finalUrl ?? k.url) : null, ok: Boolean(k.html), status: k.status }))
  const c = E.assessCitability({ home, keyPages, now })
  const r = E.scoreRetrievability({ home, access: stored.access, now, crawlerAccess: stored.crawlerProbe })
  const pillar = (name: string) => r.groups.find((g: { name: string }) => g.name === name)?.score ?? null
  return {
    meaningful: home.hasMeaningfulContent,
    citable: { band: c.band, label: c.label, signals: Object.fromEntries(c.signals.map((s: { id: string; band: string; detail: string }) => [s.id, { band: s.band, detail: s.detail }])) },
    retrievable: { withheld: r.scoreWithheld, score: r.scoreWithheld ? null : r.score, grade: r.grade, access: pillar('Access'), parseability: pillar('Parseability'), chunkability: pillar('Chunkability'), extractability: pillar('Extractability') },
  }
}

const out: unknown[] = []
let i = 0
for (const s of sites) {
  if (only && !only.has(s.key)) continue
  if (i++ >= limit) break
  const stored = reportFile(s.key)
  const rec: Record<string, unknown> = { key: s.key, population: s.population, storedCitable: s.row.citable, storedRetrievable: { withheld: s.row.scoreWithheld, score: s.row.retrievable, grade: s.row.grade, ...Object.fromEntries(Object.entries(s.row.pillars).map(([k, v]) => [k, (v as { score: number }).score])) } }
  try {
    const f = await fetchPage(s.row.finalUrl || s.url)
    if (!f.ok) {
      rec.fetch = `failed ${f.status ?? ''} ${f.note ?? ''}`.trim()
    } else {
      const home = NEW.extractPage(f.html, f.finalUrl)
      const keyHtml: { url: string; role: string; html: string | null; finalUrl: string | null; status: number | null }[] = []
      for (const cand of NEW.findKeyPages(home.links).slice(0, 3)) {
        const k = await fetchPage(cand.url, { timeoutMs: 8000 })
        keyHtml.push({ url: cand.url, role: cand.role, html: k.ok ? k.html : null, finalUrl: k.ok ? k.finalUrl : null, status: k.status })
        await sleep(1000)
      }
      rec.fetch = 'ok'
      rec.keyPages = keyHtml.map((k) => ({ role: k.role, url: k.url, ok: Boolean(k.html) }))
      rec.old = { engineVersion: OLD.version, ...score(OLD, f, keyHtml, stored) }
      rec.new = { engineVersion: NEW.version, ...score(NEW, f, keyHtml, stored) }
    }
  } catch (e) {
    rec.fetch = 'error ' + String(e).slice(0, 100)
  }
  out.push(rec)
  console.log(i, s.key, rec.fetch)
  writeFileSync(outFile, JSON.stringify({ generatedAt: new Date().toISOString(), oldEngine: OLD.version, newEngine: NEW.version, code: CODE, rows: out }, null, 1))
  await sleep(3000)
}
console.log('done', out.length)
