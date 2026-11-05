import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildChangeEmail } from './tracking-email'
import { compareOverTime } from '@/lib/geo-audit/history'
import { decodeSnapshot, snapshotBody, type AuditSnapshot } from '@/lib/geo-audit/snapshot'

const ENCODED = readFileSync(join(__dirname, 'geo-audit', '__fixtures__', 'snapshot-bylineseo-home-2026-10-29.b64'), 'utf8')

describe('buildChangeEmail, on the real recording of app.bylineseo.com', () => {
  it('reports no change plainly, with the scope line and the link', async () => {
    const s = decodeSnapshot(ENCODED)
    const e = buildChangeEmail({ pageId: 'p1', url: 'https://app.bylineseo.com/', overTime: await compareOverTime(s, s), recorded: { from: 98, to: 98 } })
    expect(e.subject).toBe('Byline re-checked app.bylineseo.com: no change')
    expect(e.text).toContain('https://app.bylineseo.com/tracking/p1')
    expect(e.text).toContain('not evidence that any AI system now retrieves or cites it')
    expect(e.text).not.toMatch(/visibility (rose|fell|improved|dropped)|more likely to be cited|ranking/i)
    expect(e.text).not.toMatch(/—|!/)
  })

  it('says the page changed, and splits out the engine when it changed too', async () => {
    const before = decodeSnapshot(ENCODED)
    const after: AuditSnapshot = structuredClone(before)
    after.recordedAt = new Date(Date.parse(before.recordedAt) + 30 * 86_400_000).toISOString()
    const home = after.exchanges.find((x) => x.finalUrl === 'https://app.bylineseo.com/' && x.body && x.status === 200)!
    after.bodies[home.body!] = `t:${snapshotBody(after, home.body!).toString('utf8').replace('Byline is an AI search readiness tool for SEOs.', 'We built Byline for SEOs.')}`
    before.engineVersion = '2026.11'
    const o = await compareOverTime(before, after)
    const e = buildChangeEmail({ pageId: 'p1', url: 'https://app.bylineseo.com/', overTime: o, recorded: { from: 96, to: 93 } })
    expect(e.subject).toBe('Byline re-checked app.bylineseo.com: the page changed')
    expect(e.text).toContain('Engine version changed between these runs.')
    expect(e.text).toMatch(/the page accounts for -?\d+ and changes to Byline's engine for/)
  })
})
