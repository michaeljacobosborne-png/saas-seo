import { NextResponse, after } from 'next/server'
import { ghlUpsertContact, ghlAddToWorkflow, ghlUpdateCustomField, ghlSendEmail } from '@/lib/ghl'
import { createServiceClient } from '@/lib/supabase/service'

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
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-right:20px;">
                <div style="width:80px;height:80px;border-radius:50%;border:4px solid ${scoreColor};display:flex;align-items:center;justify-content:center;text-align:center;line-height:80px;">
                  <span style="font-size:28px;font-weight:bold;color:${scoreColor};">${score}</span>
                </div>
              </td>
              <td>
                <div style="display:inline-block;background:${scoreColor}22;color:${scoreColor};font-size:24px;font-weight:bold;padding:8px 16px;border-radius:8px;">${grade}</div>
                <p style="color:#57534e;font-size:13px;margin:6px 0 0;">${gradeLabel} — out of 100</p>
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
    const contactId = await ghlUpsertContact({ email, tags: ['audit_lead', 'byline_lead'] })
    if (!contactId) return

    const workflowId = process.env.GHL_WORKFLOW_AUDIT_NURTURE_ID
    if (workflowId) await ghlAddToWorkflow(contactId, workflowId)
    if (domain) await ghlUpdateCustomField(contactId, 'audit_domain', domain)

    // Send results email if we have a result
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
        fromEmail: 'michael@bylineseo.com',
      })
    }
  })

  return NextResponse.json({ ok: true, resultId })
}
