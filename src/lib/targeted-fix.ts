/**
 * Targeted fixes for the editor's "Fix" buttons (signed-in pass, 2026-10-04,
 * findings 1–3).
 *
 * A fix used to come back as a whole rewritten article, with the agent's
 * SUMMARY line able to leak into the body. Now the model returns block-level
 * edits as structured data, and this module:
 *   - splits the article into top-level blocks and numbers them for the model
 *   - validates each edit: the block exists, edits stay few, nothing touches a
 *     block the edit did not name
 *   - refuses any edit that fabricates: a figure the original block did not
 *     contain, or a claim attributed to the brand (or "we"/"our") as its own
 *     research. Attaching an existing unsourced number to anyone is
 *     fabrication, not attribution.
 *   - splices accepted edits in, leaving every other block byte-identical
 *
 * The summary is a separate field and never enters the body.
 * Server-side only (cheerio).
 */
import * as cheerio from 'cheerio'
import { Marked } from 'marked'

export interface FixEdit {
  op: 'replace' | 'insert_after'
  /** 0-based block index from `numberBlocks`. -1 with insert_after means "at the start". */
  block: number
  /** Markdown for the new or replacement block(s). */
  markdown: string
}

export interface RejectedEdit {
  edit: FixEdit
  reason: string
}

export interface FixResult {
  html: string
  applied: FixEdit[]
  rejected: RejectedEdit[]
  /** Indices of original blocks that changed or gained a neighbour. */
  touched: number[]
}

export const MAX_EDITS = 6
export const EVIDENCE_PLACEHOLDER = /\[ADD EVIDENCE:[^\]]*\]/gi

/** Top-level blocks of editor HTML (or markdown, rendered first), as outer HTML strings. */
export function splitBlocks(content: string): string[] {
  const html = content.trim().startsWith('<') ? content : (new Marked({ gfm: true }).parse(content ?? '', { async: false }) as string)
  const $ = cheerio.load(html, null, false)
  const out: string[] = []
  $.root()
    .contents()
    .each((_, node) => {
      if (node.type === 'text') {
        const t = $(node).text().trim()
        if (t) out.push(`<p>${escapeHtml(t)}</p>`)
        return
      }
      if (node.type !== 'tag') return
      out.push($.html(node))
    })
  return out
}

export function blockText(blockHtml: string): string {
  return cheerio.load(blockHtml, null, false).root().text().replace(/\s+/g, ' ').trim()
}

/** The article as the model sees it: "[3] (h2) text". */
export function numberBlocks(blocks: string[]): string {
  return blocks
    .map((b, i) => {
      const tag = /^<\s*([a-z0-9]+)/i.exec(b)?.[1]?.toLowerCase() ?? 'p'
      return `[${i}] (${tag}) ${blockText(b)}`
    })
    .join('\n\n')
}

// ── Integrity ────────────────────────────────────────────────────────────────

