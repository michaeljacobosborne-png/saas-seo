/**
 * The draft pipeline, independent of the route so it can be tested with a fake
 * model and run from a script against the real one.
 *
 *   1. Write          (prompts.ts: provenance, structure and attribution rules)
 *   2. Strip body H1  (the template owns it)
 *   3. Expand         only if well short; never "add statistics" or case studies
 *   4. Polish         rewrites the hook after the opening answer, never the answer
 *   5. Evidence guard every unsupported figure, source, quote or case study → placeholder
 *   6. Triads         deterministic find, targeted rewrite, re-checked
 *   7. Engine gate    score with buildDraftReport; one targeted revision on failing
 *                     judged-now checks, kept only if Retrievable does not drop
 *
 * The model never sets a score; step 7 uses the deterministic engine.
 */
import { buildDraftReport, type DraftReport } from '@/lib/geo-audit/draft-report'
import { draftFixes } from '@/lib/draft-fixes'
import { applyFixEdits, numberBlocks, splitBlocks, type FixEdit } from '@/lib/targeted-fix'
import { figuresInText, guardEvidence, type EvidenceSource, type Replacement } from './evidence-guard'
import {
  buildConclusionPolishPrompt,
  buildDraftSystemPrompt,
  buildDraftUserPrompt,
  buildExpansionSystemPrompt,
  buildIntroPolishPrompt,
  buildRevisionPrompt,
  buildTriadRewritePrompt,
  type AuthorContext,
  type BrandContext,
} from './prompts'
import { ensureOpening, findBannedWords, findTriads, openingParagraph, promoteBareHeadings, stripBodyH1, tightenOpening } from './structure'

export type ChatModel = 'main' | 'light'
export interface ChatRequest {
  model: ChatModel
  system?: string
  user: string
  json?: boolean
  temperature: number
  maxTokens: number
}
export type Chat = (req: ChatRequest) => Promise<string>

export interface DraftInput {
  articleId: string
  brand: BrandContext
  /** null: no author set. undefined: the profile has no author fields (migration not applied). */
  author: AuthorContext | null | undefined
  sources: EvidenceSource[]
  keyword: string
  secondaryKeywords: string[]
  title: string
  serpIntent: string
  toneNotes: string
  competitorGaps: string[]
  directAnswer?: string | null
  outlineText: string
  targetWordCount: number
  polish: boolean
  /** Progress hook for the route's status column. */
  onStage?: (stage: 'generating' | 'expanding' | 'polishing') => Promise<void> | void
}

export interface DraftOutput {
  content: string
  wordCount: number
  passCount: number
  report: GenerationReport
}

export interface GenerationReport {
  bodyH1Removed: string | null
  evidenceReplaced: Replacement[]
  /** Supplied evidence items the final draft still does not use. */
  evidenceUnused: number
  openingAdded: boolean
  openingSplit: boolean
  headingsPromoted: number
  triadsFound: number
  triadsRemaining: number
  bannedWordsFound: number
  bannedWordsRemaining: number
  revision: { applied: boolean; before: number | null; after: number | null; rejected: string[] }
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

function parseJson<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T
  } catch {
    return null
  }
}

