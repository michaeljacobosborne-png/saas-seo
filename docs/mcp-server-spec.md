# Byline MCP server: specification

Status: SPEC, 2026-10-03. Decision 4 (docs/DECISIONS.md) says build it. Nothing is built yet except where noted under "Settled, can start".
Audience (decisions 3–4): freelance and in-house SEOs who keep their own Claude workflow and pay Byline for the data layer underneath it.

## 1. What it is

A remote MCP server at `https://app.bylineseo.com/api/mcp`, Streamable HTTP transport, served by the existing Next.js app on Vercel. It is a thin protocol layer over `src/lib/geo-audit`: the engine is already decoupled from fetching and from routes (`runAudit`, `probeCrawlerAccess`, `buildDraftReport` are plain functions). No scoring logic lives in the MCP layer.

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
| `score_draft` (proposed; decision M4) | `markdown` or `html`, `title?`, `brand_name?`, `author?` | `buildDraftReport()`: the 45-of-100 draft score, judged-now and judged-at-publication. Lets users score what they write in Claude before publishing. | CPU only |

Output shape: each tool returns `structuredContent` (the full JSON, same types as the engine) plus a short text summary for the model to read. That summary carries the scores, the top three findings with evidence, and the scope line. No prose recommendations are generated for MCP calls beyond what `runAudit` already produces.

Comparability: add `engineVersion` to every new report (`AuditReport.engineVersion`, starting "2026.10"). `compare_audits` refuses to diff scores across a version boundary and reports "not comparable: engine changed" rather than a misleading delta. Rows written before the version field are treated as `legacy`.

## 3. Authentication

### Options
**A. Personal API keys.**
- The user creates a key in Settings → API keys. Shown once; stored as SHA-256 hash plus prefix in a new `api_keys` table: `id, user_id, name, prefix, key_hash, created_at, last_used_at, revoked_at`.
- Sent as `Authorization: Bearer byl_live_…`.
- Works today with Claude Code (`claude mcp add --transport http byline https://app.bylineseo.com/api/mcp --header "Authorization: Bearer …"`) and any client that sends custom headers.
- Does not work as a claude.ai custom connector.

**B. OAuth 2.1 (the MCP authorization spec).**
- Required for claude.ai custom connectors (web, desktop and mobile), which is where users of "a well-structured Claude Project" live.
- Needs authorization-server metadata, dynamic client registration, the auth-code + PKCE flow against the existing Supabase login, and a consent screen.
- Supabase's own OAuth server support has to be verified at build time. If it is not usable, we implement a minimal authorization server.

### Recommendation
Build the tool layer behind an auth interface that resolves any request to `{ userId, keyId?, plan }`.
- Ship **A first** (2–3 days to a usable beta with Claude Code users).
- Ship **B before marketing the MCP to the target audience**. The agency head who triggered decision 4 works in a Claude Project, i.e. claude.ai, where only OAuth connectors work. API keys alone would miss the people the decision is about.

Never: shared secrets in URLs, IP allowlists, or any unauthenticated tool other than nothing.

## 4. Entitlement, metering, rate limits

- **Entitlement.** Resolved per request from `subscriptions` (active or trialing) and `profiles.account_type`, the same sources the dashboard uses. Free accounts get what decision M2 allows.
- **Metering.** Every call writes a row to a new `api_calls` table: `id, user_id, key_id, tool, target_domain, status, ms, created_at`. Model cost is still logged to `usage_events` (feature `mcp_run_audit`) so `/admin` cost tracking keeps working.
- **Monthly quota.** Counted from `api_calls` per user per calendar month, per tool class:
  - "audit" = `run_audit`
  - "probe" = `check_crawler_access`
  - "read" = get/list/compare/score_draft, unmetered except by the rate limit
- **Rate limit.** Per key: 10 calls/minute and 2 concurrent `run_audit`s.
- **Rate limit per target domain.** At most 6 probe-or-audit calls per target domain per 10 minutes per user. `check_crawler_access` sends one request per AI-crawler user-agent, so without this cap the MCP becomes a way to hammer third-party sites with crawler UAs.
- **Errors.** 429 carries `retry_after` and the remaining quota. Quota exhaustion returns a clear tool error, never a partial result presented as complete.
- **Owner exemption** follows decision 11: the authenticated owner account only.

Proposed quotas (decision M3; the model cost is about $0.001/audit, so these are abuse limits, not cost limits):

| Plan | run_audit / month | check_crawler_access / month | score_draft, reads |
|---|---|---|---|
| Free | 0 (or 3/day, matching the free tool) | 10 | score_draft 20/month |
| Starter | 100 | 300 | unmetered (rate-limited) |
| Growth | 400 | 1,200 | unmetered |
| Multi-Brand | 1,200 | 3,600 | unmetered |

## 5. Free vs paid (proposal; decision M2)
- **Free:** `check_crawler_access`, `score_draft`, and `get_audit` by share token. These show the framework and the evidence model at near-zero cost.
- **Paid:** `run_audit`, `list_audits`, `compare_audits`. Saved history and comparison over time are the longitudinal data layer decision 8 says nobody else has. That is the thing worth paying for.
- **Rendering** (JavaScript pages) stays off for MCP until decision 6/18 is made; raw HTML only, with the JS-only finding reported as a finding.

## 6. Build plan and estimate (API keys first)
1. Engine: `engineVersion` stamp; `compareAudits()` pure function plus tests. 4–6h.
2. `api_keys` and `api_calls` tables (migration; SQL sent as plain text per decision 20); key create/revoke UI in Settings. 6–9h.
3. MCP route (`@modelcontextprotocol/sdk` Streamable HTTP, not yet a dependency) with the six tools, auth resolver, entitlement, quota and rate limits. 8–12h.
4. Testing in Claude Code and the MCP Inspector, plus a docs page. 3–5h.
5. OAuth 2.1 for claude.ai connectors. +10–16h.

Total: 21–32h with API keys only; 31–48h including OAuth.

## 7. Decisions needed from Michael (waiting for Sunday)
- **M1. Auth at launch:** API keys first and OAuth before marketing it (recommended), or hold the launch until OAuth is ready so claude.ai users are served from day one?
- **M2. Free vs paid:** accept section 5 (crawler check, score_draft and shared reads free; audits, history and compare paid)?
- **M3. Quotas:** accept the section 4 table, or set others?
- **M4. Include `score_draft`?** Recommended yes: it is the bridge for people writing in Claude.
- **M5. Endpoint:** `app.bylineseo.com/api/mcp` (now) or `mcp.bylineseo.com` (needs DNS)? This ties into the open bylineseo.com vs app domain decision.
- **M6. MCP-created audits:** keep them out of lead/GHL flows (recommended), and include them in the benchmark promoted columns (recommended yes, same as dashboard saves)?
- **M7. Positioning:** an MCP feature of existing plans, or a separate "data layer" plan for people who never use the editor?

## 8. Settled, can start without decisions
- `engineVersion` on reports.
- `compareAudits()` with tests.
- The auth-resolver interface, so both key types fit later.
- The tool input/output schemas (zod is already a dependency).
- The domain-level rate limiter for probes.
