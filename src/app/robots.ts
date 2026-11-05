import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/dashboard/',
          '/(dashboard)/',
          '/admin/',
          '/(admin)/',
          '/auth/',
          '/(auth)/',
          '/billing/',
          '/(billing)/',
          '/welcome/',
          '/studio/',
        ],
      },
    ],
    sitemap: 'https://app.bylineseo.com/sitemap.xml',
  }
}
