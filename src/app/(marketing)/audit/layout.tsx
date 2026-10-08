import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Free Content Map — See What You Have Published and What You Have Not | Byline',
  description:
    'Map your published content from your sitemap and see suggested topics adjacent to your coverage. The suggestions are a starting point for keyword research, not a measurement. No sign-up required.',
  alternates: {
    canonical: 'https://app.bylineseo.com/audit',
  },
  openGraph: {
    title: 'Free Content Map — See What You Have Published and What You Have Not',
    description:
      'Enter your domain and Byline groups your published pages by topic, then suggests adjacent topics to research.',
    url: 'https://app.bylineseo.com/audit',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free Content Map — Byline',
    description: 'Map your published content and see suggested topics to research. Free, no sign-up required.',
  },
}

export default function AuditLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
