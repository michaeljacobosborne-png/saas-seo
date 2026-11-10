/**
 * Pricing questions, shared by the visible page and its FAQPage markup so the
 * two cannot drift. Plan numbers here must match PLANS in pricing-cards.tsx;
 * relaunch pricing is not settled, so nothing here adds a tier or a price.
 */
export const PRICING_FAQS = [
  {
    q: 'Which plan should I choose?',
    a: 'Choose by how many articles you plan to publish each month: Starter covers 8, Growth 30 and Multi-Brand 100. Every plan scores pages and drafts with the same engine and shows the evidence under every finding. The plans differ in volume and in the agent features listed on each card.',
  },
  {
    q: 'How is a Byline score produced?',
    a: 'Deterministic code reads the page and applies a published rubric: Retrievable out of 100 and Citable as a band. A language model writes the explanation beside a finding and nothing else. When too little of a page can be read, no score is published, and every report records the engine version that produced it.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. There are no contracts, and you can cancel from your account settings at any time. Your access continues until the end of the billing period.',
  },
  {
    q: 'What happens if I hit my article limit on Starter?',
    a: "You'll be prompted to upgrade to Growth. We don't cut off access mid-article.",
  },
  {
    q: 'Is the agent really different from just using ChatGPT?',
    a: "Yes. ChatGPT has no access to your article, your scores, your keyword data, or your brand profile. Byline's agent has all of that in context, including the findings the scorer flagged and where, and can apply the fix without you leaving the editor.",
  },
  {
    q: 'Do you offer a free trial?',
    a: "We offer a 30-day money-back guarantee on all plans. If it's not working for you in the first 30 days, email us and we'll refund in full.",
  },
]
