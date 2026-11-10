/**
 * The shared-link card for every public page (Open Graph and X).
 *
 * Michael's X post linking the GEO Analyzer showed a grey placeholder: the page
 * declared summary_large_image and emitted no image at all, and pages that set
 * their own openGraph replaced the root one wholesale, dropping its image (the
 * homepage, both analyzers and the content audit had none; the rest fell back
 * to an old dashboard screenshot). Each page segment now has a generated card
 * from this one template, so every page and every future blog post gets one
 * without anyone making a file.
 *
 * Plain on purpose: Byline's charcoal, amber and off-white, the wordmark, a
 * title and one line. No stock imagery. 1200x630, as X's summary_large_image
 * and Open Graph both expect.
 */
import { ImageResponse } from 'next/og'

export const OG_SIZE = { width: 1200, height: 630 }

const CHARCOAL = '#1C1917'
const AMBER = '#B87333'
const AMBER_LT = '#D4954A'
const OFF_WHITE = '#F7F3EC'
const MUTED = '#A89070'

/** Only the glyphs the card uses, from Google Fonts. Null on any failure: the bundled font is used instead. */
async function googleFont(family: string, weight: number, text: string): Promise<ArrayBuffer | null> {
  try {
    // No browser user agent: Google then serves TrueType, which the image
    // renderer reads. A modern browser UA gets WOFF2, which it cannot.
    const css = await (
      await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&text=${encodeURIComponent(text)}`)
    ).text()
    const src = /src: url\((.+?)\) format\('(?:opentype|truetype)'\)/.exec(css)?.[1]
    if (!src) return null
    const res = await fetch(src)
    return res.ok ? await res.arrayBuffer() : null
  } catch {
    return null
  }
}

export interface CardInput {
  /** Small label above the title, e.g. "Free tool" or "Blog". */
  kicker?: string
  title: string
  /** One plain line under the title. */
  descriptor?: string
}

export async function renderCard({ kicker, title, descriptor }: CardInput): Promise<ImageResponse> {
  const clean = (s: string) => s.replace(/\s*[—–]\s*/g, ': ').trim()
  const t = clean(title)
  const d = descriptor ? clean(descriptor) : ''
  const titleSize = t.length > 90 ? 50 : t.length > 60 ? 58 : 68

  const [serif, sans, sansBold] = await Promise.all([
    googleFont('Playfair Display', 700, 'Byline'),
    googleFont('DM Sans', 400, `${d} bylineseo.com ${kicker ?? ''}`),
    googleFont('DM Sans', 700, t),
  ])
  const fonts = [
    serif && { name: 'Playfair', data: serif, weight: 700 as const, style: 'normal' as const },
    sans && { name: 'DM Sans', data: sans, weight: 400 as const, style: 'normal' as const },
    sansBold && { name: 'DM Sans', data: sansBold, weight: 700 as const, style: 'normal' as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 400 | 700; style: 'normal' }[]

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: CHARCOAL,
          padding: '64px 72px',
          fontFamily: 'DM Sans',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: 'Playfair', fontSize: 48, fontWeight: 700, color: AMBER_LT }}>Byline</div>
          <div style={{ fontSize: 26, color: MUTED }}>bylineseo.com</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {kicker && (
            <div style={{ fontSize: 26, color: AMBER, textTransform: 'uppercase', letterSpacing: 3, marginBottom: 18 }}>{kicker}</div>
          )}
          <div style={{ fontSize: titleSize, fontWeight: 700, color: OFF_WHITE, lineHeight: 1.12 }}>{t}</div>
          {d && <div style={{ fontSize: 30, color: MUTED, marginTop: 24, lineHeight: 1.35 }}>{d}</div>}
        </div>
        <div style={{ width: 120, height: 8, background: AMBER, borderRadius: 4 }} />
      </div>
    ),
    { ...OG_SIZE, fonts: fonts.length ? fonts : undefined },
  )
}
