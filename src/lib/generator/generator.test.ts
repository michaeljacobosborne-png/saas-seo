import { describe, expect, it } from 'vitest'
import { figuresInText, guardEvidence, placeholderFor, unsupportedClaim, type EvidenceSource } from './evidence-guard'
import { buildBriefPrompt, buildDraftSystemPrompt, buildDraftUserPrompt, buildExpansionSystemPrompt, buildIntroPolishPrompt, PROVENANCE_RULE } from './prompts'
import { ensureOpening, findBannedWords, findTriads, openingIsDirectAnswer, promoteBareHeadings, stripBodyH1, tightenOpening } from './structure'
import { runDraftPipeline, unusedSources, type Chat } from './pipeline'
import { applyFixEdits } from '@/lib/targeted-fix'

// Exact sentences the generator published before (generator audit 2026-10-02,
// audit archive and the signed-in pass). Each must be replaced, the way
// sanitiseImpact is tested against the impacts the old engine shipped.
const PRODUCED = [
  'According to industry benchmarks, companies implementing AI tools have seen an average 30% increase in organic traffic within six months.',
  'According to a 2024 HubSpot survey, 75% of content marketers work on teams of three or fewer people — yet most enterprise SEO tools price and package for organizations with five or more dedicated roles.',
  'According to a 2023 study by DataForSEO, 73% of marketers have adopted AI tools to streamline their SEO efforts.',
  'Pricing starts at $99/month.',
  'Surfer SEO ($99/month) was built for agency teams with dedicated SEO leads, writers, and editors.',
  'According to industry benchmarks, companies using AI in their SEO strategies have seen a 20-30% increase in organic traffic.',
  'According to industry statistics, businesses using these advanced methods have seen a 15% improvement in user engagement metrics.',
  'By analyzing search trends and clustering related keywords, they were able to increase their organic traffic by 35% over six months.',
  'For example, a mid-sized tech company used AI-driven keyword clustering to streamline their content creation process.',
  "According to Byline SEO's analysis of industry benchmarks, companies using AI in their SEO strategies have seen a 20-30% increase in organic traffic.",
  'Byline SEO has found that businesses using these advanced methods have seen a 15% improvement in user engagement metrics.',
]

const NONE: EvidenceSource[] = []

