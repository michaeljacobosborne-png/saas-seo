/**
 * Deterministic AO (Answer Optimization) scoring.
 *
 * Same contract as the GEO scorer: points come only from extracted evidence,
 * every award names its source, and the six factor names and weights match the
 * previous version so historical reports stay comparable.
 */

import { countWords, truncate, type ExtractedPage } from './extract'
import { FactorBuilder } from './scoring'
import type { ScoreInput } from './score-geo'
import type { Evidence, Factor } from './types'

const ev = (url: string, kind: Evidence['kind'], snippet: string): Evidence => ({
  url,
  kind,
  snippet: truncate(snippet, 300),
})

const QUESTION_START = /^(what|why|how|when|where|who|which|can|do|does|is|are|should|will|would|could)\b/i
const CONVERSATIONAL = /\b(you|your|you're|we|our|let's|here's|that's|don't|doesn't|isn't|if you|when you)\b/i

export function scoreAo(input: ScoreInput): Factor[] {
  return [
    scoreQuestionHeadings(input),
    scoreSnippetFormat(input),
    scoreFaqSections(input),
    scoreScannableStructure(input),
    scoreConversationalLanguage(input),
    scoreRelatedCoverage(input),
  ]
}

function questionHeadings(page: ExtractedPage) {
  return page.headings.filter((h) => h.text.includes('?') || QUESTION_START.test(h.text))
}

// ── 1. Question-based headings (20) ────────────────────────────────────────────

function scoreQuestionHeadings({ home }: ScoreInput): Factor {
  const f = new FactorBuilder('question-headings', 'Question-based headings', 20)
  const subheads = home.headings.filter((h) => h.level >= 2 && h.level <= 3)

  if (subheads.length === 0) {
    f.miss('The page has no H2 or H3 headings to phrase as questions.')
    return f.build()
  }

  const questions = questionHeadings(home).filter((h) => h.level >= 2 && h.level <= 3)
  const explicit = questions.filter((h) => h.text.includes('?'))

  if (explicit.length >= 3) {
    f.award(14, `${explicit.length} subheadings are phrased as explicit questions.`, ev(home.url, 'heading', explicit.slice(0, 3).map((h) => h.text).join(' | ')))
  } else if (explicit.length >= 1) {
    f.award(8, `${explicit.length} subheading(s) are phrased as explicit questions.`, ev(home.url, 'heading', explicit.map((h) => h.text).join(' | ')))
  } else if (questions.length >= 2) {
    f.award(5, `${questions.length} subheadings open with a question word but are not phrased as questions.`, ev(home.url, 'heading', questions.slice(0, 3).map((h) => h.text).join(' | ')))
  } else {
    f.miss(`None of the ${subheads.length} subheadings are phrased as questions a reader would search for.`)
    f.note(ev(home.url, 'heading', subheads.slice(0, 3).map((h) => h.text).join(' | ')))
  }

  // Topic-shaped headings still help even when not interrogative.
  const descriptive = subheads.filter((h) => countWords(h.text) >= 3)
  if (descriptive.length >= 5) {
    f.award(6, `${descriptive.length} subheadings are descriptive enough to signal their section's topic.`, ev(home.url, 'heading', descriptive.slice(0, 3).map((h) => h.text).join(' | ')))
  } else if (descriptive.length >= 2) {
    f.award(3, `${descriptive.length} subheadings are descriptive rather than one-word labels.`)
  }

  return f.build()
}

// ── 2. Featured snippet format (20) ────────────────────────────────────────────

function scoreSnippetFormat({ home }: ScoreInput): Factor {
  const f = new FactorBuilder('snippet-format', 'Featured snippet format', 20)

  const opener = home.paragraphs.find((p) => countWords(p) >= 12)
  if (opener && opener.length <= 300) {
    f.award(8, `The page opens with a self-contained answer of ${opener.length} characters.`, ev(home.url, 'text', opener))
  } else if (opener) {
    f.award(3, `The opening paragraph is ${opener.length} characters — above the ~300 that lifts cleanly into an answer box.`, ev(home.url, 'text', truncate(opener, 200)))
  } else {
    f.miss('No opening paragraph states an answer before the page moves on.')
  }

  const snippetSized = home.paragraphs.filter((p) => p.length >= 60 && p.length <= 300)
  if (snippetSized.length >= 6) {
    f.award(7, `${snippetSized.length} paragraphs sit in the 60–300 character range that answer boxes quote.`)
  } else if (snippetSized.length >= 2) {
    f.award(4, `${snippetSized.length} paragraphs sit in the range answer boxes quote.`)
  } else {
    f.miss('Few paragraphs are short enough to be quoted whole as an answer.')
  }

  // A definition sentence ("X is a…") is the single most liftable form.
  const definition = home.paragraphs.find((p) => /\b(is|are)\s+(a|an|the)\s+\w+/i.test(p) && p.length <= 300)
  if (definition) {
    f.award(5, 'A definition-style sentence states plainly what the subject is.', ev(home.url, 'text', definition))
  } else {
    f.miss('No definition-style sentence ("X is a …") states plainly what the subject is.')
  }

  return f.build()
}

// ── 3. FAQ / Q&A sections (15) ─────────────────────────────────────────────────

function scoreFaqSections({ home }: ScoreInput): Factor {
  const f = new FactorBuilder('faq', 'FAQ/Q&A sections', 15)

  const hasFaqSchema = home.structuredDataTypes.some((t) => /^(FAQPage|QAPage|Question)$/i.test(t))
  if (hasFaqSchema) {
    f.award(9, 'FAQ structured data marks question-and-answer pairs explicitly.', ev(home.url, 'jsonld', 'FAQPage'))
  } else {
    f.miss('No FAQPage or QAPage structured data was found on the inspected page.')
  }

  const questionHeads = questionHeadings(home).filter((h) => h.text.includes('?'))
  const faqHeading = home.headings.find((h) => /\b(faq|frequently asked|common questions|questions? answered)\b/i.test(h.text))

  if (faqHeading) {
    f.award(6, `A dedicated question section is present ("${truncate(faqHeading.text, 60)}").`, ev(home.url, 'heading', faqHeading.text))
  } else if (questionHeads.length >= 3) {
    f.award(4, `${questionHeads.length} question headings form a de facto Q&A section without an FAQ label.`, ev(home.url, 'heading', questionHeads.slice(0, 3).map((h) => h.text).join(' | ')))
  } else {
    f.miss('No FAQ section or run of question-and-answer pairs was found.')
  }

  return f.build()
}

// ── 4. Scannable structure (20) ────────────────────────────────────────────────

function scoreScannableStructure({ home }: ScoreInput): Factor {
  const f = new FactorBuilder('scannable', 'Scannable structure', 20)

  if (home.lists.length >= 3) {
    f.award(6, `${home.lists.length} lists break the content into scannable items.`, ev(home.url, 'list', home.lists[0].items.slice(0, 3).join(' / ')))
  } else if (home.lists.length >= 1) {
    f.award(3, `${home.lists.length} list(s) are present.`, ev(home.url, 'list', home.lists[0].items.slice(0, 3).join(' / ')))
  } else {
    f.miss('No bulleted or numbered lists were found.')
  }

  const subheads = home.headings.filter((h) => h.level >= 2)
  if (subheads.length >= 6) {
    f.award(5, `${subheads.length} subheadings let a reader scan the page structure.`, ev(home.url, 'heading', subheads.slice(0, 4).map((h) => h.text).join(' | ')))
  } else if (subheads.length >= 2) {
    f.award(3, `${subheads.length} subheadings are present.`)
  } else {
    f.miss('Too few subheadings to scan the page by structure.')
  }

  const long = home.paragraphs.filter((p) => countWords(p) > 90)
  const shortShare = home.paragraphs.length ? 1 - long.length / home.paragraphs.length : 0
  if (home.paragraphs.length === 0) {
    f.miss('No paragraph elements were found to assess paragraph length.')
  } else if (shortShare >= 0.85) {
    f.award(5, `${Math.round(shortShare * 100)}% of paragraphs are under 90 words.`)
  } else if (shortShare >= 0.6) {
    f.award(3, `${Math.round(shortShare * 100)}% of paragraphs are under 90 words; the rest run long.`)
  } else {
    f.miss(`${long.length} of ${home.paragraphs.length} paragraphs run over 90 words, which reads as a wall of text.`)
  }

  if (home.boldTerms.length >= 5) {
    f.award(2, `${home.boldTerms.length} key terms are emphasised in bold.`, ev(home.url, 'text', home.boldTerms.slice(0, 4).join(', ')))
  } else if (home.boldTerms.length >= 1) {
    f.award(1, `${home.boldTerms.length} term(s) are emphasised in bold.`)
  } else {
    f.miss('No key terms are emphasised in bold.')
  }

  if (home.tables.length) {
    f.award(2, `${home.tables.length} table(s) present comparable values side by side.`, ev(home.url, 'table', home.tables[0].headerCells.join(' | ')))
  }

  return f.build()
}

// ── 5. Conversational language (15) ────────────────────────────────────────────

function scoreConversationalLanguage({ home }: ScoreInput): Factor {
  const f = new FactorBuilder('conversational', 'Conversational language', 15)

  if (home.paragraphs.length === 0) {
    f.unverified('No paragraph text was available to assess tone.')
    return f.build()
  }

  const direct = home.paragraphs.filter((p) => CONVERSATIONAL.test(p))
  const share = direct.length / home.paragraphs.length

  if (share >= 0.5) {
    f.award(8, `${Math.round(share * 100)}% of paragraphs address the reader directly.`, ev(home.url, 'text', truncate(direct[0], 200)))
  } else if (share >= 0.2) {
    f.award(5, `${Math.round(share * 100)}% of paragraphs address the reader directly.`, ev(home.url, 'text', truncate(direct[0], 200)))
  } else {
    f.miss('The copy rarely addresses the reader directly, so it matches spoken questions less closely.')
  }

  const sentences = home.mainText.split(/(?<=[.!?])\s+/).filter((s) => countWords(s) > 2)
  const avgWords = sentences.length
    ? sentences.reduce((sum, s) => sum + countWords(s), 0) / sentences.length
    : 0
  if (avgWords > 0 && avgWords <= 22) {
    f.award(4, `Sentences average ${Math.round(avgWords)} words, close to how people phrase questions aloud.`)
  } else if (avgWords > 0 && avgWords <= 30) {
    f.award(2, `Sentences average ${Math.round(avgWords)} words, a little long for spoken-style matching.`)
  } else if (avgWords > 30) {
    f.miss(`Sentences average ${Math.round(avgWords)} words, well above conversational phrasing.`)
  }

  const questionsInProse = home.mainText.match(/\?/g)?.length ?? 0
  if (questionsInProse >= 2) {
    f.award(3, `The copy poses ${questionsInProse} questions, mirroring how readers ask.`)
  } else if (questionsInProse === 1) {
    f.award(1, 'The copy poses one question.')
  } else {
    f.miss('The copy never poses a question in the reader’s own words.')
  }

  return f.build()
}

// ── 6. Related question coverage (10) ──────────────────────────────────────────

function scoreRelatedCoverage({ home }: ScoreInput): Factor {
  const f = new FactorBuilder('related-coverage', 'Related question coverage', 10)

  const subheads = home.headings.filter((h) => h.level >= 2)
  if (subheads.length >= 8) {
    f.award(4, `${subheads.length} sections cover the topic from several angles.`, ev(home.url, 'heading', subheads.slice(0, 5).map((h) => h.text).join(' | ')))
  } else if (subheads.length >= 4) {
    f.award(2, `${subheads.length} sections cover the topic.`)
  } else {
    f.miss('Too few sections to cover follow-up questions on the topic.')
  }

  if (home.wordCount >= 1200) {
    f.award(3, `The page carries ${home.wordCount} words of content, enough depth to answer follow-ups.`)
  } else if (home.wordCount >= 500) {
    f.award(2, `The page carries ${home.wordCount} words of content.`)
  } else {
    f.miss(`The page carries only ${home.wordCount} words, too thin to cover follow-up questions.`)
  }

  // Internal links to deeper pages are how a site covers follow-ups properly.
  const internalContentLinks = home.links.filter(
    (l) => l.internal && l.absolute && !/\.(png|jpe?g|gif|svg|webp|pdf|xml|json)$/i.test(l.absolute),
  )
  const distinct = new Set(internalContentLinks.map((l) => l.absolute)).size
  if (distinct >= 8) {
    f.award(3, `${distinct} distinct internal pages are linked, so follow-up questions have somewhere to go.`, ev(home.url, 'link', internalContentLinks.slice(0, 4).map((l) => l.text || l.absolute).join(', ')))
  } else if (distinct >= 3) {
    f.award(2, `${distinct} distinct internal pages are linked.`)
  } else {
    f.miss('Few internal links lead to deeper pages on related questions.')
  }

  return f.build()
}
