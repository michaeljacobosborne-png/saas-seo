import { createClient } from 'next-sanity'

import { apiVersion, dataset, projectId } from '../env'

// `projectId` falls back to a placeholder so createClient doesn't throw before
// the Sanity project is configured. Callers guard real fetches with
// `isSanityConfigured` (see src/sanity/env.ts), so no network calls are made
// against the placeholder.
export const client = createClient({
  projectId: projectId || 'placeholder',
  dataset,
  apiVersion,
  // Use the CDN for fast, cached, published content. Blog pages are public, so
  // we never need draft content here.
  useCdn: true,
})
