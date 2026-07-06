import { NextResponse, after } from 'next/server'
import { ghlUpsertContact, ghlAddToWorkflow, ghlUpdateCustomField, ghlSendEmail } from '@/lib/ghl'
import { createServiceClient } from '@/lib/supabase/service'
import { sendMetaCapiEvent } from '@/lib/meta-capi'

function extractDomain(rawUrl: string): string {
  const raw = (rawUrl ?? '').trim()
  if (!raw) return ''
  try {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    return new URL(withScheme).hostname.replace(/^www\./i, '')
  } catch {
    return raw
  }
}

function buildAuditEmailHtml(params: {
  email: string
  domain: string
  score: number
  grade: string
  resultsUrl: string
  topRecs: Array<{ title: string; description: string; priority: string }>
  quickWins: string[]
}): string {
  const { domain, score, grade, resultsUrl, topRecs, quickWins } = params
  const scoreColor = score >= 70 ? '#16a34a' : score >= 40 ? '#d97706' : '#dc2626'
  const gradeLabel = score >= 70 ? 'Good' : score >= 40 ? 'Needs Work' : 'Poor'

  const recsHtml = topRecs.slice(0, 3).map(r => `
    <tr>
      <td style="padding: 12px 16px; border-bottom: 1px solid #f0ece4;">
        <strong style="color: #1c1917; font-size: 14px;">${r.title}</strong>
        <p style="color: #57534e; font-size: 13px; margin: 4px 0 0;">${r.description}</p>
      </td>
    </tr>
  `).join('')

  const quickWinsHtml = quickWins.slice(0, 3).map(w => `
    <li style="color: #57534e; font-size: 13px; margin-bottom: 6px;">✓ ${w}</li>
  `).join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f7f3ec;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f3ec;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">

        <!-- Header -->
        <tr><td style="background:#1c1917;padding:28px 32px;">
          <h1 style="color:#B87333;font-family:Georgia,serif;font-size:22px;margin:0;">Byline</h1>
          <p style="color:#a8a29e;font-size:13px;margin:6px 0 0;">Your GEO Analysis Report</p>
        </td></tr>

        <!-- Score -->
        <tr><td style="padding:32px;border-bottom:1px solid #f0ece4;">
          <h2 style="color:#1c1917;font-size:20px;margin:0 0 16px;">Your GEO Score for <span style="color:#B87333;">${domain || 'your site'}</span></h2>
          <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
  <tr>
    <td style="padding-right:20px;vertical-align:middle;">
      <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <td width="84" height="84" style="width:84px;height:84px;border-radius:50%;border:4px solid ${scoreColor};text-align:center;vertical-align:middle;font-size:28px;font-weight:bold;color:${scoreColor};font-family:Arial,sans-serif;">
            ${score}
          </td>
        </tr>
      </table>
    </td>
    <td style="vertical-align:middle;">
      <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <td style="background:${scoreColor}22;border-radius:8px;padding:8px 16px;text-align:center;">
            <span style="font-size:24px;font-weight:bold;color:${scoreColor};font-family:Arial,sans-serif;">${grade}</span>
          </td>
        </tr>
        <tr>
          <td style="padding-top:6px;">
            <span style="color:#57534e;font-size:13px;font-family:Arial,sans-serif;">${gradeLabel} — out of 100</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
        </td></tr>

        <!-- Top recommendations -->
        ${topRecs.length > 0 ? `
        <tr><td style="padding:24px 32px 0;">
          <h3 style="color:#1c1917;font-size:16px;margin:0 0 12px;">Top Recommendations</h3>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #f0ece4;border-radius:8px;overflow:hidden;">
            ${recsHtml}
          </table>
        </td></tr>` : ''}

        <!-- Quick wins -->
        ${quickWins.length > 0 ? `
        <tr><td style="padding:24px 32px 0;">
          <h3 style="color:#1c1917;font-size:16px;margin:0 0 12px;">Quick Wins</h3>
          <ul style="margin:0;padding-left:0;list-style:none;">${quickWinsHtml}</ul>
        </td></tr>` : ''}

        <!-- CTA -->
        <tr><td style="padding:32px;text-align:center;border-top:1px solid #f0ece4;margin-top:24px;">
          <a href="${resultsUrl}" style="display:inline-block;background:#B87333;color:#ffffff;font-family:Georgia,serif;font-size:15px;font-weight:bold;padding:14px 28px;border-radius:8px;text-decoration:none;margin-bottom:16px;">
            View Your Full Report →
          </a>
          <p style="color:#a8a29e;font-size:12px;margin:16px 0 0;">
            Want to fix these issues automatically? <a href="https://bylineseo.com/pricing" style="color:#B87333;">Start with Byline</a> — AI content that scores well on both Google and AI engines.
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f7f3ec;padding:20px 32px;text-align:center;">
          <p style="color:#a8a29e;font-size:12px;margin:0;">© ${new Date().getFullYear()} Byline · <a href="https://bylineseo.com" style="color:#a8a29e;">bylineseo.com</a></p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export async function POST(request: Request) {
  let body: {
    email?: string
    url?: string
    gapCount?: number
    leadEventId?: string
    result?: {
      score: number
      grade: string
      breakdown: Array<{ name: string; score: number; maxScore: number; status: string; detail: string }>
      recommendations: Array<{ priority: string; title: string; description: string; impact: string }>
      quickWins: string[]
    }
    source?: string
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const email = (body.email ?? '').trim()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
  }

  const domain = extractDomain(body.url ?? '')
  const source = body.source ?? 'geo_analyzer'

  console.log(`[audit-lead] email=${email} url=${(body.url ?? '').trim()} gaps=${body.gapCount ?? 0}`)

  // Save audit result and get UUID (if result provided)
  let resultId: string | null = null
  if (body.result) {
    try {
      const supabase = createServiceClient()
      const { data, error } = await supabase
        .from('audit_results')
        .insert({
          email,
          domain: domain || null,
          result: body.result,
          source,
        })
        .select('id')
        .single()
      if (!error && data) {
        resultId = data.id as string
        console.log(`[audit-lead] saved result ${resultId} for ${email}`)
      } else if (error) {
        console.error('[audit-lead] failed to save result:', error)
      }
    } catch (err) {
      console.error('[audit-lead] save result unexpected error:', err)
    }
  }

  after(async () => {
    const contactId = await ghlUpsertContact({ email, tags: ['audit_lead', 'byline_lead', `source_${source ?? 'unknown'}`] })
    if (!contactId) return

    const workflowId = process.env.GHL_WORKFLOW_AUDIT_NURTURE_ID
    if (workflowId) await ghlAddToWorkflow(contactId, workflowId)
    if (domain) await ghlUpdateCustomField(contactId, 'audit_domain', domain)

    // Send results email if we have a result; otherwise send a simple welcome email
    if (resultId && body.result) {
      const resultsUrl = `https://bylineseo.com/audit/results/${resultId}`
      const html = buildAuditEmailHtml({
        email,
        domain,
        score: body.result.score,
        grade: body.result.grade,
        resultsUrl,
        topRecs: body.result.recommendations ?? [],
        quickWins: body.result.quickWins ?? [],
      })
      await ghlSendEmail({
        contactId,
        toEmail: email,
        subject: `Your GEO Analysis for ${domain || 'your site'} — Score: ${body.result.score}/100`,
        html,
        fromEmail: 'michael@lc.bylineseo.com',
      })
    } else {
      // No audit result (e.g. AO Analyzer lead) — send a simple nurture welcome email
      const welcomeHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f7f3ec;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f3ec;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
        <tr><td style="background:#1c1917;padding:28px 32px;">
          <h1 style="color:#B87333;font-family:Georgia,serif;font-size:22px;margin:0;">Byline</h1>
          <p style="color:#a8a29e;font-size:13px;margin:6px 0 0;">AI-powered content that ranks</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <h2 style="color:#1c1917;font-size:20px;margin:0 0 16px;">Your Byline analysis is ready</h2>
          <p style="color:#57534e;font-size:14px;line-height:1.6;margin:0 0 16px;">Thanks for signing up — here's what Byline can do for your content.</p>
          <p style="color:#57534e;font-size:14px;line-height:1.6;margin:0 0 16px;">Byline generates long-form articles optimised for both traditional search and AI engines like ChatGPT, Gemini, and Perplexity — so your content gets cited, not just ranked.</p>
          <ul style="color:#57534e;font-size:14px;line-height:1.6;padding-left:20px;margin:0 0 24px;">
            <li style="margin-bottom:8px;">GEO scoring on every article before it publishes</li>
            <li style="margin-bottom:8px;">Keyword research built into the brief</li>
            <li style="margin-bottom:8px;">One-click publishing to your CMS</li>
          </ul>
          <a href="https://bylineseo.com/pricing" style="display:inline-block;background:#B87333;color:#ffffff;font-family:Georgia,serif;font-size:15px;font-weight:bold;padding:14px 28px;border-radius:8px;text-decoration:none;">
            See plans →
          </a>
        </td></tr>
        <tr><td style="background:#f7f3ec;padding:20px 32px;text-align:center;">
          <p style="color:#a8a29e;font-size:12px;margin:0;">© ${new Date().getFullYear()} Byline · <a href="https://bylineseo.com" style="color:#a8a29e;">bylineseo.com</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
      await ghlSendEmail({
        contactId,
        toEmail: email,
        subject: 'Your Byline analysis is ready',
        html: welcomeHtml,
        fromEmail: 'michael@lc.bylineseo.com',
      })
    }
  })

  void sendMetaCapiEvent({
    eventName: 'Lead',
    eventId: body.leadEventId ?? `audit_lead_fallback_${Date.now()}`,
    email: email,
    eventSourceUrl: 'https://app.bylineseo.com/audit',
  })

  return NextResponse.json({ ok: true, resultId })
}
