import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Free SEO Audit Tool — Find What\'s Holding Your Content Back | Byline',
  description:
    'Run a free SEO audit on any URL. Discover keyword gaps, content issues, and exactly what you need to fix to rank higher. No sign-up required.',
  alternates: {
    canonical: 'https://app.bylineseo.com/audit',
  },
  openGraph: {
    title: 'Free SEO Audit Tool — Find What\'s Holding Your Content Back',
    description:
      'Enter any URL and get a free SEO audit in seconds. Keyword gaps, content structure issues, and actionable fixes — powered by AI.',
    url: 'https://app.bylineseo.com/audit',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free SEO Audit Tool — Byline',
    description: 'Find keyword gaps and content issues in seconds. Free, no sign-up required.',
  },
}

export default function AuditLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
