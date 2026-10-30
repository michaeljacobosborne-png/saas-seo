/**
 * Input schemas for the MCP tools (docs/mcp-server-spec.md §2).
 *
 * The URL schema is also the SSRF guard: an MCP tool that fetches arbitrary
 * URLs on our infrastructure must never be pointed at localhost, private
 * networks, link-local metadata endpoints or non-HTTP schemes.
 *
 * Limitation, recorded: this checks the hostname as written. A public name
 * that resolves to a private address (DNS rebinding) is not caught here; the
 * fetch layer must re-check the resolved address before connecting.
 */
import { z } from 'zod'

const PRIVATE_V4 = [
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // carrier-grade NAT
  /^(22[4-9]|2[3-5]\d)\./, // multicast and reserved
]

/** True when a hostname is obviously not a public website. */
export function isNonPublicHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')
  if (!h || h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) return PRIVATE_V4.some((r) => r.test(h))
  if (h.includes(':')) {
    // IPv6 literal: loopback, unspecified, link-local, unique-local, v4-mapped private.
    if (h === '::1' || h === '::') return true
    if (/^fe[89ab]/.test(h) || /^f[cd]/.test(h)) return true
    const mapped = h.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (mapped) return PRIVATE_V4.some((r) => r.test(mapped[1]))
    return false
  }
  if (!h.includes('.')) return true // single-label names resolve on internal DNS only
  return false
}

/** A public http(s) URL. Bare domains are accepted and given https://. */
export const publicUrl = z
  .string()
  .trim()
  .min(3)
  .max(2048)
  .transform((s) => (/^https?:\/\//i.test(s) ? s : `https://${s}`))
  .refine(
    (s) => {
      try {
        const u = new URL(s)
        return (u.protocol === 'https:' || u.protocol === 'http:') && !u.username && !u.password && !isNonPublicHost(u.hostname)
      } catch {
        return false
      }
    },
    { message: 'Must be a public http(s) website address.' },
  )

const auditId = z.string().uuid()
const shareToken = z.string().uuid()

export const runAuditInput = z.object({
  url: publicUrl,
  tool: z.enum(['geo', 'ao']).default('geo'),
  save: z.boolean().default(true),
})

export const checkCrawlerAccessInput = z.object({ url: publicUrl })

export const getAuditInput = z
  .object({ audit_id: auditId.optional(), share_token: shareToken.optional() })
  .refine((v) => Boolean(v.audit_id) !== Boolean(v.share_token), { message: 'Pass exactly one of audit_id or share_token.' })

export const listAuditsInput = z.object({
  domain: z.string().trim().min(3).max(253).optional(),
  url: publicUrl.optional(),
  limit: z.number().int().min(1).max(50).default(20),
  before: z.string().datetime().optional(),
})

export const compareAuditsInput = z.union([
  z.object({ audit_id_a: auditId, audit_id_b: auditId }).refine((v) => v.audit_id_a !== v.audit_id_b, { message: 'Pick two different audits.' }),
  z.object({ url: publicUrl, since: z.string().datetime() }),
])

export const scoreDraftInput = z
  .object({
    markdown: z.string().max(200_000).optional(),
    html: z.string().max(400_000).optional(),
    title: z.string().max(300).optional(),
    brand_name: z.string().max(120).optional(),
    author: z.object({ name: z.string().max(120), credentials: z.string().max(300).optional() }).optional(),
  })
  .refine((v) => Boolean(v.markdown) !== Boolean(v.html), { message: 'Pass exactly one of markdown or html.' })

export const TOOL_INPUTS = {
  run_audit: runAuditInput,
  check_crawler_access: checkCrawlerAccessInput,
  get_audit: getAuditInput,
  list_audits: listAuditsInput,
  compare_audits: compareAuditsInput,
  score_draft: scoreDraftInput,
} as const

export type ToolName = keyof typeof TOOL_INPUTS
