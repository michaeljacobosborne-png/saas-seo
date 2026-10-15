import Link from 'next/link'

/**
 * Context for someone who receives a report with no idea what Byline is. The
 * shared report (/report/[token]) and the emailed results page
 * (/audit/results/[id]) are what a prospect lands on from outreach, so they
 * must explain themselves: who made this, what it measures, what it does not,
 * and how to check a finding without taking our word for it.
 *
 * Every statement here is true of the engine (src/lib/geo-audit): the rubric
 * weights, the dash for unassessable checks, the model writing prose only.
 */

const playfair: React.CSSProperties = { fontFamily: 'var(--font-playfair, "Playfair Display", serif)' }
const h2: React.CSSProperties = { ...playfair, fontSize: 20, fontWeight: 700, color: '#1C1917', margin: '0 0 10px' }
const p: React.CSSProperties = { fontSize: 15, color: '#57534E', lineHeight: 1.65, margin: 0 }

export function ReportPreface({
  domain,
  date,
  engineVersion,
}: {
  domain: string
  date: string
  engineVersion?: string | null
}) {
  return (
    <p style={{ ...p, marginBottom: 24 }}>
      This is an AI search readiness report on {domain}, produced by Byline on {date}
      {engineVersion ? ` with scoring engine ${engineVersion}` : ''}. It checks whether the page can be
      retrieved by AI search and whether a quoted passage would be credited to {domain}. It does not
      measure whether any AI system currently cites the site.
    </p>
  )
}

export const REPORT_GUIDE = [
  {
    q: 'How should I read this report?',
    a: 'Retrievable is a score out of 100 for whether an engine can reach the page, parse it and lift a clean passage out of it, in four groups: Access 30, Parseability 25, Chunkability 25 and Extractability 20. Citable is a band, from Strong to Absent, built from six attribution signals. A dash means a check could not be assessed from the pages read; it is left out of the total rather than counted as zero.',
  },
  {
    q: 'How can I check a finding myself?',
    a: 'Each finding shows the evidence it was scored from, such as the heading text as found or the line in robots.txt that decided a crawler’s access. Open the page, view its source, and search for the quoted text. If you cannot reproduce a finding, email hi@bylineseo.com and we will look at it.',
  },
  {
    q: 'What does this report not tell you?',
    a: 'It does not tell you whether ChatGPT, Gemini, Perplexity or Google’s AI features cite the site, or how often. Nobody outside those companies can measure that from a page’s HTML. A higher score means fewer structural obstacles; it is not a forecast of citations, rankings or traffic. The recommendations are written by a language model from the scored findings, but the scores themselves are set in code.',
  },
  {
    q: 'Who made this report?',
    a: 'Byline is an AI search readiness tool built by Michael Jacobs. The full scoring rubric, with the points for every check, is published on the GEO Analyzer page.',
  },
] as const

export function ReportGuide() {
  return (
    <section style={{ margin: '8px 0 48px' }}>
      {REPORT_GUIDE.map((item) => (
        <div key={item.q} style={{ background: '#fff', border: '1px solid #E7E0D6', borderRadius: 16, padding: '20px 24px', marginBottom: 12 }}>
          <h2 style={h2}>{item.q}</h2>
          <p style={p}>
            {item.a}
            {item.q === 'Who made this report?' && (
              <>
                {' '}
                <Link href="/geo-analyzer" style={{ color: '#B87333', textDecoration: 'underline' }}>
                  See the rubric
                </Link>
                .
              </>
            )}
          </p>
        </div>
      ))}
    </section>
  )
}
