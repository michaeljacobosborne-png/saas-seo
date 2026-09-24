'use client'

/**
 * Sanity Studio configuration. This config is used by the embedded Studio
 * mounted at /studio (see src/app/studio/[[...tool]]/page.tsx).
 *
 * projectId and dataset are read from env vars in src/sanity/env.ts.
 * Replace SANITY_PROJECT_ID with your project ID from sanity.io/manage after
 * running `npx sanity init` or creating a project in the dashboard, then set
 * NEXT_PUBLIC_SANITY_PROJECT_ID in .env.local and on Vercel.
 */

import { visionTool } from '@sanity/vision'
import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'

import { apiVersion, dataset, projectId } from './src/sanity/env'
import { schema } from './src/sanity/schemaTypes'

export default defineConfig({
  basePath: '/studio',
  // Falls back to a placeholder until NEXT_PUBLIC_SANITY_PROJECT_ID is set.
  // The Studio is auth-gated and only loads in-browser, so this never affects
  // the public build or /blog.
  projectId: projectId || 'placeholder',
  dataset,
  schema,
  plugins: [
    structureTool(),
    // Vision lets you test GROQ queries against your dataset from within Studio.
    visionTool({ defaultApiVersion: apiVersion }),
  ],
})
