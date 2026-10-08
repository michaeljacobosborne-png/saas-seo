# Byline MCP server: specification

Status: BUILDING, updated 2026-10-04. Decisions 21–27 (docs/DECISIONS.md) settle M1–M7. Built in `src/lib/mcp` (pure, tested): auth resolvers (OAuth + API key), schemas with SSRF guard, entitlements, limits, metering. Not built yet: tables, the route, the consent page.
Audience (decisions 3–4): freelance and in-house SEOs who keep their own Claude workflow and pay Byline for the data layer underneath it.

## 1. What it is

A remote MCP server at `https://mcp.bylineseo.com/mcp` (decision 25), Streamable HTTP transport, served by the existing Next.js app on Vercel with the subdomain added to the project. It is a thin protocol layer over `src/lib/geo-audit`: the engine is already decoupled from fetching and from routes (`runAudit`, `probeCrawlerAccess`, `buildDraftReport` are plain functions). No scoring logic lives in the MCP layer.

Invariants carry over unchanged:
- The model never sets a score.
- Nothing claims actual AI visibility.
- Every finding carries evidence.
- An unassessable factor reports as unverified, never as zero.
- A withheld score is returned as withheld, never as 0.

Every tool result restates the scope line ("an assessment of content readiness, not a measurement of AI visibility").

## 2. Tools

| Tool | Input | Does | Cost to us |
|---|---|---|---|
| `run_audit` | `url`, `tool: "geo" \| "ao"` (default geo), `save` (default true) | `runAudit()` on the live page, including the crawler probe; saves to `audit_results` (`source: "mcp"`, `user_id`), returns the report plus `audit_id` and share link | Fetches plus one Haiku narration call (about $0.001) |
| `check_crawler_access` | `url` | robots.txt plus the live probe (baseline plus each AI crawler UA), cross-referenced; returns per-crawler served/refused/robots-blocked/unknown with HTTP evidence | Fetches only |
| `get_audit` | `audit_id` or `share_token` | Returns one stored audit the caller owns, or one reachable by share token | DB read |
| `list_audits` | `domain?`, `url?`, `limit` (≤50), `before?` | The caller's stored audits, newest first: id, url, date, Retrievable, Citable band, engine version | DB read |
| `compare_audits` | `audit_id_a`, `audit_id_b`, or `url` + `since` | Deterministic diff: Retrievable delta, per-group and per-check score changes, factor status transitions, Citable band changes per signal, findings resolved and new. Reports what is not comparable (legacy rows, different engine version, different final URL). | CPU only |
| `score_draft` (decision 24) | `markdown` or `html`, `title?`, `brand_name?`, `author?` | `buildDraftReport()`: the 45-of-100 draft score, judged-now and judged-at-publication. Lets users score what they write in Claude before publishing. | CPU only |

Output shape: each tool returns `structuredContent` (the full JSON, same types as the engine) plus a short text summary for the model to read. That summary carries the scores, the top three findings with evidence, and the scope line. No prose recommendations are generated for MCP calls beyond what `runAudit` already produces.

Comparability: add `engineVersion` to every new report (`AuditReport.engineVersion`, starting "2026.10"). `compare_audits` refuses to diff scores across a version boundary and reports "not comparable: engine changed" rather than a misleading delta. Rows written before the version field are treated as `legacy`.

## 3. Authentication (decision 21)

**OAuth 2.1 is the target; API keys are a side path.**

### OAuth 2.1, with Supabase as the authorization server
- Supabase Auth ships an OAuth 2.1 server (auth-js 2.106 exposes `auth.oauth.getAuthorizationDetails / approveAuthorization / denyAuthorization / listGrants / revokeGrant` and admin client management, with dynamic client registration). We do not write an authorization server.
- Byline is the resource server only:
  - `GET https://mcp.bylineseo.com/.well-known/oauth-protected-resource` names the Supabase issuer as the authorization server.
  - 401 responses carry `WWW-Authenticate: Bearer resource_metadata="…"` so claude.ai can discover it.
  - Access tokens are verified with Supabase (JWKS or `auth.getUser(token)`); the `client_id` claim is recorded as the credential for metering.
