import type { ArticleScores } from '@/lib/supabase/types'

export type { ArticleScores }

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

export function stripMarkdown(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*|__|\*|_|`{1,3}/g, '')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/!\[[^\]]*\]\([^\)]+\)/g, '')
    .replace(/^>\s+/gm, '')
    .trim()
}

export function computeSEO(
  content: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  brief: Record<string, any>,
  targetKeyword: string,
) {
  const kw = targetKeyword.toLowerCase()
  let score = 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const breakdown: Record<string, any> = {}

  // +15 Target keyword in H1
  const h1 = (content.match(/^#\s+(.+)$/m)?.[1] ?? '').toLowerCase()
  const kwInH1 = h1.includes(kw)
  breakdown.kw_in_h1 = { label: 'Target keyword in H1', points: kwInH1 ? 15 : 0, max: 15, passed: kwInH1 }
  score += kwInH1 ? 15 : 0

  // +10 Target keyword in first 100 words
  const first100 = content.split(/\s+/).slice(0, 100).join(' ').toLowerCase()
  const kwInFirst100 = first100.includes(kw)
  breakdown.kw_in_intro = { label: 'Target keyword in first 100 words', points: kwInFirst100 ? 10 : 0, max: 10, passed: kwInFirst100 }
  score += kwInFirst100 ? 10 : 0

  // +10 Target keyword in meta description
  const metaDesc = String(brief?.meta_description ?? '').toLowerCase()
  const kwInMeta = metaDesc.includes(kw)
  breakdown.kw_in_meta = { label: 'Target keyword in meta description', points: kwInMeta ? 10 : 0, max: 10, passed: kwInMeta }
  score += kwInMeta ? 10 : 0

  // +5 Meta description 120-155 chars
  const metaLen = String(brief?.meta_description ?? '').length
  const metaGoodLen = metaLen >= 120 && metaLen <= 155
  breakdown.meta_length = { label: `Meta description length (${metaLen} chars, target 120-155)`, points: metaGoodLen ? 5 : 0, max: 5, passed: metaGoodLen }
  score += metaGoodLen ? 5 : 0

  // +10 2-4 H2 headings
  const h2Count = (content.match(/^##\s+/gm) ?? []).length
  const goodH2 = h2Count >= 2 && h2Count <= 4
  breakdown.h2_count = { label: `H2 headings: ${h2Count} (target 2-4)`, points: goodH2 ? 10 : 0, max: 10, passed: goodH2 }
  score += goodH2 ? 10 : 0

  // +up to 15 Secondary keywords present
  const secondaryKws = (brief?.secondary_keywords as string[] ?? [])
  const presentCount = secondaryKws.filter((sk) => content.toLowerCase().includes(sk.toLowerCase())).length
  const secPts = secondaryKws.length > 0 ? Math.round((presentCount / secondaryKws.length) * 15) : 0
  breakdown.secondary_kws = { label: `Secondary keywords present: ${presentCount}/${secondaryKws.length}`, points: secPts, max: 15, passed: presentCount > 0 }
  score += secPts

  // +10 Word count 1800-2500
  const wc = countWords(content)
  const goodWc = wc >= 1800 && wc <= 2500
  breakdown.word_count = { label: `Word count: ${wc} (target 1800-2500)`, points: goodWc ? 10 : 0, max: 10, passed: goodWc }
  score += goodWc ? 10 : 0

  // +10 FAQ section present
  const hasFAQ = /^#{1,3}\s*(faq|frequently asked questions)/im.test(content)
  breakdown.faq = { label: 'FAQ section present', points: hasFAQ ? 10 : 0, max: 10, passed: hasFAQ }
  score += hasFAQ ? 10 : 0

  // +5 URL slug includes target keyword
  const slug = String(brief?.url_slug ?? '').toLowerCase()
  const kwSlug = kw.replace(/\s+/g, '-')
  const kwInSlug = slug.includes(kwSlug) || slug.includes(kw.replace(/\s+/g, ''))
  breakdown.url_slug = { label: 'URL slug includes target keyword', points: kwInSlug ? 5 : 0, max: 5, passed: kwInSlug }
  score += kwInSlug ? 5 : 0

  // +10 No keyword stuffing (density < 3%)
  const totalWords = countWords(content)
  const escapedKw = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const kwOccurrences = (content.toLowerCase().match(new RegExp(escapedKw, 'g')) ?? []).length
  const density = totalWords > 0 ? kwOccurrences / totalWords : 0
  const notStuffed = density < 0.03
  breakdown.kw_density = { label: `Keyword density: ${(density * 100).toFixed(1)}% (target < 3%)`, points: notStuffed ? 10 : 0, max: 10, passed: notStuffed }
  score += notStuffed ? 10 : 0

  return { score: Math.min(100, score), breakdown }
}

export function computeReadability(content: string) {
  let score = 100
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const breakdown: Record<string, any> = {}
  const plain = stripMarkdown(content)

  // Average sentence length
  const sentences = plain.split(/[.!?]+/).filter((s) => s.trim().split(/\s+/).length > 3)
  const avgLen = sentences.length > 0
    ? sentences.reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0) / sentences.length
    : 0
  breakdown.avg_sentence_len = { label: `Avg sentence length: ${avgLen.toFixed(1)} words (target 15-20)`, value: avgLen }
  if (avgLen > 25) score -= 25
  else if (avgLen > 20) score -= 10

  // Passive voice
  const passiveHits = (plain.match(/\b(was|were|is|are|been|being|be)\s+\w+ed\b/gi) ?? []).length
  breakdown.passive_voice = { label: `Passive voice instances: ${passiveHits} (target < 5)`, value: passiveHits }
  if (passiveHits > 10) score -= 20
  else if (passiveHits > 5) score -= 10

  // Paragraph density
  const totalWords = countWords(plain)
  const paras = content.split(/\n\n+/).filter((p) => p.trim().length > 50)
  const avgParaWords = paras.length > 0 ? totalWords / paras.length : 0
  breakdown.para_density = { label: `Avg paragraph length: ${avgParaWords.toFixed(0)} words (target ~100)`, value: avgParaWords }
  if (avgParaWords > 150) score -= 15
  else if (avgParaWords > 120) score -= 5

  return { score: Math.max(0, Math.min(100, score)), breakdown }
}

export function computeGEO(content: string) {
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

export function buildRankingPrediction(difficulty: number | null, seoScore: number) {
  const d = difficulty ?? 50
  let timeline: string
  let confidence: 'low' | 'medium' | 'high'

  if (d <= 30 && seoScore >= 80) {
    timeline = '2–4 months to top 10, 1–2 months to top 30'
    confidence = 'high'
  } else if (d <= 30 && seoScore >= 60) {
    timeline = '4–6 months to top 10'
    confidence = 'high'
  } else if (d <= 60 && seoScore >= 80) {
    timeline = '5–9 months to top 10, 2–4 months to top 30'
    confidence = 'medium'
  } else if (d <= 60 && seoScore >= 60) {
    timeline = '8–14 months to top 10'
    confidence = 'medium'
  } else if (seoScore >= 80) {
    timeline = '10–18 months to top 10'
    confidence = 'medium'
  } else {
    timeline = '18+ months — consider targeting an easier keyword first'
    confidence = 'low'
  }

  return { timeline, confidence }
}

export function buildTrafficPrediction(searchVolume: number | null) {
  const vol = searchVolume ?? 0
  return {
    at_rank_1: Math.round(vol * 0.28),
    at_rank_3: Math.round(vol * 0.11),
    at_rank_5: Math.round(vol * 0.06),
    at_rank_10: Math.round(vol * 0.02),
  }
}
