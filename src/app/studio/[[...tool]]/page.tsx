'use client'

/**
 * Embedded Sanity Studio, mounted at /studio (and all sub-routes via the
 * optional catch-all segment). Accessible from any browser at
 * app.bylineseo.com/studio — access is gated by the server layout (Supabase
 * admin auth) one level up.
 */

import { NextStudio } from 'next-sanity/studio'

import config from '../../../../sanity.config'

export const dynamic = 'force-dynamic'

export default function StudioPage() {
  return <NextStudio config={config} />
}
