/**
 * Article generator prompts (generator audit 2026-10-02, all twelve changes;
 * approved by Michael 2026-10-04).
 *
 * Built here, not inline in the routes, so the rules are explicit, reviewable
 * and tested. The governing rule, stated verbatim in every writing prompt:
 *
 *   The article keeps only real citable information, or information the user
 *   supplied directly for this piece. Nothing else.
 *
 * The prompt states the rule; `guardEvidence` enforces it on the output. The
 * structure rules mirror what the engine rewards: a direct answer first, one H1
 * owned by the template, sections of 40–180 words, question headings, tables
 * and lists where they fit, named authorship, owned terms, brand in claims.
 */
import type { EvidenceSource } from './evidence-guard'
import { BANNED_WORDS } from './structure'

export interface BrandContext {
  name: string | null
  voice?: string | null
  tone?: string | null
  audience?: string | null
  industry?: string | null
  expertiseNotes?: string | null
  signatureAngles?: string | null
  avoidTopics?: string | null
  avoidPhrases?: string | null
  competitors?: string | null
  primaryKeywords?: string | null
}

export interface AuthorContext {
  name?: string | null
  credentials?: string | null
}

// ── Shared rule blocks ───────────────────────────────────────────────────────

export const PROVENANCE_RULE =
  'The article keeps only real citable information, or information the user supplied directly for this piece. Nothing else.'

export function evidenceBlock(sources: EvidenceSource[]): string {
  const listed = sources.length
    ? sources.map((s, i) => `[S${i + 1}] ${s.label}${s.url ? ` (${s.url})` : ''}:\n${s.text.trim()}`).join('\n\n')
    : '(none supplied for this article)'
  return `═══ EVIDENCE YOU MAY USE (the only facts you have) ═══
${listed}`
}

export function integrityBlock(brandName: string | null): string {
  const brand = brandName ? `"${brandName}"` : 'the brand'
  return `═══ INTEGRITY RULES (these override every other instruction) ═══
${PROVENANCE_RULE}
• A statistic, figure, percentage, price, study, survey, quote, case study or customer result may appear ONLY if it is in the EVIDENCE list above. Use it with its source named, and its link where one is given.
• The writer supplied the EVIDENCE list for this article: use every item that is relevant, in the section where it supports a claim, quoted accurately with its source named and linked as a markdown link. First-hand evidence is the most valuable thing in the article; do not leave it out.
• Where the article would benefit from evidence that is not in the list, write a visible placeholder in its place: [ADD EVIDENCE: what is needed]. The writer fills it before publishing.
• Never invent a figure. Never attribute a figure or finding to a named company, publication or researcher unless that source is in the list. Never soften an invented number into a vaguer one ("around a third", "many companies"): use the placeholder instead.
• Never use unnamed authority: no "industry benchmarks show", "studies show", "research suggests", "experts say", "according to industry data".
• Never describe testing, research, analysis or results as if ${brand}, the author, "we" or "our team" carried them out, unless the EVIDENCE list says so.
• Never invent product facts about ${brand} or any other company: no prices, plans, feature lists, integrations, customer counts or results unless they are in the EVIDENCE list. Describe what a product does only in general terms the evidence supports, or use a placeholder.
• Never invent case studies, client stories, customer quotes or testimonials.
• Never invent stand-in products ("Tool A", "Option B") or give attributes to products that are not named in the EVIDENCE list.
• Never call ${brand} leading, the best, at the forefront, trusted or loved, unless the EVIDENCE list supports it.`
}

export function retrievalBlock(keyword: string): string {
  return `═══ STRUCTURE (what makes passages easy to lift and credit) ═══
• Do NOT write an H1. The page template renders the title as the H1. Start with the opening paragraph, then use ## for sections and ### for subsections.
• The opening paragraph is a direct answer: under 300 characters, at least 12 words, and it includes a plain definition sentence of the form "${keyword || 'The subject'} is …". The hook, problem or tension comes in the second paragraph, never before the answer.
• Sections of 40 to 180 words. Split a longer section under ### subheadings at its natural sub-points. On articles over 1,500 words, aim for six or more ### subsections.
• Phrase two to four ## or ### headings as the question a reader would actually type, and answer it in the first sentence beneath. Other headings state the section's conclusion.
• Every heading uses ## or ### markup. Never write a heading as a bold line or a bare question on its own line.
• Use a table where the content compares options or values side by side, and a list where it walks through steps or parallel items. Do not force either where prose is clearer.
• A comparison table compares only what the EVIDENCE supports. When it names no products (or competitor names are not allowed), compare criteria instead: what to check, why it matters, and how to tell. Write tables in markdown table syntax.
• Under every heading, the first two sentences answer the heading directly, so the section stands alone when quoted.`
}

