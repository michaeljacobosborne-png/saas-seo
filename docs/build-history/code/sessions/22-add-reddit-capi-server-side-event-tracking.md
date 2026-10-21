# Add Reddit CAPI server-side event tracking

- Session `9e369b3b-681d-42cd-a427-2fd8d4908b03`
- 2026-07-08 11:36 to 2026-07-08 12:11
- Branch: `master`  |  Claude Code 2.1.202

**Files touched (7):** `src/app/api/audit/lead/route.ts`, `src/app/auth/callback/route.ts`, `src/app/api/billing/webhook/route.ts`, `src/lib/reddit-pixel.ts`, `src/lib/analytics-events.ts`, `src/lib/analytics.ts`, `src/lib/meta-capi.ts`

---


## Michael

Add Reddit Conversions API (CAPI) server-side event tracking to the Byline Next.js app at C:\Users\ozzy5\OneDrive\Documents\Byline.

**Pixel ID:** `a2_j8679g6sf5so`
**CAPI endpoint:** `https://ads-api.reddit.com/api/v3/pixels/a2_j8679g6sf5so/conversion_events`
**Access token:** `eyJhbGciOiJSUzI1NiIsImtpZCI6IlNIQTI1NjpzS3dsMnlsV0VtMjVmcXhwTU40cWY4MXE2OWFFdWFyMnpLMUdhVGxjdWNZIiwidHlwIjoiSldUIn0.eyJzdWIiOiJ1c2VyIiwiZXhwIjo0OTM5MjcwNTE5LjE5NzUyMywiaWF0IjoxNzgzNTEwNTE5LjE5NzUyMywianRpIjoiT05Ya3h1bjluclNyRW9UMlNrNFNISWFWME15WHVBIiwiY2lkIjoiMVExRU96VFBXbll2ZXJocHR2Z1dzUSIsImxpZCI6InQyXzJpNGZ1bHpkYzEiLCJhaWQiOiJ0Ml8yaTRmdWx6ZGMxIiwiYXQiOjUsImxjYSI6MTc4MzUxMDQ2MzI2Miwic2NwIjoiZUp5S1ZrcE1LVTdPenl0TExTck96TThyVm9vRkJBQUFfXzlCRmdidSIsImZsbyI6MTAsImxsIjp0cnVlfQ.P4KYUh_KawtfsonegmSoS_T4VxWE_dl2DnCnaw_DuiKtTGUGGrIarR-O9HafP22L_YZ2bGV2MBnL-ulyJW4sNn7aowsHyCi8L5iev93hFiXPoQ3uMll7lF1Hd8JVlHvjJyMKlM0gr-DwqmRIbyze-UcNEd7OQnh2U1HHOoUVHZQGR6AqIi1fz6bYPI4RbkJy3wem3-yxuYNgsXY0R9O2vGiG_kYIIkWyF4bK1lEeaXtzswkebOKlIrDwHTb-Rdd7Itql9zJACOeWZI7ysYzDOw46UXxldWif19K7Uw-CASQBNazcIy-huCmdlHt55KHCuOfa2j61Q_PfHT2KsbV2-A`

**DO NOT hardcode the token in any source file.** Add it to Vercel env vars and `.env.local` only.

---

## Step 1 — Add env var to Vercel

```bash
curl -s -X POST "https://api.vercel.com/v10/projects/prj_DkQtXvVAVjzwC5qH2RqPfOG7vktr/env" \
  -H "Authorization: Bearer $(grep VERCEL_TOKEN .env.local | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d '{"key":"REDDIT_CAPI_TOKEN","value":"eyJhbGciOiJSUzI1NiIsImtpZCI6IlNIQTI1NjpzS3dsMnlsV0VtMjVmcXhwTU40cWY4MXE2OWFFdWFyMnpLMUdhVGxjdWNZIiwidHlwIjoiSldUIn0.eyJzdWIiOiJ1c2VyIiwiZXhwIjo0OTM5MjcwNTE5LjE5NzUyMywiaWF0IjoxNzgzNTEwNTE5LjE5NzUyMywianRpIjoiT05Ya3h1bjluclNyRW9UMlNrNFNISWFWME15WHVBIiwiY2lkIjoiMVExRU96VFBXbll2ZXJocHR2Z1dzUSIsImxpZCI6InQyXzJpNGZ1bHpkYzEiLCJhaWQiOiJ0Ml8yaTRmdWx6ZGMxIiwiYXQiOjUsImxjYSI6MTc4MzUxMDQ2MzI2Miwic2NwIjoiZUp5S1ZrcE1LVTdPenl0TExTck96TThyVm9vRkJBQUFfXzlCRmdidSIsImZsbyI6MTAsImxsIjp0cnVlfQ.P4KYUh_KawtfsonegmSoS_T4VxWE_dl2DnCnaw_DuiKtTGUGGrIarR-O9HafP22L_YZ2bGV2MBnL-ulyJW4sNn7aowsHyCi8L5iev93hFiXPoQ3uMll7lF1Hd8JVlHvjJyMKlM0gr-DwqmRIbyze-UcNEd7OQnh2U1HHOoUVHZQGR6AqIi1fz6bYPI4RbkJy3wem3-yxuYNgsXY0R9O2vGiG_kYIIkWyF4bK1lEeaXtzswkebOKlIrDwHTb-Rdd7Itql9zJACOeWeZI7ysYzDOw46UXxldWif19K7Uw-CASQBNazcIy-huCmdlHt55KHCuOfa2j61Q_PfHT2KsbV2-A","type":"encrypted","target":["production","preview","development"]}'
```

