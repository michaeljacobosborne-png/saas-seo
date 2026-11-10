/**
 * POST /api/study/audit  { url }   run the study audit of one homepage
 * POST /api/study/audit  { probe: true }   report this function's vantage point, audit nothing
 *
 * The US vantage point for the study run. The harness (scripts/study/run.ts)
 * calls this on a deployed function instead of auditing from the operator's own
 * network, because where a request comes from changes what a site serves, and
 * the study compares sites from one place.
 *
 * Not a public endpoint. It is closed unless STUDY_RUN_TOKEN is set (16+
 * characters) and the caller presents it, and it refuses non-public hosts. The
 * response carries the vantage as observed (egress address and country looked
 * up from this function, platform region, request id), never as configured.
 *
 * Region: a Node function on Vercel runs in the project's function region
 * (Project Settings > Functions, or "regions" in vercel.json); `preferredRegion`
 * applies to the edge runtime only and this route needs node:https. So the
 * region is verified from the egress lookup on every call, not assumed.
 */
import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { auditSite } from '@/lib/study/audit-site'
import { lookupEgress } from '@/lib/study/vantage'
import { isNonPublicHost } from '@/lib/mcp/schemas'
import { ENGINE_VERSION } from '@/lib/geo-audit/types'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

function authorised(request: Request): boolean {
  const token = process.env.STUDY_RUN_TOKEN ?? ''
  if (token.length < 16) return false // fail closed
  const given = /^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization') ?? '')?.[1] ?? ''
  const a = Buffer.from(given)
  const b = Buffer.from(token)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(request: Request) {
  if (!authorised(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { url?: string; probe?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const requestId = request.headers.get('x-vercel-id')
  const vantage = await lookupEgress({ mode: 'remote', requestId })

  if (body.probe) return NextResponse.json({ engineVersion: ENGINE_VERSION, vantage })

  let url: URL
  try {
    url = new URL(body.url ?? '')
  } catch {
    return NextResponse.json({ error: 'A valid url is required.' }, { status: 400 })
  }
  if (!/^https?:$/.test(url.protocol) || isNonPublicHost(url.hostname)) {
    return NextResponse.json({ error: 'Only public http(s) hosts can be audited.' }, { status: 400 })
  }

  return NextResponse.json(await auditSite(url.href, { vantage }))
}