- We build one page: the consent screen (`/oauth/consent`) inside the signed-in app, which shows the client name and scopes and calls approve/deny.
- Setup Michael must do: enable the OAuth 2.1 server and dynamic client registration in the Supabase dashboard (Authentication → OAuth Server), set the consent URL, add `mcp.bylineseo.com` in Vercel and DNS.

### API keys (side path)
- Settings → API keys. Shown once; stored as SHA-256 hash plus prefix in `api_keys`: `id, user_id, name, prefix, key_hash, created_at, last_used_at, revoked_at`.
- Sent as `Authorization: Bearer byl_live_…`. For Claude Code and scripts.

Both resolve to the same `McpPrincipal { userId, keyId (OAuth client or key id), plan, isOwner, via }` through `chainResolvers(oauthResolver, apiKeyResolver)`. Tools never see which was used.

Never: shared secrets in URLs, IP allowlists, or any unauthenticated tool.

## 4. Entitlements, metering, rate limits

**Entitlements live in one place** (`src/lib/mcp/entitlements.ts`, decision 27). `PLAN_MODEL` maps internal tier → capability → monthly allowance (0 = not included, null = unmetered). Moving MCP to its own plan is an edit to that table. Tool responses and errors never name a plan or tier: "not included in your current Byline subscription" plus an upgrade link.

**Free vs paid** (decision 22): the crawler access test and `score_draft` are free with small allowances. `run_audit`, stored audits (`get_audit`, `list_audits`) and `compare_audits` are paid. Comparison is never free.

**Allowances** (decision 23, PROPOSED, awaiting confirmation). Cost at full use assumes about $0.0015 per audit (Haiku narration plus function time) and $0.0001 per crawler check; `score_draft` and reads cost CPU only.

| Tier | crawler check | run_audit | stored/compare | score_draft | Cost at full use |
|---|---|---|---|---|---|
| Free | 30 | 0 | 0 | 30 | ≈ $0.01 |
| Starter | 500 | 150 | unmetered | 500 | ≈ $0.28 |
| Growth | 1,500 | 500 | unmetered | 2,000 | ≈ $0.90 |
| Multi-Brand | 4,500 | 1,500 | unmetered | 5,000 | ≈ $2.70 |

Reasoning: cost is negligible at every level, so these are abuse limits sized to real work. A Starter user re-auditing about 5 pages a day fits; Growth covers a small agency's weekly sweep; Multi-Brand is 3× Growth like the dashboard. The binding limit is the per-domain cap, which protects third-party sites.

**Metering** (decisions 23, 26, 27): every call, whatever the plan, writes an `api_calls` row: `user_id, credential_id, via, tool, target_domain, outcome, reason, duration_ms, model_cost_usd, engine_version, created_at`. That is per account AND per OAuth client or key, enough to price MCP on its own later. Records are never sent to GHL or used to trigger email; someone wiring up a developer tool is not a lead.

**Rate limits**: per credential 10 calls/minute and 2 concurrent `run_audit`s; per target domain at most 6 probe-or-audit calls per 10 minutes, owner included. Errors carry `retry_after`. The owner (decision 11) is exempt from allowances and per-minute limits, never from the domain cap or validation.

## 5. Decoupling (decision 27)
`src/lib/mcp` imports only itself, `src/lib/geo-audit` and the data layer (`src/lib/supabase`). A test enforces this. The route under `src/app` is a thin adapter. MCP can then move to its own deployment or product without touching the dashboard.

Rendering of JavaScript pages stays off for MCP until decision 6/18 is made: raw HTML only, with the JS-only finding reported as a finding.

## 6. Remaining build
1. Migration: `api_keys`, `api_calls` (SQL sent as plain text, decision 20). 2–3h.
2. Protected-resource metadata, token verification against Supabase, consent page. 6–10h.
3. MCP route on `mcp.bylineseo.com` (`@modelcontextprotocol/sdk`, Streamable HTTP) wiring the six tools through auth → entitlements → limits → engine → metering. Re-check DNS resolution in the fetch layer (DNS rebinding). 8–12h.
4. API key create/revoke in Settings. 3–4h.
5. Testing with claude.ai connectors, Claude Code and the MCP Inspector, plus a docs page. 3–5h.

## 7. Decisions (settled 2026-10-04)
M1 → 21 (OAuth target, keys as side path). M2 → 22. M3 → 23 (numbers above await confirmation). M4 → 24. M5 → 25. M6 → 26. M7 → 27.
