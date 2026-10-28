// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Typography from '@tiptap/extension-typography'
import CharacterCount from '@tiptap/extension-character-count'
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'
import { countArticleWords } from './word-count'

/** The count the article editor shows, from the same extensions it loads. */
function editorCount(html: string): number {
  const editor = new Editor({ extensions: [StarterKit, Typography, CharacterCount, Table, TableRow, TableCell, TableHeader], content: html })
  const n = editor.storage.characterCount.words()
  editor.destroy()
  return n
}

// Verbatim from a generated article in the app ("Discover the Best AI SEO
// Tools...", 2026-10-27). Each bolded lead-in ends in a colon outside the bold.
const BOLD_LEAD_INS = [
  '<ul>',
  '<li><p><strong>Byline SEO</strong>: Known for its comprehensive AI-driven features, Byline SEO offers keyword research, content optimization, and competitor analysis. Pricing starts at $99/month. Users praise its intuitive interface and robust customer support.</p></li>',
  '<li><p><strong>Keyword Rankings</strong>: By tracking the movement of targeted keywords in search engine results pages (SERPs), businesses can gauge the impact of AI tools on their visibility.</p></li>',
  '</ul>',
].join('')

describe('countArticleWords', () => {
  it('matches the editor on real generated markup with bold lead-ins', () => {
    expect(countArticleWords(BOLD_LEAD_INS)).toBe(editorCount(BOLD_LEAD_INS))
    expect(countArticleWords(BOLD_LEAD_INS)).toBe(31 + 26)
  })

  it('does not count the colon after a bold lead-in as a word, as the old tag-to-space count did', () => {
    const oldCount = BOLD_LEAD_INS.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length
    expect(oldCount).toBe(31 + 26 + 2)
  })

  it('separates blocks, joins inline formatting, and decodes entities like the editor', () => {
    const html = '<h2>Why it matters</h2><p>One<em>word</em> &amp; two&nbsp;words<br>three</p><p>four</p>'
    expect(countArticleWords(html)).toBe(editorCount(html))
  })

  it('counts nothing for empty content', () => {
    expect(countArticleWords('')).toBe(0)
    expect(countArticleWords(null)).toBe(0)
  })
})
