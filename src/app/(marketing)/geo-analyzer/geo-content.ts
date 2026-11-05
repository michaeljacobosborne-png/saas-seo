/**
 * The GEO Analyzer's explanatory copy, shared by the page and its FAQPage
 * markup. RUBRIC must match the factor maxima in
 * src/lib/geo-audit/score-retrievability.ts; a test pins that.
 */
export const RUBRIC = [
  { group: 'Access', points: 30, checks: [['AI crawler access', 14], ['Indexing directives', 10], ['Fetch and canonical', 6]] },
  { group: 'Parseability', points: 25, checks: [['Server-rendered content', 12], ['Structured data validity', 8], ['Markup cleanliness', 5]] },
  { group: 'Chunkability', points: 25, checks: [['Heading hierarchy', 12], ['Self-contained sections', 8], ['Block length distribution', 5]] },
  { group: 'Extractability', points: 20, checks: [['Direct answers', 10], ['Question coverage', 6], ['Lists, tables and data', 4]] },
] as const

export const CITABLE_SIGNALS = [
  'Named authorship',
  'Entity resolution',
  'Brand-claim proximity',
  'Original evidence',
  'Proprietary terms',
  'Freshness and provenance',
] as const

export const GEO_FAQS = [
  {
    q: 'What is GEO (Generative Engine Optimization)?',
    a: 'Generative Engine Optimization (GEO) is the practice of structuring your website so that AI tools like ChatGPT, Gemini and Perplexity can read it, lift answers from it and attribute those answers to you.',
  },
  {
    q: 'How is the GEO score calculated?',
    a: 'Retrievable is scored out of 100 in four groups: Access 30, Parseability 25, Chunkability 25 and Extractability 20. Each group is made of checks with fixed points, every check prints its threshold beside what it found, and a check that cannot be assessed is left out of the total rather than scored as zero.',
  },
  {
    q: 'How is Citable decided?',
    a: 'Citable is a band, not a number: Strong, Adequate, Weak or Absent. It comes from six attribution signals, such as named authorship and original evidence, because there is no honest arithmetic that turns a named author into points.',
  },
  {
    q: 'What does the GEO Analyzer not tell you?',
    a: 'It does not tell you whether any AI system cites you or how often. Nobody outside OpenAI, Google or Perplexity can measure that from your HTML. A higher score means fewer structural obstacles to being read and quoted; it is not a prediction of citations.',
  },
]
