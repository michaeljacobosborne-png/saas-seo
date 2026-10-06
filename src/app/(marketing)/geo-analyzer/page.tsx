import type { Metadata } from 'next'
import GeoAnalyzerClient from './_components/GeoAnalyzerClient'
import { ORG_ID } from '@/lib/structured-data'

export const metadata: Metadata = {
  title: 'Free GEO Analyzer — Can AI Search Read Your Site? | Byline',
  description:
    'Check how ready your site is for AI search to reach, parse and quote: crawler access, structure and attribution, scored on the page with evidence for every finding. It does not measure whether any AI system cites you.',
  alternates: {
    canonical: 'https://app.bylineseo.com/geo-analyzer',
  },
  openGraph: {
    title: 'Free GEO Analyzer — Can AI Search Read Your Site?',
    description:
      'Check how ready your site is for AI search to reach, parse and quote, with evidence for every finding. Free, in about 30 seconds.',
    url: 'https://app.bylineseo.com/geo-analyzer',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free GEO Analyzer — Can AI Search Read Your Site?',
    description: 'How ready is your site for AI search to read and quote? Free check, evidence included.',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'GEO Analyzer by Byline',
  url: 'https://app.bylineseo.com/geo-analyzer',
  applicationCategory: 'BusinessApplication',
  description:
    'Free tool that checks how ready your website is for AI search engines to reach, parse and quote. Scores what is on the page, with evidence for every finding; it does not measure whether any AI system has cited you.',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  publisher: { '@type': 'Organization', '@id': ORG_ID, name: 'Byline' },
  featureList: [
    'AI crawler access test',
    'Extractability and chunking analysis',
    'Entity and structured data checks',
    'Evidence-backed GEO readiness score',
    'GEO optimization recommendations',
  ],
}

export default function GeoAnalyzerPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <GeoAnalyzerClient />
    </>
  )
}
