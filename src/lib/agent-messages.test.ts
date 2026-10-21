import { describe, expect, it } from 'vitest'
import { extractApplicableContent } from './agent-messages'

describe('extractApplicableContent', () => {
  it('never offers a Fix status message for "Apply to article" (live message, 2026-10-05)', () => {
    const live =
      '✅ Added "Byline SEO" to the single sentence that states a direct recommendation to content marketers, so the brand name travels with that actionable guidance without attaching it to any statistic or unsourced claim. (1 block changed; the rest of the article is untouched. Undo with ⌘/Ctrl+Z.)'
    expect(extractApplicableContent(live)).toBeNull()
    expect(extractApplicableContent('❌ No change was applied. Not applied (1): this edit adds figures that were not in the original text.')).toBeNull()
    expect(extractApplicableContent('SUMMARY: Added "Byline SEO" attribution to key claim-making sentences across the article so quoted passages carry the brand name.')).toBeNull()
  })

  it('still offers real suggested content', () => {
    expect(extractApplicableContent('Try this:\n```\nAnswer-first writing is a way of opening each section with its answer.\n```')).toBe(
      'Answer-first writing is a way of opening each section with its answer.',
    )
  })
})
