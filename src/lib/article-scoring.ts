import type { ArticleScores } from '@/lib/supabase/types'

export type { ArticleScores }

/**
 * Normalise content for scoring regardless of whether it was saved as HTML
 * (Tiptap editor autosaves HTML) or raw markdown (imported articles).
 */
function normalizeForScoring(content: string): string {
  const trimmed = content.trim()
  if (!trimmed.startsWith('<')) return content // already markdown

  return content
    // Headings — must come before generic tag strip
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, t) => `# ${t.replace(/<[^>]+>/g, '').trim()}\n`)
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, t) => `## ${t.replace(/<[^>]+>/g, '').trim()}\n`)
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, t) => `### ${t.replace(/<[^>]+>/g, '').trim()}\n`)
    .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, (_, t) => `#### ${t.replace(/<[^>]+>/g, '').trim()}\n`)
    .replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, (_, t) => `##### ${t.replace(/<[^>]+>/g, '').trim()}\n`)
    .replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, (_, t) => `###### ${t.replace(/<[^>]+>/g, '').trim()}\n`)
    // Formatting
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*')
    // Lists
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, t) => `- ${t.replace(/<[^>]+>/g, '').trim()}\n`)
    // Links
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    // Paragraphs and line breaks
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    // Strip remaining tags
    .replace(/<[^>]+>/g, '')
    // HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Normalize whitespace but keep paragraph breaks
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