/** Concrete figures: percentages, ranges, money, multipliers, and numbers of 2+ digits. */
export function figuresIn(text: string): string[] {
  const t = text.replace(EVIDENCE_PLACEHOLDER, ' ')
  const re = /[$£€]?\d[\d,.]*(?:\s*[-–]\s*\d[\d,.]*)?\s*(?:%|percent|x\b|×|k\b|m\b|bn\b|million|billion)?/gi
  return (t.match(re) ?? [])
    .map((m) => m.replace(/\s+/g, '').toLowerCase())
    .filter((m) => /%|percent|[$£€]|x$|×|k$|m$|bn$|million|billion/.test(m) || /\d{2,}/.test(m.replace(/[,.]/g, '')))
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const RESEARCH_NOUN = '(?:analysis|analyses|research|data|study|studies|survey|surveys|findings|testing|tests|benchmarks?|experiments?|investigation|report)'
const RESEARCH_VERB = '(?:found|finds|discovered|measured|tested|observed|analy[sz]ed|surveyed|studied|has found|have found|research(?:ed)?|shows?|showed)'

/** Phrases that present a claim as the brand's (or the writer's) own research. */
export function firstPartyAttributions(text: string, brandName?: string | null): string[] {
  const owners = ['our', 'we', 'us']
  if (brandName?.trim()) owners.push(escapeRe(brandName.trim()))
  const owner = `(?:${owners.join('|')})`
  const patterns = [
    new RegExp(`\\b(?:according to|per|based on)\\s+${owner}(?:'s|’s)?(?:\\s+(?:own|internal|recent|ongoing|latest))?(?:\\s+${RESEARCH_NOUN})?`, 'gi'),
    new RegExp(`\\b${owner}(?:'s|’s)?\\s+(?:own\\s+|internal\\s+|recent\\s+)?${RESEARCH_NOUN}\\b`, 'gi'),
    new RegExp(`\\b${owner}\\s+(?:has\\s+|have\\s+)?${RESEARCH_VERB}\\b`, 'gi'),
  ]
  const hits: string[] = []
  for (const re of patterns) for (const m of text.matchAll(re)) hits.push(m[0])
  return hits
}

/** Lines the agent must never put in a body: its own headers. */
const ARTEFACT_LINE = /^\s*(?:PATCH:(?:APPEND|REPLACE|EDITS)|SUMMARY:)/i

export function stripAgentArtefacts(markdown: string): string {
  return markdown
    .split(/\r?\n/)
    .filter((l) => !ARTEFACT_LINE.test(l))
    .join('\n')
    .trim()
}

/** Why an edit must not be applied, or null when it is acceptable. */
export function integrityProblem(original: string, replacement: string, brandName?: string | null): string | null {
  const before = new Set(figuresIn(original))
  const added = figuresIn(replacement).filter((f) => !before.has(f))
  if (added.length) return `adds figures that were not in the original text (${added.join(', ')}); a figure needs a real source, so use an [ADD EVIDENCE: …] placeholder instead`
  const had = new Set(firstPartyAttributions(original, brandName).map((s) => s.toLowerCase()))
  const claims = firstPartyAttributions(replacement, brandName).filter((s) => !had.has(s.toLowerCase()))
  if (claims.length) return `presents a claim as first-party research ("${claims[0]}"); attributing an unsourced claim to anyone is fabrication`
  return null
}

// ── Apply ────────────────────────────────────────────────────────────────────

export function applyFixEdits(content: string, edits: FixEdit[], opts: { brandName?: string | null; maxEdits?: number } = {}): FixResult {
  const blocks = splitBlocks(content)
  const md = new Marked({ gfm: true })
  const maxEdits = opts.maxEdits ?? MAX_EDITS
  const applied: FixEdit[] = []
  const rejected: RejectedEdit[] = []
  const replaced = new Map<number, string>()
  const insertedAfter = new Map<number, string[]>()
  const seen = new Set<number>()

  for (const raw of edits) {
    const edit = { ...raw, markdown: stripAgentArtefacts(raw.markdown ?? '') }
    const reject = (reason: string) => rejected.push({ edit: raw, reason })
    if (applied.length >= maxEdits) { reject(`more than ${maxEdits} edits; a targeted fix changes only what the finding is about`); continue }
    if (!Number.isInteger(edit.block) || edit.block < (edit.op === 'insert_after' ? -1 : 0) || edit.block >= blocks.length) { reject('names a block that does not exist'); continue }
    if (!edit.markdown) { reject('is empty'); continue }
    if (edit.op === 'replace' && seen.has(edit.block)) { reject('edits the same block twice'); continue }
    const original = edit.op === 'replace' ? blockText(blocks[edit.block]) : ''
    const problem = integrityProblem(original, edit.markdown, opts.brandName)
    if (problem) { reject(problem); continue }
    const html = (md.parse(edit.markdown, { async: false }) as string).trim()
    if (edit.op === 'replace') {
      replaced.set(edit.block, html)
      seen.add(edit.block)
    } else {
      insertedAfter.set(edit.block, [...(insertedAfter.get(edit.block) ?? []), html])
    }
    applied.push(edit)
  }

  const out: string[] = [...(insertedAfter.get(-1) ?? [])]
  blocks.forEach((b, i) => {
    out.push(replaced.get(i) ?? b)
    out.push(...(insertedAfter.get(i) ?? []))
  })
  const touched = [...new Set([...replaced.keys(), ...[...insertedAfter.keys()].filter((k) => k >= 0)])].sort((a, b) => a - b)
  return { html: out.join(''), applied, rejected, touched }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