If that command fails (e.g. VERCEL_TOKEN not in .env.local), read `.env.local` to find the correct Vercel token env var name, or try reading `.env.local` to see what token is available. Also add it to `.env.local` manually:
```
REDDIT_CAPI_TOKEN=eyJhbGciOiJSUzI1NiIsImtpZCI6IlNIQTI1NjpzS3dsMnlsV0VtMjVmcXhwTU40cWY4MXE2OWFFdWFyMnpLMUdhVGxjdWNZIiwidHlwIjoiSldUIn0.eyJzdWIiOiJ1c2VyIiwiZXhwIjo0OTM5MjcwNTE5LjE5NzUyMywiaWF0IjoxNzgzNTEwNTE5LjE5NzUyMywianRpIjoiT05Ya3h1bjluclNyRW9UMlNrNFNISWFWME15WHVBIiwiY2lkIjoiMVExRU96VFBXbll2ZXJocHR2Z1dzUSIsImxpZCI6InQyXzJpNGZ1bHpkYzEiLCJhaWQiOiJ0Ml8yaTRmdWx6ZGMxIiwiYXQiOjUsImxjYSI6MTc4MzUxMDQ2MzI2Miwic2NwIjoiZUp5S1ZrcE1LVTdPenl0TExTck96TThyVm9vRkJBQUFfXzlCRmdidSIsImZsbyI6MTAsImxsIjp0cnVlfQ.P4KYUh_KawtfsonegmSoS_T4VxWE_dl2DnCnaw_DuiKtTGUGGrIarR-O9HafP22L_YZ2bGV2MBnL-ulyJW4sNn7aowsHyCi8L5iev93hFiXPoQ3uMll7lF1Hd8JVlHvjJyMKlM0gr-DwqmRIbyze-UcNEd7OQnh2U1HHOoUVHZQGR6AqIi1fz6bYPI4RbkJy3wem3-yxuYNgsXY0R9O2vGiG_kYIIkWyF4bK1lEeaXtzswkebOKlIrDwHTb-Rdd7Itql9zJACOeWeZI7ysYzDOw46UXxldWif19K7Uw-CASQBNazcIy-huCmdlHt55KHCuOfa2j61Q_PfHT2KsbV2-A
```

## Step 2 — Create `src/lib/reddit-capi.ts`

```typescript
const PIXEL_ID = 'a2_j8679g6sf5so'
const CAPI_URL = `https://ads-api.reddit.com/api/v3/pixels/${PIXEL_ID}/conversion_events`

type StandardTrackingType = 'Lead' | 'SignUp' | 'Purchase' | 'PageVisit' | 'AddToCart' | 'ViewContent'

interface RedditCapiEvent {
  event_at: number // Unix ms
  action_source: 'website' | 'app' | 'offline'
  tracking_type: StandardTrackingType
  click_id?: string
  email?: string // will be hashed by Reddit
  external_id?: string // user ID, hashed by Reddit
  value?: number
  currency?: string
  conversion_id?: string // for deduplication with browser pixel
}

