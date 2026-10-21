/**
 * Content map copy, shared by the page and its FAQPage markup. Facts here are
 * tied to src/app/api/audit/route.ts: MAX_PAGES = 30, and the prompt asks the
 * model for 6-12 gaps, 3-6 clusters and 3-5 quick wins. If either changes,
 * this copy must change with it.
 */
export const AUDIT_FAQS = [
  {
    q: 'What does the content map show?',
    a: "Byline's content map is a free tool that reads up to 30 pages from your sitemap, groups what you have published into topics, and suggests adjacent topics you have not covered. It needs no login.",
  },
  {
    q: 'How are the suggested topics produced?',
    a: 'A language model reads your page titles and proposes the topics. No search volume, ranking or competitor data is fetched. The model is asked for between six and twelve suggestions every time, so the number of suggestions is a format, not a finding about your site.',
  },
  {
    q: 'What should I do with the suggestions?',
    a: 'Treat them as a starting point for your own research. Take a topic into keyword research, where volume and difficulty come from real search data, before you commit to writing it.',
  },
]
