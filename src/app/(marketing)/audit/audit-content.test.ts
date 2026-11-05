import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AUDIT_FAQS } from './audit-content'

// The content map page states two facts about the pipeline. If the pipeline
// changes, this fails so the page copy is changed with it.
describe('content map copy matches the audit pipeline', () => {
  const route = readFileSync(join(__dirname, '..', '..', 'api', 'audit', 'route.ts'), 'utf8')
  const copy = AUDIT_FAQS.map((f) => f.a).join(' ')

  it('reads up to 30 pages', () => {
    expect(route).toMatch(/const MAX_PAGES = 30\b/)
    expect(copy).toContain('up to 30 pages')
  })

  it('asks the model for six to twelve suggestions', () => {
    expect(route).toContain('Provide 6-12 gaps')
    expect(copy).toContain('between six and twelve suggestions')
  })
})