export function stripMarkdown(md: string): string {
  if (md.trim().startsWith('<')) md = normalizeForScoring(md)
  return md
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*|__|\*|_|`{1,3}/g, '')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/!\[[^\]]*\]\([^\)]+\)/g, '')
    .replace(/^>\s+/gm, '')
    .trim()
}

/**
 * SEO basics (decision 28, signed-in pass findings 5 and 10).
 *
 * Only checks with a real basis remain, as a pass/fail checklist with no 0–100
 * number. Removed as invented thresholds:
 * - H2 count 2–4 (it contradicted Retrievable, which wants 6+)
 * - word count 1800–2500
 * - keyword in the first 100 words
 * - keyword density under 3%
 * - URL slug keyword
 * - secondary keyword coverage
 * - FAQ section present
 * - every Readability metric
 *
 * The meta description is read from the article's own field, not the brief; the
 * old check scored an empty field 10/10 from the brief's copy. `score` remains
 * for stored-row compatibility only and is not shown.
 */
export const SEO_BASICS_KEYS = ['kw_in_title', 'meta_present', 'meta_length'] as const

export function computeSEO(
  content: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  brief: Record<string, any>,
  targetKeyword: string,
  page: { title?: string | null; metaDescription?: string | null } = {},
) {
  content = normalizeForScoring(content)
  const kw = targetKeyword.toLowerCase().trim()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const breakdown: Record<string, any> = {}

  // The title the template renders as the H1; a body H1 only if there is no title.
  const title = (page.title ?? content.match(/^#\s+(.+)$/m)?.[1] ?? brief?.title ?? (brief?.h1_options as string[] | undefined)?.[0] ?? '').trim()
  const kwInTitle = !!kw && title.toLowerCase().includes(kw)
  breakdown.kw_in_title = {
    label: kw ? `Target keyword "${targetKeyword}" in the title` : 'Target keyword in the title (no keyword set)',
    points: kwInTitle ? 1 : 0,
    max: 1,
    passed: kwInTitle,
  }

  // Google uses the meta description as a snippet candidate when it is present.
  const meta = (page.metaDescription ?? '').trim()
  breakdown.meta_present = {
    label: meta ? 'Meta description is set' : 'No meta description is set (use Auto-generate above the editor)',
    points: meta ? 1 : 0,
    max: 1,
    passed: !!meta,
  }

  // Not scored: Google truncates by pixel width, not a fixed count, so this only
  // warns. Nothing to say about the length of a description that is not set.
  if (meta) breakdown.meta_length = {
    label: meta.length > 160
      ? `Meta description is ${meta.length} characters; search results may cut it off after about 160`
      : `Meta description length: ${meta.length} characters`,
    points: 0,
    max: 0,
    passed: meta.length <= 160,
    warning: true,
  }

  const scored = Object.values(breakdown).filter((c) => c.max > 0)
  const score = scored.length ? Math.round((scored.filter((c) => c.passed).length / scored.length) * 100) : 0
  return { score, breakdown }
}

export function computeGEO(content: string) {
  content = normalizeForScoring(content)
  let score = 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const breakdown: Record<string, any> = {}

  // +20 Definition paragraph in first 500 words
  const first500 = content.split(/\s+/).slice(0, 500).join(' ')
  const hasDef = /\b\w[\w\s]*\s+is\s+(a|an|the)\b|\brefers?\s+to\b/i.test(first500)
  breakdown.definition = { label: 'Definitional statement in first 500 words', passed: hasDef }
  score += hasDef ? 20 : 0

  // +20 At least 3 H2 sections
  const h2Count = (content.match(/^##\s+/gm) ?? []).length
  const hasStructure = h2Count >= 3
  breakdown.structure = { label: `Structured H2 sections: ${h2Count} (target ≥ 3)`, passed: hasStructure }
  score += hasStructure ? 20 : 0

  // +20 Stat/data sentence per section
  const statHits = (content.match(/\b(according to|research shows?|studies show?|industry|benchmark|data shows?|percent|%|\d+x|\d+\s*(million|billion|thousand))\b/gi) ?? []).length
  const hasStats = statHits >= Math.max(1, h2Count)
  breakdown.stats = { label: `Data/stat references: ${statHits} across sections`, passed: hasStats }
  score += hasStats ? 20 : 0

  // +20 FAQ present
  const hasFAQ = /^#{1,3}\s*(faq|frequently asked questions)/im.test(content)
  breakdown.faq = { label: 'FAQ section present', passed: hasFAQ }
  score += hasFAQ ? 20 : 0

  // +20 Word count 1500+
  const wc = countWords(content)
  const longEnough = wc >= 1500
  breakdown.length = { label: `Total word count: ${wc} (target ≥ 1500)`, passed: longEnough }
  score += longEnough ? 20 : 0

  return { score: Math.min(100, score), breakdown }
}

export function computeAEO(content: string) {
  content = normalizeForScoring(content)
  let score = 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const breakdown: Record<string, any> = {}

  // +40 FAQ with H3 questions immediately followed by answers
  const h3Questions = (content.match(/^###\s+.+\?/gm) ?? []).length
  const faqPts = h3Questions >= 3 ? 40 : h3Questions > 0 ? 20 : 0
  breakdown.faq_h3 = { label: `FAQ H3 questions found: ${h3Questions} (target ≥ 3)`, passed: h3Questions >= 3 }
  score += faqPts

  // +30 Short direct-answer paragraph (40-80 words)
  const paras = content.split(/\n\n+/)
  const hasDirectAnswer = paras.some((p) => {
    const wc = p.trim().split(/\s+/).length
    return wc >= 40 && wc <= 80 && !p.trim().startsWith('#')
  })
  breakdown.direct_answer = { label: 'Direct-answer paragraph (40-80 words)', passed: hasDirectAnswer }
  score += hasDirectAnswer ? 30 : 0

  // +15 Lists or numbered steps
  const hasList = /^[-*+]\s|^\d+\.\s/m.test(content)
  breakdown.lists = { label: 'Lists or numbered steps present', passed: hasList }
  score += hasList ? 15 : 0

  // +15 Key Takeaways / Summary section
  const hasTakeaways = /^#{1,3}\s*(key takeaways?|summary|wrap[\s-]?up)/im.test(content)
  breakdown.takeaways = { label: 'Key Takeaways or Summary section', passed: hasTakeaways }
  score += hasTakeaways ? 15 : 0

  return { score: Math.min(100, score), breakdown }
}
