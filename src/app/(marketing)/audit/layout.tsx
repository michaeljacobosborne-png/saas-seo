import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { ORG_ID, graph, jsonLdString, organizationNode } from '@/lib/structured-data'
import { AUDIT_FAQS } from './audit-content'

export const metadata: Metadata = {
  title: 'Free Content Map: See What You Have Published and What You Have Not | Byline',
  description:
    'Map your published content from your sitemap and see suggested topics adjacent to your coverage. Take the suggestions into your own keyword research before you commit to any of them. No sign-up required.',
  alternates: {
    canonical: 'https://app.bylineseo.com/audit',
  },
  openGraph: {
    title: 'Free Content Map: See What You Have Published and What You Have Not',
    description:
      'Enter your domain and Byline groups your published pages by topic, then suggests adjacent topics to research.',
    url: 'https://app.bylineseo.com/audit',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free Content Map | Byline',
    description: 'Map your published content and see suggested topics to research. Free, no sign-up required.',
  },
}

// Organization says who publishes the page; WebApplication says what it is;
// FAQPage mirrors the visible questions word for word.
const jsonLd = graph(
  organizationNode(),
  {
    '@type': 'WebApplication',
    name: 'Content Map by Byline',
    url: 'https://app.bylineseo.com/audit',
    applicationCategory: 'BusinessApplication',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    publisher: { '@id': ORG_ID },
  },
  {
    '@type': 'FAQPage',
    mainEntity: AUDIT_FAQS.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  },
)

export default function AuditLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} />
      {children}
    </>
  )
}
