/**
 * Deterministic checks and repairs on generated markdown (generator audit
 * 2026-10-02, changes 2, 3, 10).
 *
 * - The page template renders the title as the H1, so a body H1 doubles it.
 * - The first paragraph must be a short direct answer, not an 80–120 word hook.
 * - Rhetorical triads ("fast, reliable, and affordable") were banned in the
 *   prompt and produced anyway (29 in one article). A ban that is not checked
 *   is not a ban, so they are found here and sent for a targeted rewrite.
 */

/** Remove a body H1 (the template owns it) and demote any further H1s to H2. */
export function stripBodyH1(markdown: string): { markdown: string; removed: string | null } {
  const lines = (markdown ?? '').split(/\r?\n/)
  let removed: string | null = null
  let seenContent = false
  const out: string[] = []
  for (const line of lines) {
    const h1 = /^#\s+(.+?)\s*#*\s*$/.exec(line)
    if (h1) {
      if (!seenContent && removed === null) {
        removed = h1[1]
        continue
      }
      out.push(`## ${h1[1]}`)
      continue
    }
    if (line.trim()) seenContent = true
    out.push(line)
  }
  while (out.length && !out[0].trim()) out.shift()
  return { markdown: out.join('\n'), removed }
}

/** The first prose paragraph (before the first heading), or ''. */
export function openingParagraph(markdown: string): string {
  for (const block of (markdown ?? '').split(/\n\s*\n/)) {
    const t = block.trim()
    if (!t) continue
    if (/^#/.test(t)) return ''
    if (/^(?:[-*+]|\d+[.)])\s|^\||^>/.test(t)) return ''
    return t.replace(/\s+/g, ' ')
  }
  return ''
}

/**
 * The model often writes the right answer and then keeps going, so the opening
 * paragraph runs past 300 characters and the answer no longer lifts cleanly
 * (sample run: Direct answers 2/10). Split it, moving nothing and rewriting
 * nothing: the leading sentences that fit in 300 characters stay as the
 * opening, the rest becomes the next paragraph. Unchanged when the first
 * sentence alone is over 300 characters.
 */
export function tightenOpening(markdown: string): { markdown: string; split: boolean } {
  const md = markdown ?? ''
  const p = openingParagraph(md)
  if (!p || p.length <= 300) return { markdown: md, split: false }
  const sentences = p.split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/)
  let head = ''
  let n = 0
  while (n < sentences.length && (head ? `${head} ${sentences[n]}` : sentences[n]).length <= 300) {
    head = head ? `${head} ${sentences[n]}` : sentences[n]
    n++
  }
  if (!n || n === sentences.length || head.split(/\s+/).length < 12) return { markdown: md, split: false }
  const rest = sentences.slice(n).join(' ')
  const original = md.split(/\n\s*\n/).find((b) => b.trim() && b.trim().replace(/\s+/g, ' ') === p)
  if (!original) return { markdown: md, split: false }
  return { markdown: md.replace(original, `${head}\n\n${rest}`), split: true }
}

/**
 * A draft that opens on a heading has no answer paragraph at all (sample run).
 * The brief already planned one (`direct_answer`); put it first.
 */
export function ensureOpening(markdown: string, directAnswer: string | null | undefined): { markdown: string; added: boolean } {
  const md = (markdown ?? '').trimStart()
  const answer = (directAnswer ?? '').trim()
  if (!answer || openingParagraph(md) || !/^#{2,6}\s/.test(md)) return { markdown: markdown ?? '', added: false }
  return { markdown: `${answer}\n\n${md}`, added: true }
}

/** Same thresholds as the engine's Direct answers check: ≤300 characters, 12+ words. */
export function openingIsDirectAnswer(markdown: string): boolean {
  const p = openingParagraph(markdown)
  return p.length > 0 && p.length <= 300 && p.split(/\s+/).length >= 12
}

/**
 * The model often writes a subheading as a bare line ("What should I look for?"
 * or "**Ease of use**") instead of a heading, which costs question coverage and
 * hierarchy. A standalone line that is a single short question, or wholly bold,
 * and is followed by more content is a heading in all but markup: make it ###.
 */
export function promoteBareHeadings(markdown: string, opts: { allowFirst?: boolean } = {}): { markdown: string; promoted: number } {
  const blocks = (markdown ?? '').split(/\n\s*\n/)
  let promoted = 0
  const out = blocks.map((block, i) => {
    const t = block.trim()
    if (!t || t.includes('\n') || i === blocks.length - 1 || (i === 0 && !opts.allowFirst)) return block
    const next = blocks[i + 1]?.trim() ?? ''
    if (!next || /^#/.test(next)) return block
    const words = t.split(/\s+/).length
    const question = /^[A-Z][^.!?]*\?$/.test(t) && words <= 14
    const bold = /^\*\*([^*]+)\*\*:?$/.exec(t)
    if (question) {
      promoted++
      return `### ${t}`
    }
    if (bold && bold[1].split(/\s+/).length <= 10) {
      promoted++
      return `### ${bold[1].trim()}`
    }
    return block
  })
  return { markdown: out.join('\n\n'), promoted }
}

// ── Banned words ─────────────────────────────────────────────────────────────

/** One list for the prompts and the checker. */
export const BANNED_WORDS = [
  'delve', 'leverage', 'leveraging', 'robust', 'seamless', 'seamlessly', 'crucial', 'cutting-edge', 'dive into',
  "in today's landscape", 'moreover', 'furthermore', 'utilize', 'utilizing', 'facilitate', 'game-changer',
  'game changer', 'revolutionary', 'revolutionize', 'revolutionizing', 'transformative', 'unprecedented',
  'dramatically', 'harness the full potential',
]
const BANNED_RE = new RegExp(`\\b(?:${BANNED_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s/g, '\\s+')).join('|')})\\b`, 'i')

export function findBannedWords(markdown: string): Triad[] {
  const out: Triad[] = []
  for (const line of (markdown ?? '').split(/\r?\n/)) {
    if (!line.trim() || /^\s*(?:\||```)/.test(line)) continue
    const body = line.replace(/^\s*(?:#{1,6}|[-*+]|\d+[.)]|>)\s+/, '')
    for (const sentence of body.split(/(?<=[.!?])\s+/)) {
      const hit = BANNED_RE.exec(sentence)
      if (hit) out.push({ sentence: sentence.trim(), match: hit[0] })
    }
  }
  return out
}

// ── Rule of three ────────────────────────────────────────────────────────────

/** "X, Y, and Z" / "X, Y and Z" / "X, Y, or Z" with short items: the rhetorical triad. */
const ITEM = "(?!(?:so|but|which|while|yet|because|that|who|when|where|if|as|then|and|or|not)\\b)(?:[A-Za-z][\\w'-]*\\s){0,2}[A-Za-z][\\w'-]*"
const TRIAD = new RegExp(`\\b(${ITEM}),\\s+(${ITEM}),?\\s+(?:and|or)\\s+(${ITEM})\\b`, 'g')

export interface Triad {
  sentence: string
  match: string
}

/** Rhetorical triads in prose, including inside list items. Headings, tables, quotes and code are skipped. */
export function findTriads(markdown: string): Triad[] {
  const out: Triad[] = []
  for (const line of (markdown ?? '').split(/\r?\n/)) {
    if (!line.trim() || /^\s*(?:#|\||>|```)/.test(line)) continue
    const body = line.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '')
    for (const sentence of body.split(/(?<=[.!?])\s+/)) {
      const hit = sentence.match(TRIAD)
      if (hit) out.push({ sentence: sentence.trim(), match: hit[0] })
    }
  }
  return out
}
