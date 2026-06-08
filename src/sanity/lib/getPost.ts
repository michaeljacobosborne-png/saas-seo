import { cache } from 'react'

import { isSanityConfigured } from '../env'
import { client } from './client'
import { postBySlugQuery } from './queries'

// Memoized for the duration of a single request so generateMetadata and the
// page component share one fetch. ISR still applies via the page's revalidate.
export const getPost = cache((slug: string) =>
  isSanityConfigured ? client.fetch(postBySlugQuery, { slug }) : Promise.resolve(null)
)
