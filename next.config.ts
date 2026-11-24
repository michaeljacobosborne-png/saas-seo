import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // The old /callback route was a duplicate of /auth/callback. Confirmation emails sent before it
  // was removed still link to it, so those links are passed on with their query intact.
  async redirects() {
    return [{ source: '/callback', destination: '/auth/callback', permanent: true }]
  },
  images: {
    remotePatterns: [
      // Sanity-hosted blog images served from the asset CDN.
      { protocol: 'https', hostname: 'cdn.sanity.io' },
    ],
  },
}

export default nextConfig


