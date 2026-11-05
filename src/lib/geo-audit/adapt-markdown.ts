/**
 * Phase 1 of the paid engine (docs/paid-engine-spec.md §2): turn a markdown
 * draft into the same `ExtractedPage` the live engine consumes.
 *
 * The draft is parsed by `marked` (a real CommonMark/GFM parser, already a
 * dependency) into HTML, and that HTML goes through `extractPage()` — the exact
 * extractor the live audit uses. That is deliberate. The spec's main risk for
 * this phase was the adapter building `ContentBlock`s, statistics or links
 * slightly differently from `extract.ts`, so the two paths would disagree about
 * the same content. Reusing the extractor removes that divergence by
 * construction rather than by testing for it.
 *
 * What a draft cannot carry is blanked, never guessed: canonical, meta
 * description, language, robots meta and structured data belong to the CMS
 * template (spec §2.3). Raw HTML embedded in the markdown is dropped and
 * counted, so the report can say that part was not assessed (spec §2.7).
 */

import { Marked } from 'marked'
import { extractPage, type ExtractedPage } from './extract'

export interface DraftMeta {
  /** Article id, used for the `draft:<id>` evidence URL (spec §2.4). */
  articleId: string
  /** Title from the article record, not the markdown. */
  title?: string | null
  /** Base for resolving relative links, e.g. the brand's website. */
  siteUrl?: string | null
}

export interface AdaptedDraft {
  page: ExtractedPage
  /** Blocks of raw HTML dropped from the markdown. */
  rawHtmlBlocks: number
  /** True when the H1 came from the article title rather than the markdown. */
  h1FromTitle: boolean
  /** Agent header lines (SUMMARY:/PATCH:) removed before scoring. */
  artefactsRemoved: number
  /** True when text above the draft's own H1 was left out. */
  preH1Removed: boolean
}

export const DRAFT_URL_PREFIX = 'draft:'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function adaptMarkdown(md: string, meta: DraftMeta): AdaptedDraft {
  let rawHtmlBlocks = 0
  const marked = new Marked({
    gfm: true,
    renderer: {
      html() {
        rawHtmlBlocks++
        return ''
      },
    },
  })

  const source = md ?? ''
  // `articles.content` is markdown when generated, but the editor autosaves
  // TipTap HTML (`editor.getHTML()`), so any article a user has touched is
  // HTML. Same test the editor uses (`prepareContent`). HTML goes straight to
  // the extractor; it must not pass through marked, whose raw-HTML handling
  // would drop the whole body.
  const isHtml = source.trim().startsWith('<')
  const hasH1 = isHtml
    ? /<h1[\s>]/i.test(source)
    : marked.lexer(source).some((t) => t.type === 'heading' && t.depth === 1)
  const title = (meta.title ?? '').trim()

  // The published page's H1 is the article title in every template we render,
  // so a draft without its own H1 is assessed with the title in that slot.
  // Disclosed on the report, never silent.
  const h1FromTitle = !hasH1 && !!title
  let rendered = isHtml ? source : (marked.parse(source, { async: false }) as string)

  // Agent artefacts are never article content. A fix once left its own
  // "SUMMARY: …" line above the H1, and the scorer took it for the opening
  // answer (Direct answers 7 → 10). Strip them, and treat anything above the
  // draft's own H1 as outside the article: the published page opens at the H1.
  let artefactsRemoved = 0
  rendered = rendered.replace(AGENT_ARTEFACT_BLOCK, () => {
    artefactsRemoved++
    return ''
  })
  let preH1Removed = false
  if (hasH1) {
    const at = rendered.search(/<h1[\s>]/i)
    if (at > 0 && rendered.slice(0, at).replace(/<[^>]+>/g, '').trim()) {
      preH1Removed = true
      rendered = rendered.slice(at)
    }
  }
  const body = (h1FromTitle ? `<h1>${escapeHtml(title)}</h1>\n` : '') + rendered

  const html = `<!doctype html><html><head><title>${escapeHtml(title)}</title></head><body><main><article>${body}</article></main></body></html>`

  const base = safeBase(meta.siteUrl)
  const extracted = extractPage(html, base)

  const page: ExtractedPage = {
    ...extracted,
    url: `${DRAFT_URL_PREFIX}${meta.articleId}`,
    // Publication-layer fields: a draft has none of these.
    canonical: '',
    metaDescription: '',
    lang: '',
    metaRobots: null,
    structuredData: [],
    structuredDataTypes: [],
    jsonLdBlocks: [],
  }

  return { page, rawHtmlBlocks, h1FromTitle, artefactsRemoved, preH1Removed }
}

/** A paragraph that is an agent header line ("SUMMARY: …", "PATCH:REPLACE"). */
const AGENT_ARTEFACT_BLOCK = /<p[^>]*>\s*(?:SUMMARY:|PATCH:(?:APPEND|REPLACE|EDITS)\b)[\s\S]*?<\/p>/gi

function safeBase(siteUrl?: string | null): string {
  try {
    if (siteUrl) return new URL(siteUrl).toString()
  } catch {
    /* fall through */
  }
  return 'https://draft.invalid/'
}

/**
 * Prefix evidence with the markdown line it came from, so the editor can jump
 * to it (spec §2.4). Matches on the start of the snippet; leaves the snippet
 * unchanged when it cannot be located rather than guessing a line.
 */
export function locateLine(md: string, snippet: string): number | null {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[*_`#>[\]()]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  const first = snippet.split(' | ')[0].split(/:\s/).pop() ?? ''
  const needle = norm(first).replace(/…$/, '').slice(0, 40)
  if (needle.length < 6) return null
  const lines = md.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    if (norm(lines[i]).includes(needle)) return i + 1
  }
  return null
}
