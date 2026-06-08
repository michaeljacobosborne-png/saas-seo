// Sanity environment configuration.
//
// Replace SANITY_PROJECT_ID with your project ID from sanity.io/manage after
// running `npx sanity init` or creating a project in the dashboard, then set
// NEXT_PUBLIC_SANITY_PROJECT_ID in .env.local and on Vercel.
//
// These intentionally do NOT throw when unset so the app builds before the
// Sanity project exists — the blog simply renders empty until configured.

export const apiVersion =
  process.env.NEXT_PUBLIC_SANITY_API_VERSION || '2024-01-01'

export const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production'

export const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || ''

// True once a real project ID is configured. Data fetches short-circuit to
// empty results when this is false to keep builds/pages from erroring.
export const isSanityConfigured = projectId.length > 0

// Server-only read token. Optional — only needed if you query draft/unpublished
// content. Public published content is readable without it.
export const readToken = process.env.SANITY_API_READ_TOKEN || ''
