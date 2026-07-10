import { NextResponse, after } from 'next/server'
import { ghlUpsertContact, ghlAddToWorkflow, ghlUpdateCustomField, ghlSendEmail } from '@/lib/ghl'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { sendMetaCapiEvent } from '@/lib/meta-capi'
import { sendRedditCapiEvent } from '@/lib/reddit-capi'

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

type GeoAuditResult = {
  score: number
  grade: string
  breakdown: Array<{ name: string; score: number; maxScore: number; status: string; detail: string }>
  recommendations: Array<{ priority: string; title: string; description: string; impact: string }>
  quickWins: string[]
}

type ContentAuditResult = {
  gaps: Array<{ title: string; description: string; priority: 'high' | 'medium' | 'low'; suggestedKeyword: string }>
  topicClusters: unknown[]
  quickWins: string[]
  pageCount: number
}

export async function POST(request: Request) {
  let body: {
    email?: string
    url?: string
    gapCount?: number
    leadEventId?: string
    result?: GeoAuditResult | ContentAuditResult
    source?: string
    conversionId?: string
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

  // Try to get logged-in user (optional — may be null for anonymous audit visitors)
  let userId: string | null = null
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.id) userId = user.id
  } catch {
    // Not critical — proceed without user_id
  }

  // Save audit result and get UUID + share_token (if result provided)
  let resultId: string | null = null
  let shareToken: string | null = null
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
          url: (body.url ?? '').trim() || null,
          user_id: userId,
        })
        .select('id, share_token')
        .single()
      if (!error && data) {
        resultId = data.id as string
        shareToken = data.share_token as string
        console.log(`[audit-lead] saved result ${resultId} share_token=${shareToken} for ${email}`)
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

    // Send results email if we have a GEO audit result (has score + grade); otherwise send welcome email
    const geoResult = (body.result && 'score' in body.result) ? body.result as GeoAuditResult : null

    // Route to source-specific workflow
    const workflowId =
      source === 'geo_analyzer' ? process.env.GHL_WORKFLOW_GEO_NURTURE_ID :
      source === 'ao_analyzer'  ? process.env.GHL_WORKFLOW_AO_NURTURE_ID  :
      process.env.GHL_WORKFLOW_AUDIT_NURTURE_ID

    if (workflowId) await ghlAddToWorkflow(contactId, workflowId)

    // Reddit CAPI — Lead event (server-side, deduplicates with browser pixel)
    await sendRedditCapiEvent({
      trackingType: 'Lead',
      email,
      externalId: userId ?? undefined,
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? request.headers.get('x-real-ip') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
      conversionId: body.conversionId,
    })

    // Update custom fields
    if (domain) await ghlUpdateCustomField(contactId, 'audit_domain', domain)
    if (source === 'geo_analyzer' && geoResult) {
      await ghlUpdateCustomField(contactId, 'geo_score', String(geoResult.score))
      await ghlUpdateCustomField(contactId, 'geo_grade', geoResult.grade)
    }
    if (resultId && geoResult) {
      const resultsUrl = `https://bylineseo.com/audit/results/${resultId}`
      const html = buildAuditEmailHtml({
        email,
        domain,
        score: geoResult.score,
        grade: geoResult.grade,
        resultsUrl,
        topRecs: geoResult.recommendations ?? [],
        quickWins: geoResult.quickWins ?? [],
      })
      await ghlSendEmail({
        contactId,
        toEmail: email,
        subject: `Your GEO Analysis for ${domain || 'your site'} — Score: ${geoResult.score}/100`,
        html,
        fromEmail: 'michael@lc.bylineseo.com',
      })
    } else {
      // Either content audit result (has gaps) or AO analyzer lead (no result data)
      const contentResult = (body.result && 'gaps' in body.result) ? body.result as ContentAuditResult : null

      if (resultId && contentResult) {
        // Content audit email — branded, shows top gaps + quick wins
        const topGaps = (contentResult.gaps ?? []).slice(0, 3)
        const quickWins = (contentResult.quickWins ?? []).slice(0, 3)
        const gapCount = contentResult.gaps?.length ?? 0
        const pageCount = contentResult.pageCount ?? 0

        const gapsHtml = topGaps.map(g => `
          <tr>
            <td style="padding:12px 16px;border-bottom:1px solid #f0ece4;">
              <div style="display:inline-block;background:${g.priority === 'high' ? '#fee2e2' : g.priority === 'medium' ? '#fef3c7' : '#dcfce7'};color:${g.priority === 'high' ? '#dc2626' : g.priority === 'medium' ? '#d97706' : '#16a34a'};font-size:11px;font-weight:bold;padding:2px 8px;border-radius:4px;text-transform:uppercase;font-family:Arial,sans-serif;">${g.priority}</div>
              <strong style="display:block;color:#1c1917;font-size:14px;margin:6px 0 4px;">${g.title}</strong>
              <p style="color:#57534e;font-size:13px;margin:0 0 4px;">${g.description}</p>
              ${g.suggestedKeyword ? `<span style="color:#B87333;font-size:12px;font-style:italic;">Keyword: ${g.suggestedKeyword}</span>` : ''}
            </td>
          </tr>
        `).join('')

        const winsHtml = quickWins.map(w => `
          <li style="color:#57534e;font-size:13px;margin-bottom:6px;">✓ ${w}</li>
        `).join('')

        const contentAuditHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f7f3ec;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f3ec;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
        <tr><td style="background:#1c1917;padding:28px 32px;">
          <h1 style="color:#B87333;font-family:Georgia,serif;font-size:22px;margin:0;">Byline</h1>
          <p style="color:#a8a29e;font-size:13px;margin:6px 0 0;">Your Content Gap Analysis</p>
        </td></tr>
        <tr><td style="padding:32px;border-bottom:1px solid #f0ece4;">
          <h2 style="color:#1c1917;font-size:20px;margin:0 0 8px;">Content gaps found for <span style="color:#B87333;">${domain || 'your site'}</span></h2>
          <p style="color:#57534e;font-size:14px;margin:0;">We scanned ${pageCount > 0 ? `${pageCount} pages` : 'your site'} and found <strong style="color:#1c1917;">${gapCount} content gap${gapCount !== 1 ? 's' : ''}</strong> where competitors are ranking and you're not.</p>
        </td></tr>
        ${topGaps.length > 0 ? `
        <tr><td style="padding:24px 32px 0;">
          <h3 style="color:#1c1917;font-size:16px;margin:0 0 12px;">Top Gaps to Close</h3>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #f0ece4;border-radius:8px;overflow:hidden;">
            ${gapsHtml}
          </table>
        </td></tr>` : ''}
        ${quickWins.length > 0 ? `
        <tr><td style="padding:24px 32px 0;">
          <h3 style="color:#1c1917;font-size:16px;margin:0 0 12px;">Quick Wins</h3>
          <ul style="margin:0;padding-left:0;list-style:none;">${winsHtml}</ul>
        </td></tr>` : ''}
        <tr><td style="padding:32px;text-align:center;border-top:1px solid #f0ece4;margin-top:24px;">
          <a href="https://bylineseo.com/audit/results/${resultId}" style="display:inline-block;background:#B87333;color:#ffffff;font-family:Georgia,serif;font-size:15px;font-weight:bold;padding:14px 28px;border-radius:8px;text-decoration:none;margin-bottom:16px;">
            View Your Full Gap Report →
          </a>
          <p style="color:#a8a29e;font-size:12px;margin:16px 0 0;">
            Want Byline to write articles that close these gaps automatically? <a href="https://bylineseo.com/pricing" style="color:#B87333;">Start free</a>
          </p>
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
          subject: `Your content gap report for ${domain || 'your site'} — ${gapCount} gaps found`,
          html: contentAuditHtml,
          fromEmail: 'michael@lc.bylineseo.com',
        })
      } else {
        // AO Analyzer or other lead — branded welcome email
        const isAo = source === 'ao_analyzer'
        const welcomeHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f7f3ec;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f3ec;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
        <tr><td style="background:#1c1917;padding:28px 32px;">
          <h1 style="color:#B87333;font-family:Georgia,serif;font-size:22px;margin:0;">Byline</h1>
          <p style="color:#a8a29e;font-size:13px;margin:6px 0 0;">${isAo ? 'Your AI Optimization Analysis' : 'AI-powered content that ranks'}</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <h2 style="color:#1c1917;font-size:20px;margin:0 0 16px;">${isAo ? `Your AO Analysis for ${domain || 'your site'}` : 'Your Byline analysis is ready'}</h2>
          ${isAo ? `
          <p style="color:#57534e;font-size:14px;line-height:1.6;margin:0 0 16px;">We analyzed <strong style="color:#1c1917;">${domain || 'your site'}</strong> for AI engine visibility — how often ChatGPT, Gemini, and Perplexity cite your content vs. competitors.</p>
          <p style="color:#57534e;font-size:14px;line-height:1.6;margin:0 0 24px;">Byline's AO scoring is built into every article it generates, so your content is optimised to get cited — not just ranked.</p>
          ` : `
          <p style="color:#57534e;font-size:14px;line-height:1.6;margin:0 0 16px;">Thanks for trying Byline. We generate long-form articles optimised for traditional search <em>and</em> AI engines like ChatGPT, Gemini, and Perplexity — so your content gets cited, not just ranked.</p>
          `}
          <ul style="color:#57534e;font-size:14px;line-height:1.6;padding-left:20px;margin:0 0 24px;">
            <li style="margin-bottom:8px;">GEO + AO scoring on every article before it publishes</li>
            <li style="margin-bottom:8px;">Keyword research built into the brief</li>
            <li style="margin-bottom:8px;">One-click publishing to your CMS</li>
          </ul>
          <a href="https://bylineseo.com/pricing" style="display:inline-block;background:#B87333;color:#ffffff;font-family:Georgia,serif;font-size:15px;font-weight:bold;padding:14px 28px;border-radius:8px;text-decoration:none;">
            ${isAo ? 'Start optimizing for AI →' : 'See plans →'}
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
          subject: isAo
            ? `Your AO Analysis for ${domain || 'your site'} — AI visibility insights`
            : 'Welcome to Byline — your AI content platform',
          html: welcomeHtml,
          fromEmail: 'michael@lc.bylineseo.com',
        })
      }
    }
  })

  return NextResponse.json({ ok: true, resultId, shareToken })
}