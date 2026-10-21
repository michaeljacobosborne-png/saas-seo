/**
 * The AO Analyzer's explanatory copy, shared by the page and its FAQPage
 * markup. AO runs the same engine as the GEO Analyzer (src/lib/geo-audit
 * index.ts: "GEO and AO differ only in how the report is presented"), so the
 * checks shown here come from the same pinned rubric.
 */
import { RUBRIC } from '../geo-analyzer/geo-content'

export const ANSWER_GROUPS = RUBRIC.filter((g) => g.group === 'Chunkability' || g.group === 'Extractability')

export const AO_FAQS = [
  {
    q: 'What is Answer Optimization (AO)?',
    a: 'Answer Optimization (AO) is the practice of structuring your content so it can be directly extracted and shown as a featured snippet in Google, or quoted in an AI-generated answer from tools like ChatGPT and Perplexity. Where traditional SEO aims at a results page, AO aims at the answer itself.',
  },
  {
    q: 'What decides whether an answer can be lifted?',
    a: 'Two groups of the Retrievable rubric: Chunkability, which asks whether the page breaks into sections that stand alone, and Extractability, which asks whether a section opens with a direct answer a reader could quote. Together they are 45 of the 100 points.',
  },
  {
    q: "AO vs GEO: what's the difference?",
    a: 'AO and GEO are two views of one problem. AO looks at whether a single passage can be extracted cleanly. GEO looks at whether the whole page can be reached and parsed before extraction is even possible. Byline scores both with the same engine.',
  },
  {
    q: 'What does the AO Analyzer not tell you?',
    a: 'It does not tell you how often AI tools or featured snippets surface your content. Nobody outside Google, OpenAI or Perplexity can measure that from your HTML. A higher score means fewer structural obstacles to being quoted; it is not a prediction.',
  },
]
