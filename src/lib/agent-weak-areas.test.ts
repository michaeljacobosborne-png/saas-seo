import { describe, expect, it } from 'vitest'
import { draftWeakAreas } from './agent-weak-areas'
import { buildDraftReport } from './geo-audit/draft-report'

const NOW = new Date('2026-10-01T09:00:00Z')
const MD = `# A thin draft about payroll

Payroll is hard. We can help.

## Why payroll

${'Small teams spend hours on payroll every month and make mistakes along the way. '.repeat(4)}
`

describe('draftWeakAreas (agent prompt, spec §4.1 #7)', () => {
  const draft = buildDraftReport({ markdown: MD, articleId: 'a1', brandName: 'Acme', author: null, now: NOW })
  const text = draftWeakAreas({ draft })

  it('says "not computed" rather than "no gaps" when there is no draft report', () => {
    const none = draftWeakAreas({})
    expect(none).toMatch(/not computed/)
    expect(none).not.toMatch(/\(none\)/)
  })

  it('lists draft structure and attribution gaps under the framework names', () => {
    expect(text).toMatch(/^Retrievable gaps/m)
    expect(text).toMatch(/^Citable gaps/m)
    expect(text).toMatch(/Heading hierarchy \(\d+\/12\)/)
    expect(text).toMatch(/Named authorship \(absent\)/)
  })

  it('never feeds the agent anything judged at publication', () => {
    for (const a of draft.afterPublication) expect(text).not.toContain(`- ${a.name} (`)
  })

  it('never feeds it a check that is already good', () => {
    const good = draft.retrievability.groups.flatMap((g) => g.checks).filter((c) => c.scored && c.status === 'good')
    for (const c of good) expect(text).not.toContain(`- ${c.name} (`)
  })

  it('tells the agent not to invent evidence', () => {
    expect(text).toMatch(/Never invent statistics, studies, quotes or sources/)
  })

  it('no longer mentions the regex GEO/AEO checks', () => {
    expect(text).not.toMatch(/AEO gaps|GEO gaps|Data\/stat/)
  })
})
