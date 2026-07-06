import type { MetadataRoute } from 'next'

const BASE_URL = 'https://app.bylineseo.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  return [
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
}
