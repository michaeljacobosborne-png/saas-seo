/**
 * The two-score section, shared by every server-rendered report page.
 *
 * This exists because it was originally written inline in /report/[token] and
 * simply never added to /audit/results/[id] — which is the page the results
 * email links to, so the lead most likely to need the Gap was the one who
 * could not see it. One component, used by both, so they cannot drift again.
 *
 * Styling is self-contained inline styles rather than utility classes, because
 * the two host pages use different idioms and this has to look identical in
 * both. It is a server component: no hooks, no client bundle.
 *
 * Renders nothing at all when the report predates Phase B, which is what keeps
 * historical reports rendering exactly as they always did.
 */

export type Band = 'strong' | 'adequate' | 'weak' | 'absent' | 'unverified'

export interface TwoScoreData {
  retrievability?: {
    score: number
    grade?: string
    scoreWithheld: boolean
    withheldReason?: string
    groups?: {
      id: string
      name: string
      score: number
      maxScore: number
      deduction: number
      scored: boolean
      label: string
    }[]
  }
  citability?: {
    band: Band
    label: string
    signals?: { id: string; name: string; band: Band; detail: string }[]
  }
  gap?: { quadrant: string; headline: string; diagnosis: string; nextStep: string }
}

const BAND_COLOR: Record<Band, string> = {
  strong: '#16a34a',
  adequate: '#B87333',
  weak: '#d97706',
  absent: '#dc2626',
  unverified: '#998876',
}

const BAND_ORDER: Band[] = ['absent', 'weak', 'adequate', 'strong']

const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #E7E0D6',
  borderRadius: 12,
  padding: 16,
}

const kicker: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: '#998876',
  margin: '0 0 8px',
}

export function TwoScoreSection({ result }: { result: TwoScoreData }) {
  const { retrievability: r, citability: c, gap } = result
  // Pre-Phase-B report: render nothing and let the host page's legacy layout stand.
  if (!r || !c || !gap) return null

  const rColor = r.scoreWithheld ? '#998876' : r.score >= 70 ? '#16a34a' : r.score >= 40 ? '#d97706' : '#dc2626'
  const filled = BAND_ORDER.indexOf(c.band) + 1

  return (
    <section style={{ marginBottom: 32 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 16 }}>
        {/* Retrievability — rule-derived, so it gets a number. */}
        <div style={card}>
          <p style={kicker}>Retrievable</p>
          <p style={{ fontSize: 30, fontWeight: 700, margin: 0, color: rColor, lineHeight: 1.1 }}>
            {r.scoreWithheld ? '—' : r.score}
            {!r.scoreWithheld && <span style={{ fontSize: 15, fontWeight: 400, color: '#998876' }}>/100</span>}
          </p>
          {!r.scoreWithheld && (
            <div style={{ height: 8, background: '#F7F3EC', borderRadius: 4, overflow: 'hidden', margin: '8px 0' }}>
              <div style={{ height: '100%', width: `${r.score}%`, background: rColor, borderRadius: 4 }} />
            </div>
          )}
          <p style={{ fontSize: 12, color: '#57534E', margin: '6px 0 0', lineHeight: 1.5 }}>
            {r.scoreWithheld
              ? (r.withheldReason ?? 'Not enough could be read to score it.')
              : 'Can an engine reach, parse and lift a clean answer from this page.'}
          </p>
        </div>

        {/* Citability — heuristic, so it gets a band, never a number. */}
        <div style={card}>
          <p style={kicker}>Citable</p>
          <p style={{ fontSize: 30, fontWeight: 700, margin: 0, color: BAND_COLOR[c.band] ?? '#998876', lineHeight: 1.1 }}>
            {c.label}
          </p>
          <div style={{ display: 'flex', gap: 4, margin: '10px 0 0' }}>
            {BAND_ORDER.map((_, i) => (
              <div
                key={i}
                style={{
                  height: 8,
                  flex: 1,
                  borderRadius: 4,
                  background: c.band !== 'unverified' && i < filled ? BAND_COLOR[c.band] : '#F7F3EC',
                }}
              />
            ))}
          </div>
          <p style={{ fontSize: 12, color: '#57534E', margin: '8px 0 0', lineHeight: 1.5 }}>
            If an engine lifts this content, does anything in it force attribution back to you.
          </p>
        </div>
      </div>

      {/* The Gap — the diagnosis, and the reason the two numbers are separate. */}
      <div style={{ background: '#1C1917', borderRadius: 12, padding: 20, color: '#F7F3EC' }}>
        <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.16em', color: '#A89070', margin: '0 0 8px' }}>
          The gap
        </p>
        <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 8px', lineHeight: 1.3 }}>{gap.headline}</h3>
        <p style={{ fontSize: 14, color: '#D8CFC2', lineHeight: 1.6, margin: '0 0 10px' }}>{gap.diagnosis}</p>
        <p style={{ fontSize: 14, margin: 0, lineHeight: 1.6 }}>
          <strong>Where to start: </strong>
          {gap.nextStep}
        </p>
      </div>

      {/* Retrievability groups, with points lost shown inline. */}
      {r.groups && r.groups.length > 0 && (
        <div style={{ ...card, padding: '16px 20px', marginTop: 16 }}>
          <h3 style={{ ...kicker, fontSize: 12, margin: '0 0 12px' }}>Retrievability</h3>
          {r.groups.map((g) => (
            <div key={g.id} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: '#1C1917' }}>{g.name}</span>
                <span style={{ fontSize: 12, color: '#998876', flexShrink: 0 }}>
                  {g.scored ? (
                    <>
                      {g.deduction > 0 && <span style={{ color: '#9A6228', fontWeight: 600 }}>−{g.deduction} </span>}
                      {g.score}/{g.maxScore}
                    </>
                  ) : (
                    '—'
                  )}
                </span>
              </div>
              <div style={{ height: 5, background: '#F7F3EC', borderRadius: 3, overflow: 'hidden' }}>
                {g.scored && (
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.round((g.score / g.maxScore) * 100)}%`,
                      background: g.score / g.maxScore >= 0.8 ? '#16a34a' : g.score / g.maxScore >= 0.4 ? '#d97706' : '#dc2626',
                      borderRadius: 3,
                    }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* The six attribution signals. */}
      {c.signals && c.signals.length > 0 && (
        <div style={{ ...card, padding: '16px 20px', marginTop: 16 }}>
          <h3 style={{ ...kicker, fontSize: 12, margin: '0 0 12px' }}>Attribution signals</h3>
          {c.signals.map((s, i) => (
            <div
              key={s.id}
              style={{
                padding: '8px 0',
                borderBottom: i < c.signals!.length - 1 ? '1px solid #F7F3EC' : 'none',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontSize: 13, color: '#1C1917' }}>{s.name}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: BAND_COLOR[s.band] ?? '#998876', flexShrink: 0 }}>
                  {s.band}
                </span>
              </div>
              {s.detail && (
                <p style={{ fontSize: 12, color: '#57534E', margin: '4px 0 0', lineHeight: 1.5 }}>{s.detail}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
