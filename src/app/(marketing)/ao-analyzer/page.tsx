import type { Metadata } from 'next'
import AoAnalyzerClient from './_components/AoAnalyzerClient'

export const metadata: Metadata = {
  title: 'Free AO Analyzer — Answer Optimization Score | Byline',
  description:
    'Check your Answer Optimization score. See how well your content is structured to win featured snippets and appear in AI-generated answers.',
  alternates: {
    canonical: 'https://app.bylineseo.com/ao-analyzer',
  },
  openGraph: {
    title: 'Free AO Analyzer — Answer Optimization Score',
    description:
      'See how well your content is structured to win featured snippets and appear in AI-generated answers. Free Answer Optimization score.',
    url: 'https://app.bylineseo.com/ao-analyzer',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free AO Analyzer — Answer Optimization Score',
    description: 'Check if your content is structured to win featured snippets and AI answer boxes. Free score.',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'AO Analyzer by Byline',
  url: 'https://app.bylineseo.com/ao-analyzer',
  applicationCategory: 'BusinessApplication',
  description:
    'Free tool that checks your Answer Optimization score. Analyzes how well your content is structured to win featured snippets and appear in AI-generated answers.',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  featureList: [
    'Answer Optimization scoring',
    'Featured snippet opportunity analysis',
    'AI answer box optimization',
    'Content structure recommendations',
    'Question-answer format analysis',
  ],
}

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
