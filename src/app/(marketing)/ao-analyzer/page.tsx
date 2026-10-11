import type { Metadata } from 'next'
import AoAnalyzerClient from './_components/AoAnalyzerClient'
import { ORG_ID, graph, organizationNode } from '@/lib/structured-data'
import { AO_FAQS } from './ao-content'

export const metadata: Metadata = {
  title: 'Free AO Analyzer: Answer Optimization Score | Byline',
  description:
    'Check your Answer Optimization score. See how well your content is structured for answer extraction: direct answers, question headings and scannable structure, checked on the page itself.',
  alternates: {
    canonical: 'https://app.bylineseo.com/ao-analyzer',
  },
  openGraph: {
    title: 'Free AO Analyzer: Answer Optimization Score',
    description:
      'See how well your content is structured for answer extraction: direct answers, question headings and scannable structure, checked on the page itself. Free Answer Optimization score.',
    url: 'https://app.bylineseo.com/ao-analyzer',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free AO Analyzer: Answer Optimization Score',
    description: 'Check whether a clean answer can be extracted from your page. Scored from the page itself, with the evidence shown.',
  },
}

const app = {
  '@type': 'WebApplication',
  name: 'AO Analyzer by Byline',
  url: 'https://app.bylineseo.com/ao-analyzer',
  applicationCategory: 'BusinessApplication',
  description:
    'Free tool that checks your Answer Optimization score. Analyzes how well your content is structured for answer extraction: direct answers, question headings and scannable structure, checked on the page itself.',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  featureList: [
    'Answer Optimization scoring',
    'Answer extraction structure check',
    'Direct answer and question coverage scoring',
    'Content structure recommendations',
    'Question-answer format analysis',
  ],
  publisher: { '@id': ORG_ID },
}

// Organization so the page says who publishes it; FAQPage mirrors the visible
// questions word for word.
const jsonLd = graph(organizationNode(), app, {
  '@type': 'FAQPage',
  mainEntity: AO_FAQS.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
})

export default function AoAnalyzerPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <AoAnalyzerClient />
    </>
  )
}