export function attributionBlock(brand: BrandContext, author: AuthorContext | null): string {
  const lines: string[] = ['═══ ATTRIBUTION (so a quoted passage carries its source) ═══']
  if (brand.name) {
    lines.push(
      `• Where a sentence states what ${brand.name} does, offers or recommends, name ${brand.name} in that sentence. Do not add the name to every paragraph, and never present ${brand.name} as the source of research or data (see INTEGRITY).`,
      `• Write about ${brand.name} as the publisher of this article, not as one more tool in a list of competitors.`,
      `• When the article covers work ${brand.name} does, say so plainly in the sections where it is relevant (at least two), naming ${brand.name} in the sentence. Keep it to what ${brand.name} does in general terms; specifics such as prices, features or results only from the EVIDENCE list.`,
    )
  }
  if (author?.name) {
    lines.push(
      `• The article is written by ${author.name}${author.credentials ? ` (${author.credentials})` : ''}. Where a perspective below is first-hand, attribute it to ${author.name} by name. Never invent experience, credentials or anecdotes for ${author.name}.`,
    )
  } else {
    lines.push('• No author is set. Do not invent one, and do not write first-person experience claims.')
  }
  if (brand.signatureAngles) {
    lines.push(
      `• Owned terms: if the angles below describe a method or framework of the brand's own, give it one consistent name and use that name each time it appears. Use at most two such names. Never coin a name for a generic idea.\nANGLES: ${brand.signatureAngles}`,
    )
  }
  if (brand.expertiseNotes) {
    lines.push(`AUTHOR PERSPECTIVES (use to shape argument; they are not a source for figures):\n${brand.expertiseNotes}`)
  }
  return lines.join('\n')
}

const STYLE_BLOCK = `═══ STYLE ═══
• Vary sentence length. Never three sentences of matching length in a row.
• Use contractions. Active voice: find the person doing the action and make them the subject.
• Cut adverbs; choose a stronger verb instead.
• No throat-clearing (It's worth noting, Importantly, Interestingly, Notably, Ultimately, Essentially), no "In this article we'll cover".
• No binary contrasts ("Not X, it's Y"), no vague declaratives ("The implications are significant"), no cinematic one-liners closing a paragraph, no section-closing summaries.
• No hype: game-changer, revolutionary, transformative, unprecedented, powerful.
• Banned words (a checker rewrites any that appear): ${BANNED_WORDS.join(', ')}.
• No em dashes; use a comma, parentheses or a colon.
• Lists of exactly three items only when there really are three things. Do not build "A, B, and C" phrases for rhythm; use two items, four, or a sentence. A checker rewrites every inline triad it finds.
• Introduce a list with a sentence and follow it with one.`

// ── Brief ────────────────────────────────────────────────────────────────────

