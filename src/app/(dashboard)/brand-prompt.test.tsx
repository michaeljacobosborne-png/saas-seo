import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ArticlesBrandNotice, DashboardBrandPrompt, TrackedBrandNote } from './_components/BrandPrompt'

/**
 * The brand profile is a prompt, not a gate (2026-11-22). Before this, the dashboard
 * layout redirected every account with no profile to /brand, so a customer who had
 * just paid met a form before the thing they paid for, and an account with no profile
 * (the demo account) could not reach the dashboard at all.
 */
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f) ? [p] : []
  })

describe('no account is sent to /brand for lacking a profile', () => {
  it('the dashboard layout does not redirect to /brand', () => {
    const layout = readFileSync(join(__dirname, 'layout.tsx'), 'utf8')
    expect(layout).not.toMatch(/redirect\(\s*['"`]\/brand/)
    expect(layout).not.toMatch(/from\(\s*['"]brand_profiles['"]\s*\)/)
  })

  it('no server component or layout in the dashboard redirects on a missing brand profile', () => {
    for (const file of walk(__dirname)) {
      const src = readFileSync(file, 'utf8')
      if (/^'use client'/m.test(src)) continue
      expect(src, file).not.toMatch(/if\s*\(\s*!\s*brand\w*\s*\)\s*redirect\(/i)
    }
  })
})

describe('the prompts say what the profile is for, and what does not need it', () => {
  it('the article generator names why it needs a profile and links to the form', () => {
    const html = renderToStaticMarkup(<ArticlesBrandNotice />)
    expect(html).toMatch(/article generator needs a brand profile/i)
    expect(html).toContain('href="/brand"')
    expect(html).toMatch(/Tracking pages and running audits do not need it/)
    expect(html).not.toMatch(/Brand profile missing/i)
  })

  it('the dashboard prompt is hidden until the saved choice is known, so a dismissed card never flashes', () => {
    expect(renderToStaticMarkup(<DashboardBrandPrompt />)).toBe('')
  })

  it('the tracked-page note shows what the engine counted, and links to the form only without a profile', () => {
    const without = renderToStaticMarkup(<TrackedBrandNote counted={['Fabrikam']} hasProfile={false} />)
    expect(without).toContain('Fabrikam')
    expect(without).toContain('href="/brand"')
    const withProfile = renderToStaticMarkup(<TrackedBrandNote counted={['Fabrikam']} hasProfile />)
    expect(withProfile).not.toContain('href="/brand"')
    expect(renderToStaticMarkup(<TrackedBrandNote counted={[]} hasProfile />)).toMatch(/could not read a name/)
  })

  it('never claims a brand profile changes a score', () => {
    const all = [renderToStaticMarkup(<ArticlesBrandNotice />), renderToStaticMarkup(<TrackedBrandNote counted={['X']} hasProfile={false} />)].join(' ')
    expect(all).not.toMatch(/improv\w+ (your )?(score|brand-claim)/i)
  })
})
