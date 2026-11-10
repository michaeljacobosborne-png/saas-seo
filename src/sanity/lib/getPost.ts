import { cache } from 'react'

import { isSanityConfigured } from '../env'
import { client } from './client'
import { postBySlugQuery } from './queries'

// Memoized for the duration of a single request so generateMetadata and the
// page component share one fetch. ISR still applies via the page's revalidate.
// A fetch failure resolves to null (→ notFound / "Post not found") rather than
// crashing the build or request.
export const getPost = cache(async (slug: string) => {
  if (!isSanityConfigured) return null
  try {
    return await client.fetch(postBySlugQuery, { slug })
  } catch (err) {
    console.warn(`[blog] getPost("${slug}"): Sanity fetch failed`, err)
    return null
  }
})
