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

// Sanity validates `dataset` and `projectId` inside createClient() — which runs
// at module-eval time, before any isSanityConfigured guard. A blank-but-truthy
// value (e.g. a stray quote or whitespace injected by a misconfigured Vercel
// env var) therefore aborts the build with "Datasets can only contain ...".
// Sanitize here so an invalid value falls back to a safe default and the app
// builds regardless of how the env vars are set.
//
// Dataset: lowercase letters, numbers, underscores, dashes, optional leading
// tilde, max 64 chars. ProjectId: lowercase letters, numbers, dashes.
const DATASET_RE = /^~?[a-z0-9_-]{1,64}$/
const PROJECT_ID_RE = /^[a-z0-9-]+$/

const rawDataset = (process.env.NEXT_PUBLIC_SANITY_DATASET || '').trim()
export const dataset = DATASET_RE.test(rawDataset) ? rawDataset : 'production'

const rawProjectId = (process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || '').trim()
export const projectId = PROJECT_ID_RE.test(rawProjectId) ? rawProjectId : ''

// True once a real project ID is configured. Data fetches short-circuit to
// empty results when this is false to keep builds/pages from erroring.
export const isSanityConfigured = projectId.length > 0

// Server-only read token. Optional — only needed if you query draft/unpublished
// content. Public published content is readable without it.
export const readToken = process.env.SANITY_API_READ_TOKEN || ''
