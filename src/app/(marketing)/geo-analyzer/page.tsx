import type { Metadata } from 'next'
import GeoAnalyzerClient from './_components/GeoAnalyzerClient'

export const metadata: Metadata = {
  title: 'Free GEO Analyzer — Check Your AI Citation Score | Byline',
  description:
    'See how likely ChatGPT, Gemini, and Perplexity are to recommend your site. Get your free Generative Engine Optimization score in 30 seconds.',
}

export default function GeoAnalyzerPage() {
  return <GeoAnalyzerClient />
}