export function buildBriefPrompt(input: {
  brand: BrandContext
  keywordLines: string
  directTopic?: string | null
}): string {
  const b = input.brand
  return `You are an SEO content strategist for ${b.name ?? 'the brand'}${b.industry ? `, a ${b.industry} company` : ''}, targeting ${b.audience ?? 'their ideal audience'}.

Brand voice: ${b.voice ?? 'professional'}
Tone notes: ${b.tone ?? 'none'}
Brand keywords: ${b.primaryKeywords || 'none'}
${b.expertiseNotes ? `Author perspectives: ${b.expertiseNotes}` : ''}
${b.signatureAngles ? `Content angles: ${b.signatureAngles}` : ''}
${b.avoidTopics ? `NEVER write about or reference: ${b.avoidTopics}` : ''}
${b.avoidPhrases ? `NEVER use these phrases or terms: ${b.avoidPhrases}` : ''}
${b.competitors ? `COMPETITOR NAMES: do not name these brands in the article unless the brand explicitly permits comparisons: ${b.competitors}` : ''}

${input.directTopic ? `Article topic: "${input.directTopic}"\n` : ''}Keywords for this article (search data only; these are not facts to cite):
${input.keywordLines}

${PROVENANCE_RULE} The brief must not plan any section that depends on evidence nobody has supplied: no "what we found after testing", no "our results", no case studies, no original research, unless the user has supplied that material.

Generate a content brief. Return JSON only, no markdown:
{
  "target_keyword": "the single best keyword from the list",
  "secondary_keywords": ["related terms to use where they fit naturally, from the list and closely related concepts"],
  "h1_options": ["a specific, keyword-forward title", "an alternative title"],
  "meta_description": "150 to 160 characters, includes the target keyword",
  "url_slug": "clean-keyword-slug",
  "direct_answer": "one or two sentences, under 300 characters, that answer the target keyword plainly and include a definition sentence. The article opens with this.",
  "outline": [
    {
      "heading": "Either the question a reader would type, or a heading that states the section's conclusion",
      "heading_level": "H2",
      "notes": "What this section concludes, and what material supports it. If the support would be a figure or example nobody has supplied, say [ADD EVIDENCE] here rather than inventing one.",
      "word_count_target": 140
    }
  ],
  "word_count_target": 1500,
  "tone_notes": "specific writing guidance combining brand voice and keyword intent",
  "competitor_gaps": ["an angle competitors likely miss", "another"],
  "serp_intent": "informational | commercial | comparison | transactional"
}

Outline rules:
• Every section targets 120 to 160 words. A section that needs more is split into ### subsections of that size.
• Two to four headings are phrased as the question a reader would type; the rest state their conclusion. A heading that could sit on any generic article is rewritten until it could not.
• Include an FAQ section (H2) with ### question subsections when the topic has distinct follow-up questions; skip it when it would repeat the body.
• If serp_intent is "commercial" or "comparison", include a section with a comparison table of the options on criteria the reader cares about. Describe each option in general terms only; never plan prices, results or test outcomes unless supplied.
• The sum of word_count_target values equals word_count_target.`
}

// ── Draft ────────────────────────────────────────────────────────────────────

export function buildDraftSystemPrompt(input: {
  brand: BrandContext
  author: AuthorContext | null
  keyword: string
  sources: EvidenceSource[]
}): string {
  const b = input.brand
  const constraints = [
    b.avoidTopics ? `NEVER write about or reference: ${b.avoidTopics}` : '',
    b.avoidPhrases ? `NEVER use these phrases or terms: ${b.avoidPhrases}` : '',
    b.competitors ? `COMPETITOR NAMES: do not mention these brands by name: ${b.competitors}` : '',
  ].filter(Boolean)

  return `You write articles for ${b.name ?? 'the brand'}.

BRAND VOICE: ${b.voice ?? 'professional'}
TONE: ${b.tone ?? 'Clear and direct.'}
AUDIENCE: ${b.audience ?? 'readers looking to learn'}
${constraints.length ? `\n═══ BRAND CONSTRAINTS ═══\n${constraints.join('\n')}\n` : ''}
${evidenceBlock(input.sources)}

${integrityBlock(b.name)}

${retrievalBlock(input.keyword)}

${attributionBlock(b, input.author)}

${STYLE_BLOCK}

═══ SEO ═══
• Use the target keyword in the opening paragraph and in at least one ## heading. Use secondary keywords where they fit; never stuff them.
• Do not include the meta description in the body.

Write in Markdown. No H1. Start with the opening paragraph.`
}