describe('evidence guard: the provenance rule', () => {
  it.each(PRODUCED)('replaces fabricated sentence %#', (sentence) => {
    expect(unsupportedClaim(sentence, NONE)).not.toBeNull()
    const out = guardEvidence(sentence, NONE)
    expect(out.replaced).toHaveLength(1)
    expect(out.markdown).toMatch(/^\[ADD EVIDENCE: /)
  })

  it('never keeps the invented number, never moves it to a firm, never softens it', () => {
    for (const s of PRODUCED) {
      const { markdown } = guardEvidence(s, NONE)
      expect(figuresInText(markdown)).toEqual([])
      expect(markdown).not.toMatch(/HubSpot|DataForSEO|industry (benchmarks|statistics)|Byline SEO's analysis|has found/i)
      expect(markdown).not.toMatch(/\b(about|around|roughly|nearly|almost) (a|one)? ?(third|quarter|half)\b|\bmany companies\b/i)
    }
  })

  it('replaces the invented results heading, keeping its level', () => {
    const { markdown, replaced } = guardEvidence('## Real Results: How Our Users Achieved 200% Traffic Growth', NONE)
    expect(markdown).toMatch(/^## \[ADD EVIDENCE: /)
    expect(markdown).not.toContain('200')
    expect(replaced).toHaveLength(1)
  })

  it('keeps a figure the writer supplied for this article, with its source', () => {
    const sources: EvidenceSource[] = [{ label: 'Supplied by the writer for this article', text: 'Our March 2026 audit of 40 client sites: 62% had no direct answer in the first paragraph.' }]
    const s = 'In a March 2026 audit of 40 client sites, 62% had no direct answer in the first paragraph.'
    expect(guardEvidence(s, sources)).toEqual({ markdown: s, replaced: [] })
  })

  it('keeps a named source only when it was supplied', () => {
    const s = 'According to Ahrefs, 96.55% of pages get no organic traffic from Google.'
    expect(unsupportedClaim(s, NONE)).toMatch(/figure|Ahrefs/)
    const supplied: EvidenceSource[] = [{ label: 'Ahrefs study', url: 'https://ahrefs.com/blog/search-traffic-study/', text: '96.55% of all pages get zero traffic from Google.' }]
    expect(unsupportedClaim(s, supplied)).toBeNull()
  })

  it('rejects unnamed authority even without a number', () => {
    expect(unsupportedClaim('Studies show that shorter sections are quoted more often.', NONE)).toMatch(/unnamed authority/)
    expect(unsupportedClaim('Industry data suggests most teams publish weekly.', NONE)).toMatch(/unnamed authority/)
  })

  it('leaves ordinary prose, years and list counts alone', () => {
    for (const s of [
      'A direct answer near the top lets an engine lift the passage cleanly.',
      'Google updated its spam policies in 2024.',
      'The 10 best tools are compared below.',
      'Use H2 headings for each question.',
      'Write two sentences that answer the heading before adding detail.',
    ]) {
      expect(unsupportedClaim(s, NONE)).toBeNull()
    }
  })

  it('guards list items and table cells too', () => {
    const md = '- Byline ($39/month) handles the full pipeline.\n\n| Tool | Price |\n|---|---|\n| Surfer | $99/month |'
    const { markdown, replaced } = guardEvidence(md, NONE)
    expect(replaced).toHaveLength(2)
    expect(markdown).not.toMatch(/\$\d/)
    expect(markdown).toContain('|---|---|')
  })

  it('replaces stand-in products the sample run invented', () => {
    const { replaced } = guardEvidence('- Tool B: Medium ease of use, good integration capabilities, business hours support', NONE)
    expect(replaced[0].reason).toMatch(/stand-in product/)
  })

  it('clears every value under a stand-in product column or row, not just its header (sample run)', () => {
    const table = '| Feature | Tool A | Tool B |\n|---|---|---|\n| Keyword Analysis | Advanced | Basic |\n\n| Product | Ease |\n|---|---|\n| Tool C | High |'
    const { markdown } = guardEvidence(table, NONE)
    expect(markdown).not.toMatch(/Advanced|Basic|High|Tool [ABC]/)
    expect(markdown).toContain('Keyword Analysis')
  })

  it('replaces unsupported superlatives about the brand, from the sample run', () => {
    const s = 'Byline SEO is at the forefront of using AI to optimize content and create a more personalized user experience.'
    expect(unsupportedClaim(s, NONE, { brandName: 'Byline SEO' })).toMatch(/superlative/)
    expect(unsupportedClaim('Byline SEO scores each draft before it is published.', NONE, { brandName: 'Byline SEO' })).toBeNull()
  })

  it('replaces product facts about the brand that nobody supplied (sample run)', () => {
    const s = "Whether you're using Google Analytics or WordPress, Byline SEO integrates well, enhancing workflow efficiency."
    expect(unsupportedClaim(s, NONE, { brandName: 'Byline SEO' })).toMatch(/product fact/)
    const supplied: EvidenceSource[] = [{ label: 'Supplied', text: 'Byline SEO publishes to WordPress and reads Google Analytics, so it integrates with both.' }]
    expect(unsupportedClaim('Byline SEO integrates with WordPress and Google Analytics.', supplied, { brandName: 'Byline SEO' })).toBeNull()
  })

  it('does not read a hypothetical company as a case study (sample run false positive)', () => {
    expect(unsupportedClaim('Companies can keep competitive SEO strategies without needing a large writing team.', NONE)).toBeNull()
  })

  it('writes the placeholder as an instruction with the figure removed', () => {
    expect(placeholderFor(PRODUCED[0])).toBe(
      '[ADD EVIDENCE: a real, citable source for the claim that companies implementing AI tools have seen an average … increase in organic traffic within six months]',
    )
  })
})

describe('prompts state the rule and no longer license fabrication', () => {
  const brand = { name: 'Acme', voice: 'plain', signatureAngles: 'The Answer-First method', expertiseNotes: 'Ran content at two SaaS firms.' }
  const draft = buildDraftSystemPrompt({ brand, author: { name: 'Jane Doe', credentials: '12 years in B2B content' }, keyword: 'answer-first writing', sources: [] })
  const user = buildDraftUserPrompt({ keyword: 'k', secondaryKeywords: [], title: 'T', serpIntent: 'informational', toneNotes: '', competitorGaps: [], outlineText: '', targetWordCount: 1500 })
  const brief = buildBriefPrompt({ brand, keywordLines: '- "k"', directTopic: null })
  const all = [draft, user, brief, buildExpansionSystemPrompt('Acme', [])].join('\n')

  it('states the provenance rule explicitly', () => {
    expect(draft).toContain(PROVENANCE_RULE)
    expect(brief).toContain(PROVENANCE_RULE)
    expect(draft).toMatch(/\[ADD EVIDENCE: what is needed\]/)
    expect(draft).toMatch(/Never invent product facts/)
  })

  it('drops the language that licensed fabrication', () => {
    expect(all).not.toMatch(/use framing like/i)
    expect(all).not.toMatch(/even if based on secondary sources/i)
    expect(all).not.toMatch(/What We Found After Testing/)
    expect(all).not.toMatch(/add (a relevant FAQ section, )?case study/i)
    expect(all).not.toMatch(/add real examples, statistics/i)
    expect(all).not.toMatch(/one stat or data sentence per/i)
    expect(all).not.toMatch(/must be exactly \$?\{?\d*/i)
  })

  it('asks for the structure the engine rewards', () => {
    expect(draft).toMatch(/Do NOT write an H1/)
    expect(draft).not.toMatch(/Start directly with the # H1/)
    expect(draft).toMatch(/under 300 characters/)
    expect(draft).not.toMatch(/never a definition/i)
    expect(draft).toMatch(/40 to 180 words/)
    expect(draft).toMatch(/question a reader would actually type/)
    expect(draft).toMatch(/table/)
    expect(draft).toMatch(/Jane Doe/)
    expect(draft).toMatch(/one consistent name/)
    expect(draft).toMatch(/name Acme in that sentence/)
    expect(buildIntroPolishPrompt({ title: 'T', keyword: 'k', openingAnswer: 'A.', hook: 'B.', brandVoice: 'plain' })).not.toMatch(/avoid defining/i)
  })
})

describe('structure', () => {
  it('removes the body H1 the template already renders, and demotes any later H1', () => {
    const r = stripBodyH1('# How to Write\n\nAnswer first.\n\n# Stray\n\n## Section')
    expect(r.removed).toBe('How to Write')
    expect(r.markdown).toBe('Answer first.\n\n## Stray\n\n## Section')
  })

  it('splits an over-long opening after its answer, rewriting nothing (sample run)', () => {
    const opening =
      'AI-powered SEO tools are transforming digital marketing by automating complex tasks and providing real-time insights. An AI-powered SEO tool is a software application that uses artificial intelligence to enhance search engine optimization efforts. By integrating AI, businesses can adapt to search algorithm changes and consumer behavior shifts more effectively.'
    const r = tightenOpening(`${opening}\n\n## Next`)
    expect(r.split).toBe(true)
    expect(openingIsDirectAnswer(r.markdown)).toBe(true)
    expect(r.markdown.replace(/\s+/g, ' ')).toBe(`${opening} ## Next`.replace(/\s+/g, ' '))
  })

  it('puts the planned answer first when the draft opens on a heading (sample run)', () => {
    const r = ensureOpening('## What makes a Surfer SEO alternative effective?\n\nBody.', 'A Surfer SEO alternative is a content tool that covers the same optimization jobs with a different workflow or price.')
    expect(r.added).toBe(true)
    expect(openingIsDirectAnswer(r.markdown)).toBe(true)
    expect(ensureOpening('Already answers.\n\n## H', 'x').added).toBe(false)
  })

  it('checks the opening paragraph against the engine thresholds', () => {
    expect(openingIsDirectAnswer('Answer-first writing is a way of opening each section with the answer a reader came for.\n\n## Next')).toBe(true)
    expect(openingIsDirectAnswer(`${'A long hook sentence that keeps going. '.repeat(10)}\n\n## Next`)).toBe(false)
  })

  it('turns bare question lines and bold lines into ### headings, as the sample run produced them', () => {
    const md = 'Opening answer paragraph here.\n\nWhat features do AI Powered SEO Tools offer?\n\n- Keyword research\n\n**Essential Features to Consider**\n\nBody text.\n\nA normal sentence that ends with a question, does it?'
    const r = promoteBareHeadings(md)
    expect(r.promoted).toBe(2)
    expect(r.markdown).toContain('### What features do AI Powered SEO Tools offer?')
    expect(r.markdown).toContain('### Essential Features to Consider')
    expect(r.markdown.startsWith('Opening answer')).toBe(true)
  })

  it('finds the banned words the sample run still produced', () => {
    const hits = findBannedWords('For small teams, AI SEO tools are a game-changer due to their efficiency.\n\nLimited budget makes automation crucial.')
    expect(hits.map((h) => h.match.toLowerCase())).toEqual(['game-changer', 'crucial'])
  })

  it('finds the triads the audit counted, and not genuine lists', () => {
    const triads = findTriads(
      "That's a product decision with real consequences for how the tool is priced, structured, and designed.\n\n- Step one\n- Step two\n- Step three\n\n## Fast, cheap and good",
    )
    expect(triads).toHaveLength(1)
    expect(triads[0].match).toContain('priced, structured, and designed')
    expect(findTriads('Open every section with the answer, so a reader or an engine can lift it cleanly.')).toEqual([])
  })
})

describe('supplied evidence', () => {
  const ahrefs: EvidenceSource = { label: 'Supplied', url: 'https://ahrefs.com/blog/ai-overviews-reduce-clicks/', text: 'Pages shown in an AI Overview saw 34.5% lower clickthrough for the top result.' }

  it('notices supplied evidence the draft left out (the sample run ignored it)', () => {
    expect(unusedSources('An article that never mentions it.', [ahrefs])).toHaveLength(1)
    expect(unusedSources('Ahrefs measured a 34.5% drop.', [ahrefs])).toHaveLength(0)
  })

  it('lets a revision use the supplied figure, and only that one', () => {
    const md = 'Opening.\n\nAI Overviews take clicks from the top result.'
    const ok = applyFixEdits(md, [{ op: 'replace', block: 1, markdown: '[Ahrefs found](https://ahrefs.com/blog/ai-overviews-reduce-clicks/) a 34.5% lower clickthrough for the top result.' }], { evidence: [ahrefs.text] })
    expect(ok.applied).toHaveLength(1)
    const bad = applyFixEdits(md, [{ op: 'replace', block: 1, markdown: 'Clickthrough fell 50% for the top result.' }], { evidence: [ahrefs.text] })
    expect(bad.rejected[0].reason).toMatch(/adds figures/)
  })
})

describe('pipeline (fake model)', () => {
  const ARTICLE = [
    '# Answer-First Writing',
    '',
    'Answer-first writing is a method of opening every section with the answer, so a reader or an engine can lift it cleanly.',
    '',
    'Most drafts bury the answer under a long hook.',
    '',
    '## Why does the opening matter?',
    '',
    'According to industry benchmarks, companies implementing AI tools have seen an average 30% increase in organic traffic within six months. The opening is the passage most likely to be quoted, so it should carry the answer, not a scene-setting hook that delays it.',
    '',
    '## How should sections be sized?',
    '',
    'Keep sections short enough to quote and long enough to stand alone, which keeps them clear, focused, and useful for the reader who skims.',
  ].join('\n')

  const chat: Chat = async (req) => {
    if (req.user.startsWith('Write the article')) return ARTICLE
    if (req.user.includes('list of three short items')) {
      return JSON.stringify({ rewrites: [{ original: 'Keep sections short enough to quote and long enough to stand alone, which keeps them clear, focused, and useful for the reader who skims.', rewritten: 'Keep sections short enough to quote and long enough to stand alone, which keeps them clear for the reader who skims.' }] })
    }
    if (req.user.includes('deterministic checker')) return JSON.stringify({ edits: [] })
    return '{}'
  }

  it('produces a draft with no H1, no invented figure, no triad', async () => {
    const out = await runDraftPipeline(chat, {
      articleId: 'a', brand: { name: 'Acme' }, author: null, sources: [], keyword: 'answer-first writing', secondaryKeywords: [],
      title: 'Answer-First Writing', serpIntent: 'informational', toneNotes: '', competitorGaps: [], outlineText: '', targetWordCount: 100, polish: false,
    })
    expect(out.content).not.toMatch(/^# /m)
    expect(out.content).not.toMatch(/30%|industry benchmarks/)
    expect(out.content).toContain('[ADD EVIDENCE:')
    expect(out.report.bodyH1Removed).toBe('Answer-First Writing')
    expect(out.report.evidenceReplaced).toHaveLength(1)
    expect(out.report.triadsFound).toBe(1)
    expect(out.report.triadsRemaining).toBe(0)
    expect(openingIsDirectAnswer(out.content)).toBe(true)
  })
})
