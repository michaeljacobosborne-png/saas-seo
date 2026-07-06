import type { MetadataRoute } from 'next'
import { isSanityConfigured } from '@/sanity/env'
import { client } from '@/sanity/lib/client'
import { postSlugsQuery } from '@/sanity/lib/queries'

const BASE_URL = 'https://app.bylineseo.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  // Static pages
  const staticEntries: MetadataRoute.Sitemap = [
    // Homepage
    {
      url: BASE_URL,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    // Free tools — high-traffic lead gen pages
    {
      url: `${BASE_URL}/audit`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/geo-analyzer`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/ao-analyzer`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    // Conversion pages
    {
      url: `${BASE_URL}/pricing`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.85,
    },
    {
      url: `${BASE_URL}/book`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    // Marketing / trust pages
    {
      url: `${BASE_URL}/featured`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/affiliates`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]

  // Blog entries — pulled live from Sanity when configured
  let blogEntries: MetadataRoute.Sitemap = []
  if (isSanityConfigured) {
    try {
      const slugs: { slug: string }[] = await client.fetch(postSlugsQuery)
      if (slugs.length > 0) {
        // Blog index
        blogEntries.push({
          url: `${BASE_URL}/blog`,
          lastModified: now,
          changeFrequency: 'daily',
          priority: 0.8,
        })
        // Individual posts
        blogEntries = [
          ...blogEntries,
          ...slugs.map(({ slug }) => ({
            url: `${BASE_URL}/blog/${slug}`,
            lastModified: now,
            changeFrequency: 'weekly' as const,
            priority: 0.75,
          })),
        ]
      }
    } catch {
      // Sanity unreachable at build time — skip blog entries rather than fail build
    }
  }

  return [...staticEntries, ...blogEntries]
}
