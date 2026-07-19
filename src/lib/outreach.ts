// Outreach agent core engine.
//
// The "thin agent": deterministic control flow, with the LLM used only at the two
// genuine judgment points —
//   1. pickAudit()      — which of the 3 free audits best fits this prospect
//   2. generateCopy()   — a personalized email that references the real findings
//
// prepareProspect() orchestrates: fetch homepage → pick audit → run it → persist
// the result (so it gets a shareable /report link) → draft the email. It does NOT
// send. Sending is a separate, human-approved step (see /api/outreach/[id]/approve).

import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/service'
import {
  runScoreAudit,
  runContentAudit,
  normalizeUrl,
  type AuditKind,
  type ScoreAuditResult,
  type ContentAuditResult,
} from '@/lib/audits'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const COPY_MODEL = 'claude-haiku-4-5-20251001'
const PICK_MODEL = 'claude-haiku-4-5-20251001'

// Public base for report links. Overridable for preview deploys.
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://bylineseo.com').replace(/\/+$/, '')

const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

export interface PreparedDraft {
  chosenAudit: AuditKind
  auditReason: string
  auditResultId: string
  shareToken: string
  subject: string
  html: string
}

// ── Step 1: pick the best-fit audit ──────────────────────────────────────────

const PICK_SYSTEM = `You route a sales prospect to ONE of three free website audits Byline offers. Choose the audit that will produce the most compelling, relevant "aha" for THIS prospect based on their homepage.

The three audits:
- "content": Content Gap Audit. Crawls the site and finds missing topics/articles. Best for sites with a blog or many content pages, publishers, or anyone whose growth depends on organic content.
- "geo": GEO Score (Generative Engine Optimization). Scores how likely ChatGPT/Gemini/Perplexity are to cite the site. Best for modern SaaS, tech, or brands who care about being recommended by AI.
- "ao": Answer Optimization. Scores featured-snippet / direct-answer readiness. Best for service businesses, FAQ-driven or thin-content sites, local businesses.

Return ONLY JSON: { "audit": "content" | "geo" | "ao", "reason": string }. "reason" is one sentence a salesperson could act on.`

async function pickAudit(domain: string, homepageHtml: string): Promise<{ audit: AuditKind; reason: string }> {
  const snippet = homepageHtml.slice(0, 8000)
  const res = await anthropic.messages.create({
    model: PICK_MODEL,
    max_tokens: 300,
    system: PICK_SYSTEM,
    messages: [{ role: 'user', content: `Prospect domain: ${domain}\n\nHomepage HTML:\n${snippet}` }],
  })
  const block = res.content.find((b) => b.type === 'text')
  const text = block && block.type === 'text' ? block.text : ''
  const match = text.match(/\{[\s\S]*\}/)
  try {
    const obj = JSON.parse(match ? match[0] : text) as { audit?: string; reason?: string }
    const audit = obj.audit === 'geo' || obj.audit === 'ao' || obj.audit === 'content' ? obj.audit : 'geo'
    return { audit, reason: String(obj.reason ?? '').trim() || 'Best general fit.' }
  } catch {
    // Safe default: GEO is the broadest-appeal audit for a modern site.
    return { audit: 'geo', reason: 'Defaulted to GEO (classifier response unparseable).' }
  }
}

// ── Step 2: distill findings into a compact brief for the copywriter ──────────

function summarizeFindings(kind: AuditKind, result: ScoreAuditResult | ContentAuditResult): string {
  if (kind === 'content') {
    const r = result as ContentAuditResult
    const gaps = r.gaps.slice(0, 4).map((g) => `- [${g.priority}] ${g.title}: ${g.description}`).join('\n')
    return `Content Gap Audit — scanned ${r.pageCount} pages, found ${r.gaps.length} gaps.\nTop gaps:\n${gaps}\nQuick wins: ${r.quickWins.slice(0, 3).join('; ')}`
  }
  const r = result as ScoreAuditResult
  const weak = r.breakdown
    .filter((f) => f.status !== 'good')
    .slice(0, 3)
    .map((f) => `- ${f.name} (${f.score}/${f.maxScore}): ${f.detail}`)
    .join('\n')
  const label = kind === 'geo' ? 'GEO Score' : 'Answer Optimization (AO) Score'
  return `${label}: ${r.score}/100 (grade ${r.grade}).\nWeakest factors:\n${weak}\nQuick wins: ${r.quickWins.slice(0, 3).join('; ')}`
}

// ── Step 3: write the email ───────────────────────────────────────────────────

const COPY_SYSTEM = `You are a founder writing a short, warm, genuinely helpful cold outreach email on behalf of Byline (bylineseo.com) — an AI tool that generates publish-ready articles optimized for both Google and AI engines (ChatGPT, Gemini, Perplexity).

Rules:
- You just ran a FREE audit on the prospect's site. Lead with a specific, real finding from it — prove you actually looked. Never invent findings not in the brief.
- 90-140 words. Conversational, first-person, no corporate fluff, no "I hope this finds you well".
- One clear soft CTA: view their full report (a link is provided). Do NOT hard-sell the paid product in email #1.
- End with a single, natural question that invites a reply.
- Plain sentences. No emoji. No markdown headers.

Return ONLY JSON: { "subject": string, "body": string }.
- "subject": under 55 chars, specific to their finding, lowercase-casual is fine, no clickbait.
- "body": plain text, use "\\n\\n" between paragraphs. Use the token {{REPORT_URL}} exactly where the report link should go, and {{FIRST_NAME}} for the greeting name if useful.`

