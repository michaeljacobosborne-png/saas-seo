import type { Metadata } from 'next'
import AoAnalyzerClient from './_components/AoAnalyzerClient'

export const metadata: Metadata = {
  title: 'Free AO Analyzer — Answer Optimization Score | Byline',
  description:
    'Check your Answer Optimization score. See how well your content is structured to win featured snippets and appear in AI-generated answers.',
}

export default function AoAnalyzerPage() {
  return <AoAnalyzerClient />
}
