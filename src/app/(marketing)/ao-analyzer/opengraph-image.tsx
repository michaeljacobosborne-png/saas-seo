// Shared-link card for this page (src/lib/og/card.tsx).
import { renderCard } from '@/lib/og/card'

export const alt = "Free AO Analyzer from Byline"
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return renderCard({"kicker":"Free tool","title":"Free AO Analyzer: answer optimization score","descriptor":"How cleanly an engine can lift an answer from your page."})
}
