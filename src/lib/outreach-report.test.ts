import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { OUTREACH_EMAIL, OUTREACH_SOURCE, outreachRow, reportLinks } from './outreach-report'

describe('outreach report rows', () => {
  const row = outreachRow({ url: 'https://passion.digital', finalUrl: 'https://passion.digital/' }, 'geo')

  it('uses the internal address and the outreach source, never a prospect address', () => {
    expect(row.email).toBe(OUTREACH_EMAIL)
    expect(row.source).toBe(OUTREACH_SOURCE)
  })

  it('has no user, so it cannot appear in any dashboard', () => {
    expect(row.user_id).toBeNull()
  })

  it('leaves the promoted score columns empty, so it never enters a benchmark', () => {
    expect(row.retrievability_score).toBeNull()
    expect(row.citability_band).toBeNull()
  })

  it('records the audited domain without www', () => {
    expect(outreachRow({ url: 'https://www.clickslice.co.uk/' }, 'geo').domain).toBe('clickslice.co.uk')
  })

  it('builds the prospect link from the share token', () => {
    expect(reportLinks({ id: 'abc', share_token: 'tok' })).toEqual({
      reportUrl: 'https://app.bylineseo.com/report/tok',
      resultsUrl: 'https://app.bylineseo.com/audit/results/abc',
    })
  })
})

describe('the share path never sends email', () => {
  it('save-audit does not call the lead route or any mailer', () => {
    const src = readFileSync(join(__dirname, '..', '..', 'scripts', 'save-audit.ts'), 'utf8')
    expect(src).not.toMatch(/api\/audit\/lead|resend|sendEmail|nodemailer/i)
  })
})
