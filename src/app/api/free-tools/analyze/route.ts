export const runtime = 'nodejs'
export const maxDuration = 60

import { AUDIT_STEPS, AuditError, runAudit } from '@/lib/geo-audit'
import { consumeRun, identityFor, isQuotaExempt } from '@/lib/geo-audit/rate-limit'
import { createClient } from '@/lib/supabase/server'

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

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))

      try {
        const report = await runAudit(url, type, {
          // The audit clock. Passed explicitly so no date logic anywhere in the
          // engine has to assume what "now" is.
          now: new Date(),
          onProgress: (message, step) => send({ type: 'progress', message, step, total: AUDIT_STEPS }),
        })
        send({ type: 'result', ...report, rateLimit: budget })
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
