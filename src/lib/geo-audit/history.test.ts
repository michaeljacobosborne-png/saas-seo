import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { compareOverTime, contentFingerprint, rescoreSnapshot } from './history'
import { decodeSnapshot, encodeSnapshot, recordingFetch, replayFetch, snapshotBody, type AuditSnapshot } from './snapshot'

/**
 * Score over time rests on one property: a recorded run replays to the same
 * result, with no network, on any later day. The fixture is a real recording of
 * app.bylineseo.com (2026-10-29, engine 2026.14): 18 requests including the
 * crawler probe, 5 distinct bodies, 30 KB encoded. Live it scored Retrievable
 * 98, Citable strong.
 */
const ENCODED = readFileSync(join(__dirname, '__fixtures__', 'snapshot-bylineseo-home-2026-10-29.b64'), 'utf8')

describe('snapshot replay', () => {
  it('re-scores the recorded run exactly as it scored live, offline', async () => {
    const s = decodeSnapshot(ENCODED)
    const r = await rescoreSnapshot(s)
    expect(r.retrievability?.score).toBe(98)
    expect(r.citability?.band).toBe('strong')
    expect(r.analyzedAt).toBe(s.recordedAt)
  })

  it('replays requests in order, failures included, and refuses anything it never saw', async () => {
    let n = 0
    const inner = (async (url: string) => {
      n++
      if (url.endsWith('/down')) throw new Error('ECONNRESET')
      return new Response(`body ${n}`, { status: 200, headers: { 'x-n': String(n) } })
    }) as unknown as typeof fetch
    const rec = recordingFetch(inner)
    await rec.fetchImpl('https://a.test/', { headers: { 'User-Agent': 'UA' } })
    await rec.fetchImpl('https://a.test/', { headers: { 'User-Agent': 'UA' } })
    await rec.fetchImpl('https://a.test/down', { headers: { 'User-Agent': 'UA' } }).catch(() => null)
    const snap: AuditSnapshot = { version: 1, recordedAt: 'x', engineVersion: 'x', url: 'https://a.test/', tool: 'geo', exchanges: rec.exchanges, bodies: rec.bodies }
    const replay = replayFetch(decodeSnapshot(encodeSnapshot(snap)))
    expect(await (await replay('https://a.test/', { headers: { 'User-Agent': 'UA' } })).text()).toBe('body 1')
    expect(await (await replay('https://a.test/', { headers: { 'User-Agent': 'UA' } })).text()).toBe('body 2')
    await expect(replay('https://a.test/down', { headers: { 'User-Agent': 'UA' } })).rejects.toThrow('ECONNRESET')
    await expect(replay('https://a.test/other', {})).rejects.toThrow('Not in the snapshot')
  })
})

describe('compareOverTime', () => {
  it('reports no change when the same run is compared with itself', async () => {
    const s = decodeSnapshot(ENCODED)
    const out = await compareOverTime(s, s)
    expect(out.contentChanged).toBe(false)
    expect(out.comparison.scoresComparable).toBe(true)
    expect(out.comparison.retrievability.delta).toBe(0)
  })

  it('attributes a score change to the page when the page text changed, on one engine', async () => {
    // The same recording, with the homepage's definition sentence removed, as if
    // the page had been edited before a later run.
    const before = decodeSnapshot(ENCODED)
    const after: AuditSnapshot = structuredClone(before)
    after.recordedAt = new Date(Date.parse(before.recordedAt) + 30 * 86_400_000).toISOString()
    const home = after.exchanges.find((e) => e.finalUrl === 'https://app.bylineseo.com/' && e.body && e.status === 200)!
    const html = snapshotBody(after, home.body!).toString('utf8')
    expect(html).toContain('Byline is an AI search readiness tool for SEOs.')
    after.bodies[home.body!] = `t:${html.replace('Byline is an AI search readiness tool for SEOs.', 'We built Byline for SEOs.')}`

    const out = await compareOverTime(before, after)
    expect(out.contentChanged).toBe(true)
    expect(out.comparison.scoresComparable).toBe(true)
    expect(out.comparison.retrievability.delta).toBeLessThan(0)
    expect(out.recordedOn).toEqual({ from: before.engineVersion, to: after.engineVersion })
  })

  it('fingerprints the readable text, so markup-only changes do not count as content changes', () => {
    const a = '<html><body><main><p>Same words here.</p></main></body></html>'
    const b = '<html><body><main><div class="x"><p>Same   words here.</p></div></main></body></html>'
    expect(contentFingerprint(a, 'https://x.test/')).toBe(contentFingerprint(b, 'https://x.test/'))
  })
})
