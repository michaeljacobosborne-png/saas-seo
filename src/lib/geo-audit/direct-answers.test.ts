import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractPage, findDefinition } from './extract'
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

  it('does not credit "becoming an agentic business is an evolution for us" as a definition', () => {
    // Engine 2026.12/2026.13 awarded 5 points for this sentence. It is about
    // something already said, not a statement of what the subject is.
    expect(answers.evidence.some((e) => e.snippet.startsWith('Definition-style sentence:'))).toBe(false)
    expect(answers.detail).toMatch(/No definition-style sentence/)
  })

  it('still credits a sentence that opens with its subject, and quotes exactly that sentence', () => {
    const ours = extractPage(readFileSync(join(__dirname, '__fixtures__', 'bylineseo-home-2026-10-26.html'), 'utf8'), 'https://app.bylineseo.com/')
    expect(findDefinition(ours.paragraphs)).toBe('Byline is an AI search readiness tool for SEOs.')
  })

  it('skips sentences that open with a pronoun, a demonstrative or a gerund', () => {
    expect(findDefinition(['That is the reason we exist.', 'It is a long road.', 'Becoming an agency is a big step.'])).toBeNull()
    expect(findDefinition(['Retrievable is a score out of 100.'])).toBe('Retrievable is a score out of 100.')
  })

  it('has no unlabelled quote', () => {
    for (const e of answers.evidence) expect(e.snippet).toMatch(/^(Opening paragraph|Definition-style sentence)/)
  })
})
