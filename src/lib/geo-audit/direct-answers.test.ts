import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractPage } from './extract'
import { scoreRetrievability } from './score-retrievability'

/**
 * typeamedia.net, 2026-10-14: "The opening paragraph is 355 characters" was
 * printed over a quote of a different paragraph ("We have always been
 * framework-forward..."), the one the definition check had matched. A reader
 * checking the finding found a quote that did not fit it. Fixture: the
 * homepage as fetched 2026-10-26, which still reproduces it.
 */

const html = readFileSync(join(__dirname, '__fixtures__', 'typeamedia-home-2026-10-26.html'), 'utf8')
const home = extractPage(html, 'https://typeamedia.net/')
const answers = scoreRetrievability({ home, access: null, now: new Date('2026-10-26T12:00:00Z') })
  .groups.flatMap((g) => g.checks)
  .find((c) => c.id === 'extract-answers')!

describe('direct answers evidence quotes the paragraph each finding describes', () => {
  it('quotes the 355-character opening paragraph under the finding about it', () => {
    expect(answers.detail).toMatch(/The opening paragraph is 355 characters/)
    const opening = answers.evidence.find((e) => e.snippet.startsWith('Opening paragraph (355 characters):'))
    expect(opening?.snippet).toContain('Type A are becoming an agentic digital marketing agency')
  })

  it('labels the definition quote as the definition, and quotes the sentence that matched', () => {
    const def = answers.evidence.find((e) => e.snippet.startsWith('Definition-style sentence:'))!
    expect(def.snippet).toBe('Definition-style sentence: That is exactly why becoming an agentic business is an evolution for us, not a reinvention.')
  })

  it('has no unlabelled quote', () => {
    for (const e of answers.evidence) expect(e.snippet).toMatch(/^(Opening paragraph|Definition-style sentence)/)
  })
})