async function generateCopy(params: {
  domain: string
  contactName: string | null
  kind: AuditKind
  findings: string
}): Promise<{ subject: string; body: string }> {
  const res = await anthropic.messages.create({
    model: COPY_MODEL,
    max_tokens: 700,
    system: COPY_SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Prospect domain: ${params.domain}\nContact first name: ${params.contactName || '(unknown)'}\nAudit run: ${params.kind}\n\nAudit findings brief:\n${params.findings}`,
      },
    ],
  })
  const block = res.content.find((b) => b.type === 'text')
  const text = block && block.type === 'text' ? block.text : ''
  const match = text.match(/\{[\s\S]*\}/)
  try {
    const obj = JSON.parse(match ? match[0] : text) as { subject?: string; body?: string }
    return {
      subject: String(obj.subject ?? '').trim() || `A quick look at ${params.domain}`,
      body: String(obj.body ?? '').trim(),
    }
  } catch {
    throw new Error('copywriter returned unparseable JSON')
  }
}

// ── HTML wrapper (matches the branded audit emails; includes opt-out footer) ──

function firstName(contactName: string | null): string {
  const n = (contactName ?? '').trim().split(/\s+/)[0]
  return n || 'there'
}

function bodyToHtml(bodyText: string, reportUrl: string, contactName: string | null): string {
  const paragraphs = bodyText
    .replace(/\{\{REPORT_URL\}\}/g, reportUrl)
    .replace(/\{\{FIRST_NAME\}\}/g, firstName(contactName))
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    // Linkify the report URL if the model wrote it inline as bare text.
    .map((p) =>
      `<p style="margin:0 0 16px;color:#1c1917;font-size:15px;line-height:1.6;">${p
        .replace(
          reportUrl,
          `<a href="${reportUrl}" style="color:#B87333;font-weight:600;">${reportUrl}</a>`,
        )
        .replace(/\n/g, '<br>')}</p>`,
    )
    .join('\n')

  // CAN-SPAM / GDPR: a real one-click unsubscribe + physical address are legally
  // required for cold email. UNSUBSCRIBE_URL / MAILING_ADDRESS must be set before
  // any real send (the approve route enforces UNSUBSCRIBE_URL).
  const unsubscribeUrl = process.env.OUTREACH_UNSUBSCRIBE_URL || '#'
  const mailingAddress = process.env.OUTREACH_MAILING_ADDRESS || ''

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f7f3ec;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f3ec;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;max-width:560px;width:100%;">
        <tr><td style="padding:32px 32px 8px;">
          ${paragraphs}
          <div style="margin-top:24px;">
            <a href="${reportUrl}" style="display:inline-block;background:#B87333;color:#ffffff;font-size:14px;font-weight:bold;padding:12px 22px;border-radius:8px;text-decoration:none;">View your full report →</a>
          </div>
        </td></tr>
        <tr><td style="padding:24px 32px;border-top:1px solid #f0ece4;">
          <p style="color:#a8a29e;font-size:11px;line-height:1.6;margin:0;">
            You're receiving this because we ran a free SEO audit on your public website.
            ${mailingAddress ? `Byline · ${mailingAddress}<br>` : ''}
            <a href="${unsubscribeUrl}" style="color:#a8a29e;text-decoration:underline;">Unsubscribe</a> — one click, no reply needed.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

export async function prepareProspect(prospect: {
  email: string
  domain: string
  contact_name: string | null
}): Promise<PreparedDraft> {
  const url = normalizeUrl(prospect.domain)

  // Fetch homepage once, for the audit picker.
  let homepageHtml = ''
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12000), headers: BROWSER_HEADERS, redirect: 'follow' })
    if (res.ok) homepageHtml = (await res.text()).slice(0, 15000)
  } catch {
    /* picker will fall back to GEO */
  }

  // 1. Pick.
  const { audit, reason } = await pickAudit(prospect.domain, homepageHtml)

  // 2. Run the chosen audit.
  const result: ScoreAuditResult | ContentAuditResult =
    audit === 'content' ? await runContentAudit(url) : await runScoreAudit(url, audit)

  // 3. Persist to audit_results → yields the share_token that powers /report/<token>.
  const supabase = createServiceClient()
  const { data: saved, error } = await supabase
    .from('audit_results')
    .insert({
      email: prospect.email,
      domain: prospect.domain,
      result,
      source: `outreach_${audit}`,
      url,
      tool: audit,
    })
    .select('id, share_token')
    .single()
  if (error || !saved) throw new Error(`failed to save audit result: ${error?.message ?? 'unknown'}`)

  const shareToken = saved.share_token as string
  const reportUrl = `${SITE_URL}/report/${shareToken}`

  // 4. Draft the email.
  const findings = summarizeFindings(audit, result)
  const { subject, body } = await generateCopy({
    domain: prospect.domain,
    contactName: prospect.contact_name,
    kind: audit,
    findings,
  })
  const html = bodyToHtml(body, reportUrl, prospect.contact_name)

  return {
    chosenAudit: audit,
    auditReason: reason,
    auditResultId: saved.id as string,
    shareToken,
    subject,
    html,
  }
}
