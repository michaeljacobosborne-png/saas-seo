/**
 * Word count for article HTML, matching what the editor shows.
 *
 * The editor (TipTap's CharacterCount) counts `doc.textBetween(0, end, ' ', ' ')`
 * split on single spaces: block boundaries and leaf nodes become a space, inline
 * formatting adds nothing, and whitespace inside text is collapsed when the HTML
 * is parsed. The server used to replace every tag with a space, so a word split
 * by inline formatting ("<strong>AI</strong>-ready") counted twice, and paths
 * that changed content without recounting left a stale number in the list. On
 * 2026-10-27, 6 of 26 articles showed a different count in the list and the
 * editor, by 4 to 409 words.
 */

import { marked } from 'marked'

/**
 * Article content as the editor loads it: HTML is used as is, markdown (imports,
 * older drafts) goes through marked, with tables converted first. Shared so the
 * server counts words on exactly what the editor will show.
 */
export function prepareContent(content: string): string {
  if (content.trim().startsWith('<')) return content
  const md = content
    // Convert markdown tables to HTML before passing to marked
    .replace(/^\|(.+)\|\s*\n\|[-| :]+\|\s*\n((?:\|.+\|\s*\n?)*)/gm, (match, header, rows) => {
      const ths = header.split('|').filter(Boolean).map((h: string) => `<th>${h.trim()}</th>`).join('')
      const trs = rows.trim().split('\n').map((row: string) => {
        const tds = row.split('|').filter(Boolean).map((c: string) => `<td>${c.trim()}</td>`).join('')
        return `<tr>${tds}</tr>`
      }).join('')
      return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`
    })
  return marked.parse(md) as string
}

/** The word count the editor will show for stored content, HTML or markdown. */
export function articleWordCount(content: string | null | undefined): number {
  return content ? countArticleWords(prepareContent(content)) : 0
}

const BLOCK ='p|h[1-6]|li|ul|ol|blockquote|pre|table|thead|tbody|tfoot|tr|td|th|div|figure|figcaption|section|article|header|footer|hr|br|img'
const BLOCK_TAG = new RegExp(`<\\/?(?:${BLOCK})\\b[^>]*>`, 'gi')

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'", nbsp: ' ' }

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : m
    }
    return ENTITIES[e.toLowerCase()] ?? m
  })
}

export function countArticleWords(html: string | null | undefined): number {
  if (!html) return 0
  const text = decode(
    html
      .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(BLOCK_TAG, ' ')
      .replace(/<[^>]+>/g, ''),
  )
    // HTML parsing collapses spaces, tabs and newlines; a non-breaking space survives.
    .replace(/[ \t\n\r\f]+/g, ' ')
  return text.split(' ').filter((w) => w !== '').length
}
