import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { describeChange } from './change-summary'
import { compareOverTime } from './history'
import { decodeSnapshot, snapshotBody, type AuditSnapshot } from './snapshot'

const ENCODED = readFileSync(join(__dirname, '__fixtures__', 'snapshot-bylineseo-home-2026-10-29.b64'), 'utf8')

function edited(transform: (html: string) => string, days = 30): [AuditSnapshot, AuditSnapshot] {
  const before = decodeSnapshot(ENCODED)
  const after: AuditSnapshot = structuredClone(before)
  after.recordedAt = new Date(Date.parse(before.recordedAt) + days * 86_400_000).toISOString()
  const home = after.exchanges.find((e) => e.finalUrl === 'https://app.bylineseo.com/' && e.body && e.status === 200)!
  after.bodies[home.body!] = `t:${transform(snapshotBody(after, home.body!).toString('utf8'))}`
  return [before, after]
}

describe('describeChange, on the real recording of app.bylineseo.com', () => {
  it('says nothing changed when nothing did', async () => {
    const s = decodeSnapshot(ENCODED)
    expect(describeChange(await compareOverTime(s, s))).toMatch(/^Nothing changed on the same day: same text, and Retrievable stayed at 98 on engine/)
  })

  it('says the text changed and gives both scores on one engine', async () => {
    const [a, b] = edited((h) => h.replace('Byline is an AI search readiness tool for SEOs.', 'We built Byline for SEOs.'))
    const text = describeChange(await compareOverTime(a, b))
    expect(text).toMatch(/^The page's text changed over 30 days\. Retrievable went from 98 to \d+, both runs scored on engine/)
  })

  it('says when the score moved but the words did not, and where to look', async () => {
    // Remove the page's structured data: same readable text, different markup.
    const [a, b] = edited((h) => h.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, ''))
    const o = await compareOverTime(a, b)
    expect(o.contentChanged).toBe(false)
    const text = describeChange(o)
    expect(text).toMatch(/^The page's text did not change over 30 days, but/)
    expect(text).toMatch(/markup, a linked page, or how the server answered the crawlers\.$/)
  })
})
