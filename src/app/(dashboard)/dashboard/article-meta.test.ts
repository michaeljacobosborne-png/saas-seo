import { describe, expect, it } from 'vitest'
import { articleMeta } from './article-meta'

describe('articleMeta', () => {
  it('shows the article\'s own keyword, and labels the project as a project', () => {
    // The real case: article targeting "ai optimization" in a project named "what is aeo".
    expect(articleMeta('ai optimization', 'what is aeo')).toEqual(['Keyword: ai optimization', 'Project: what is aeo'])
  })

  it('does not repeat a project named the same as the keyword', () => {
    expect(articleMeta('ai optimization', 'AI Optimization')).toEqual(['Keyword: ai optimization'])
  })

  it('shows nothing it does not have', () => {
    expect(articleMeta(null, null)).toEqual([])
    expect(articleMeta('  ', undefined)).toEqual([])
  })
})
