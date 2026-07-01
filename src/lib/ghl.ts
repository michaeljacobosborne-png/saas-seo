// GoHighLevel (GHL) API helper — REST API v2 (https://services.leadconnectorhq.com).
//
// All functions are FIRE-AND-FORGET by contract: they never throw and never
// block the caller's main request. Every network call is wrapped in try/catch,
// errors are logged via `console.error('[GHL]', ...)` so they surface in Vercel
// logs, and failures resolve quietly. A GHL outage must NEVER degrade the user
// experience — callers should invoke these with `void` (or inside an async IIFE)
// and not await them on the request's critical path.
//
// Auth: v2 uses PIT (Private Integration Token) keys — pass the token as the
// Bearer value. GHL_LOCATION_ID is required in the request body for v2 contact
// upserts (v2 does not infer location from the key alone).
//
// NOTE: a separate, simpler GHL integration already exists in the Stripe webhook
// (`GHL_WEBHOOK_URL`, an inbound-webhook trigger). That stays as-is; this helper
// is the richer API-key path used for the audit funnel + onboarding activation.

const GHL_API_KEY = process.env.GHL_API_KEY
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID

const GHL_BASE = 'https://services.leadconnectorhq.com'

// Abort GHL calls that hang so a slow/down GHL can't keep a serverless function
// alive past its timeout. Fire-and-forget means nothing is awaiting the result,
// but a dangling fetch still holds the function open.
const GHL_TIMEOUT_MS = 8000

function isConfigured(): boolean {
  if (!GHL_API_KEY) {
    // Quiet single-line note — expected on local dev / preview without the key.
    return false
  }
  return true
}

// Thin fetch wrapper: injects auth + JSON headers, enforces a timeout, and
// returns the parsed body on success or null on any failure (network, non-2xx,
// timeout, JSON parse). Never throws.
async function ghlFetch(
  path: string,
  init: { method: string; body?: unknown },
  context: Record<string, unknown> = {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), GHL_TIMEOUT_MS)
  try {
    const res = await fetch(`${GHL_BASE}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${GHL_API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Version: '2021-07-28',
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error('[GHL] non-OK response', { path, status: res.status, body: text.slice(0, 300), ...context })
      return null
    }

    // Some endpoints (e.g. add-to-workflow) return an empty body on success.
    const raw = await res.text()
    if (!raw) return {}
    try {
      return JSON.parse(raw)
    } catch {
      return {}
    }
  } catch (err) {
    console.error('[GHL] request failed', { path, error: err instanceof Error ? err.message : String(err), ...context })
    return null
  } finally {
    clearTimeout(timer)
  }
}

// Contact upsert — creates or updates a contact by email. v2's POST /contacts/
// upserts on email within the location (locationId is required in the body), so
// re-capturing an existing lead (e.g. an audit_lead who later signs up) updates
// the same contact rather than duplicating it. Returns the GHL contactId, or null on failure.
export async function ghlUpsertContact(params: {
  email: string
  firstName?: string
  lastName?: string
  tags?: string[]
  customFields?: Record<string, string | number | boolean>
}): Promise<string | null> {
  try {
    if (!isConfigured()) return null
    const email = (params.email ?? '').trim()
    if (!email) {
      console.error('[GHL] ghlUpsertContact called without an email')
      return null
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: Record<string, any> = { email }
    if (params.firstName) body.firstName = params.firstName
    if (params.lastName) body.lastName = params.lastName
    if (params.tags?.length) body.tags = params.tags
    if (params.customFields && Object.keys(params.customFields).length) {
      // v2 accepts custom fields as a flat { key: value } object.
      body.customField = params.customFields
    }
    if (GHL_LOCATION_ID) body.locationId = GHL_LOCATION_ID

    const data = await ghlFetch('/contacts/', { method: 'POST', body }, { email })
    if (!data) return null

    // v2 returns the contact under `contact`; tolerate a flat shape too.
    const contactId: string | undefined = data?.contact?.id ?? data?.id
    if (!contactId) {
      console.error('[GHL] upsert succeeded but no contactId in response', { email })
      return null
    }
    return contactId
  } catch (err) {
    // Defensive — isConfigured/ghlFetch already swallow, but never let this throw.
    console.error('[GHL] ghlUpsertContact unexpected error', err)
    return null
  }
}

// Add a contact to a GHL workflow (drip/automation) by workflow id.
export async function ghlAddToWorkflow(contactId: string, workflowId: string): Promise<void> {
  try {
    if (!isConfigured()) return
    if (!contactId || !workflowId) {
      console.error('[GHL] ghlAddToWorkflow missing contactId or workflowId', { contactId, workflowId })
      return
    }
    await ghlFetch(
      `/contacts/${encodeURIComponent(contactId)}/workflow/${encodeURIComponent(workflowId)}`,
      { method: 'POST', body: {} },
      { contactId, workflowId },
    )
  } catch (err) {
    console.error('[GHL] ghlAddToWorkflow unexpected error', err)
  }
}

// Add tags to a contact. Additive — GHL merges with the contact's existing tags
// rather than replacing them.
export async function ghlAddTags(contactId: string, tags: string[]): Promise<void> {
  try {
    if (!isConfigured()) return
    if (!contactId || !tags?.length) return
    await ghlFetch(
      `/contacts/${encodeURIComponent(contactId)}/tags/`,
      { method: 'POST', body: { tags } },
      { contactId, tags },
    )
  } catch (err) {
    console.error('[GHL] ghlAddTags unexpected error', err)
  }
}

// Update a single custom field on a contact.
export async function ghlUpdateCustomField(
  contactId: string,
  fieldKey: string,
  value: string | number | boolean,
): Promise<void> {
  try {
    if (!isConfigured()) return
    if (!contactId || !fieldKey) return
    await ghlFetch(
      `/contacts/${encodeURIComponent(contactId)}`,
      { method: 'PUT', body: { customField: { [fieldKey]: value } } },
      { contactId, fieldKey },
    )
  } catch (err) {
    console.error('[GHL] ghlUpdateCustomField unexpected error', err)
  }
}
