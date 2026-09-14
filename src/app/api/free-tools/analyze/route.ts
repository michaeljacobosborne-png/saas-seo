export const runtime = 'nodejs'
export const maxDuration = 60

import { AUDIT_STEPS, AuditError, runAudit } from '@/lib/geo-audit'

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
        send({ type: 'result', ...report })
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

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
