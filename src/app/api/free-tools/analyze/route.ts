export const runtime = 'nodejs'
export const maxDuration = 60

import { AUDIT_STEPS, AuditError } from '@/lib/geo-audit'
import { recordAudit, type RecordedAudit } from '@/lib/geo-audit/history'
import { consumeRun, identityFor, isQuotaExempt } from '@/lib/geo-audit/rate-limit'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { snapshotRow } from '@/lib/tracking'

/**
 * Shared NDJSON streaming endpoint for the free GEO and AO analyzers.
 *
 * This is a thin wrapper: all fetching, extraction, scoring and wording lives in
 * `src/lib/geo-audit`, which is unit-tested. Body: `{ url, type: 'geo'|'ao' }`.
 */
export async function POST(request: Request) {
  let body: { url?: string; type?: string }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const { url, type } = body
  if (!url || !url.trim()) return json({ error: 'url is required' }, 400)
  if (type !== 'geo' && type !== 'ao') return json({ error: 'type must be "geo" or "ao"' }, 400)

  // Rate limit before doing any paid work. Presented as a budget, not a wall:
  // the remaining count rides on every response so the UI can show it up front.
  // The signed-in owner is exempt so demos are not cut off after three runs.
  // Their runs are still counted, under their account id, so usage stays visible.
  const user = await verifiedUser()
  const exempt = isQuotaExempt(user)
  const counted = await consumeRun(exempt ? `user:${user!.id}` : identityFor(request.headers), { tool: type })
  const budget = exempt ? { ...counted, allowed: true, exempt: true } : counted
  if (!budget.allowed) {
    return json(
      {
        error: `You've used all ${budget.limit} free runs for today. Your next run is available after ${new Date(budget.resetsAt).toUTCString()}.`,
        rateLimit: budget,
      },
      429,
    )
  }

  const expectedAuthor = user ? await profileAuthorFor(user.id, url) : null

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))

      try {
        // Every run, free or signed in, is recorded with what it fetched
        // (DECISIONS 39): history that is not kept now cannot be rebuilt later.
        const run = await recordAudit(url, type, {
          // The audit clock. Passed explicitly so no date logic anywhere in the
          // engine has to assume what "now" is.
          now: new Date(),
          onProgress: (message, step) => send({ type: 'progress', message, step, total: AUDIT_STEPS }),
          expectedAuthor,
        })
        const snapshotId = await storeSnapshot(run, user?.id ?? null)
        // snapshotId lets this exact run become the first point of a tracked
        // page if the visitor signs up and tracks it.
        send({ type: 'result', ...run.report, rateLimit: budget, snapshotId })
      } catch (err) {
        send({
          type: 'error',
          error:
            err instanceof AuditError
              ? err.message
              : `Analysis failed: ${err instanceof Error ? err.message : String(err)}`,
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  })
}

/**
 * Keeps the run in audit_snapshots, untracked: tracked_page_id null, and user_id
 * null for an anonymous visitor. Never fails the audit: a storage problem costs
 * one point of history, not the visitor's result.
 */
async function storeSnapshot(run: RecordedAudit, userId: string | null): Promise<string | null> {
  try {
    const row = { ...snapshotRow({ id: '', user_id: userId ?? '', tool: run.snapshot.tool }, run), tracked_page_id: null, user_id: userId }
    const { data, error } = await createServiceClient().from('audit_snapshots').insert(row).select('id').single()
    if (error) throw new Error(error.message)
    return data.id as string
  } catch (err) {
    console.error('[free-tools/analyze] snapshot not stored', err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * The author the signed-in user's brand profile claims, but only when the URL
 * being audited is on that profile's own website: a profile author must never
 * be checked against somebody else's site (decision 17). Null otherwise, or if
 * the author columns do not exist yet.
 */
async function profileAuthorFor(userId: string, rawUrl: string): Promise<string | null> {
  try {
    const supabase = await createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rows } = await (supabase as any).from('brand_profiles').select('*').eq('user_id', userId)
    const host = (u: string) => new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`).hostname.replace(/^www\./, '')
    const target = host(rawUrl)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const own = (rows ?? []).find((r: any) => r.website_url && host(r.website_url) === target)
    return typeof own?.author_name === 'string' && own.author_name.trim() ? own.author_name.trim() : null
  } catch {
    return null
  }
}

/** The auth-server-verified user for this request, or null if anonymous. */
async function verifiedUser() {
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    return data.user ?? null
  } catch {
    return null
  }
}

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