export async function sendRedditCapiEvent(event: RedditCapiEvent): Promise<void> {
  const token = process.env.REDDIT_CAPI_TOKEN
  if (!token) {
    console.warn('[reddit-capi] REDDIT_CAPI_TOKEN not set — skipping')
    return
  }

  const body = {
    data: {
      events: [
        {
          event_at: event.event_at,
          action_source: event.action_source,
          type: { tracking_type: event.tracking_type },
          ...(event.click_id && { click_id: event.click_id }),
          ...(event.conversion_id && { conversion_id: event.conversion_id }),
          user: {
            ...(event.email && { email: event.email }),
            ...(event.external_id && { external_id: event.external_id }),
          },
          ...(event.value !== undefined && {
            value: { currency: event.currency ?? 'USD', value: event.value },
          }),
        },
      ],
    },
  }

  try {
    const res = await fetch(CAPI_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text()
      console.error(`[reddit-capi] ${res.status}: ${text}`)
    } else {
      console.log(`[reddit-capi] ${event.tracking_type} sent OK`)
    }
  } catch (err) {
    console.error('[reddit-capi] fetch error:', err)
  }
}
```

## Step 3 — Wire `Lead` event in `/api/audit/lead/route.ts`

Inside the `after()` callback, after `ghlAddToWorkflow`, add:

```typescript
import { sendRedditCapiEvent } from '@/lib/reddit-capi'

// inside after() callback:
await sendRedditCapiEvent({
  event_at: Date.now(),
  action_source: 'website',
  tracking_type: 'Lead',
  email,
  external_id: userId ?? undefined,
})
```

## Step 4 — Wire `SignUp` event

Find the auth callback or wherever new user registration is confirmed. Read `src/app/auth/callback/route.ts` and any webhook that handles new user creation. Add:

```typescript
await sendRedditCapiEvent({
  event_at: Date.now(),
  action_source: 'website',
  tracking_type: 'SignUp',
  email: user.email,
  external_id: user.id,
})
```

## Step 5 — Wire `Purchase` event in Stripe webhook

Find the Stripe webhook handler (likely `src/app/api/webhooks/stripe/route.ts`). In the `checkout.session.completed` or `customer.subscription.created` handler, add:

```typescript
await sendRedditCapiEvent({
  event_at: Date.now(),
  action_source: 'website',
  tracking_type: 'Purchase',
  email: customerEmail,
  external_id: userId,
  value: amountInDollars,
  currency: 'USD',
})
```

## Step 6 — Commit and deploy

- `git pull --rebase origin main`
- Stage only the files you changed
- Commit: `git -c user.email=michaeljacobosborne@gmail.com -c user.name="Michael Osborne" commit -m "Add Reddit CAPI server-side events — Lead, SignUp, Purchase"`
- Push to origin main
- POST deploy hook: `curl -X POST "https://api.vercel.com/v1/integrations/deploy/prj_DkQtXvVAVjzwC5qH2RqPfOG7vktr/HCPNWt1KoS"`

Report back: which files changed, whether the Vercel env var was added successfully, and whether the deploy triggered.

**Claude:** I'll work through this carefully. First, let me explore the codebase to verify the file locations mentioned (the prompt guesses at several) and check the existing Reddit pixel work for consistency. Let me also confirm `.env.local` is gitignored before touching any token.

> `Bash: git branch --show-current && echo "---REMOTES---" && git remote -v && echo "---GITIGNORE env---" && git check-ignore .env.local && echo ".env.local is ignored (`

> `Bash: ls src/app/api/audit/lead/ 2>/dev/null; echo "---"; ls src/app/auth/ 2>/dev/null; echo "---"; ls src/app/api/webhooks/ 2>/dev/null; echo "---stripe search---"; `

> `Grep: RedditPixel|reddit|Reddit`

**Claude:** Branch is `master` (not `main`), `.env.local` is gitignored, and there's no `/api/webhooks/` dir — the Stripe handler is likely under `/api/billing/`. Let me read the actual files.

> `Bash: ls -R src/app/api/billing/ 2>/dev/null; echo "===GREP stripe webhook==="; grep -rl "checkout.session.completed\|constructEvent\|stripe" src/app/api/ 2>/dev/null`

> `Read: src/app/api/audit/lead/route.ts`

> `Read: src/app/auth/callback/route.ts`

**Claude:** Now the Stripe webhook and existing pixel lib, plus checking `.env.local` for the Vercel token and any existing Reddit vars.

> `Read: src/app/api/billing/webhook/route.ts`

> `Read: src/lib/reddit-pixel.ts`

> `Bash: grep -iE "VERCEL_TOKEN|VERCEL|REDDIT" .env.local | sed -E 's/=(.{6}).*/=\1…[redacted]/' 2>/dev/null; echo "---keys present---"; grep -oE "^[A-Z_]+=" .env.local `

**Claude:** No `VERCEL_TOKEN` exists in `.env.local` — so Step 1's Vercel API call can't be authenticated from here. I'll note that for the user. There's a `META_CAPI_ACCESS_TOKEN` confirming the CAPI pattern. Let me check where the client-side Reddit Purchase/SignUp events fire so I can match `conversion_id` for browser↔server dedup.

> `Grep: rdt\(|reddit|Purchase|SignUp|conversion_id|eventId`