export function buildDraftUserPrompt(input: {
  keyword: string
  secondaryKeywords: string[]
  title: string
  serpIntent: string
  toneNotes: string
  competitorGaps: string[]
  directAnswer?: string | null
  outlineText: string
  targetWordCount: number
}): string {
  const low = Math.round(input.targetWordCount * 0.85)
  const high = Math.round(input.targetWordCount * 1.1)
  return `Write the article from this brief.

TITLE (rendered by the template as the H1; do not repeat it): ${input.title}
TARGET KEYWORD: ${input.keyword}
SECONDARY KEYWORDS: ${input.secondaryKeywords.join(', ')}
SERP INTENT: ${input.serpIntent}
TONE NOTES: ${input.toneNotes}
ANGLES COMPETITORS MISS: ${input.competitorGaps.join('; ')}
${input.directAnswer ? `OPENING ANSWER (start with this, refined if needed, under 300 characters): ${input.directAnswer}\n` : ''}
LENGTH: aim for ${low} to ${high} words. A shorter article that is complete is better than a padded one. Never add a section, example or case study just to reach the length.

OUTLINE:
${input.outlineText}

Write the full article now.`
}

// ── Later passes ─────────────────────────────────────────────────────────────

export function buildExpansionSystemPrompt(brandName: string | null, sources: EvidenceSource[]): string {
  return `You are a senior editor. The article below is short of its target length. Deepen the sections that are thin: explain the reasoning, add the steps a reader needs, answer the follow-up questions listed. Return the complete article in markdown, with no H1.

${evidenceBlock(sources)}

${integrityBlock(brandName)}

The expansion angles and related searches you are given are topics to explain, not facts to cite: they contain no statistics. If the article is complete as it is, return it unchanged; length is not a reason to add material.
Keep every section between 40 and 180 words, splitting under ### where needed. Keep the opening paragraph exactly as it is.
${STYLE_BLOCK}`
}

/**
 * The polish pass rewrites only what follows the opening answer. The answer
 * paragraph is fixed; the old pass replaced it with an 80–120 word hook that
 * avoided defining the topic, which cost Direct answers up to 8 points.
 */
export function buildIntroPolishPrompt(input: { title: string; keyword: string; openingAnswer: string; hook: string; brandVoice: string }): string {
  return `The article opens with this direct answer, which stays exactly as it is:
"${input.openingAnswer}"

Rewrite the paragraph that follows it (the hook) in two alternative ways. Each must:
• follow on from the answer above without repeating it
• set up the problem or stakes for the reader in 40 to 90 words
• use contractions and no hype
• add no figures, sources, quotes or examples that are not already in the current hook
Return only JSON: {"options": ["...", "..."]}
Article title: ${input.title}
Target keyword: ${input.keyword}
Brand voice: ${input.brandVoice}
Current hook: ${input.hook}`
}

export function buildConclusionPolishPrompt(input: { title: string; keyword: string; conclusion: string }): string {
  return `Write two alternative closing paragraphs for this article: one ending with a clear next action, one reframing the opening problem. No "In conclusion", no recap, 60 to 100 words each. Add no figures, sources, quotes or examples that are not in the current conclusion.
Return only JSON: {"options": ["...", "..."]}
Article title: ${input.title}
Target keyword: ${input.keyword}
Current conclusion: ${input.conclusion}`
}

export function buildTriadRewritePrompt(sentences: string[]): string {
  return `Each sentence below breaks a style rule. Rewrite each one so it does not:
• A list of three short items ("A, B, and C") used for rhythm: keep two items, use four only if there truly are four, or make it a plain sentence.
• A banned word (${BANNED_WORDS.join(', ')}): replace it with a plain, specific word.
Keep the meaning and every fact, and add nothing new: no figures, sources or examples.
Return only JSON: {"rewrites": [{"original": "...", "rewritten": "..."}]}

${sentences.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
}

/** One targeted revision on the failing judged-now checks, as block edits (change 12). */
export function buildRevisionPrompt(input: { numberedBlocks: string; instructions: string[]; brandName: string | null; sources: EvidenceSource[] }): string {
  return `The article below was scored by a deterministic checker. Make targeted edits for these findings only:
${input.instructions.map((s) => `- ${s}`).join('\n')}

${evidenceBlock(input.sources)}

${integrityBlock(input.brandName)}

THE ARTICLE, as numbered blocks ("[index] (tag) text"):
${input.numberedBlocks}

Return only JSON: {"edits": [{"op": "replace" | "insert_after", "block": <index>, "markdown": "..."}]}
Edit only the blocks the findings are about, at most 6 edits. Every block you do not name stays exactly as it is. Do not add an H1. A heading you add or rephrase uses ## or ### markup, never a plain line.`
}