/** Split markdown into the opening answer, the rest of the intro (hook), and the body from the first heading. */
function splitIntro(md: string): { answer: string; hook: string; body: string } {
  const firstHeading = md.search(/^#{2,6}\s/m)
  const intro = firstHeading === -1 ? md : md.slice(0, firstHeading)
  const body = firstHeading === -1 ? '' : md.slice(firstHeading)
  const answer = openingParagraph(intro)
  const hook = intro.trim().slice(intro.trim().indexOf(answer) + answer.length).trim()
  return { answer, hook, body }
}

export async function runDraftPipeline(chat: Chat, input: DraftInput): Promise<DraftOutput> {
  const report: GenerationReport = {
    bodyH1Removed: null,
    evidenceReplaced: [],
    evidenceUnused: 0,
    openingAdded: false,
    openingSplit: false,
    headingsPromoted: 0,
    triadsFound: 0,
    triadsRemaining: 0,
    bannedWordsFound: 0,
    bannedWordsRemaining: 0,
    revision: { applied: false, before: null, after: null, rejected: [] },
  }

  // 1. Write
  await input.onStage?.('generating')
  let content = await chat({
    model: 'main',
    system: buildDraftSystemPrompt({ brand: input.brand, author: input.author ?? null, keyword: input.keyword, sources: input.sources }),
    user: buildDraftUserPrompt(input),
    temperature: 0.7,
    maxTokens: 3800,
  })

  // 2. The template owns the H1.
  const stripped = stripBodyH1(content)
  content = stripped.markdown
  report.bodyH1Removed = stripped.removed

  // 3. Expand only when well short, and only with explanation.
  let passCount = 1
  if (countWords(content) < Math.floor(input.targetWordCount * 0.7)) {
    await input.onStage?.('expanding')
    const expanded = await chat({
      model: 'main',
      system: buildExpansionSystemPrompt(input.brand.name, input.sources),
      user: `ARTICLE:\n${content}\n\nTARGET LENGTH: about ${input.targetWordCount} words (currently ${countWords(content)}).\nTOPICS READERS ALSO ASK ABOUT (to explain, not to cite):\n${input.competitorGaps.map((g) => `- ${g}`).join('\n')}`,
      temperature: 0.6,
      maxTokens: 5000,
    }).catch(() => '')
    if (expanded.trim()) content = stripBodyH1(expanded).markdown
    passCount = 2
  }

  // 4. Polish the hook and the close; the opening answer is never touched.
  if (input.polish) {
    await input.onStage?.('polishing')
    content = await polish(chat, content, input).catch(() => content)
  }

  // 5. Provenance, enforced.
  const guarded = guardEvidence(content, input.sources, { brandName: input.brand.name })
  content = guarded.markdown
  report.evidenceReplaced.push(...guarded.replaced)

  // 6. Structure repairs that move text but never rewrite it: an over-long
  //    opening is split after its answer, bare lines become headings. Then the
  //    style rules the prompt states (rule of three, banned words) are checked.
  const opened = ensureOpening(content, input.directAnswer)
  content = opened.markdown
  report.openingAdded = opened.added
  const tightened = tightenOpening(content)
  content = tightened.markdown
  report.openingSplit = tightened.split
  const promoted = promoteBareHeadings(content)
  content = promoted.markdown
  report.headingsPromoted = promoted.promoted
  const triads = findTriads(content)
  const banned = findBannedWords(content)
  report.triadsFound = triads.length
  report.bannedWordsFound = banned.length
  if (triads.length || banned.length) {
    content = await rewriteStyle(chat, content, [...triads, ...banned].map((t) => t.sentence), 'light').catch(() => content)
    // The light model leaves some; one more round on the main model for what remains.
    const left = [...findTriads(content), ...findBannedWords(content)]
    if (left.length) content = await rewriteStyle(chat, content, left.map((t) => t.sentence), 'main').catch(() => content)
  }
  report.triadsRemaining = findTriads(content).length
  report.bannedWordsRemaining = findBannedWords(content).length

  // 7. Engine gate.
  content = await engineRevision(chat, content, input, report).catch(() => content)

  return { content, wordCount: countWords(content.replace(/<[^>]+>/g, ' ')), passCount, report }
}

async function polish(chat: Chat, content: string, input: DraftInput): Promise<string> {
  const { answer, hook, body } = splitIntro(content)
  const lastH2 = body.lastIndexOf('\n## ')
  const lastSection = lastH2 === -1 ? '' : body.slice(lastH2 + 1)
  const headingEnd = lastSection.indexOf('\n')
  const lastHeading = headingEnd === -1 ? lastSection : lastSection.slice(0, headingEnd)
  // Only a plain closing section is rewritten. A last section with subsections,
  // a list, a table or an FAQ is content, and replacing it with a closing
  // paragraph deleted the FAQ in a sample run.
  const tail = headingEnd === -1 ? '' : lastSection.slice(headingEnd + 1).trim()
  const plainClose = !/^#{3,6}\s|^\s*(?:[-*+]|\d+[.)])\s|^\s*\|/m.test(tail) && !/\b(faq|frequently asked|questions)\b/i.test(lastHeading)
  const conclusion = plainClose ? tail : ''

  const [hooks, closes] = await Promise.all([
    hook
      ? chat({ model: 'main', user: buildIntroPolishPrompt({ title: input.title, keyword: input.keyword, openingAnswer: answer, hook, brandVoice: input.brand.voice ?? 'professional' }), json: true, temperature: 0.8, maxTokens: 700 })
      : Promise.resolve(''),
    conclusion
      ? chat({ model: 'main', user: buildConclusionPolishPrompt({ title: input.title, keyword: input.keyword, conclusion }), json: true, temperature: 0.8, maxTokens: 600 })
      : Promise.resolve(''),
  ])
  const hookOptions = parseJson<{ options?: string[] }>(hooks)?.options?.filter(Boolean) ?? []
  const closeOptions = parseJson<{ options?: string[] }>(closes)?.options?.filter(Boolean) ?? []

  let out = content
  if (hook && hookOptions[0]) out = out.replace(hook, hookOptions[0].trim())
  if (conclusion && closeOptions[0]) out = out.replace(conclusion, closeOptions[0].trim())
  return out
}

async function rewriteStyle(chat: Chat, content: string, sentences: string[], model: ChatModel): Promise<string> {
  const unique = [...new Set(sentences)].slice(0, 40)
  const raw = await chat({ model, user: buildTriadRewritePrompt(unique), json: true, temperature: 0.4, maxTokens: 3000 })
  const rewrites = parseJson<{ rewrites?: { original?: string; rewritten?: string }[] }>(raw)?.rewrites ?? []
  let out = content
  for (const r of rewrites) {
    if (!r.original || !r.rewritten || !unique.includes(r.original)) continue
    // A rewrite may not smuggle in a figure or source the original did not have.
    if (guardEvidence(r.rewritten, []).replaced.length > guardEvidence(r.original, []).replaced.length) continue
    out = out.replace(r.original, r.rewritten.trim())
  }
  return out
}

function scoreOf(r: DraftReport): number | null {
  return r.retrievability.scoreWithheld ? null : r.retrievability.score
}

async function engineRevision(chat: Chat, content: string, input: DraftInput, report: GenerationReport): Promise<string> {
  const now = new Date()
  const score = (md: string) =>
    buildDraftReport({ markdown: md, articleId: input.articleId, title: input.title, brandName: input.brand.name, author: input.author, now })
  const before = score(content)
  report.revision.before = scoreOf(before)

  // Structure fixes, plus any evidence the writer supplied that the draft left
  // out. Evidence gaps beyond that are the writer's to fill, not the model's.
  const unused = unusedSources(content, input.sources)
  report.evidenceUnused = unused.length
  const instructions = [
    ...draftFixes(before, input.keyword, input.brand.name)
      .filter((f) => f.id.startsWith('chunk-') || f.id.startsWith('extract-'))
      .map((f) => f.instruction),
    ...unused.map((s) => `Use this evidence the writer supplied, in the section where it supports a claim, quoted accurately with its source named${s.url ? ` and linked (${s.url})` : ''}: "${s.text.trim()}"`),
  ]
  if (!instructions.length) return content

  const raw = await chat({
    model: 'main',
    user: buildRevisionPrompt({ numberedBlocks: numberBlocks(splitBlocks(content)), instructions, brandName: input.brand.name, sources: input.sources }),
    json: true,
    temperature: 0.3,
    maxTokens: 3000,
  })
  const edits = (parseJson<{ edits?: FixEdit[] }>(raw)?.edits ?? []).map((e) => {
    const g = guardEvidence(e.markdown ?? '', input.sources, { brandName: input.brand.name })
    report.evidenceReplaced.push(...g.replaced)
    // The revision added question "headings" as plain lines; give them markup.
    return { ...e, markdown: promoteBareHeadings(stripBodyH1(g.markdown).markdown, { allowFirst: true }).markdown }
  })
  const result = applyFixEdits(content, edits, { brandName: input.brand.name, evidence: input.sources.map((s) => s.text) })
  report.revision.rejected = result.rejected.map((r) => r.reason)
  if (!result.applied.length) return content

  const after = score(result.html)
  report.revision.after = scoreOf(after)
  if (report.revision.before !== null && (report.revision.after === null || report.revision.after < report.revision.before)) return content
  report.revision.applied = true
  report.evidenceUnused = unusedSources(result.html.replace(/<[^>]+>/g, ' '), input.sources).length
  return result.html
}

/** Supplied sources none of whose figures, URL or label appear in the draft. */
export function unusedSources(content: string, sources: EvidenceSource[]): EvidenceSource[] {
  const text = content.toLowerCase()
  const used = new Set(figuresInText(content))
  return sources.filter((s) => {
    if (s.url && text.includes(s.url.toLowerCase())) return false
    const figs = figuresInText(s.text)
    if (figs.length) return !figs.some((f) => used.has(f))
    const words = s.text.toLowerCase().match(/[a-z]{6,}/g) ?? []
    return words.length > 0 && words.filter((w) => text.includes(w)).length / words.length < 0.5
  })
}