> `Grep: rdt\(|trackRedditSignUp|trackRedditPurchase|reddit`

> `Read: src/lib/analytics-events.ts`

**Claude:** Let me read the analytics.ts context around the Reddit calls to understand the client-side dedup ids.

> `Read: src/lib/analytics.ts`

**Claude:** The client fires `rdt('SignUp')` and `rdt('Purchase', {...})` without a `conversion_id`, so server CAPI events would double-count against the pixel unless they share a dedup key. Let me check the client-side Lead firing to align `conversion_id` there too.

> `Grep: rdt\(|leadEventId|Lead|conversion_id`

> `Grep: leadEventId|eventId|crypto|randomUUID|fetch\('/api/audit/lead'|body`

**Claude:** The client Lead has no shared dedup id (matching how Meta Lead already works here), but SignUp and Purchase do have natural keys. Before finalizing the CAPI helper, I want to verify one correctness point the prompt glosses over: whether Reddit's CAPI expects **plaintext** email (the prompt's comment says "will be hashed by Reddit") or **SHA-256-hashed** email like Meta's does. Let me check the existing Meta CAPI hashing and confirm Reddit's spec.

> `Read: src/lib/meta-capi.ts`

> `ToolSearch: select:WebFetch`

**Claude:** Meta CAPI hashes email server-side. Let me confirm Reddit's requirement rather than trust the prompt's inline comment.

> `WebFetch: Does the Reddit Conversions API require the caller to SHA-256 hash the email and external_id (external identifier) befor`

> `WebFetch: For the Conversions API endpoint /pixels/{pixel_id}/conversion_events, does the caller need to SHA-256 hash the email an`

> `WebFetch: Does the Reddit Conversions API require SHA-256 hashing of email and external_id before sending? What are the user objec`

> `ToolSearch: select:WebSearch`

> `WebSearch: Reddit Conversions API conversion_events email SHA-256 hashed user object required fields`

**Claude:** Confirmed: Reddit CAPI expects email and external_id **SHA-256 hashed** (normalized), with IP/user-agent left raw. The prompt's "Reddit will hash it" comment would send plaintext PII — I'll hash it like the repo's Meta helper does. Let me confirm the exact payload field names (`event_type` vs `type`, `event_at` units) before writing the helper.

> `WebFetch: What is the exact JSON payload structure for the Reddit Conversions API conversion_events endpoint? List the exact field`

> `WebFetch: Show the exact JSON request body structure Reddit's Conversions API expects: field names for event timestamp (event_at),`

**Claude:** WebFetch can't reach `ads-api.reddit.com` directly, and the prompt's payload shape looks Meta-influenced (top-level `data` wrapper, `type` instead of `event_type`, `action_source`, a `value` object) — which may not match Reddit's actual v3 schema. Let me pull the exact field mapping from authoritative third-party integrations that mirror Reddit's API.

> `WebFetch: List the exact Reddit Conversions API request field names this integration maps to: the top-level body wrapper (is there`

> `WebFetch: What exact JSON fields does the Reddit Conversions API expect? Report: event_at format, event_type/tracking_type, click_`

**Claude:** I now have enough to see the prompt's payload shape is **Meta-influenced and likely wrong for Reddit v3**. Reddit v3 expects: no `data` wrapper (just `events[]`), `event_type` (not `type`), an `event_metadata` object with `value_decimal`/`currency`/`conversion_id`, an RFC3339 `event_at` string (not epoch ms), no `action_source`, and **SHA-256-hashed** email/external_id. Rather than guess, I'll write the token to `.env.local` and empirically validate both schemas against Reddit's endpoint in `test_mode` (which doesn't affect real reporting).

> `Bash: cd "C:/Users/ozzy5/OneDrive/Documents/Byline"`

**Claude:** Token is in `.env.local` (gitignored). Now let me empirically validate my corrected v3 schema vs. the prompt's schema against Reddit's live endpoint using `test_mode: true`.

> `Bash: cd "C:/Users/ozzy5/OneDrive/Documents/Byline"`

**Claude:** All three return **401 UNAUTHORIZED** — auth fails before schema is even evaluated. That's either a corrupted token in my file or a genuinely invalid/unauthorized token. Let me verify the token's integrity and decode it.

> `Bash: cd "C:/Users/ozzy5/OneDrive/Documents/Byline"`

**Claude:** Token is well-formed, fresh (issued ~35 min ago), and not expired (`exp` ≈ 2126). Yet every call 401s. Let me isolate whether it's the token/scope or the endpoint path by hitting a simple authenticated read endpoint with the same token.

> `Bash: cd "C:/Users/ozzy5/OneDrive/Documents/Byline"`
