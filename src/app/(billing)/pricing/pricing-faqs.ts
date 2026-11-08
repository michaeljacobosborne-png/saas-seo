import { FREE_LIMITS, PLAN_LIMITS } from '@/lib/plans'

/**
 * Pricing questions, shared by the visible page and its FAQPage markup so the
 * two cannot drift. Numbers come from src/lib/plans.ts. Nothing here may say
 * pages are re-scored daily: crawler access is checked daily, scores are
 * re-recorded weekly at best.
 */
const n = (x: number) => x.toLocaleString('en-US')

export const PRICING_FAQS = [
  {
    q: 'Which plan should I choose?',
    a: `Choose by how many pages you need watched. Solo monitors ${PLAN_LIMITS.starter.trackedPages} pages on one domain, Pro ${PLAN_LIMITS.pro.trackedPages} pages across ${PLAN_LIMITS.pro.domains} domains, and Agency ${PLAN_LIMITS.agency.trackedPages} pages across ${PLAN_LIMITS.agency.domains} domains. A freelancer watching one client site fits Solo, an in-house SEO with a hundred important pages fits Pro, and an agency with many client domains fits Agency. Every plan scores with the same engine and shows the evidence under every finding. Article generation is included on each plan as a bundled feature.`,
  },
  {
    q: 'How is a Byline score produced?',
    a: 'Deterministic code reads the page and applies a published rubric: Retrievable out of 100 and Citable as a band. A language model writes the explanation beside a finding and nothing else. When too little of a page can be read, no score is published, and every report records the engine version that produced it.',
  },
  {
    q: 'What does monitoring actually do?',
    a: 'Every day Byline checks whether each AI crawler is served each monitored page, using a plain browser request as the control. When access changes and a second daily check confirms it, you get an email with the evidence. Separately, each page is re-scored on a schedule, weekly on Pro and Agency and every 30 days on Solo, and every run is kept so you can compare any two.',
  },
  {
    q: 'How often are scores re-recorded?',
    a: 'Crawler access is checked every day. Scores are re-recorded weekly on Pro and Agency and every 30 days on Solo. A score describes the page as it was when it was read, which is why each run is stored with its date and engine version.',
  },
  {
    q: 'What is the difference between a one-off audit and a monitored page?',
    a: `A one-off audit scores any URL once and stores the run. A monitored page is checked for crawler access every day, re-scored on a schedule, and keeps a history you can compare. Free accounts get ${FREE_LIMITS.auditsPerMonth} one-off audits a month with the crawler probe included and no monitoring. Paid plans include ${n(PLAN_LIMITS.starter.auditsPerMonth)}, ${n(PLAN_LIMITS.pro.auditsPerMonth)} and ${n(PLAN_LIMITS.agency.auditsPerMonth)} a month.`,
  },
  {
    q: 'What happens when I reach my page or domain limit?',
    a: 'You can keep every page you already monitor. To add another you stop monitoring one, or move to a plan with a higher limit. Nothing is deleted, and the history of a page you stop monitoring is kept.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. There are no contracts, and you can cancel from your account settings at any time. Your access continues until the end of the billing period.',
  },
  {
    q: 'Is the agent really different from just using ChatGPT?',
    a: "Yes. ChatGPT has no access to your article, your scores, your keyword data, or your brand profile. Byline's agent has all of that in context, including the findings the scorer flagged and where, and can apply the fix without you leaving the editor.",
  },
  {
    q: 'Do you offer a free trial?',
    a: "There is a free account with one-off audits, and we offer a 30-day money-back guarantee on all paid plans. If it's not working for you in the first 30 days, email us and we'll refund in full.",
  },
]
