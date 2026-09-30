import type { Metadata } from 'next'
import GeoAnalyzerClient from './_components/GeoAnalyzerClient'
import { ORG_ID } from '@/lib/structured-data'

export const metadata: Metadata = {
  title: 'Free GEO Analyzer — Check Your AI Citation Score | Byline',
  description:
    'See how likely ChatGPT, Gemini, and Perplexity are to recommend your site. Get your free Generative Engine Optimization score in 30 seconds.',
  alternates: {
    canonical: 'https://app.bylineseo.com/geo-analyzer',
  },
  openGraph: {
    title: 'Free GEO Analyzer — Check Your AI Citation Score',
    description:
      'See how likely ChatGPT, Gemini, and Perplexity are to recommend your site. Free Generative Engine Optimization score in 30 seconds.',
    url: 'https://app.bylineseo.com/geo-analyzer',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free GEO Analyzer — Check Your AI Citation Score',
    description: 'See how likely AI chatbots are to recommend your site. Free GEO score in 30 seconds.',
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
